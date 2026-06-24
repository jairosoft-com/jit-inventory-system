import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { ReportService, ReportType } from '../services/report.service.js';
import { prisma } from '../lib/prisma.js';
import type { Cell } from 'exceljs';
const router = Router();

router.use(authenticate);
router.use(authorize('reports:export'));

const VALID_REPORT_TYPES: ReportType[] = [
  'inventory',
  'procurement',
  'borrowing',
  'maintenance',
  'disposal',
  'employee_equipment',
  'low_stock',
];

function isValidReportType(value: string): value is ReportType {
  return VALID_REPORT_TYPES.includes(value as ReportType);
}

function getReportTitle(type: ReportType): string {
  const titles: Record<ReportType, string> = {
    inventory: 'Inventory Summary Report',
    procurement: 'Procurement Report',
    borrowing: 'Borrowing Report',
    maintenance: 'Maintenance Report',
    disposal: 'Disposal Report',
    employee_equipment: 'Employee Equipment Report',
    low_stock: 'Low Stock Report',
  };
  return titles[type];
}

async function resolveGeneratedBy(userId: number | undefined): Promise<string> {
  if (!userId) return 'Unknown';
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });
    return user ? `${user.firstName} ${user.lastName}`.trim() : 'Unknown';
  } catch {
    return 'Unknown';
  }
}

function formatColumnHeader(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}

function flattenRow(row: Record<string, unknown>): Record<string, string | number> {
  const flat: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(row)) {
    if (Array.isArray(value)) continue;
    if (value === null || value === undefined) {
      flat[key] = '';
    } else if (typeof value === 'number') {
      flat[key] = value;
    } else if (typeof value === 'string' || typeof value === 'boolean') {
      // FIX 1: explicitly handle string/boolean before falling through to JSON.stringify
      // so we never call String() on an object (which would produce '[object Object]')
      flat[key] = String(value);
    } else {
      flat[key] = JSON.stringify(value);
    }
  }
  return flat;
}

// ── GET /api/reports/types ────────────────────────────────────────────────────
router.get('/types', (_req: Request, res: Response): void => {
  res.status(200).json({
    types: VALID_REPORT_TYPES.map((type) => ({
      value: type,
      label: getReportTitle(type),
    })),
  });
});

// ── GET /api/reports/preview?type=X ──────────────────────────────────────────
router.get('/preview', async (req: Request, res: Response): Promise<void> => {
  try {
    const { type } = req.query;
    if (!type || typeof type !== 'string' || !isValidReportType(type)) {
      res.status(400).json({ message: `Invalid report type. Must be one of: ${VALID_REPORT_TYPES.join(', ')}` });
      return;
    }

    const [data, generatedBy] = await Promise.all([
      ReportService.generateReport(type),
      resolveGeneratedBy(req.user?.id),
    ]);

    res.status(200).json({
      type,
      title: getReportTitle(type),
      generatedAt: new Date().toISOString(),
      generatedBy,
      count: Array.isArray(data) ? data.length : 0,
      data,
    });
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Internal server error' });
  }
});

