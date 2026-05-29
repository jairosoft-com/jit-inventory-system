import { useState, useMemo } from 'react';
import { useAuthStore } from '../store/authStore';

type EquipmentStatus = 
  | 'AVAILABLE'
  | 'IN_USE'
  | 'UNDER_MAINTENANCE'
  | 'DAMAGED'
  | 'LOST'
  | 'BORROWED'
  | 'RETIRED';

type EquipmentCondition = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
type LifecycleStatus = 'NEW' | 'ACTIVE' | 'AGING' | 'END_OF_LIFE';

type Equipment = {
  id: string;
  name: string;
  serialNumber: string;
  model: string;
  category: string;
  status: EquipmentStatus;
  condition: EquipmentCondition;
  warrantyExpiry: string;
  lifecycleStatus: LifecycleStatus;
  replacementDate: string;
  imageUrl: string | null;
};

const MOCK_EQUIPMENT: Equipment[] = [
  {
    id: 'EQ-001',
    name: 'Dell XPS 15',
    serialNumber: 'SN-DXPS-001',
    model: '9500',
    category: 'Laptops',
    status: 'AVAILABLE',
    condition: 'EXCELLENT',
    warrantyExpiry: '2027-05-15',
    lifecycleStatus: 'NEW',
    replacementDate: '2030-05-15',
    imageUrl: null
  },
  {
    id: 'EQ-002',
    name: 'MacBook Pro M2',
    serialNumber: 'SN-MBP-004',
    model: '2023',
    category: 'Laptops',
    status: 'IN_USE',
    condition: 'GOOD',
    warrantyExpiry: '2026-10-10',
    lifecycleStatus: 'ACTIVE',
    replacementDate: '2028-10-10',
    imageUrl: null
  },
  {
    id: 'EQ-003',
    name: 'Lenovo ThinkPad T14',
    serialNumber: 'SN-LTP-092',
    model: 'Gen 3',
    category: 'Laptops',
    status: 'UNDER_MAINTENANCE',
    condition: 'FAIR',
    warrantyExpiry: '2024-12-01',
    lifecycleStatus: 'AGING',
    replacementDate: '2026-12-01',
    imageUrl: null
  }
];

