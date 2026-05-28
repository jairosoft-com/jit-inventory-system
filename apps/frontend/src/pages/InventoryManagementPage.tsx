import { FormEvent, useMemo, useState } from 'react';

type InventoryItem = {
  id: number;
  itemCode: string;
  itemName: string;
  category: string;
  location: string;
  quantity: number;
  reorderLevel: number;
  status: 'In Stock' | 'Low Stock' | 'Out of Stock';
};

type InventoryFormState = {
  itemCode: string;
  itemName: string;
  category: string;
  location: string;
  quantity: string;
  reorderLevel: string;
};

const initialInventoryItems: InventoryItem[] = [
  {
    id: 1,
    itemCode: 'INV-001',
    itemName: 'Laptop Charger',
    category: 'Accessories',
    location: 'Storage Room A',
    quantity: 12,
    reorderLevel: 5,
    status: 'In Stock',
  },
  {
    id: 2,
    itemCode: 'INV-002',
    itemName: 'HDMI Cable',
    category: 'Cables',
    location: 'Storage Room B',
    quantity: 3,
    reorderLevel: 5,
    status: 'Low Stock',
  },
  {
    id: 3,
    itemCode: 'INV-003',
    itemName: 'Wireless Mouse',
    category: 'Peripherals',
    location: 'IT Office',
    quantity: 0,
    reorderLevel: 4,
    status: 'Out of Stock',
  },
];

const emptyForm: InventoryFormState = {
  itemCode: '',
  itemName: '',
  category: '',
  location: '',
  quantity: '',
  reorderLevel: '',
};

function getStockStatus(quantity: number, reorderLevel: number): InventoryItem['status'] {
  if (quantity === 0) {
    return 'Out of Stock';
  }

  if (quantity <= reorderLevel) {
    return 'Low Stock';
  }

  return 'In Stock';
}

