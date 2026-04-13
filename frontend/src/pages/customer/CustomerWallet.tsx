import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, Plus, ArrowUpRight, ArrowDownLeft, RefreshCw, X, Check } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { walletApi, WalletTransaction } from '../../api/wallet';
import { loadRazorpay } from '../../utils/razorpay';

const QUICK_AMOUNTS = [50, 100, 200, 500, 1000];

export const CustomerWallet = () => {
  const { toast } = useToast();
  const [balance,      setBalance]      = useState(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [showTopup,    setShowTopup]    = useState(false);
  const [amount,       setAmount]       = useState('');
  const [paying,       setPaying]       = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await walletApi.get();
      setBalance(data.balance);
      setTransactions(data.transactions);
    } catch { toast('Failed to load wallet', 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleTopup = async () => {
    const amt = Number(amount);
    if (!amt || amt < 1) { toast('Enter a valid amount', 'error'); return; }

    setPaying(true);
    try {
      const rzpLoaded = await loadRazorpay();
      if (!rzpLoaded) { toast('Razorpay failed to load', 'error'); setPaying(false); return; }

      const { data } = await walletApi.createTopupOrder(amt);

      await new Promise<void>((resolve, reject) => {
        const options = {
          key:         data.keyId,
          amount:      data.amount,
          currency:    data.currency,
          name:        'Swara Aqua',
          description: 'Wallet Top-up',
          order_id:    data.orderId,
          handler: async (response: any) => {
            try {
              const verify = await walletApi.verifyTopup({
                razorpay_order_id:   response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature:  response.razorpay_signature,
                amount:              data.amount,
              });
              setBalance(verify.data.balance);
              toast(`₹${amt} added to wallet!`, 'success');
              setShowTopup(false);
              setAmount('');
              await load();
              resolve();
            } catch { reject(new Error('Verification failed')); }
          },
          modal: { ondismiss: () => reject(new Error('dismissed')) },
          prefill: {},
          theme: { color: '#2563eb' },
        };
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      });
    } catch (err: any) {
      if (err?.message !== 'dismissed') toast(err?.message || 'Payment failed', 'error');
    } finally {
      setPaying(false);
    }
  };

  const modeLabel: Record<string, string> = {
    razorpay: 'Razorpay', cash: 'Cash', wallet: 'Wallet', refund: 'Refund',
  };

  return (
    <div className="max-w-lg space-y-4">

      {/* Balance card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-brand-600 to-aqua-500 rounded-3xl p-6 relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-36 h-36 rounded-full bg-white/10" />
        <div className="absolute right-8 -bottom-6 w-20 h-20 rounded-full bg-white/10" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="w-5 h-5 text-white/80" />
            <p className="text-white/80 text-sm font-medium">Wallet Balance</p>
          </div>
          {loading ? (
            <Skeleton className="h-10 w-36 bg-white/20 rounded-xl mt-1" />
          ) : (
            <p className="text-4xl font-bold text-white mt-1">₹{balance.toFixed(2)}</p>
          )}
          <Button
            size="sm"
            className="mt-4 bg-white/20 hover:bg-white/30 text-white border-white/30 border backdrop-blur-sm"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => setShowTopup(v => !v)}>
            Add Money
          </Button>
        </div>
      </motion.div>

      {/* Top-up panel */}
      <AnimatePresence>
        {showTopup && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-2xl border border-brand-100 shadow-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-800">Add Money to Wallet</h3>
              <button onClick={() => setShowTopup(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick amounts */}
            <div className="flex flex-wrap gap-2 mb-4">
              {QUICK_AMOUNTS.map(q => (
                <button key={q} type="button"
                  onClick={() => setAmount(String(q))}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all
                    ${amount === String(q)
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-brand-300'}`}>
                  ₹{q}
                </button>
              ))}
            </div>

            <div className="relative mb-4">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-semibold text-sm">₹</span>
              <input
                type="number" min={1} value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="Enter amount"
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-8 pr-4 py-3 text-sm font-semibold outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 transition-all" />
            </div>

            <Button
              className="w-full" loading={paying}
              icon={<Check className="w-4 h-4" />}
              onClick={handleTopup}>
              Pay ₹{amount || '0'} via Razorpay
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transaction history */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Transaction History</p>
          <button onClick={load} className="text-slate-400 hover:text-brand-500 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {loading ? (
          <div className="p-4 space-y-3">
            {[0, 1, 2].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-10 text-center">
            <Wallet className="w-8 h-8 text-slate-200 mx-auto mb-2" />
            <p className="text-xs text-slate-400">No transactions yet</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {transactions.map(tx => (
              <div key={tx.id} className="flex items-center gap-3 px-4 py-3.5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0
                  ${tx.type === 'credit' ? 'bg-green-50' : 'bg-red-50'}`}>
                  {tx.type === 'credit'
                    ? <ArrowDownLeft className="w-4 h-4 text-green-500" />
                    : <ArrowUpRight  className="w-4 h-4 text-red-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{tx.note || 'Transaction'}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {modeLabel[tx.mode]} · {new Date(tx.created_at).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-bold ${tx.type === 'credit' ? 'text-green-600' : 'text-red-500'}`}>
                    {tx.type === 'credit' ? '+' : '-'}₹{Number(tx.amount).toFixed(2)}
                  </p>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full
                    ${tx.status === 'completed' ? 'bg-green-50 text-green-600'
                      : tx.status === 'failed'  ? 'bg-red-50 text-red-500'
                      : 'bg-amber-50 text-amber-600'}`}>
                    {tx.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
};
