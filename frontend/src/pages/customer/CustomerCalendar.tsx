import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, Droplets,
  IndianRupee, CalendarDays, BarChart3,
} from 'lucide-react';
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
  const [active,  setActive]  = useState<string | null>(null);

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
  const deliveryDays = days.filter(d => Number(d.jars_delivered) > 0).length;
  const avgPerDay   = deliveryDays > 0 ? (totalJars / deliveryDays).toFixed(1) : '—';

  const firstDay    = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let startDay = firstDay.getDay() - 1;
  if (startDay < 0) startDay = 6;
  const cells: (number | null)[] = [
    ...Array(startDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const deliveryList = days
    .filter(d => Number(d.jars_delivered) > 0)
    .sort((a, b) => {
      const da = typeof a.date === 'string' ? a.date.split('T')[0] : new Date(a.date).toISOString().split('T')[0];
      const db = typeof b.date === 'string' ? b.date.split('T')[0] : new Date(b.date).toISOString().split('T')[0];
      return da.localeCompare(db);
    });

  return (
    <div className="max-w-lg space-y-4">

      {/* ── CALENDAR CARD ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.07)]">

        {/* Header — gradient background */}
        <div className="bg-gradient-to-br from-brand-700 via-brand-600 to-aqua-500 px-5 pt-5 pb-6 relative overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/10 pointer-events-none" />
          <div className="absolute top-8 -right-2 w-16 h-16 rounded-full bg-white/5 pointer-events-none" />

          {/* Month navigation */}
          <div className="flex items-center justify-between relative z-10">
            <button onClick={prevMonth}
              className="w-9 h-9 flex items-center justify-center rounded-2xl bg-white/15 hover:bg-white/25 active:scale-90 transition-all backdrop-blur-sm">
              <ChevronLeft className="w-4 h-4 text-white" />
            </button>
            <div className="text-center">
              <motion.p key={`${month}-${year}`}
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                className="text-xl font-bold text-white tracking-tight">
                {MONTHS_LONG[month]}
              </motion.p>
              <p className="text-white/60 text-xs font-semibold mt-0.5">{year}</p>
            </div>
            <button onClick={nextMonth}
              className="w-9 h-9 flex items-center justify-center rounded-2xl bg-white/15 hover:bg-white/25 active:scale-90 transition-all backdrop-blur-sm">
              <ChevronRight className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* Mini stats row */}
          <div className="flex items-center justify-center gap-5 mt-4 relative z-10">
            <div className="text-center">
              <p className="text-white font-extrabold text-lg leading-none">{loading ? '—' : totalJars}</p>
              <p className="text-white/60 text-[10px] font-semibold mt-0.5">Jars</p>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div className="text-center">
              <p className="text-white font-extrabold text-lg leading-none">{loading ? '—' : deliveryDays}</p>
              <p className="text-white/60 text-[10px] font-semibold mt-0.5">Days</p>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div className="text-center">
              <p className="text-white font-extrabold text-lg leading-none">{loading ? '—' : `₹${totalAmount}`}</p>
              <p className="text-white/60 text-[10px] font-semibold mt-0.5">Amount</p>
            </div>
          </div>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-100">
          {DAYS_SHORT.map((d, i) => (
            <div key={d} className={`py-2.5 text-center text-[10px] font-bold uppercase tracking-widest
              ${i >= 5 ? 'text-brand-400' : 'text-slate-400'}`}>
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="grid grid-cols-7 p-3 gap-1.5">
              {Array.from({ length: 35 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-xl bg-slate-100 animate-pulse" />
              ))}
            </motion.div>
          ) : (
            <motion.div key={monthStr}
              initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }}
              className="grid grid-cols-7 p-3 gap-1.5">
              {cells.map((day, i) => {
                if (day === null) return <div key={`e-${i}`} className="aspect-square" />;

                const dateStr  = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const data     = dayMap.get(dateStr);
                const isToday  = dateStr === todayStr;
                const hasData  = !!data && Number(data.jars_delivered) > 0;
                const jars     = hasData ? Number(data!.jars_delivered) : 0;
                const colIndex = i % 7;
                const isWeekend = colIndex >= 5;
                const isFuture = new Date(dateStr + 'T00:00:00') > now;
                const isActive = active === dateStr;

                return (
                  <motion.button
                    key={dateStr}
                    whileTap={{ scale: 0.88 }}
                    onClick={() => setActive(isActive ? null : dateStr)}
                    className={`
                      aspect-square rounded-2xl flex flex-col items-center justify-center
                      relative select-none transition-all duration-200 text-center
                      ${isToday
                        ? 'bg-gradient-to-br from-brand-600 to-aqua-500 shadow-[0_4px_14px_rgba(37,99,235,0.4)]'
                        : hasData
                          ? 'bg-brand-50 border-2 border-brand-200'
                          : isWeekend
                            ? 'bg-slate-50/80'
                            : 'hover:bg-slate-50'}
                      ${isFuture && !isToday ? 'opacity-25' : ''}
                    `}
                  >
                    {/* Day number */}
                    <span className={`text-[11px] font-bold leading-none
                      ${isToday ? 'text-white'
                        : hasData ? 'text-brand-700'
                        : isWeekend ? 'text-slate-400'
                        : 'text-slate-500'}`}>
                      {day}
                    </span>

                    {/* Jar count or delivery dot */}
                    {hasData ? (
                      <>
                        <span className={`text-[13px] font-extrabold leading-none mt-0.5
                          ${isToday ? 'text-white' : 'text-brand-600'}`}>
                          {jars}
                        </span>
                        {/* Small drop icon */}
                        <svg viewBox="0 0 24 24"
                          className={`w-2 h-2 mt-0.5 fill-current ${isToday ? 'text-white/70' : 'text-aqua-400'}`}>
                          <path d="M12 2C12 2 5 9.5 5 14a7 7 0 0 0 14 0c0-4.5-7-12-7-12z" />
                        </svg>
                      </>
                    ) : isToday ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-white/60 mt-1" />
                    ) : null}

                    {/* Tap tooltip */}
                    {hasData && isActive && data && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.85 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        className="absolute -top-16 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-semibold px-3 py-2 rounded-2xl whitespace-nowrap z-30 shadow-2xl pointer-events-none border border-white/10">
                        <p className="text-center">{jars} jar{jars !== 1 ? 's' : ''} delivered</p>
                        <p className="text-white/50 text-center">₹{Number(data.total_amount).toLocaleString('en-IN')}</p>
                        <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-900 rotate-45 block border-r border-b border-white/10" />
                      </motion.div>
                    )}
                  </motion.button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Legend */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-50 bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-md bg-gradient-to-br from-brand-500 to-aqua-500" />
              <span className="text-[10px] text-slate-400 font-semibold">Today</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-md bg-brand-50 border-2 border-brand-200" />
              <span className="text-[10px] text-slate-400 font-semibold">Delivered</span>
            </div>
          </div>
          {!loading && (
            <span className="text-[10px] text-slate-300 font-medium italic">tap for details</span>
          )}
        </div>
      </motion.div>

      {/* ── DELIVERY LIST ── */}
      {!loading && deliveryList.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
          className="space-y-3">

          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">
            Deliveries this month
          </p>

          {deliveryList.map((d, i) => {
            const dateStr = typeof d.date === 'string'
              ? d.date.split('T')[0]
              : new Date(d.date).toISOString().split('T')[0];
            const [, , dd] = dateStr.split('-');
            const dayNum   = parseInt(dd, 10);
            const jars     = Number(d.jars_delivered);
            const amount   = Number(d.total_amount);
            const dateObj  = new Date(dateStr + 'T00:00:00');
            const weekday  = dateObj.toLocaleDateString('en-IN', { weekday: 'short' });

            return (
              <motion.div key={dateStr}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.14 + i * 0.045 }}
                className="flex items-center gap-3 bg-white rounded-2xl border border-slate-100 shadow-card px-4 py-3.5">

                {/* Date chip */}
                <div className="w-12 h-12 bg-gradient-to-br from-brand-600 to-aqua-500 rounded-2xl flex flex-col items-center justify-center shrink-0 shadow-[0_4px_12px_rgba(37,99,235,0.3)]">
                  <span className="text-white font-extrabold text-base leading-none">{dayNum}</span>
                  <span className="text-white/70 text-[9px] font-bold leading-none mt-0.5">{MONTHS_SHORT[month]}</span>
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800">
                    {jars} Jar{jars !== 1 ? 's' : ''} Delivered
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">{weekday}, {dayNum} {MONTHS_SHORT[month]} {year}</p>
                </div>

                {/* Amount pill */}
                <div className="shrink-0 bg-brand-50 border border-brand-100 rounded-xl px-3 py-1.5 text-right">
                  <p className="text-sm font-bold text-brand-600 leading-none">₹{amount.toLocaleString('en-IN')}</p>
                  <p className="text-[9px] text-brand-300 font-semibold leading-none mt-0.5">collected</p>
                </div>
              </motion.div>
            );
          })}

          {/* Month total banner */}
          <div className="relative overflow-hidden bg-gradient-to-r from-brand-700 to-aqua-500 rounded-2xl px-5 py-4 flex items-center justify-between">
            <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/10 pointer-events-none" />
            <div className="flex items-center gap-3 relative z-10">
              <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
                <Droplets className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-white font-bold text-sm leading-none">Month Total</p>
                <p className="text-white/60 text-xs mt-0.5">{deliveryDays} delivery day{deliveryDays !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <div className="text-right relative z-10">
              <p className="text-white font-extrabold text-lg leading-none">{totalJars} jars</p>
              <p className="text-white/70 text-xs mt-0.5">₹{totalAmount.toLocaleString('en-IN')}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Empty state */}
      {!loading && deliveryList.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
          className="bg-white rounded-2xl border border-slate-100 shadow-card p-10 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-brand-100 to-aqua-50 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <CalendarDays className="w-8 h-8 text-brand-300" />
          </div>
          <p className="text-sm font-bold text-slate-700">No deliveries this month</p>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Deliveries will appear here once they're recorded by your delivery partner.
          </p>
        </motion.div>
      )}
    </div>
  );
};
