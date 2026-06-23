import { FormEvent, useEffect, useState } from 'react';
import {
  SupplierStatusFilter,
  useSuppliersStore,
} from '../store/suppliersStore';

const statusOptions: Array<{ label: string; value: SupplierStatusFilter }> = [
  { label: 'Active Suppliers', value: 'active' },
  { label: 'Inactive Suppliers', value: 'inactive' },
  { label: 'All Suppliers', value: 'all' },
];

function formatStatus(status: SupplierStatusFilter) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatDate(value: string | null) {
  if (!value) {
    return '—';
  }

  return new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(new Date(value));
}

export default function SuppliersPage() {
  const {
    suppliers,
    search,
    status,
    page,
    meta,
    isLoading,
    error,
    fetchSuppliers,
    setSearch,
    setStatus,
    setPage,
    clearError,
  } = useSuppliersStore();

  const [searchInput, setSearchInput] = useState(search);

  useEffect(() => {
    void fetchSuppliers();
  }, [fetchSuppliers, search, status, page]);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearch(searchInput);
  };

  const handleStatusChange = (value: SupplierStatusFilter) => {
    if (!searchInput.trim()) {
      setSearch('');
    }

    setStatus(value);
  }

  const showingEmpty = !isLoading && suppliers.length === 0;

  return (
    <div className="dash-page suppliers-page animate-fade-in">
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Suppliers</h1>
          <p className="dash-page-desc">
            Search supplier records and filter active or inactive suppliers.
          </p>
        </div>
      </div>

      {error && (
        <div className="dash-error-banner">
          <span className="dash-error-msg">{error}</span>
          <button
            className="dash-error-close"
            type="button"
            onClick={clearError}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      <form className="suppliers-toolbar" onSubmit={handleSearchSubmit}>
        <label className="suppliers-filter-field">
          <span>Search Supplier Name</span>
          <input
            className="inventory-input"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search by supplier name..."
            type="search"
          />
        </label>

        <label className="suppliers-filter-field">
          <span>Status Filter</span>
          <select
            className="inventory-input"
            value={status}
            onChange={(event) =>
              handleStatusChange(event.target.value as SupplierStatusFilter)
            }
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="suppliers-toolbar-actions">
          <button
            className="inventory-primary-button suppliers-search-button"
            type="submit"
            disabled={isLoading}
          >
            Search
          </button>

          <button
            className="inventory-secondary-button suppliers-refresh-button"
            type="button"
            onClick={() => void fetchSuppliers()}
            disabled={isLoading}
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </form>

      <div className="dash-card suppliers-card">
        <div className="inventory-card-header suppliers-card-header">
          <div>
            <h2>Supplier Directory</h2>
            <p>
              Showing {suppliers.length} of {meta.total} supplier
              {meta.total === 1 ? '' : 's'}.
            </p>
          </div>
        </div>

        <div className="inventory-table-wrapper">
          <table className="inventory-table suppliers-table">
            <thead>
              <tr>
                <th>Supplier Name</th>
                <th>Contact Person</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Purchase Orders</th>
                <th>Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                suppliers.length === 0 &&
                Array.from({ length: 4 }).map((_, index) => (
                  <tr key={index}>
                    <td colSpan={7}>Loading supplier records...</td>
                  </tr>
                ))}

              {!isLoading &&
                suppliers.map((supplier) => (
                  <tr key={supplier.id}>
                    <td>
                      <strong className="suppliers-name">
                        {supplier.supplierName}
                      </strong>
                      {supplier.address && (
                        <span className="suppliers-address">
                          {supplier.address}
                        </span>
                      )}
                    </td>
                    <td>{supplier.contactPerson || '—'}</td>
                    <td>{supplier.email || '—'}</td>
                    <td>{supplier.phone || '—'}</td>
                    <td>
                      <span
                        className={
                          supplier.status === 'active'
                            ? 'suppliers-status suppliers-status--active'
                            : 'suppliers-status suppliers-status--inactive'
                        }
                      >
                        {formatStatus(supplier.status)}
                      </span>
                    </td>
                    <td>{supplier.purchaseOrderCount}</td>
                    <td>{formatDate(supplier.updatedAt)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {showingEmpty && (
          <div className="dash-card-content-empty suppliers-empty-state">
            <div className="dash-empty-state">
              <div className="dash-empty-icon">
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <h3 className="dash-empty-heading">No Suppliers Found</h3>
              <p className="dash-empty-text">
                No supplier records match the current search and status filter.
              </p>
            </div>
          </div>
        )}

        {meta.totalPages > 1 && (
          <div className="suppliers-pagination">
            <button
              className="inventory-secondary-button"
              type="button"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </button>

            <span>
              Page {meta.page} of {meta.totalPages}
            </span>

            <button
              className="inventory-secondary-button"
              type="button"
              disabled={page >= meta.totalPages || isLoading}
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}