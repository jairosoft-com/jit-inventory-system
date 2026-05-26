import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardLayout from './layouts/DashboardLayout';
import DashboardPage from './pages/DashboardPage';
import UserManagementPage from './pages/UserManagementPage';
import PlaceholderPage from './pages/PlaceholderPage';
import InventoryManagementPage from './pages/InventoryManagementPage';

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
          <Route path="inventory" element={<InventoryManagementPage />} />
          <Route path="equipment" element={<PlaceholderPage />} />
          <Route path="borrow" element={<PlaceholderPage />} />
          <Route path="orders" element={<PlaceholderPage />} />
          <Route path="suppliers" element={<PlaceholderPage />} />
          <Route path="maintenance" element={<PlaceholderPage />} />
          <Route path="logs" element={<PlaceholderPage />} />
        </Route>

        {/* Catch-all Redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
