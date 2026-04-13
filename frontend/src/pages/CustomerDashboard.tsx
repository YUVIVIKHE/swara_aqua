import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Package, FileText, CalendarDays, Wallet } from 'lucide-react';
import { DashboardLayout } from '../components/layouts/DashboardLayout';
import { CustomerHome } from './customer/CustomerHome';
import { CustomerOrders } from './customer/CustomerOrders';
import { CustomerBills } from './customer/CustomerBills';
import { CustomerCalendar } from './customer/CustomerCalendar';
import { CustomerWallet } from './customer/CustomerWallet';
import { ProfilePage } from './shared/ProfilePage';

const NAV = [
  { label: 'Home',     icon: LayoutDashboard, to: '/customer' },
  { label: 'Orders',   icon: Package,         to: '/customer/orders' },
  { label: 'Calendar', icon: CalendarDays,     to: '/customer/calendar' },
  { label: 'Bills',    icon: FileText,         to: '/customer/bills' },
];

const TITLES: Record<string, string> = {
  '/customer':          'Home',
  '/customer/orders':   'My Orders',
  '/customer/calendar': 'Delivery Calendar',
  '/customer/bills':    'My Bills',
  '/customer/profile':  'My Profile',
  '/customer/wallet':   'My Wallet',
};

export default function CustomerDashboard() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  // FAB handler: navigate to orders page with ?new=1 to auto-open the form
  const handleOrderPress = () => {
    navigate('/customer/orders?new=1');
  };

  return (
    <DashboardLayout navItems={NAV} title={TITLES[pathname] || 'Home'} onOrderPress={handleOrderPress}>
      <Routes>
        <Route index element={<CustomerHome onOrderPress={handleOrderPress} />} />
        <Route path="orders"   element={<CustomerOrders />} />
        <Route path="calendar" element={<CustomerCalendar />} />
        <Route path="bills"    element={<CustomerBills />} />
        <Route path="profile"  element={<ProfilePage />} />
        <Route path="wallet"   element={<CustomerWallet />} />
        <Route path="*"        element={<Navigate to="/customer" replace />} />
      </Routes>
    </DashboardLayout>
  );
}
