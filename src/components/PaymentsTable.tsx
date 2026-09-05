'use client';

import React from 'react';
import { PaymentRecord } from '@/lib/types';
import { formatINR, formatFailureReason, formatDate } from '@/lib/format';
import { StatusBadge } from './StatusBadge';
import { ChevronRight, CreditCard, Smartphone, Globe } from 'lucide-react';

interface PaymentsTableProps {
  payments: PaymentRecord[];
  onSelectPayment: (payment: PaymentRecord) => void;
  isLoading?: boolean;
}

export function PaymentsTable({
  payments,
  onSelectPayment,
  isLoading = false,
}: PaymentsTableProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-800 bg-[#0d0f17] p-12 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-rose-500 border-t-transparent" />
        <p className="mt-3 text-sm text-slate-400">Loading payments ledger...</p>
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-[#0d0f17] p-12 text-center">
        <p className="text-base font-medium text-slate-300">No payment records found</p>
        <p className="mt-1 text-xs text-slate-500">
          Try adjusting your search criteria or filter selections.
        </p>
      </div>
    );
  }

  const getMethodIcon = (type: string) => {
    switch (type) {
      case 'upi':
        return <Smartphone className="w-3.5 h-3.5 text-emerald-400" />;
      case 'netbanking':
        return <Globe className="w-3.5 h-3.5 text-sky-400" />;
      default:
        return <CreditCard className="w-3.5 h-3.5 text-indigo-400" />;
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-[#0d0f17] shadow-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="border-b border-slate-800 bg-[#121622] text-[11px] uppercase tracking-wider text-slate-400">
            <tr>
              <th scope="col" className="px-5 py-3.5 font-semibold">
                Customer
              </th>
              <th scope="col" className="px-4 py-3.5 font-semibold">
                Payment ID
              </th>
              <th scope="col" className="px-4 py-3.5 font-semibold text-right">
                Amount
              </th>
              <th scope="col" className="px-4 py-3.5 font-semibold text-center">
                Status
              </th>
              <th scope="col" className="px-4 py-3.5 font-semibold">
                Failure Reason
              </th>
              <th scope="col" className="px-4 py-3.5 font-semibold text-center">
                Attempts
              </th>
              <th scope="col" className="px-4 py-3.5 font-semibold">
                Last Attempt
              </th>
              <th scope="col" className="px-4 py-3.5 font-semibold text-center">
                <span className="sr-only">Inspect</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {payments.map((p) => {
              const isAtRisk = p.status === 'failed' || p.status === 'abandoned';
              return (
                <tr
                  key={p.payment_id}
                  onClick={() => onSelectPayment(p)}
                  className="group cursor-pointer transition-colors duration-150 hover:bg-slate-800/40"
                >
                  {/* Customer */}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-slate-200 border border-slate-700">
                        {p.customer_name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2)}
                      </div>
                      <div>
                        <div className="font-medium text-white group-hover:text-rose-300 transition-colors">
                          {p.customer_name}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {p.customer_email}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Payment ID & Channel */}
                  <td className="px-4 py-3.5">
                    <div className="font-mono text-[11px] text-slate-300 font-medium">
                      {p.payment_id}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                      {getMethodIcon(p.payment_method_type)}
                      <span className="truncate max-w-[140px]">
                        {p.payment_method_detail || p.payment_method_type.toUpperCase()}
                      </span>
                    </div>
                  </td>

                  {/* Amount */}
                  <td className="px-4 py-3.5 text-right">
                    <div
                      className={`font-mono text-sm font-bold ${
                        isAtRisk ? 'text-rose-300' : 'text-slate-100'
                      }`}
                    >
                      {formatINR(p.amount)}
                    </div>
                    <div className="text-[10px] text-slate-400">INR</div>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3.5 text-center">
                    <StatusBadge status={p.status} />
                  </td>

                  {/* Failure Reason */}
                  <td className="px-4 py-3.5">
                    {p.failure_reason ? (
                      <span className="inline-flex items-center gap-1.5 font-medium text-slate-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                        {formatFailureReason(p.failure_reason)}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">None</span>
                    )}
                  </td>

                  {/* Attempts */}
                  <td className="px-4 py-3.5 text-center">
                    <span
                      className={`inline-block rounded px-2 py-0.5 font-mono text-[11px] ${
                        p.attempt_count > 2
                          ? 'bg-rose-950/40 text-rose-300 border border-rose-800/40'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {p.attempt_count} {p.attempt_count === 1 ? 'try' : 'tries'}
                    </span>
                  </td>

                  {/* Last Attempt */}
                  <td className="px-4 py-3.5 text-slate-400 font-mono text-[11px]">
                    {formatDate(p.last_attempt_at)}
                  </td>

                  {/* Action arrow */}
                  <td className="px-4 py-3.5 text-right">
                    <div className="flex justify-end">
                      <span className="rounded p-1 text-slate-400 group-hover:bg-slate-700 group-hover:text-white transition-colors">
                        <ChevronRight className="w-4 h-4" />
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
