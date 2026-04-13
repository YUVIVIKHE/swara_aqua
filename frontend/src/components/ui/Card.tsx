import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export const Card = ({ children, className = '', hover, onClick }: Props) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    whileHover={hover ? { y: -2, boxShadow: '0 8px 32px rgba(0,0,0,0.08)' } : undefined}
    onClick={onClick}
    className={`bg-white rounded-2xl shadow-card border border-slate-100 ${hover ? 'cursor-pointer' : ''} ${className}`}
  >
    {children}
  </motion.div>
);

export const StatCard = ({ label, value, icon, color, change }: {
  label: string; value: string | number; icon: ReactNode;
  color: string; change?: string;
}) => (
  <Card hover className="p-5">
    <div className="flex items-start justify-between mb-4">
      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${color}`}>
        {icon}
      </div>
      {change && (
        <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${change.startsWith('+') ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
          {change}
        </span>
      )}
    </div>
    <p className="text-2xl font-bold text-slate-900 mb-1">{value}</p>
    <p className="text-xs text-slate-500 font-medium">{label}</p>
  </Card>
);
