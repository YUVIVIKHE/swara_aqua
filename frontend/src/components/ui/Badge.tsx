interface Props { status: string; }

const map: Record<string, string> = {
  active:   'bg-green-50 text-green-700 border-green-200',
  pending:  'bg-amber-50 text-amber-700 border-amber-200',
  rejected: 'bg-red-50 text-red-600 border-red-200',
  admin:    'bg-brand-50 text-brand-700 border-brand-200',
  staff:    'bg-purple-50 text-purple-700 border-purple-200',
  customer: 'bg-slate-100 text-slate-600 border-slate-200',
};

export const Badge = ({ status }: Props) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize ${map[status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
    {status}
  </span>
);
