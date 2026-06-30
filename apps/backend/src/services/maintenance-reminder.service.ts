import { prisma } from '../lib/prisma.js';
import { MaintenanceStatus } from '@prisma/client';
import { EmailService } from './email.service.js';

export class MaintenanceReminderService {
  /**
   * Scans for scheduled maintenance logs approaching in the next 7 days,
   * creates MaintenanceAlert notifications, and sends reminder emails.
   */
  static async scanAndNotify(): Promise<void> {
    console.log('[MaintenanceReminderService] Running scheduled scan...');
    try {
      const now = new Date();
      
      // Calculate date threshold for next 7 days
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      
      const thresholdEnd = new Date();
      thresholdEnd.setDate(thresholdEnd.getDate() + 7);
      thresholdEnd.setHours(23, 59, 59, 999);

      // Find all SCHEDULED maintenance logs within the 7-day window
      const logs = await prisma.maintenanceLog.findMany({
        where: {
          status: MaintenanceStatus.SCHEDULED,
          scheduledDate: {
            gte: todayStart,
            lte: thresholdEnd,
          },
        },
        include: {
          equipment: {
            include: {
              item: { select: { itemName: true } },
            },
          },
          performedBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      });

      console.log(`[MaintenanceReminderService] Found ${logs.length} scheduled maintenance logs within 7-day threshold.`);

      if (logs.length === 0) {
        return;
      }

      // Fetch all active Managers for email alerts
      const managers = await prisma.user.findMany({
        where: {
          role: { name: 'MANAGER' },
          isActive: true,
          deletedAt: null,
        },
        select: { email: true },
      });
      const managerEmails = managers.map((m) => m.email);

      const cooldownLimit = new Date(Date.now() - 24 * 60 * 60 * 1000);

      for (const log of logs) {
        // Deduplication check: skip if an unread alert or an alert created in the last 24h already exists for this log
        const existingAlert = await prisma.maintenanceAlert.findFirst({
          where: {
            maintenanceLogId: log.id,
            OR: [
              { isRead: false },
              { createdAt: { gte: cooldownLimit } },
            ],
          },
        });

        if (existingAlert) {
          console.log(`[MaintenanceReminderService] Alert already exists/sent recently for log ID ${log.id}. Skipping.`);
          continue;
        }

        // 1. Create Dashboard Alert (MaintenanceAlert)
        const message = `Scheduled maintenance is approaching for "${log.equipment.item.itemName}" (${log.equipment.assetId}) on ${log.scheduledDate?.toLocaleDateString(undefined, { timeZone: 'UTC' })}.`;
        await prisma.maintenanceAlert.create({
          data: {
            maintenanceLogId: log.id,
            message,
          },
        });
        console.log(`[MaintenanceReminderService] Created database alert for log ID ${log.id}`);

        // 2. Compile recipient list
        const recipients: string[] = [...managerEmails];
        let technicianName = log.performedByVendor ? `${log.performedByVendor} (Vendor)` : 'Unassigned';

        if (log.performedBy) {
          technicianName = `${log.performedBy.firstName} ${log.performedBy.lastName}`;
          if (log.performedBy.email && !recipients.includes(log.performedBy.email)) {
            recipients.push(log.performedBy.email);
          }
        }

        if (recipients.length > 0 && log.scheduledDate) {
          // 3. Send Email Notification
          await EmailService.sendMaintenanceReminder({
            to: recipients,
            equipmentName: log.equipment.item.itemName,
            assetId: log.equipment.assetId,
            description: log.description,
            scheduledDate: log.scheduledDate,
            technicianName,
          });
        }
      }
      console.log('[MaintenanceReminderService] Scheduled scan completed.');
    } catch (error) {
      console.error('[MaintenanceReminderService] Error during scheduled scan:', error);
    }
  }
}