// ── GET /api/reports/export/excel?type=X ─────────────────────────────────────
router.get('/export/excel', async (req: Request, res: Response): Promise<void> => {
  try {
    const { type } = req.query;
    if (!type || typeof type !== 'string' || !isValidReportType(type)) {
      res.status(400).json({ message: `Invalid report type. Must be one of: ${VALID_REPORT_TYPES.join(', ')}` });
      return;
    }

    const [{ default: ExcelJS }, [data, generatedBy]] = await Promise.all([
      import('exceljs'),
      Promise.all([
        ReportService.generateReport(type),
        resolveGeneratedBy(req.user?.id),
      ]),
    ]);

    const rows = (Array.isArray(data) ? data : []) as Record<string, unknown>[];
    const title = getReportTitle(type);
    const generatedAt = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'JIT IMS';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(title, {
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
    });

    if (rows.length === 0) {
      sheet.addRow([title]);
      sheet.addRow([`Generated: ${generatedAt}  |  By: ${generatedBy}`]);
      sheet.addRow([]);
      sheet.addRow(['No data available for this report.']);
      const filename = `${type}-report-${new Date().toISOString().split('T')[0]}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      await workbook.xlsx.write(res);
      res.end();
      return;
    }

    const flatRows = rows.map(flattenRow);
    const columns = Object.keys(flatRows[0]);
    const colCount = columns.length;
    const lastCol = sheet.getColumn(colCount).letter ?? String.fromCharCode(64 + colCount);

    // ── Compute natural column widths from actual content ──
    const colWidths = columns.map((col, _i) => {
      const header = formatColumnHeader(col);
      const maxDataLen = flatRows.reduce((max, r) => {
        const len = String(r[col] ?? '').length;
        return len > max ? len : max;
      }, 0);
      // Use the larger of header length or data length, add padding, no artificial cap
      return Math.max(header.length + 4, maxDataLen + 2, 10);
    });

    // ── Title block — merge across all columns ──
    const mergeEnd = colCount > 1 ? `${lastCol}1` : 'A1';
    try { sheet.mergeCells(`A1:${mergeEnd}`); } catch { /* single column */ }
    const titleCell = sheet.getCell('A1');
    titleCell.value = title;
    titleCell.font = { bold: true, size: 14, color: { argb: 'FF1E3A5F' } };
    titleCell.alignment = { horizontal: 'left', vertical: 'middle' };
    sheet.getRow(1).height = 28;

    const mergeEnd2 = colCount > 1 ? `${lastCol}2` : 'A2';
    try { sheet.mergeCells(`A2:${mergeEnd2}`); } catch { /* single column */ }
    const metaCell = sheet.getCell('A2');
    metaCell.value = `Generated: ${generatedAt}  |  By: ${generatedBy}  |  Records: ${rows.length}`;
    metaCell.font = { size: 9, color: { argb: 'FF6B7280' } };
    sheet.getRow(2).height = 18;

    sheet.addRow([]); // spacer

    // ── Header row ──
    const headerRow = sheet.addRow(columns.map(formatColumnHeader));
    headerRow.eachCell((cell: Cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
      cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: false };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FF2563EB' } } };
    });
    headerRow.height = 22;

    // ── Data rows ──
    flatRows.forEach((flatRow, idx) => {
      const values = columns.map((col) => {
        const v = flatRow[col];
        // Keep numbers as numbers so Excel can format them
        return typeof v === 'number' ? v : String(v ?? '');
      });
      const dataRow = sheet.addRow(values);
      const isEven = idx % 2 === 1;
      dataRow.eachCell((cell: Cell) => {
        cell.font = { size: 9 };
        cell.alignment = { vertical: 'middle', wrapText: false };
        if (isEven) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4FF' } };
        }
      });
      dataRow.height = 18;
    });

    // ── Apply computed column widths ──
    // FIX 2: rename unused `_col` parameter to `_` to satisfy no-unused-vars
    columns.forEach((_, i) => {
      sheet.getColumn(i + 1).width = colWidths[i];
    });

    // ── Freeze first 3 rows (title + meta + spacer) + header ──
    sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 4 }];

    // ── Auto filter on header row ──
    sheet.autoFilter = {
      from: { row: 4, column: 1 },
      to: { row: 4, column: colCount },
    };

    const filename = `${type}-report-${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ message: error instanceof Error ? error.message : 'Internal server error' });
    }
  }
});

