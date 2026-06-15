import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import type { Item } from '../store/itemsStore';

/**
 * StockMovementModal.tsx
 *
 * Drop-in modal for the Inventory Management page.
 * Place between Edit and Archive in the actions column.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

type TransactionType = 'STOCK_IN' | 'STOCK_OUT';

interface StockMovement {
  id: number;
  movementType: 'STOCK_IN' | 'STOCK_OUT' | 'ADJUSTMENT_ADD' | 'ADJUSTMENT_REMOVE';
  quantityChange: number;
  quantityBefore: number;
  quantityAfter: number;
  reason: string;
  createdAt: string;
  performedBy: { firstName: string; lastName: string };
}

interface MovementsResponse {
  data: StockMovement[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function movementLabel(type: StockMovement['movementType']) {
  switch (type) {
    case 'STOCK_IN':
      return { text: 'Stock In', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
    case 'STOCK_OUT':
      return { text: 'Stock Out', color: 'text-rose-700 bg-rose-50 border-rose-200' };
    case 'ADJUSTMENT_ADD':
      return { text: 'Adjust (+)', color: 'text-amber-700 bg-amber-50 border-amber-200' };
    case 'ADJUSTMENT_REMOVE':
      return { text: 'Adjust (-)', color: 'text-amber-700 bg-amber-50 border-amber-200' };
    default:
      return { text: 'Unknown', color: 'text-gray-700 bg-gray-50 border-gray-200' };
  }
}

function formatTs(iso: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  item: Item;
  onClose: () => void;
  onSuccess: () => void;
}

export default function StockMovementModal({ item, onClose, onSuccess }: Props) {
  const profile = item.consumableProfile!;

  // ── Tab state ────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'adjust' | 'history'>('adjust');

  // ── Transaction form state ────────────────────────────────────────────────────
  const [txType, setTxType] = useState<TransactionType>('STOCK_IN');
  const [delta, setDelta] = useState(0);          // relative change (+/-)
  const [inputValue, setInputValue] = useState('0'); // text in the editable field
  const [purpose, setPurpose] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // preview quantity
  const currentQty = profile.quantity;
  const previewQty = txType === 'STOCK_IN' ? currentQty + delta : currentQty - delta;

  // ── History state ─────────────────────────────────────────────────────────────
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [histTotal, setHistTotal] = useState(0);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab]);

  async function loadHistory() {
    setIsLoadingHistory(true);
    try {
      const res = await api.get<MovementsResponse>('/inventory/movements', {
        params: { consumableProfileId: profile.id, limit: 20 },
      });
      setMovements(res.data.data);
      setHistTotal(res.data.pagination.total);
    } catch (err) {
      console.error('Failed to load history', err);
    } finally {
      setIsLoadingHistory(false);
    }
  }

  // ── Input Handlers ────────────────────────────────────────────────────────────

  function applyDelta(change: number) {
    const newVal = Math.max(0, delta + change);
    setDelta(newVal);
    setInputValue(String(newVal));
  }

  function handleInputChange(val: string) {
    setInputValue(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      setDelta(parsed);
    }
  }

  function handleInputBlur() {
    const parsed = parseInt(inputValue, 10);
    const safe = isNaN(parsed) || parsed < 0 ? 0 : parsed;
    setDelta(safe);
    setInputValue(String(safe));
  }

  // ── Submit ────────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    setFormError('');
    setSuccessMsg('');

    if (delta <= 0) {
      setFormError('Quantity change must be greater than zero.');
      return;
    }
    if (txType === 'STOCK_OUT' && !purpose.trim()) {
      setFormError('Purpose is required for stock removal.');
      return;
    }
    if (previewQty < 0) {
      setFormError('Resulting quantity cannot be negative.');
      return;
    }

    setIsSaving(true);
    try {
      if (txType === 'STOCK_IN') {
        await api.post('/inventory/stock-in', {
          consumableProfileId: profile.id,
          quantityAdded: delta,
          notes: notes.trim() || null,
        });
      } else {
        await api.post('/inventory/stock-out', {
          consumableProfileId: profile.id,
          quantityRemoved: delta,
          purpose: purpose.trim(),
          notes: notes.trim() || null,
        });
      }

      setSuccessMsg(
        txType === 'STOCK_IN'
          ? `Added ${delta} ${profile.unit}. New quantity: ${previewQty}.`
          : `Removed ${delta} ${profile.unit}. New quantity: ${previewQty}.`
      );

      // reset form
      setDelta(0);
      setInputValue('0');
      setPurpose('');
      setNotes('');

      // Refresh parent table after a short delay
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (error: any) {
      setFormError(error.response?.data?.message || 'Failed to process transaction.');
    } finally {
      setIsSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  const previewSafe = Math.max(0, previewQty);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-[var(--surface)] shadow-xl ring-1 ring-[var(--surface-border)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--surface-border)] bg-[var(--background-secondary)] px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Manage Stock</h2>
            <p className="text-sm font-medium text-[var(--text-secondary)]">{item.itemName}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-[var(--text-disabled)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--surface-border)] px-6">
          {(['adjust', 'history'] as const).map((tab) => (
            <button
               key={tab}
               type="button"
               onClick={() => setActiveTab(tab)}
               className={`-mb-px border-b-2 py-3 pr-4 text-sm font-medium transition ${
                 activeTab === tab
                   ? 'border-[var(--primary,#3b82f6)] text-[var(--primary,#3b82f6)]'
                   : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
               }`}
            >
               {tab === 'adjust' ? 'Update Stock' : `History${histTotal > 0 ? ` (${histTotal})` : ''}`}
            </button>
          ))}
        </div>

        {/* ── Update Stock Tab ── */}
        {activeTab === 'adjust' && (
          <div className="space-y-5 px-6 py-5">
            {/* Transaction type selector */}
            <div className="grid grid-cols-2 gap-2">
              {(['STOCK_IN', 'STOCK_OUT'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setTxType(t);
                    setDelta(0);
                    setInputValue('0');
                    setFormError('');
                    setSuccessMsg('');
                  }}
                  className={`rounded-xl border py-2.5 text-xs font-semibold transition ${
                    txType === t
                      ? t === 'STOCK_IN'
                        ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                        : 'border-red-300 bg-red-50 text-red-700'
                      : 'border-[var(--surface-border)] bg-[var(--background-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  {t === 'STOCK_IN' ? '+ Stock In' : '− Stock Out'}
                </button>
              ))}
            </div>

            {/* Quantity input */}
            <div>
               <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                 {txType === 'STOCK_IN' ? 'Quantity to Add' : 'Quantity to Remove'}
               </label>
               <div className="flex items-center gap-2">
                 <button
                   type="button"
                   onClick={() => applyDelta(-1)}
                   className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--surface-border)] text-lg font-bold transition hover:bg-[var(--surface-hover)]"
                 >
                   −
                 </button>
                 <input
                   type="number"
                   min="0"
                   value={inputValue}
                   onChange={(e) => handleInputChange(e.target.value)}
                   onBlur={handleInputBlur}
                   className="h-9 flex-1 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 text-center text-sm font-semibold"
                 />
                 <button
                   type="button"
                   onClick={() => applyDelta(1)}
                   className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--surface-border)] text-lg font-bold transition hover:bg-[var(--surface-hover)]"
                 >
                   +
                 </button>
                 <span className="text-xs text-[var(--text-secondary)]">{profile.unit}</span>
               </div>
               
               {/* Preview */}
               {delta !== 0 && (
                 <p className="mt-2 text-sm text-[var(--text-secondary)]">
                   Current: <span className="font-semibold">{currentQty}</span> → New:{' '}
                   <span className={`font-bold ${previewQty < 0 ? 'text-red-600' : 'text-[var(--text-primary)]'}`}>
                     {previewSafe}
                   </span>
                 </p>
               )}
               {/* Inline Validation Warning */}
               {previewQty < 0 && (
                 <p className="mt-1 flex items-center gap-1 text-sm font-medium text-red-500">
                   <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                   </svg>
                   Cannot remove more than available stock.
                 </p>
               )}
            </div>

            {/* Purpose — only for Stock Out */}
            {txType === 'STOCK_OUT' && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  Purpose <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="e.g. Used in maintenance, distributed..."
                  className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm placeholder:text-[var(--text-disabled)] focus:outline-none focus:ring-2 focus:ring-[var(--primary,#3b82f6)]"
                />
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Optional Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional details..."
                className="w-full resize-none rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm placeholder:text-[var(--text-disabled)] focus:outline-none focus:ring-2 focus:ring-[var(--primary,#3b82f6)]"
                rows={2}
              />
            </div>

            {/* Alerts */}
            {formError && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-100">
                {formError}
              </div>
            )}
            {successMsg && (
              <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700 border border-emerald-100">
                {successMsg}
              </div>
            )}
            
            {/* Action Buttons */}
            <div className="mt-6 flex justify-end gap-3 border-t border-[var(--surface-border)] pt-5">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSaving || delta === 0 || previewQty < 0}
                className="rounded-xl bg-[var(--primary,#3b82f6)] px-5 py-2 text-sm font-bold text-white transition hover:bg-[var(--primary-hover,#2563eb)] disabled:opacity-50"
              >
                {isSaving ? 'Processing...' : 'Confirm Update'}
              </button>
            </div>
          </div>
        )}

        {/* ── History Tab ── */}
        {activeTab === 'history' && (
          <div className="h-[400px] overflow-y-auto p-4 sm:p-6">
            {isLoadingHistory ? (
              <div className="flex h-full items-center justify-center text-sm text-[var(--text-secondary)]">
                Loading history...
              </div>
            ) : movements.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-[var(--text-disabled)]">
                No stock history found.
              </div>
            ) : (
              <div className="space-y-4">
                {movements.map((mov) => {
                  const lbl = movementLabel(mov.movementType);
                  return (
                    <div key={mov.id} className="flex gap-4 rounded-xl border border-[var(--surface-border)] bg-[var(--background-tertiary)] p-4">
                      <div className="flex-1">
                        <div className="mb-2 flex items-center justify-between">
                           <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${lbl.color}`}>
                             {lbl.text}
                           </span>
                           <span className="text-xs text-[var(--text-disabled)]">
                             {formatTs(mov.createdAt)}
                           </span>
                        </div>
                        <p className="text-sm text-[var(--text-primary)]">
                          <span className="font-medium text-[var(--text-secondary)]">Performed by: </span>
                          {mov.performedBy.firstName} {mov.performedBy.lastName}
                        </p>
                        <div className="mt-1 flex items-center gap-2 text-sm font-semibold">
                          <span className="text-[var(--text-secondary)]">{mov.quantityBefore}</span>
                          <span className="text-[var(--text-disabled)] text-xs">→</span>
                          <span className="text-[var(--text-primary)]">{mov.quantityAfter}</span>
                          <span className="text-xs text-[var(--text-disabled)] font-normal ml-2">
                             (Change: {mov.quantityChange > 0 ? `+${mov.quantityChange}` : mov.quantityChange})
                          </span>
                        </div>
                        {mov.reason && (
                           <p className="mt-2 text-xs italic text-[var(--text-secondary)] border-l-2 border-[var(--surface-border)] pl-2">
                             "{mov.reason}"
                           </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}