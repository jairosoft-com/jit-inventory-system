import React, { useState, useEffect } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

type TransactionType = 'STOCK_IN' | 'STOCK_OUT';

export interface ConsumableProfile {
  id: number;
  itemId: number;
  quantity: number;
  unit: string;
}

export interface Item {
  id: number;
  itemName: string;
  consumableProfile?: ConsumableProfile;
}

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
    case 'ADJUSTMENT_ADD':
      return { label: 'Stock In', color: 'text-emerald-700 bg-emerald-100 border-emerald-200' };
    case 'STOCK_OUT':
    case 'ADJUSTMENT_REMOVE':
      return { label: 'Stock Out', color: 'text-rose-700 bg-rose-100 border-rose-200' };
    default:
      return { label: type, color: 'text-gray-700 bg-gray-100 border-gray-200' };
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
  const [delta, setDelta] = useState(0); 
  const [inputValue, setInputValue] = useState('0'); 
  const [reason, setReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // ── History state ─────────────────────────────────────────────────────────────
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<'ALL' | 'STOCK_IN' | 'STOCK_OUT'>('ALL');

  // preview quantity
  const previewQty = txType === 'STOCK_IN' 
    ? profile.quantity + delta 
    : profile.quantity - delta;

  const previewSafe = Math.max(0, previewQty);

  // Fetch history when tab is switched
  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const fetchHistory = async () => {
    try {
      setIsLoadingHistory(true);
      const token = localStorage.getItem('token');
      // Adjust this endpoint based on your actual backend API route
      const res = await fetch(`/api/inventory/items/${item.id}/movements`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Failed to fetch history');
      
      const json: MovementsResponse = await res.json();
      setMovements(json.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    const parsed = parseInt(val, 10);
    setDelta(isNaN(parsed) ? 0 : parsed);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (delta <= 0) {
      setFormError('Quantity must be greater than zero.');
      return;
    }
    if (txType === 'STOCK_OUT' && delta > profile.quantity) {
      setFormError('Cannot remove more stock than currently available.');
      return;
    }

    try {
      setIsSaving(true);
      const token = localStorage.getItem('token');
      
      // Adjust this endpoint based on your actual backend API route
      const res = await fetch(`/api/inventory/items/${item.id}/move`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          movementType: txType,
          quantity: delta,
          reason: reason
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to update stock');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setFormError(err.message || 'An unexpected error occurred.');
      setIsSaving(false);
    }
  };

  // Filter the movements based on the selected filter
  const displayedMovements = movements.filter((mov) => {
    if (historyFilter === 'ALL') return true;
    return mov.movementType.includes(historyFilter);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-gray-200">
        
        {/* Header */}
        <div className="border-b border-gray-100 p-4 sm:p-6 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Manage Stock</h2>
              <p className="mt-1 text-sm text-gray-500">{item.itemName}</p>
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
            >
              ✕
            </button>
          </div>

          {/* Tabs */}
          <div className="mt-6 flex space-x-4 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('adjust')}
              className={`pb-2 text-sm font-medium transition-colors ${
                activeTab === 'adjust'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Update Stock
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`pb-2 text-sm font-medium transition-colors ${
                activeTab === 'history'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              History
            </button>
          </div>
        </div>

        {/* ── Adjust Tab ── */}
        {activeTab === 'adjust' && (
          <form onSubmit={handleSubmit} className="p-4 sm:p-6 pt-4">
            <div className="mb-6 rounded-xl bg-gray-50 p-4 border border-gray-100">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Current Quantity</span>
                <span className="text-lg font-semibold text-gray-900">
                  {profile.quantity} <span className="text-sm font-normal text-gray-500">{profile.unit}</span>
                </span>
              </div>
              <div className="mt-2 flex justify-between items-center text-sm border-t border-gray-200 pt-2">
                <span className="text-gray-500">New Quantity</span>
                <span className={`text-lg font-semibold ${
                  previewSafe > profile.quantity ? 'text-emerald-600' : previewSafe < profile.quantity ? 'text-rose-600' : 'text-gray-900'
                }`}>
                  {previewSafe} <span className="text-sm font-normal text-gray-500">{profile.unit}</span>
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTxType('STOCK_IN')}
                  className={`flex items-center justify-center rounded-lg border py-2.5 text-sm font-medium transition-colors ${
                    txType === 'STOCK_IN'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  ➕ Stock In
                </button>
                <button
                  type="button"
                  onClick={() => setTxType('STOCK_OUT')}
                  className={`flex items-center justify-center rounded-lg border py-2.5 text-sm font-medium transition-colors ${
                    txType === 'STOCK_OUT'
                      ? 'border-rose-600 bg-rose-50 text-rose-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  ➖ Stock Out
                </button>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={inputValue}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Reason / Notes</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="E.g., new shipment, damaged, used for event..."
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            {formError && (
              <p className="mt-4 text-sm text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-100">
                {formError}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving || delta <= 0 || (txType === 'STOCK_OUT' && delta > profile.quantity)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Confirm Update'}
              </button>
            </div>
          </form>
        )}

        {/* ── History Tab ── */}
        {activeTab === 'history' && (
          <div className="flex h-[400px] flex-col p-4 sm:p-6">
            
            {/* Filters */}
            <div className="mb-4 flex flex-wrap shrink-0 gap-2">
              <button
                type="button"
                onClick={() => setHistoryFilter('ALL')}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition tracking-wide ${
                  historyFilter === 'ALL'
                    ? 'bg-blue-600 text-white border border-transparent'
                    : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setHistoryFilter('STOCK_IN')}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition tracking-wide ${
                  historyFilter === 'STOCK_IN'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                }`}
              >
                Stock In
              </button>
              <button
                type="button"
                onClick={() => setHistoryFilter('STOCK_OUT')}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition tracking-wide ${
                  historyFilter === 'STOCK_OUT'
                    ? 'bg-rose-100 text-rose-800 border border-rose-300'
                    : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                }`}
              >
                Stock Out
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {isLoadingHistory ? (
                <div className="flex h-full items-center justify-center text-sm text-gray-500">
                  Loading history...
                </div>
              ) : displayedMovements.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-gray-400">
                  {movements.length === 0 ? 'No stock history found.' : 'No matching stock history found.'}
                </div>
              ) : (
                <div className="space-y-3">
                  {displayedMovements.map((mov) => {
                    const status = movementLabel(mov.movementType);
                    const isPositive = mov.quantityChange > 0;
                    
                    return (
                      <div key={mov.id} className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-gray-50 p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold border ${status.color}`}>
                              {status.label}
                            </span>
                            <div className="mt-1.5 text-sm font-medium text-gray-900">
                              {mov.performedBy.firstName} {mov.performedBy.lastName}
                            </div>
                          </div>
                          <div className={`text-sm font-bold ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {isPositive ? '+' : '-'}{Math.abs(mov.quantityChange)}
                          </div>
                        </div>
                        
                        <div className="flex justify-between items-end mt-1">
                          <div className="text-xs text-gray-500">
                            {formatTs(mov.createdAt)}
                          </div>
                          <div className="text-xs text-gray-500">
                            Balance: <span className="font-medium text-gray-700">{mov.quantityAfter}</span>
                          </div>
                        </div>

                        {mov.reason && (
                           <p className="mt-2 text-xs text-gray-600 border-l-2 border-gray-300 pl-2 py-0.5 bg-white rounded-r-md px-2 shadow-sm">
                             "{mov.reason}"
                           </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}