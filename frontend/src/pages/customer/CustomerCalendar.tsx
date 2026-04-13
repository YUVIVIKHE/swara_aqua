import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Droplets, IndianRupee, CalendarDays, BarChart3, Package } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';
import { calendarApi, CalendarDay } from '../../api/calendar';

const DAYS_SHORT  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS_LONG = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

interface CalendarProps { customerId?: number; }

export const CustomerCalendar = ({ customerId }: CalendarProps = {}) => {
  const { toast } = useToast();
  const now = new Date();
  const [year,    setYear]    = useState(now.getFullYear());
  const [month,   setMonth]   = useState(now.getMonth());
  const [days,    setDays]    = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [active,  setActive]  = useState<string | null>(null); // for mobile tap tooltip

  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;

  const load = async () => {
    setLoading(true);
    setActive(null);
    try {
      const { data } = await calendarApi.getCalendar(monthStr, customerId);
      setDays(data.days);
    } catch { toast('Failed to load calendar data', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [year, month]);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  // Build day map
  const dayMap = new Map<string, CalendarDay>();
  days.forEach(d => {
    const dateStr = typeof d.date === 'string'
      ? d.date.split('T')[0]
      : new Date(d.date).toISOString().split('T')[0];
    dayMap.set(dateStr, d);
  });

  const todayStr    = now.toISOString().split('T')[0];
  const totalJars   = days.reduce((s, d) => s + Number(d.jars_delivered), 0);
  const totalAmount = days.reduce((s, d) => s + Number(d.total_amount), 0);
  const deliveryDays = days.length;
  const avgPerDay   = deliveryDays > 0 ? (totalJars / deliveryDays).toFixed(1) : '—';

  // Grid cells
  const firstDay    = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let startDay = firstDay.getDay() - 1;
  if (startDay < 0) startDay = 6;
  const cells: (number | null)[] = [
    ...Array(startDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  // Delivery list for bottom section
  const deliveryList = days
    .filter(d => Number(d.jars_delivered) > 0)
    .sort((a, b) => {
      const da = typeof a.date === 'string' ? a.date.split('T')[0] : new Date(a.date).toISOString().split('T')[0];
      const db = typeof b.date === 'string' ? b.date.split('T')[0] : new Date(b.date).toISOString().split('T')[0];
      return da.localeCompare(db);
    });

  return (
    <div className="max-w-2xl space-y-4">

      {/* ── Month navigation header ── */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between bg-white rounded-2xl border border-slate-100 shadow-card px-4 py-3">
        <button onClick={prevMonth}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 transition-all">
          <ChevronLeft className="w-4 h-4 text-slate-600" />
        </button>
        <div className="text-center">
          <p className="text-base font-bold text-slate-900">{MONTHS_LONG[month]}</p>
          <p className="text-xs text-slate-400 font-medium">{year}</p>
        </div>
        <button onClick={nextMonth}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 transition-all">
          <ChevronRight className="w-4 h-4 text-slate-600" />
        </button>
      </motion.div>

      {/* ── Stats strip ── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="grid grid-cols-4 gap-2">
        {[
          { icon: Droplets,    label: 'Jars',    value: loading ? '—' : String(totalJars),        grad: 'from-brand-500 to-aqua-500' },
          { icon: CalendarDays,label: 'Days',    value: loading ? '—' : String(deliveryDays),     grad: 'from-purple-500 to-indigo-500' },
          { icon: BarChart3,   label: 'Avg/Day', value: loading ? '—' : avgPerDay,                grad: 'from-teal-500 to-green-500' },
          { icon: IndianRupee, label: 'Amount',  value: loading ? '—' : `₹${totalAmount}`,        grad: 'from-amber-500 to-orange-500' },
        ].map(({ icon: Icon, label, value, grad }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-card p-3 flex flex-col items-center gap-1.5">
            <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center`}>
              <Icon className="w-4 h-4 text-white" />
            </div>
            <p className="text-sm font-bold text-slate-800 leading-none">{value}</p>
            <p className="text-[10px] text-slate-400 font-medium leading-none">{label}</p>
          </div>
        ))}
      </motion.div>

      {/* ── Calendar grid ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="bg-white rounded-3xl border border-slate-100 shadow-card overflow-hidden">

        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-slate-100">
          {DAYS_SHORT.map((d, i) => (
            <div key={d} className={`py-3 text-center text-[11px] font-bold uppercase tracking-wide
              ${i >= 5 ? 'text-brand-400' : 'text-slate-400'}`}>
              {d}
            </div>
          ))}
        </div>

        {/* Grid cells */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="grid grid-cols-7 p-2.5 gap-1.5">
              {Array.from({ length: 35 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-xl bg-slate-100 animate-pulse" />
              ))}
            </motion.div>
          ) : (
            <motion.div key={monthStr}
              initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.22 }}
              className="grid grid-cols-7 p-2.5 gap-1.5">
              {cells.map((day, i) => {
                if (day === null) return <div key={`e-${i}`} className="aspect-square" />;

                const dateStr   = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const data      = dayMap.get(dateStr);
                const isToday   = dateStr === todayStr;
                const hasData   = !!data && Number(data.jars_delivered) > 0;
                const jars      = hasData ? Number(data!.jars_delivered) : 0;
                const colIndex  = i % 7;
                const isWeekend = colIndex >= 5;
                const isFuture  = new Date(dateStr) > now;
                const isActive  = active === dateStr;

                return (
                  <motion.button
                    key={dateStr}
                    whileTap={{ scale: 0.92 }}
                    onClick={() => setActive(isActive ? null : dateStr)}
                    className={`
                      aspect-square rounded-xl flex flex-col items-center justify-center
                      relative select-none transition-all duration-150 text-center
                      ${isToday   ? 'bg-gradient-to-br from-brand-500 to-aqua-500 shadow-[0_4px_12px_rgba(37,99,235,0.35)]'
                      : hasData   ? 'bg-brand-50 border border-brand-100 hover:bg-brand-100'
                      : isWeekend ? 'bg-slate-50'
                      : 'hover:bg-slate-50'}
                      ${isFuture && !isToday ? 'opacity-30' : ''}
                    `}
                  >
                    {/* Day number */}
                    <span className={`text-[11px] font-bold leading-none
                      ${isToday ? 'text-white'
                      : hasData  ? 'text-brand-700'
                      : isWeekend ? 'text-slate-400'
                      : 'text-slate-500'}`}>
                      {day}
                    </span>

                    {/* Jar count */}
                    {hasData && (
                      <>
                        <span className={`text-xs font-extrabold leading-tight mt-0.5
                          ${isToday ? 'text-white' : 'text-brand-600'}`}>
                          {jars}
                        </span>
                        <span className={`text-[7px] font-semibold uppercase leading-none
                          ${isToday ? 'text-white/70' : 'text-brand-400'}`}>
                          {jars === 1 ? 'jar' : 'jars'}
                        </span>
                      </>
                    )}

                    {/* Today dot (no delivery) */}
                    {isToday && !hasData && (
                      <span className="w-1.5 h-1.5 rounded-full bg-white/70 mt-0.5" />
                    )}

                    {/* Tap tooltip */}
                    {hasData && isActive && data && (
                      <motion.div
                        initial={{ opacity: 0, y: 6, scale: 0.85 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        className="absolute -top-14 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-semibold px-3 py-2 rounded-xl whitespace-nowrap z-30 shadow-2xl pointer-events-none"
                      >
                        <p>{jars} jar{jars !== 1 ? 's' : ''}</p>
                        <p className="text-white/60">₹{Number(data.total_amount).toLocaleString('en-IN')}</p>
                        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45 block" />
                      </motion.div>
                    )}
                  </motion.button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Legend footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-50">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-md bg-gradient-to-br from-brand-500 to-aqua-500" />
              <span className="text-[10px] text-slate-400 font-medium">Today</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-md bg-brand-50 border border-brand-100" />
              <span className="text-[10px] text-slate-400 font-medium">Delivery</span>
            </div>
          </div>
          {!loading && (
            <span className="text-[10px] text-slate-400 font-medium">
              Tap delivery date for details
            </span>
          )}
        </div>
      </motion.div>

      {/* ── Delivery list ── */}
      {!loading && deliveryList.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Deliveries This Month
          </p>
          <div className="space-y-2">
            {deliveryList.map((d, i) => {
              const dateStr = typeof d.date === 'string'
                ? d.date.split('T')[0]
                : new Date(d.date).toISOString().split('T')[0];
              const [, , dd] = dateStr.split('-');
              const dayNum   = parseInt(dd, 10);
              const jars     = Number(d.jars_delivered);
              const amount   = Number(d.total_amount);

              return (
                <motion.div key={dateStr}
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.04 }}
                  className="bg-white rounded-2xl border border-slate-100 shadow-card px-4 py-3 flex items-center gap-4">

                  {/* Date badge */}
                  <div className="w-11 h-11 bg-gradient-to-br from-brand-100 to-aqua-50 rounded-2xl flex flex-col items-center justify-center shrink-0">
                    <span className="text-brand-700 text-sm font-extrabold leading-none">{dayNum}</span>
                    <span className="text-brand-400 text-[9px] font-semibold leading-none mt-0.5">
                      {MONTHS_SHORT[month]}
                    </span>
                  </div>

                  {/* Icon */}
                  <div className="w-9 h-9 bg-brand-50 rounded-xl flex items-center justify-center shrink-0">
                    <Package className="w-4 h-4 text-brand-500" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800">
                      {jars} Jar{jars !== 1 ? 's' : ''} Delivered
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{dateStr}</p>
                  </div>

                  {/* Amount */}
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-brand-600">₹{amount.toLocaleString('en-IN')}</p>
                  </div>
                </motion.div>
              );
            })}

            {/* Month total footer */}
            <div className="bg-gradient-to-r from-brand-600 to-aqua-500 rounded-2xl px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Droplets className="w-4 h-4 text-white/80" />
                <p className="text-white font-bold text-sm">Month Total</p>
              </div>
              <div className="text-right">
                <p className="text-white font-extrabold text-sm">{totalJars} jars</p>
                <p className="text-white/70 text-xs">₹{totalAmount.toLocaleString('en-IN')}</p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Empty state */}
      {!loading && deliveryList.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
          className="bg-white rounded-2xl border border-slate-100 shadow-card p-8 text-center">
          <div className="w-14 h-14 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <CalendarDays className="w-7 h-7 text-brand-300" />
          </div>
          <p className="text-sm font-bold text-slate-700">No deliveries this month</p>
          <p className="text-xs text-slate-400 mt-1">Deliveries will appear here as they are recorded.</p>
        </motion.div>
      )}
    </div>
  );
};
