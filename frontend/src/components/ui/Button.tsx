import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { ReactNode, ButtonHTMLAttributes } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

const variants = {
  primary: 'bg-gradient-brand text-white shadow-brand hover:opacity-90',
  secondary: 'bg-white text-brand-600 border border-slate-200 hover:bg-slate-50 shadow-card',
  ghost: 'text-slate-600 hover:bg-slate-100',
  danger: 'bg-red-50 text-red-600 border border-red-100 hover:bg-red-100',
};
const sizes = {
  sm: 'px-3 py-1.5 text-xs rounded-xl gap-1.5',
  md: 'px-4 py-2.5 text-sm rounded-2xl gap-2',
  lg: 'px-6 py-3.5 text-sm rounded-2xl gap-2',
};

export const Button = ({ variant = 'primary', size = 'md', loading, icon, children, disabled, className = '', ...props }: Props) => (
  <motion.button
    whileTap={{ scale: 0.97 }}
    whileHover={{ scale: 1.01 }}
    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    disabled={disabled || loading}
    className={`inline-flex items-center justify-center font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
    {...(props as any)}
  >
    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
    {children}
  </motion.button>
);
