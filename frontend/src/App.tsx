import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/ui/Toast';
import ProtectedRoute from './components/ProtectedRoute';
import { PWAInstallBanner, OfflineIndicator } from './components/PWAInstall';

// Lazy load heavy dashboards — only downloaded when user navigates there
const LoginPage       = lazy(() => import('./pages/LoginPage'));
const SignupPage      = lazy(() => import('./pages/SignupPage'));
const AdminDashboard  = lazy(() => import('./pages/AdminDashboard'));
const StaffDashboard  = lazy(() => import('./pages/StaffDashboard'));
const CustomerDashboard = lazy(() => import('./pages/CustomerDashboard'));
const DownloadAppPage = lazy(() => import('./pages/DownloadAppPage').then(m => ({ default: m.DownloadAppPage })));

// Minimal full-screen loader shown while chunks download
const PageLoader = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-slate-50">
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-500 to-aqua-400 animate-pulse" />
      <p className="text-xs text-slate-400 font-medium">Loading…</p>
    </div>
  </div>
);

const App = () => (
  <AuthProvider>
    <ToastProvider>
      <OfflineIndicator />
      <Suspense fallback={<PageLoader />}>
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
      </Suspense>
      <PWAInstallBanner />
    </ToastProvider>
  </AuthProvider>
);

export default App;
