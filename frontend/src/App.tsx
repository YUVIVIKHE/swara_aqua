import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/ui/Toast';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import AdminDashboard from './pages/AdminDashboard';
import StaffDashboard from './pages/StaffDashboard';
import CustomerDashboard from './pages/CustomerDashboard';
import { DownloadAppPage } from './pages/DownloadAppPage';
import { PWAInstallBanner, OfflineIndicator } from './components/PWAInstall';

const App = () => (
  <AuthProvider>
    <ToastProvider>
      <OfflineIndicator />
      <Routes>
        <Route path="/login"    element={<LoginPage />} />
        <Route path="/signup"   element={<SignupPage />} />
        <Route path="/download" element={<DownloadAppPage />} />
        <Route path="/admin/*" element={
          <ProtectedRoute allowedRole="admin"><AdminDashboard /></ProtectedRoute>
        } />
        <Route path="/staff/*" element={
          <ProtectedRoute allowedRole="staff"><StaffDashboard /></ProtectedRoute>
        } />
        <Route path="/customer/*" element={
          <ProtectedRoute allowedRole="customer"><CustomerDashboard /></ProtectedRoute>
        } />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      <PWAInstallBanner />
    </ToastProvider>
  </AuthProvider>
);

export default App;
