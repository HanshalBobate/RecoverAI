import React from 'react';
import { PaymentStatus } from '@/lib/types';
import { formatStatus } from '@/lib/format';

interface StatusBadgeProps {
  status: PaymentStatus;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  let colorStyles = '';
  let dotColor = '';

  switch (status) {
    case 'failed':
      colorStyles = 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      dotColor = 'bg-rose-400 animate-pulse';
      break;
    case 'abandoned':
      colorStyles = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      dotColor = 'bg-amber-400';
      break;
    case 'pending':
      colorStyles = 'bg-sky-500/10 text-sky-400 border-sky-500/30';
      dotColor = 'bg-sky-400';
      break;
    case 'successful':
      colorStyles = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      dotColor = 'bg-emerald-400';
      break;
    default:
      colorStyles = 'bg-slate-500/10 text-slate-400 border-slate-500/30';
      dotColor = 'bg-slate-400';
  }

  const sizeStyles = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium uppercase tracking-wider rounded-md border ${sizeStyles} ${colorStyles}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      {formatStatus(status)}
    </span>
  );
}
