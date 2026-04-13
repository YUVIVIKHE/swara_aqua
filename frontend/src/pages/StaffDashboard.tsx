import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, Warehouse } from 'lucide-react';
import { DashboardLayout } from '../components/layouts/DashboardLayout';
import { StaffHome } from './staff/StaffHome';
import { StaffDeliveries } from './staff/StaffDeliveries';
import { StaffInventory } from './staff/StaffInventory';
import { ProfilePage } from './shared/ProfilePage';

const NAV = [
  { label: 'Dashboard',  icon: LayoutDashboard, to: '/staff' },
  { label: 'Deliveries', icon: ClipboardList,    to: '/staff/deliveries' },
  { label: 'Inventory',  icon: Warehouse,        to: '/staff/inventory' },
];

const TITLES: Record<string, string> = {
  '/staff':             'Dashboard',
  '/staff/deliveries':  'Deliveries',
  '/staff/inventory':   'Inventory',
  '/staff/profile':     'Profile',
};

export default function StaffDashboard() {
  const { pathname } = useLocation();
  return (
    <DashboardLayout navItems={NAV} title={TITLES[pathname] || 'Dashboard'}>
      <Routes>
        <Route index element={<StaffHome />} />
        <Route path="deliveries" element={<StaffDeliveries />} />
        <Route path="inventory"  element={<StaffInventory />} />
        <Route path="profile"    element={<ProfilePage />} />
        <Route path="*"          element={<Navigate to="/staff" replace />} />
      </Routes>
    </DashboardLayout>
  );
}
