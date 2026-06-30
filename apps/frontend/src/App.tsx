import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardLayout from './layouts/DashboardLayout';
import DashboardPage from './pages/DashboardPage';
import UserManagementPage from './pages/UserManagementPage';
import CategoryManagementPage from './pages/CategoryManagementPage';
import EquipmentPage from './pages/EquipmentPage';
import PlaceholderPage from './pages/PlaceholderPage';
import InventoryManagementPage from './pages/InventoryManagementPage';
import BorrowRequestPage from './pages/BorrowRequestPage';
import SupplierManagementPage from './pages/SupplierManagementPage';
import ReportsPage from './pages/ReportsPage';
import PurchaseOrderPage from './pages/PurchaseOrderPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Login Route */}
        <Route path="/" element={<LoginPage />} />
 
        {/* Dashboard Shell Route */}
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="users" element={<UserManagementPage />} />
          <Route path="categories" element={<CategoryManagementPage />} />
          <Route path="inventory" element={<InventoryManagementPage />} />
          <Route path="equipment" element={<EquipmentPage />} />
          <Route path="borrow" element={<BorrowRequestPage />} />
          <Route path="orders" element={<PurchaseOrderPage />} />
          <Route path="suppliers" element={<SupplierManagementPage />} />
          <Route path="maintenance" element={<PlaceholderPage />} />
          <Route path="logs" element={<PlaceholderPage />} />
          <Route path="reports" element={<ReportsPage />} />
        </Route>
 
        {/* Catch-all Redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

