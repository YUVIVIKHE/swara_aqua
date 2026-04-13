export const Skeleton = ({ className = '' }: { className?: string }) => (
  <div className={`animate-pulse bg-slate-200 rounded-xl ${className}`} />
);

export const StatCardSkeleton = () => (
  <div className="bg-white rounded-2xl shadow-card border border-slate-100 p-5">
    <div className="flex items-start justify-between mb-4">
      <Skeleton className="w-11 h-11 rounded-2xl" />
      <Skeleton className="w-12 h-6 rounded-lg" />
    </div>
    <Skeleton className="w-16 h-7 mb-2" />
    <Skeleton className="w-24 h-4" />
  </div>
);
