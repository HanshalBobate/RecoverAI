import { FailureReason, PaymentStatus } from './types';

export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatFailureReason(reason: FailureReason | string | null): string {
  if (!reason) return 'None';
  switch (reason) {
    case 'insufficient_funds':
      return 'Insufficient Funds';
    case 'bank_decline':
      return 'Bank Decline';
    case 'expired_card':
      return 'Expired Card';
    case 'timeout':
      return 'Gateway Timeout';
    case 'authentication_failure':
      return '3DS / Auth Failure';
    case 'gateway_error':
      return 'Gateway Error';
    case 'checkout_abandoned':
      return 'Checkout Abandoned';
    default:
      return reason
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
  }
}

export function formatStatus(status: PaymentStatus): string {
  switch (status) {
    case 'failed':
      return 'FAILED';
    case 'abandoned':
      return 'ABANDONED';
    case 'pending':
      return 'PENDING';
    case 'successful':
      return 'SUCCESSFUL';
    default:
      return status;
  }
}

export function formatDate(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    return new Intl.DateTimeFormat('en-IN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    return isoDate;
  }
}
