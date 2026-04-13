import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, UserCheck, RefreshCw, X, AlertTriangle, Building2, CheckCircle2, Truck, PlusCircle, Package, CornerDownLeft, AlertOctagon, ClipboardList } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { inventoryApi, Inventory, StaffInventory, InventoryLog } from '../../api/inventory';

const LOG_COLORS: Record<string, string> = {
  add:       'bg-green-50  text-green-700  border-green-200',
  assign:    'bg-blue-50   text-blue-700   border-blue-200',
  return:    'bg-teal-50   text-teal-700   border-teal-200',
  delivered: 'bg-purple-50 text-purple-700 border-purple-200',
  damaged:   'bg-red-50    text-red-600    border-red-200',
};
const LOG_ICON: Record<string, React.ElementType> = {
  add: PlusCircle, assign: Package, return: CornerDownLeft, delivered: CheckCircle2, damaged: AlertOctagon,
};

export const AdminInventory = () => {
  const { toast } = useToast();
  const [inventory,      setInventory]      = useState<Inventory | null>(null);
  const [staffInventory, setStaffInventory] = useState<StaffInventory[]>([]);
  const [logs,           setLogs]           = useState<InventoryLog[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [showAdd,        setShowAdd]        = useState(false);
  const [showAssign,     setShowAssign]     = useState(false);
  const [addQty,         setAddQty]         = useState(1);
  const [addNote,        setAddNote]        = useState('');
  const [assignStaffId,  setAssignStaffId]  = useState('');
  const [assignQty,      setAssignQty]      = useState(1);
  const [submitting,     setSubmitting]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [invRes, logRes] = await Promise.all([
        inventoryApi.get(),
        inventoryApi.getLogs(30),
      ]);
      setInventory(invRes.data.inventory);
      setStaffInventory(invRes.data.staffInventory);
      setLogs(logRes.data.logs);
    } catch { toast('Failed to load inventory', 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await inventoryApi.addStock(addQty, addNote || undefined);
      toast(`${addQty} jars added to inventory`, 'success');
      setShowAdd(false); setAddQty(1); setAddNote('');
      await load();
    } catch (err: any) {
      toast(err?.response?.data?.message || 'Failed to add stock', 'error');
    } finally { setSubmitting(false); }
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignStaffId) { toast('Select a staff member', 'error'); return; }
    setSubmitting(true);
    try {
      await inventoryApi.assignJars(Number(assignStaffId), assignQty);
      toast(`${assignQty} jars assigned`, 'success');
      setShowAssign(false); setAssignStaffId(''); setAssignQty(1);
      await load();
    } catch (err: any) {
      toast(err?.response?.data?.message || 'Failed to assign jars', 'error');
    } finally { setSubmitting(false); }
  };

  const isLowStock = inventory && inventory.available_jars <= inventory.low_stock_threshold;

  return (
    <div className="max-w-4xl space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Inventory</h2>
          <p className="text-xs text-slate-400 mt-0.5">Jar stock management</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={load}>Refresh</Button>
          <Button variant="secondary" size="sm" icon={<UserCheck className="w-3.5 h-3.5" />} onClick={() => setShowAssign(true)}>Assign</Button>
          <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowAdd(true)}>Add Stock</Button>
        </div>
      </div>

      {/* Low stock alert */}
      {isLowStock && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
          <p className="text-sm font-semibold text-amber-700">
            Low stock! Only <span className="font-bold">{inventory?.available_jars}</span> jars available.
          </p>
        </motion.div>
      )}

      {/* Stats cards — always 3 cols, compact on mobile */}
      {loading ? (
        <div className="grid grid-cols-3 gap-3">{[0,1,2].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
      ) : inventory && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total',     value: inventory.total_jars,     color: 'text-slate-800',  bg: 'bg-slate-50',  iconColor: 'text-slate-400',  icon: Building2 },
            { label: 'Available', value: inventory.available_jars, color: 'text-green-700',  bg: 'bg-green-50',  iconColor: 'text-green-400', icon: CheckCircle2 },
            { label: 'With Staff',value: inventory.total_jars - inventory.available_jars, color: 'text-blue-700', bg: 'bg-blue-50', iconColor: 'text-blue-400', icon: Truck },
          ].map(({ label, value, color, bg, iconColor, icon: Icon }) => (
            <div key={label} className={`${bg} border border-white rounded-2xl p-3 sm:p-5 shadow-card`}>
              <Icon className={`w-4 h-4 sm:w-5 sm:h-5 mb-1.5 ${iconColor}`} />
              <p className={`text-2xl sm:text-3xl font-bold ${color}`}>{value}</p>
              <p className="text-[10px] sm:text-xs text-slate-500 font-medium mt-0.5 leading-tight">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Staff inventory */}
      {staffInventory.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
          <div className="px-4 py-3.5 border-b border-slate-100 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-brand-500" />
            <h3 className="text-sm font-bold text-slate-800">Staff Inventory</h3>
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Staff', 'Assigned', 'Empty Collected', 'Last Updated'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {staffInventory.map(si => (
                  <tr key={si.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-gradient-to-br from-brand-500 to-aqua-500 rounded-lg flex items-center justify-center text-white text-xs font-bold">
                          {si.staff_name?.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-semibold text-slate-800">{si.staff_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5"><span className="text-sm font-bold text-blue-600">{si.assigned_jars}</span></td>
                    <td className="px-5 py-3.5"><span className="text-sm font-bold text-teal-600">{si.empty_collected}</span></td>
                    <td className="px-5 py-3.5 text-xs text-slate-400">{new Date(si.updated_at).toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden divide-y divide-slate-50">
            {staffInventory.map(si => (
              <div key={si.id} className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 bg-gradient-to-br from-brand-500 to-aqua-500 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {si.staff_name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{si.staff_name}</p>
                    <p className="text-[10px] text-slate-400">
                      Updated {new Date(si.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                    <p className="text-[10px] text-blue-500 font-semibold uppercase tracking-wide">Assigned</p>
                    <p className="text-xl font-bold text-blue-700 mt-0.5">{si.assigned_jars}</p>
                  </div>
                  <div className="bg-teal-50 border border-teal-100 rounded-xl p-3">
                    <p className="text-[10px] text-teal-500 font-semibold uppercase tracking-wide">Empty Collected</p>
                    <p className="text-xl font-bold text-teal-700 mt-0.5">{si.empty_collected}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inventory logs */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
        <div className="px-4 py-3.5 border-b border-slate-100 flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-brand-500" />
          <h3 className="text-sm font-bold text-slate-800">Recent Activity</h3>
        </div>
        {logs.length === 0 ? (
          <p className="text-center text-slate-400 text-sm py-8">No activity yet</p>
        ) : (
          <div className="divide-y divide-slate-50 max-h-80 overflow-y-auto">
            {logs.map(log => {
              const Icon = LOG_ICON[log.type] || ClipboardList;
              return (
                <div key={log.id} className="flex items-start gap-3 px-4 py-3">
                  <span className="shrink-0 p-2 rounded-xl bg-slate-50 border border-slate-100 text-slate-500 mt-0.5">
                    <Icon className="w-3.5 h-3.5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize ${LOG_COLORS[log.type]}`}>
                        {log.type}
                      </span>
                      <span className="text-sm font-bold text-slate-800">{log.quantity} jars</span>
                    </div>
                    {log.note && <p className="text-xs text-slate-400 mt-0.5 truncate">{log.note}</p>}
                    <p className="text-[10px] text-slate-300 mt-1">
                      {new Date(log.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Stock Modal */}
      <AnimatePresence>
        {showAdd && (
          <Modal title="Add Stock" onClose={() => setShowAdd(false)}>
            <form onSubmit={handleAddStock} className="space-y-4">
              <Field label="Quantity (Jars)">
                <input type="number" min={1} value={addQty}
                  onChange={e => setAddQty(Math.max(1, Number(e.target.value)))}
                  className={inputCls} />
              </Field>
              <Field label="Note (optional)">
                <input type="text" value={addNote} onChange={e => setAddNote(e.target.value)}
                  placeholder="e.g. New stock from supplier" className={inputCls} />
              </Field>
              <Button type="submit" loading={submitting} size="lg" className="w-full" icon={<Plus className="w-4 h-4" />}>
                Add {addQty} Jars
              </Button>
            </form>
          </Modal>
        )}
      </AnimatePresence>

      {/* Assign Jars Modal */}
      <AnimatePresence>
        {showAssign && (
          <Modal title="Assign Jars to Staff" onClose={() => setShowAssign(false)}>
            <form onSubmit={handleAssign} className="space-y-4">
              <Field label="Staff Member">
                <select value={assignStaffId} onChange={e => setAssignStaffId(e.target.value)} className={inputCls}>
                  <option value="">— Select staff —</option>
                  {staffInventory.map(si => (
                    <option key={si.staff_id} value={si.staff_id}>{si.staff_name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Quantity">
                <input type="number" min={1} value={assignQty}
                  onChange={e => setAssignQty(Math.max(1, Number(e.target.value)))}
                  className={inputCls} />
              </Field>
              {inventory && (
                <p className="text-xs text-slate-400">
                  Available: <span className="font-bold text-green-600">{inventory.available_jars}</span> jars
                </p>
              )}
              <Button type="submit" loading={submitting} size="lg" className="w-full" icon={<UserCheck className="w-4 h-4" />}>
                Assign {assignQty} Jars
              </Button>
            </form>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Shared helpers ────────────────────────────────────────────────────────────

const inputCls = 'w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 transition-all';

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">{label}</label>
    {children}
  </div>
);

const Modal = ({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    onClick={onClose}>
    <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
      onClick={e => e.stopPropagation()}
      className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-base font-bold text-slate-900">{title}</h3>
        <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400">
          <X className="w-4 h-4" />
        </button>
      </div>
      {children}
    </motion.div>
  </motion.div>
);
