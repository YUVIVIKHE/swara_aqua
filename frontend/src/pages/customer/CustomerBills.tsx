import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Download, ChevronDown, IndianRupee,
  CheckCircle2, AlertCircle, Clock, Wallet,
} from 'lucide-react';
import { Skeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { billingApi, Bill } from '../../api/billing';

const STATUS_CFG: Record<string, { label: string; icon: typeof CheckCircle2; bg: string; text: string; dot: string }> = {
  paid:    { label: 'Paid',    icon: CheckCircle2, bg: 'bg-green-50 border-green-100', text: 'text-green-700', dot: 'bg-green-400' },
  partial: { label: 'Partial', icon: Clock,        bg: 'bg-amber-50 border-amber-100', text: 'text-amber-700', dot: 'bg-amber-400' },
  unpaid:  { label: 'Unpaid',  icon: AlertCircle,  bg: 'bg-red-50 border-red-100',     text: 'text-red-600',   dot: 'bg-red-500' },
};

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const formatMonth = (monthStr: string) => {
  const [y, m] = monthStr.split('-');
  return `${MONTH_NAMES[Number(m) - 1]} ${y}`;
};

export const CustomerBills = () => {
  const { toast } = useToast();
  const [bills,   setBills]   = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    billingApi.list()
      .then(({ data }) => setBills(data.bills))
      .catch(() => toast('Failed to load bills', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const totalPending = bills.reduce((s, b) =>
    s + Math.max(0, Number(b.total_amount) - Number(b.paid_amount)), 0
  );
  const totalPaid  = bills.reduce((s, b) => s + Number(b.paid_amount), 0);
  const unpaidCount = bills.filter(b => b.status !== 'paid').length;

  return (
    <div className="max-w-2xl space-y-5">

      {/* ── Summary hero ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-slate-800 to-slate-700 rounded-3xl p-5 relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/5" />
        <div className="absolute right-10 -bottom-6 w-24 h-24 rounded-full bg-white/5" />

        <div className="relative z-10">
          <p className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-4">Billing Summary</p>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-white/50 text-[10px] font-medium mb-1">Total Paid</p>
              <p className="text-white font-bold text-lg">₹{totalPaid.toFixed(0)}</p>
            </div>
            <div>
              <p className="text-white/50 text-[10px] font-medium mb-1">Pending</p>
              <p className={`font-bold text-lg ${totalPending > 0 ? 'text-red-400' : 'text-green-400'}`}>
                ₹{totalPending.toFixed(0)}
              </p>
            </div>
            <div>
              <p className="text-white/50 text-[10px] font-medium mb-1">Bills Due</p>
              <p className={`font-bold text-lg ${unpaidCount > 0 ? 'text-amber-400' : 'text-green-400'}`}>
                {unpaidCount}
              </p>
            </div>
          </div>

          {totalPending > 0 && (
            <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
              <p className="text-white/70 text-xs">
                You have <span className="text-white font-semibold">₹{totalPending.toFixed(2)}</span> pending — please clear at earliest
              </p>
            </div>
          )}
          {totalPending === 0 && bills.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <p className="text-white/70 text-xs">All bills cleared — you're all good! 🎉</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Bills list ── */}
      {loading ? (
        <div className="space-y-3">{[0,1,2].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
      ) : bills.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-10 text-center">
          <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <FileText className="w-7 h-7 text-slate-300" />
          </div>
          <p className="text-sm font-bold text-slate-600">No bills yet</p>
          <p className="text-xs text-slate-400 mt-1">Bills are generated monthly by admin.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {bills.map((b, i) => {
            const cfg    = STATUS_CFG[b.status] || STATUS_CFG.unpaid;
            const Icon   = cfg.icon;
            const due    = Math.max(0, Number(b.total_amount) - Number(b.paid_amount));
            const isOpen = expanded === b.id;

            return (
              <motion.div key={b.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">

                {/* Main row */}
                <button
                  onClick={() => setExpanded(isOpen ? null : b.id)}
                  className="w-full flex items-center gap-4 p-4 text-left hover:bg-slate-50/50 transition-colors">

                  {/* Month badge */}
                  <div className="w-12 h-12 bg-gradient-to-br from-slate-700 to-slate-600 rounded-2xl flex flex-col items-center justify-center shrink-0">
                    <span className="text-white text-[11px] font-bold leading-none">
                      {MONTH_NAMES[Number(b.month.split('-')[1]) - 1].toUpperCase()}
                    </span>
                    <span className="text-white/60 text-[10px] leading-none mt-0.5">
                      {b.month.split('-')[0].slice(2)}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-bold text-slate-800">{formatMonth(b.month)}</p>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.text}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">{b.total_jars} jars × ₹{b.jar_rate}/jar</p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className="text-base font-bold text-slate-900">₹{Number(b.total_amount).toFixed(0)}</p>
                      {due > 0 && <p className="text-[10px] text-red-500 font-semibold">₹{due.toFixed(0)} due</p>}
                    </div>
                    <ChevronDown className={`w-4 h-4 text-slate-300 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {/* Expandable detail */}
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden">
                      <div className="px-4 pb-4 border-t border-slate-100 pt-4 space-y-3">

                        {/* Breakdown grid */}
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { icon: IndianRupee, label: 'Subtotal',         value: `₹${b.subtotal}`,         color: 'text-slate-700' },
                            { icon: Wallet,      label: 'Prev. Pending',    value: `₹${b.previous_pending}`, color: 'text-red-600' },
                            { icon: Wallet,      label: 'Advance Used',     value: `-₹${b.advance_used}`,    color: 'text-green-600' },
                            { icon: CheckCircle2,label: 'Amount Paid',      value: `₹${b.paid_amount}`,      color: 'text-green-700' },
                          ].map(({ label, value, color }) => (
                            <div key={label} className="bg-slate-50 rounded-xl p-3">
                              <p className="text-[10px] text-slate-400 font-medium">{label}</p>
                              <p className={`text-sm font-bold mt-0.5 ${color}`}>{value}</p>
                            </div>
                          ))}
                        </div>

                        {/* Balance due pill */}
                        <div className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${
                          due > 0 ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'
                        }`}>
                          <div className="flex items-center gap-2">
                            {due > 0
                              ? <AlertCircle className="w-4 h-4 text-red-500" />
                              : <CheckCircle2 className="w-4 h-4 text-green-500" />}
                            <p className={`text-sm font-bold ${due > 0 ? 'text-red-700' : 'text-green-700'}`}>
                              {due > 0 ? 'Balance Due' : 'Fully Paid'}
                            </p>
                          </div>
                          <p className={`text-base font-bold ${due > 0 ? 'text-red-700' : 'text-green-700'}`}>
                            {due > 0 ? `₹${due.toFixed(2)}` : '✓ Cleared'}
                          </p>
                        </div>

                        {/* Due date */}
                        <p className="text-xs text-slate-400 text-center">
                          Due: {new Date(b.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>

                        {/* Download */}
                        <button
                          onClick={e => { e.stopPropagation(); window.open(billingApi.pdfUrl(b.id), '_blank'); }}
                          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-800 text-white text-xs font-bold hover:opacity-90 active:scale-[0.98] transition-all">
                          <Download className="w-4 h-4" /> Download PDF
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};
