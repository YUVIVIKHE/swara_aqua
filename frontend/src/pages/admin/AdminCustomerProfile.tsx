import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Phone, MapPin, Droplets, Package, CreditCard, IndianRupee,
  ChevronLeft, ChevronRight, FileText,
} from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { OrderStatusBadge } from '../../components/ui/OrderStatusBadge';
import { Skeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { calendarApi, CalendarDay, CustomerProfile, CustomerProfileStats } from '../../api/calendar';

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const BILL_STATUS: Record<string, string> = {
  paid:    'bg-green-50 text-green-700 border-green-200',
  partial: 'bg-amber-50 text-amber-700 border-amber-200',
  unpaid:  'bg-red-50   text-red-600   border-red-200',
};

export const AdminCustomerProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [stats, setStats]     = useState<CustomerProfileStats | null>(null);
  const [bills, setBills]     = useState<any[]>([]);
  const [orders, setOrders]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Calendar state
  const now = new Date();
  const [calYear, setCalYear]   = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [calDays, setCalDays]   = useState<CalendarDay[]>([]);
  const [calLoading, setCalLoading] = useState(true);

  const calMonthStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}`;

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    calendarApi.getCustomerProfile(Number(id))
      .then(({ data }) => {
        setProfile(data.customer);
        setStats(data.stats);
        setBills(data.bills);
        setOrders(data.orders);
      })
      .catch(() => toast('Failed to load customer profile', 'error'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setCalLoading(true);
    calendarApi.getCalendar(calMonthStr, Number(id))
      .then(({ data }) => setCalDays(data.days))
      .catch(() => {})
      .finally(() => setCalLoading(false));
  }, [id, calYear, calMonth]);

  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
    else setCalMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
    else setCalMonth(m => m + 1);
  };

  // Calendar grid
  const firstDay = new Date(calYear, calMonth, 1);
  const lastDay = new Date(calYear, calMonth + 1, 0);
  const daysInMonth = lastDay.getDate();
  let startDay = firstDay.getDay() - 1;
  if (startDay < 0) startDay = 6;

  const dayMap = new Map<string, CalendarDay>();
  calDays.forEach(d => {
    const dateStr = typeof d.date === 'string' ? d.date.split('T')[0] : new Date(d.date).toISOString().split('T')[0];
    dayMap.set(dateStr, d);
  });

  const todayStr = now.toISOString().split('T')[0];
  const calTotalJars = calDays.reduce((s, d) => s + Number(d.jars_delivered), 0);
  const calTotalAmount = calDays.reduce((s, d) => s + Number(d.total_amount), 0);

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let i = 1; i <= daysInMonth; i++) cells.push(i);
  while (cells.length % 7 !== 0) cells.push(null);

  if (loading) {
    return (
      <div className="max-w-4xl space-y-5">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-4xl text-center py-20">
        <p className="text-slate-400">Customer not found</p>
        <Button variant="secondary" size="sm" onClick={() => navigate('/admin/users')} className="mt-4">
          Back to Users
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">

      {/* Back + Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/admin/users')}
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 hover:bg-slate-50 transition-all shrink-0">
          <ArrowLeft className="w-4.5 h-4.5 text-slate-600" />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-slate-900">{profile.name}</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge status={profile.status} />
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Phone className="w-3 h-3" />{profile.phone}
            </span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs text-slate-500">
              Joined {new Date(profile.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
        </div>
      </div>

      {/* Profile cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Jar Rate',       value: `₹${profile.jar_rate || 50}`, icon: IndianRupee, color: 'from-brand-500 to-aqua-500' },
          { label: 'Total Jars',     value: stats?.total_jars_delivered || 0, icon: Droplets, color: 'from-blue-500 to-cyan-500' },
          { label: 'Total Orders',   value: stats?.total_orders || 0, icon: Package, color: 'from-purple-500 to-pink-500' },
          { label: 'Pending',        value: `₹${stats?.pending_amount || 0}`, icon: CreditCard, color: 'from-red-500 to-orange-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <motion.div key={label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-slate-100 shadow-card p-4">
            <div className={`w-9 h-9 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center mb-2`}>
              <Icon className="w-4.5 h-4.5 text-white" />
            </div>
            <p className="text-xl font-bold text-slate-800">{value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{label}</p>
          </motion.div>
        ))}
      </div>

      {/* Address */}
      {profile.address && (
        <div className="flex items-start gap-2 bg-white rounded-2xl border border-slate-100 shadow-card p-4">
          <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
          <p className="text-sm text-slate-700">{profile.address}</p>
        </div>
      )}

      {/* ── Calendar ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Delivery Calendar</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {calTotalJars} jars · ₹{calTotalAmount} · {calDays.length} days
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors">
              <ChevronLeft className="w-4 h-4 text-slate-500" />
            </button>
            <span className="text-sm font-semibold text-slate-700 min-w-[130px] text-center">
              {MONTH_NAMES[calMonth]} {calYear}
            </span>
            <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors">
              <ChevronRight className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
          {DAYS_OF_WEEK.map(d => (
            <div key={d} className="py-2.5 text-center text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{d}</div>
          ))}
        </div>

        {calLoading ? (
          <div className="p-4"><Skeleton className="h-48 w-full rounded-xl" /></div>
        ) : (
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              if (day === null) return <div key={`e-${i}`} className="aspect-square border-b border-r border-slate-50 bg-slate-50/30" />;
              const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const data = dayMap.get(dateStr);
              const isToday = dateStr === todayStr;
              const hasData = !!data && Number(data.jars_delivered) > 0;
              return (
                <div key={dateStr} className={`aspect-square border-b border-r border-slate-50 p-1 flex flex-col items-center justify-center
                  ${isToday ? 'ring-2 ring-brand-400 ring-inset bg-brand-50/40' : ''}
                  ${hasData ? 'bg-gradient-to-br from-brand-50 to-aqua-400/10' : ''}
                `}>
                  <span className={`text-[10px] font-medium ${isToday ? 'text-brand-700 font-bold' : hasData ? 'text-brand-600' : 'text-slate-400'}`}>
                    {day}
                  </span>
                  {hasData && (
                    <span className="text-xs font-bold text-brand-700 leading-none mt-0.5">{data.jars_delivered}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Bills History ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-400" /> Bills History
          </h3>
        </div>
        {bills.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-400">No bills generated yet</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {bills.map((b: any) => (
              <div key={b.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                <div>
                  <p className="text-sm font-semibold text-slate-700">{b.month}</p>
                  <p className="text-xs text-slate-400">{b.total_jars} jars · Due {new Date(b.due_date).toLocaleDateString('en-IN')}</p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-bold text-brand-600">₹{b.total_amount}</p>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize ${BILL_STATUS[b.status]}`}>
                    {b.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Recent Orders ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Package className="w-4 h-4 text-slate-400" /> Recent Orders
          </h3>
        </div>
        {orders.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-400">No orders yet</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {orders.map((o: any) => (
              <div key={o.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-400">#{o.id}</span>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{o.quantity} jars · <span className="capitalize text-slate-500">{o.type}</span></p>
                    <p className="text-xs text-slate-400">
                      {new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-bold text-brand-600">₹{o.total_amount}</p>
                  <OrderStatusBadge status={o.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
