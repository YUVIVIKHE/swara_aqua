import { useState, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { TopNavbar } from './TopNavbar';
import { BottomNav } from './BottomNav';

interface NavItem { label: string; icon: LucideIcon; to: string; }

interface Props {
  children: ReactNode;
  navItems: NavItem[];
  title: string;
  onOrderPress?: () => void;
}

export const DashboardLayout = ({ children, navItems, title, onOrderPress }: Props) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar items={navItems} collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />

      <div className="flex flex-col flex-1 min-w-0">
        <TopNavbar title={title} />
        <motion.main
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="flex-1 overflow-y-auto p-4 sm:p-6 pb-28 md:pb-6"
        >
          {children}
        </motion.main>
      </div>

      <BottomNav items={navItems} onOrderPress={onOrderPress} />
    </div>
  );
};