// ── GET /api/reports/export/pdf?type=X ───────────────────────────────────────
router.get('/export/pdf', async (req: Request, res: Response): Promise<void> => {
  try {
    const { type } = req.query;
    if (!type || typeof type !== 'string' || !isValidReportType(type)) {
      res.status(400).json({ message: `Invalid report type. Must be one of: ${VALID_REPORT_TYPES.join(', ')}` });
      return;
    }

    const [{ default: PDFDocument }, [data, generatedBy]] = await Promise.all([
      import('pdfkit'),
      Promise.all([
        ReportService.generateReport(type),
        resolveGeneratedBy(req.user?.id),
      ]),
    ]);

    const rows = (Array.isArray(data) ? data : []) as Record<string, unknown>[];
    const title = getReportTitle(type);
    const generatedAt = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
    const filename = `${type}-report-${new Date().toISOString().split('T')[0]}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Use A3 landscape for more horizontal room
    const doc = new PDFDocument({
      margin: 30,
      size: 'A3',
      layout: 'landscape',
      info: { Title: title, Author: generatedBy, Creator: 'JIT IMS' },
    });

    doc.pipe(res);

    const MARGIN = 30;
    const PAGE_W = doc.page.width - MARGIN * 2;
    const PAGE_H = doc.page.height;
    const DARK_BLUE = '#1E3A5F';
    const ACCENT = '#2563EB';
    const LIGHT_BG = '#F0F4FF';
    const GREY = '#6B7280';
    const FONT_SIZE = 7.5;
    const HEADER_FONT_SIZE = 8;
    const HEADER_H = 20;
    const CELL_PAD_X = 4;
    const CELL_PAD_Y = 4;
    const LINE_HEIGHT = FONT_SIZE * 1.3;
    const FOOTER_H = 24;

    // ── Title block ──
    doc.rect(MARGIN, MARGIN, PAGE_W, 44).fill(DARK_BLUE);
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(15)
      .text(title, MARGIN + 12, MARGIN + 8, { width: PAGE_W - 24, lineBreak: false });
    doc.fillColor('#CBD5E1').font('Helvetica').fontSize(8)
      .text(
        `Generated: ${generatedAt}  ·  By: ${generatedBy}  ·  Records: ${rows.length}`,
        MARGIN + 12, MARGIN + 28,
        { width: PAGE_W - 24, lineBreak: false },
      );

    if (rows.length === 0) {
      doc.moveDown(2).fillColor(GREY).font('Helvetica').fontSize(10)
        .text('No data available for this report.', MARGIN, MARGIN + 60);
      doc.end();
      return;
    }

    const flatRows = rows.map(flattenRow);
    const columns = Object.keys(flatRows[0]);
    const headers = columns.map(formatColumnHeader);

    // ── Measure natural column widths based on actual content ──
    // Approximate: Helvetica char width ≈ 0.55 * fontSize for average chars
    const CHAR_W = FONT_SIZE * 0.55;
    const HDR_CHAR_W = HEADER_FONT_SIZE * 0.6;

    const naturalWidths = columns.map((col, i) => {
      const headerW = headers[i].length * HDR_CHAR_W + CELL_PAD_X * 2;
      const maxDataW = flatRows.reduce((max, r) => {
        const len = String(r[col] ?? '').length * CHAR_W + CELL_PAD_X * 2;
        return len > max ? len : max;
      }, 0);
      return Math.max(headerW, maxDataW, 35); // minimum 35pt per column
    });

    const totalNatural = naturalWidths.reduce((a, b) => a + b, 0);

    // If natural widths fit, use them. If too wide, scale proportionally.
    const colWidths = totalNatural <= PAGE_W
      ? naturalWidths
      : naturalWidths.map((w) => (w / totalNatural) * PAGE_W);

    // ── Helpers ──
    const drawTableHeader = (y: number): number => {
      doc.rect(MARGIN, y, PAGE_W, HEADER_H).fill(ACCENT);
      let x = MARGIN;
      headers.forEach((hdr, i) => {
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(HEADER_FONT_SIZE)
          .text(hdr, x + CELL_PAD_X, y + CELL_PAD_Y + 1, {
            width: colWidths[i] - CELL_PAD_X * 2,
            lineBreak: false,
            ellipsis: true,
          });
        x += colWidths[i];
      });
      return y + HEADER_H;
    };

    const drawPageFooter = (pageNum: number): void => {
      const fy = PAGE_H - FOOTER_H;
      doc.rect(MARGIN, fy - 1, PAGE_W, 0.5).fill('#E5E7EB');
      doc.fillColor(GREY).font('Helvetica').fontSize(7)
        .text(`${title}  ·  JIT Inventory & Equipment Management System`, MARGIN, fy + 6, {
          width: PAGE_W * 0.7,
          lineBreak: false,
        })
        .text(`Page ${pageNum}`, MARGIN, fy + 6, {
          width: PAGE_W,
          align: 'right',
          lineBreak: false,
        });
    };

    // ── Measure row height — account for wrapping if column is narrow ──
    const measureRowHeight = (flatRow: Record<string, string | number>): number => {
      let maxLines = 1;
      columns.forEach((col, i) => {
        const text = String(flatRow[col] ?? '');
        const availW = colWidths[i] - CELL_PAD_X * 2;
        const charsPerLine = Math.floor(availW / CHAR_W);
        if (charsPerLine > 0) {
          const lines = Math.ceil(text.length / charsPerLine);
          if (lines > maxLines) maxLines = lines;
        }
      });
      // Cap at 3 lines max per row to keep table readable
      return Math.min(maxLines, 3) * LINE_HEIGHT + CELL_PAD_Y * 2;
    };

    // ── Render table ──
    let currentY = MARGIN + 44 + 6; // below title block
    let pageNum = 1;

    currentY = drawTableHeader(currentY);

    flatRows.forEach((flatRow, rowIdx) => {
      const rowH = measureRowHeight(flatRow);
      const isEven = rowIdx % 2 === 0;
      const availableH = PAGE_H - FOOTER_H - MARGIN;

      // Page break
      if (currentY + rowH > availableH) {
        drawPageFooter(pageNum);
        doc.addPage();
        pageNum++;
        currentY = MARGIN;
        doc.fillColor(GREY).font('Helvetica-Oblique').fontSize(7)
          .text(`${title} (continued)`, MARGIN, currentY, { lineBreak: false });
        currentY += 11;
        currentY = drawTableHeader(currentY);
      }

      // Row background
      if (isEven) {
        doc.rect(MARGIN, currentY, PAGE_W, rowH).fill(LIGHT_BG);
      }

      // Draw vertical dividers
      let x = MARGIN;
      columns.forEach((col, i) => {
        const cellText = String(flatRow[col] ?? '—');
        doc.fillColor('#111827').font('Helvetica').fontSize(FONT_SIZE)
          .text(cellText, x + CELL_PAD_X, currentY + CELL_PAD_Y, {
            width: colWidths[i] - CELL_PAD_X * 2,
            height: rowH - CELL_PAD_Y,
            ellipsis: true,
            lineBreak: true,
          });

        // Column separator
        if (i < columns.length - 1) {
          doc.rect(x + colWidths[i] - 0.5, currentY, 0.5, rowH).fill('#D1D5DB');
        }

        x += colWidths[i];
      });

      // Row bottom border
      doc.rect(MARGIN, currentY + rowH - 0.5, PAGE_W, 0.5).fill('#E5E7EB');

      currentY += rowH;
    });

    drawPageFooter(pageNum);
    doc.end();
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ message: error instanceof Error ? error.message : 'Internal server error' });
    }
  }
});

export default router;