export default function InventoryManagementPage() {
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>(initialInventoryItems);
  const [form, setForm] = useState<InventoryFormState>(emptyForm);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredInventoryItems = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLowerCase();

    if (!normalizedSearchTerm) {
      return inventoryItems;
    }

    return inventoryItems.filter((item) => {
      return (
        item.itemCode.toLowerCase().includes(normalizedSearchTerm) ||
        item.itemName.toLowerCase().includes(normalizedSearchTerm) ||
        item.category.toLowerCase().includes(normalizedSearchTerm) ||
        item.location.toLowerCase().includes(normalizedSearchTerm) ||
        item.status.toLowerCase().includes(normalizedSearchTerm)
      );
    });
  }, [inventoryItems, searchTerm]);

  const handleInputChange = (field: keyof InventoryFormState, value: string) => {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const quantity = Number(form.quantity);
    const reorderLevel = Number(form.reorderLevel);

    if (
      !form.itemCode.trim() ||
      !form.itemName.trim() ||
      !form.category.trim() ||
      !form.location.trim() ||
      Number.isNaN(quantity) ||
      Number.isNaN(reorderLevel) ||
      quantity < 0 ||
      reorderLevel < 0
    ) {
      return;
    }

    const itemPayload: Omit<InventoryItem, 'id'> = {
      itemCode: form.itemCode.trim(),
      itemName: form.itemName.trim(),
      category: form.category.trim(),
      location: form.location.trim(),
      quantity,
      reorderLevel,
      status: getStockStatus(quantity, reorderLevel),
    };

    if (editingItemId) {
      setInventoryItems((currentItems) =>
        currentItems.map((item) =>
          item.id === editingItemId
            ? {
                ...item,
                ...itemPayload,
              }
            : item,
        ),
      );
    } else {
      setInventoryItems((currentItems) => [
        {
          id: Date.now(),
          ...itemPayload,
        },
        ...currentItems,
      ]);
    }

    setForm(emptyForm);
    setEditingItemId(null);
  };

  const handleEdit = (item: InventoryItem) => {
    setEditingItemId(item.id);
    setForm({
      itemCode: item.itemCode,
      itemName: item.itemName,
      category: item.category,
      location: item.location,
      quantity: String(item.quantity),
      reorderLevel: String(item.reorderLevel),
    });
  };

  const handleCancelEdit = () => {
    setForm(emptyForm);
    setEditingItemId(null);
  };

  return (
    <div className="dash-page animate-fade-in">
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Inventory Management</h1>
          <p className="dash-page-desc">
            Skeleton page for viewing inventory records, submitting inventory forms, and displaying stock status.
          </p>
        </div>
      </div>

      <div className="dash-card inventory-summary-grid">
        <div>
          <p className="inventory-summary-label">Total Items</p>
          <strong>{inventoryItems.length}</strong>
        </div>
        <div>
          <p className="inventory-summary-label">In Stock</p>
          <strong>{inventoryItems.filter((item) => item.status === 'In Stock').length}</strong>
        </div>
        <div>
          <p className="inventory-summary-label">Low Stock</p>
          <strong>{inventoryItems.filter((item) => item.status === 'Low Stock').length}</strong>
        </div>
        <div>
          <p className="inventory-summary-label">Out of Stock</p>
          <strong>{inventoryItems.filter((item) => item.status === 'Out of Stock').length}</strong>
        </div>
      </div>

      <div className="inventory-content-grid">
        <div className="dash-card">
          <div className="inventory-card-header">
            <div>
              <h2>Inventory Listing</h2>
              <p>Temporary mock records for frontend skeleton testing.</p>
            </div>

            <input
              className="inventory-input"
              type="search"
              placeholder="Search inventory..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>

          <div className="inventory-table-wrapper">
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Item</th>
                  <th>Category</th>
                  <th>Location</th>
                  <th>Quantity</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventoryItems.map((item) => (
                  <tr key={item.id}>
                    <td>{item.itemCode}</td>
                    <td>{item.itemName}</td>
                    <td>{item.category}</td>
                    <td>{item.location}</td>
                    <td>{item.quantity}</td>
                    <td>
                      <span className={`inventory-status inventory-status-${item.status.toLowerCase().replaceAll(' ', '-')}`}>
                        {item.status}
                      </span>
                    </td>
                    <td>
                      <button className="inventory-link-button" type="button" onClick={() => handleEdit(item)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}

                {filteredInventoryItems.length === 0 && (
                  <tr>
                    <td colSpan={7}>No inventory records found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="dash-card">
          <h2>{editingItemId ? 'Update Inventory Item' : 'Create Inventory Item'}</h2>
          <p className="inventory-form-note">This form currently saves only to local page state.</p>

          <form className="inventory-form" onSubmit={handleSubmit}>
            <label>
              Item Code
              <input
                className="inventory-input"
                value={form.itemCode}
                onChange={(event) => handleInputChange('itemCode', event.target.value)}
                required
              />
            </label>

            <label>
              Item Name
              <input
                className="inventory-input"
                value={form.itemName}
                onChange={(event) => handleInputChange('itemName', event.target.value)}
                required
              />
            </label>

            <label>
              Category
              <input
                className="inventory-input"
                value={form.category}
                onChange={(event) => handleInputChange('category', event.target.value)}
                required
              />
            </label>

            <label>
              Location
              <input
                className="inventory-input"
                value={form.location}
                onChange={(event) => handleInputChange('location', event.target.value)}
                required
              />
            </label>

            <label>
              Quantity
              <input
                className="inventory-input"
                type="number"
                min="0"
                value={form.quantity}
                onChange={(event) => handleInputChange('quantity', event.target.value)}
                required
              />
            </label>

            <label>
              Reorder Level
              <input
                className="inventory-input"
                type="number"
                min="0"
                value={form.reorderLevel}
                onChange={(event) => handleInputChange('reorderLevel', event.target.value)}
                required
              />
            </label>

            <div className="inventory-form-actions">
              <button className="inventory-primary-button" type="submit">
                {editingItemId ? 'Update Item' : 'Create Item'}
              </button>

              {editingItemId && (
                <button className="inventory-secondary-button" type="button" onClick={handleCancelEdit}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}