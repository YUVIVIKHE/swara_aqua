import { motion, AnimatePresence } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { LucideIcon, ChevronLeft, ChevronRight, Droplets } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface NavItem { label: string; icon: LucideIcon; to: string; }

interface Props {
  items: NavItem[];
  collapsed: boolean;
  onToggle: () => void;
}

export const Sidebar = ({ items, collapsed, onToggle }: Props) => {
  const { user } = useAuth();

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 240 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="hidden md:flex flex-col h-screen bg-slate-900 border-r border-slate-800 shrink-0 relative z-30"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-800">
        <div className="w-9 h-9 bg-gradient-aqua rounded-xl flex items-center justify-center shrink-0 shadow-brand">
          <Droplets className="w-5 h-5 text-white" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.2 }}>
              <p className="text-white font-bold text-sm leading-tight">Swara Aqua</p>
              <p className="text-slate-500 text-[10px] capitalize">{user?.role} panel</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto no-scrollbar">
        {items.map(({ label, icon: Icon, to }) => (
          <NavLink key={to} to={to} end
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative
              ${isActive ? 'bg-brand-600 text-white shadow-brand' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
                      className="text-sm font-medium whitespace-nowrap">
                      {label}
                    </motion.span>
                  )}
                </AnimatePresence>
                {collapsed && (
                  <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity z-50 shadow-lg">
                    {label}
                  </div>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Collapse toggle */}
      <button onClick={onToggle}
        className="flex items-center justify-center w-full py-4 border-t border-slate-800 text-slate-500 hover:text-white transition-colors">
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </motion.aside>
  );
};
