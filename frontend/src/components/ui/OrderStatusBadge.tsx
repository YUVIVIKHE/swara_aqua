export type OrderStatus = 'pending' | 'assigned' | 'delivered' | 'completed' | 'cancelled';

const config: Record<OrderStatus, { label: string; className: string; dot: string }> = {
  pending:          { label: 'Pending',          className: 'bg-amber-50  text-amber-700  border-amber-200',  dot: 'bg-amber-400'  },
  assigned:         { label: 'Assigned',         className: 'bg-blue-50   text-blue-700   border-blue-200',   dot: 'bg-blue-500'   },
  delivered:        { label: 'Delivered',        className: 'bg-teal-50   text-teal-700   border-teal-200',   dot: 'bg-teal-500'   },
  completed:        { label: 'Completed',        className: 'bg-green-50  text-green-700  border-green-200',  dot: 'bg-green-500'  },
  cancelled:        { label: 'Cancelled',        className: 'bg-red-50    text-red-600    border-red-200',    dot: 'bg-red-400'    },
};

export const OrderStatusBadge = ({ status }: { status: string }) => {
  const c = config[status as OrderStatus] ?? config.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${c.className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
};
