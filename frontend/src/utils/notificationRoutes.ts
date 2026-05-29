import type { Role } from '../context/AuthContext';

const ROUTES: Record<Role, Record<string, string>> = {
  admin: {
    order: '/admin/orders',
    payment: '/admin/billing',
    delivery: '/admin/orders',
    approval: '/admin/users',
    stock: '/admin/inventory',
    subscription: '/admin/subscriptions',
    general: '/admin',
  },
  staff: {
    order: '/staff/deliveries',
    delivery: '/staff/deliveries',
    payment: '/staff/deliveries',
    stock: '/staff/deliveries',
    general: '/staff/deliveries',
  },
  customer: {
    order: '/customer/orders',
    payment: '/customer/wallet',
    delivery: '/customer/orders',
    subscription: '/customer/plan',
    general: '/customer',
  },
};

export const notificationScreenPath = (type: string, role: Role = 'customer'): string =>
  ROUTES[role]?.[type] || ROUTES[role]?.general || '/';
