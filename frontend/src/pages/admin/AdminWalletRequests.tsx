import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet, CheckCircle2, XCircle, Clock, RefreshCw,
  User, Phone, IndianRupee, ShieldCheck, ShieldX, Filter,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { walletApi, WalletAccessRequest, WalletAccess } from '../../api/wallet';

const STATUS_TABS: { key: WalletAccess; label: string; color: string }[] = [
  { key: 'pending',  label: 'Pending',  color: 'text-amber-600' },
  { key: 'approved', label: 'Approved', color: 'text-green-600' },
  { key: 'rejected', label: 'Rejected', color: 'text-red-600'  },
];

export const AdminWalletRequests = () => {
  const { toast } = useToast();
  const [requests, setRequests] = useState<WalletAccessRequest[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState<WalletAccess>('pending');
  const [acting,   setActing]   = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await walletApi.getAccessRequests(tab);
      setRequests(data.requests);
    } catch { toast('Failed to load requests', 'error'); }
    finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (userId: number, name: string) => {
    setActing(userId);
    try {
      await walletApi.approveAccess(userId);
      toast(`✅ Wallet approved for ${name}`, 'success');
      load();
    } catch { toast('Failed to approve', 'error'); }
    finally { setActing(null); }
  };

  const handleReject = async (userId: number, name: string) => {
    setActing(userId);
    try {
      await walletApi.rejectAccess(userId);
      toast(`Wallet request rejected for ${name}`, 'success');
      load();
    } catch { toast('Failed to reject', 'error'); }
    finally { setActing(null); }
  };

  return (
    <div className="max-w-2xl space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Wallet Access Requests</h2>
          <p className="text-xs text-slate-400 mt-0.5">Manage customer wallet activation requests</p>
        </div>
        <Button variant="secondary" size="sm" icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={load}>
          Refresh
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {STATUS_TABS.map(({ key, label, color }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border transition-all
              ${tab === key
                ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
            {key === 'pending'  && <Clock       className={`w-3.5 h-3.5 ${tab === key ? 'text-amber-300' : 'text-amber-500'}`} />}
            {key === 'approved' && <ShieldCheck className={`w-3.5 h-3.5 ${tab === key ? 'text-green-300' : 'text-green-500'}`} />}
            {key === 'rejected' && <ShieldX     className={`w-3.5 h-3.5 ${tab === key ? 'text-red-300'   : 'text-red-500'}`}   />}
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-10 text-center">
          <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Wallet className="w-7 h-7 text-slate-300" />
          </div>
          <p className="text-sm font-bold text-slate-600">
            No {tab} requests
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {tab === 'pending'
              ? 'No customers are waiting for wallet approval.'
              : `No ${tab} wallet requests found.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req, i) => (
            <motion.div key={req.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white rounded-2xl border border-slate-100 shadow-card p-4">

              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="w-11 h-11 bg-gradient-to-br from-brand-100 to-brand-50 rounded-2xl flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-brand-500" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-slate-800">{req.name}</p>
                    {/* Status badge */}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border
                      ${req.wallet_access === 'pending'  ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : req.wallet_access === 'approved' ? 'bg-green-50 text-green-700 border-green-200'
                        : 'bg-red-50 text-red-700 border-red-200'}`}>
                      {req.wallet_access}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {req.phone}
                    </span>
                    <span className="flex items-center gap-1">
                      <IndianRupee className="w-3 h-3" /> Balance: ₹{Number(req.wallet_balance).toFixed(2)}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Requested: {new Date(req.created_at).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </p>
                </div>
              </div>

              {/* Action buttons — only for pending */}
              {req.wallet_access === 'pending' && (
                <div className="grid grid-cols-2 gap-2 mt-4">
                  <button
                    disabled={acting === req.id}
                    onClick={() => handleApprove(req.id, req.name)}
                    className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-green-600 text-white text-xs font-bold hover:bg-green-700 disabled:opacity-50 transition-all active:scale-[0.98]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {acting === req.id ? 'Processing…' : 'Approve'}
                  </button>
                  <button
                    disabled={acting === req.id}
                    onClick={() => handleReject(req.id, req.name)}
                    className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-50 text-red-600 border border-red-200 text-xs font-bold hover:bg-red-100 disabled:opacity-50 transition-all active:scale-[0.98]">
                    <XCircle className="w-3.5 h-3.5" />
                    Reject
                  </button>
                </div>
              )}

              {/* Approved / Rejected state info */}
              {req.wallet_access === 'approved' && (
                <div className="mt-3 flex items-center gap-2 bg-green-50 rounded-xl px-3 py-2">
                  <ShieldCheck className="w-4 h-4 text-green-500 shrink-0" />
                  <p className="text-xs text-green-700 font-medium">Wallet access granted — customer can use wallet</p>
                </div>
              )}
              {req.wallet_access === 'rejected' && (
                <div className="mt-3 flex items-center gap-2 bg-red-50 rounded-xl px-3 py-2">
                  <ShieldX className="w-4 h-4 text-red-500 shrink-0" />
                  <p className="text-xs text-red-700 font-medium">Access denied — customer may re-request</p>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};