export default function EquipmentPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role?.name?.toUpperCase().includes('ADMIN') || user?.role?.name === 'System Administrator';

  const [equipmentList, setEquipmentList] = useState<Equipment[]>(MOCK_EQUIPMENT);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingEquipmentId, setEditingEquipmentId] = useState<string | null>(null);

  // Form State
  const initialFormState = {
    name: '',
    serialNumber: '',
    model: '',
    category: '',
    status: 'AVAILABLE' as EquipmentStatus,
    condition: 'EXCELLENT' as EquipmentCondition,
    warrantyExpiry: '',
    lifecycleStatus: 'NEW' as LifecycleStatus,
    replacementDate: '',
    imageUrl: null as string | null
  };
  const [formData, setFormData] = useState(initialFormState);

  const getStatusColor = (status: EquipmentStatus) => {
    switch (status) {
      case 'AVAILABLE': return 'bg-green-100 text-green-800';
      case 'IN_USE': return 'bg-blue-100 text-blue-800';
      case 'UNDER_MAINTENANCE': return 'bg-orange-100 text-orange-800';
      case 'DAMAGED': return 'bg-red-100 text-red-800';
      case 'RETIRED': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getConditionColor = (condition: EquipmentCondition) => {
    switch (condition) {
      case 'EXCELLENT': return 'text-green-600 font-medium';
      case 'GOOD': return 'text-blue-600 font-medium';
      case 'FAIR': return 'text-orange-600 font-medium';
      case 'POOR': return 'text-red-600 font-bold';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingEquipmentId) {
      // Editing existing
      setEquipmentList(prev => 
        (prev.map(eq => eq.id === editingEquipmentId ? { ...formData, id: eq.id } : eq)) as Equipment[]
      );
    } else {
      // Adding new
      const newEquipment: Equipment = {
        id: `EQ-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        ...formData
      } as Equipment;
      setEquipmentList(prev => [...prev, newEquipment]);
    }
    
    closeModal();
  };

  const openAddModal = () => {
    setFormData(initialFormState);
    setEditingEquipmentId(null);
    setShowAddForm(true);
  };

  const openEditModal = (equipment: Equipment) => {
    setFormData({ ...equipment });
    setEditingEquipmentId(equipment.id);
    setShowAddForm(true);
  };

  const closeModal = () => {
    setShowAddForm(false);
    setEditingEquipmentId(null);
    setFormData(initialFormState);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const imageUrl = URL.createObjectURL(file); // Local mock URL
      setFormData(prev => ({ ...prev, imageUrl }));
    }
  };

  const showModal = showAddForm;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Equipment Management</h1>
        <button
          onClick={openAddModal}
          className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-md hover:bg-indigo-700 transition"
        >
          + Add Equipment
        </button>
      </div>

      {/* Form Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-500/75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full p-6 max-h-[95vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingEquipmentId ? 'Edit Equipment' : 'Register New Equipment'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-500">
                <span className="sr-only">Close</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Image Upload spanning 2 cols */}
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Equipment Image</label>
                  <div className="mt-1 flex items-center mb-4 gap-4">
                    {formData.imageUrl ? (
                      <img src={formData.imageUrl} alt="Equipment preview" className="h-24 w-24 object-cover rounded shadow" />
                    ) : (
                      <div className="h-24 w-24 border-2 border-dashed border-gray-300 rounded flex items-center justify-center text-gray-400">
                        No Image
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Display Name *</label>
                  <input
                    required
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Category *</label>
                  <input
                    required
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    placeholder="e.g. Laptops, Servers, Furniture"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Model *</label>
                  <input
                    required
                    name="model"
                    value={formData.model}
                    onChange={handleInputChange}
                     className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Serial Number *</label>
                  <input
                    required
                    name="serialNumber"
                    value={formData.serialNumber}
                    onChange={handleInputChange}
                     className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Warranty Expiry *</label>
                  <input
                    required
                    type="date"
                    name="warrantyExpiry"
                    value={formData.warrantyExpiry}
                    onChange={handleInputChange}
                     className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Replacement Date</label>
                  <input
                    type="date"
                    name="replacementDate"
                    value={formData.replacementDate}
                    onChange={handleInputChange}
                     className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Status</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                  >
                    <option value="AVAILABLE">AVAILABLE</option>
                    <option value="IN_USE">IN_USE</option>
                    <option value="UNDER_MAINTENANCE">UNDER_MAINTENANCE</option>
                    <option value="DAMAGED">DAMAGED</option>
                    <option value="RETIRED">RETIRED</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Condition</label>
                  <select
                    name="condition"
                    value={formData.condition}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                  >
                    <option value="EXCELLENT">EXCELLENT</option>
                    <option value="GOOD">GOOD</option>
                    <option value="FAIR">FAIR</option>
                    <option value="POOR">POOR</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Lifecycle Status</label>
                  <select
                    name="lifecycleStatus"
                    value={formData.lifecycleStatus}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                  >
                    <option value="NEW">NEW</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="AGING">AGING</option>
                    <option value="END_OF_LIFE">END OF LIFE</option>
                  </select>
                </div>
              </div>
              
              <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                <button
                  type="submit"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none sm:col-start-2 sm:text-sm"
                >
                  Save Equipment
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:col-start-1 sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Equipment List */}
      <div className="bg-white shadow ring-1 ring-black ring-opacity-5 md:rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-300">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6 w-16"></th>
              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900">Equipment</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Serial &amp; Model</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Status</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Monitoring Info</th>
              {isAdmin && (
                <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {equipmentList.map((equipment) => (
              <tr key={equipment.id}>
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                  {equipment.imageUrl ? (
                    <img src={equipment.imageUrl} alt={equipment.name} className="h-10 w-10 rounded-md object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded-md bg-gray-200 flex items-center justify-center text-gray-500 text-xs text-center border">
                      No img
                    </div>
                  )}
                </td>
                <td className="whitespace-nowrap py-4 pr-3 text-sm">
                  <div className="font-medium text-gray-900">{equipment.name}</div>
                  <div className="text-gray-500 font-mono text-xs mt-1">{equipment.id}</div>
                  <div className="text-gray-400 text-xs mt-0.5">{equipment.category}</div>
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                  <div className="text-gray-900">{equipment.model}</div>
                  <div className="text-gray-500">{equipment.serialNumber}</div>
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                  <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${getStatusColor(equipment.status)}`}>
                    {equipment.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-3 py-4 text-sm text-gray-500">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                       <span className="text-gray-600 font-medium whitespace-nowrap">Condition:</span>
                       <span className={getConditionColor(equipment.condition)}>{equipment.condition}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                       <span className="text-gray-600 whitespace-nowrap">Lifecycle:</span>
                       <span>{equipment.lifecycleStatus.replace('_', ' ')}</span>
                    </div>
                    <div className="flex flex-col gap-1 text-xs mt-1">
                       <div>
                         <span className="text-gray-600">Warranty: </span>
                         <span>{equipment.warrantyExpiry}</span>
                       </div>
                       {equipment.replacementDate && (
                         <div>
                           <span className="text-gray-600">Replace by: </span>
                           <span>{equipment.replacementDate}</span>
                         </div>
                       )}
                    </div>
                  </div>
                </td>
                {isAdmin && (
                  <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6 align-top">
                    <button 
                      onClick={() => openEditModal(equipment)}
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      Edit<span className="sr-only">, {equipment.name}</span>
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {equipmentList.length === 0 && (
               <tr>
                 <td colSpan={isAdmin ? 6 : 5} className="py-8 text-center text-gray-500">No equipment found. Add some to get started.</td>
               </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}