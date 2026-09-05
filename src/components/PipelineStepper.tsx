'use client';

import React from 'react';
import {
  Database,
  Sparkles,
  Shield,
  Zap,
  History,
  CheckCircle2,
  AlertTriangle,
  Lock,
  XCircle,
  Mail,
  ArrowRight,
} from 'lucide-react';
import type { PaymentRecord } from '@/lib/types';
import type { AIAssessmentAudit } from '@/lib/llm/types';
import type { ExecutionPreview, RecoveryExecutionResult } from '@/lib/execution/types';
import { formatINR } from '@/lib/format';

interface PipelineStepperProps {
  payment: PaymentRecord;
  aiAudit?: AIAssessmentAudit | null;
  executionPreview?: ExecutionPreview | null;
  executionResult?: RecoveryExecutionResult | null;
  isAiLoading?: boolean;
  isExecuting?: boolean;
}

export function PipelineStepper({
  payment,
  aiAudit,
  executionPreview,
  executionResult,
  isAiLoading,
  isExecuting,
}: PipelineStepperProps) {
  // Step 1: Detect
  const step1 = {
    title: '1. Detect',
    subtitle: payment.failure_reason ? payment.failure_reason.replace('_', ' ') : 'N/A',
    status: 'complete' as const,
    badge: `Attempt #${payment.attempt_count}`,
    badgeColor: 'text-slate-400 border-slate-700 bg-slate-800/80',
    icon: <Database className="w-3.5 h-3.5 text-slate-300" />,
  };

  // Step 2: Diagnose (AI)
  const rec = aiAudit?.ai_recommendation;
  const hasAi = !!rec;
  const step2 = {
    title: '2. Diagnose',
    subtitle: isAiLoading
      ? 'Analyzing...'
      : rec
      ? `${Math.round(rec.confidence * 100)}% Conf`
      : 'Rule Engine',
    status: isAiLoading ? ('loading' as const) : hasAi ? ('complete' as const) : ('ready' as const),
    badge: rec ? rec.risk_level.toUpperCase() : 'HEURISTIC',
    badgeColor: rec
      ? rec.risk_level === 'low'
        ? 'text-emerald-300 border-emerald-500/30 bg-emerald-950/40'
        : rec.risk_level === 'medium'
        ? 'text-amber-300 border-amber-500/30 bg-amber-950/40'
        : 'text-rose-300 border-rose-500/30 bg-rose-950/40'
      : 'text-indigo-300 border-indigo-500/30 bg-indigo-950/40',
    icon: <Sparkles className="w-3.5 h-3.5 text-purple-400" />,
  };

  // Step 3: Policy Gate
  const isOverridden = aiAudit?.policy_overridden;
  const policyRule = aiAudit?.final_decision?.policy_rule || executionPreview?.policy_rule || 'POL-100';
  const step3 = {
    title: '3. Policy Gate',
    subtitle: isOverridden ? 'Overridden' : 'Approved',
    status: isOverridden ? ('warning' as const) : ('complete' as const),
    badge: policyRule.split(':')[0],
    badgeColor: isOverridden
      ? 'text-amber-300 border-amber-500/40 bg-amber-950/40'
      : 'text-emerald-300 border-emerald-500/30 bg-emerald-950/40',
    icon: isOverridden ? (
      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
    ) : (
      <Shield className="w-3.5 h-3.5 text-sky-400" />
    ),
  };

  // Step 4: Execution Gate
  const eligibility = executionPreview?.execution_eligibility;
  const isBlocked = eligibility === 'blocked';
  const isAlreadyRecovered = eligibility === 'already_recovered';
  const isEligible = eligibility === 'eligible';

  const step4 = {
    title: '4. Execution Gate',
    subtitle: isAlreadyRecovered
      ? 'Idempotent Lock'
      : isBlocked
      ? 'Policy Block'
      : isEligible
      ? 'Eligible'
      : 'Action Required',
    status: isBlocked
      ? ('blocked' as const)
      : isAlreadyRecovered
      ? ('complete' as const)
      : ('ready' as const),
    badge: isAlreadyRecovered
      ? 'LOCKED'
      : isBlocked
      ? 'BLOCKED'
      : isEligible
      ? 'PASSED'
      : 'MANUAL',
    badgeColor: isAlreadyRecovered
      ? 'text-teal-300 border-teal-500/40 bg-teal-950/40'
      : isBlocked
      ? 'text-rose-400 border-rose-500/40 bg-rose-950/40'
      : isEligible
      ? 'text-emerald-300 border-emerald-500/40 bg-emerald-950/40'
      : 'text-sky-300 border-sky-500/40 bg-sky-950/40',
    icon: isBlocked ? (
      <Lock className="w-3.5 h-3.5 text-rose-400" />
    ) : isExecuting ? (
      <Zap className="w-3.5 h-3.5 text-teal-300 animate-pulse" />
    ) : (
      <Zap className="w-3.5 h-3.5 text-teal-400" />
    ),
  };

  // Step 5: Audit Ledger
  const pastExec = executionPreview?.previous_execution;
  const currentResult = executionResult || pastExec;
  const isSucceeded = currentResult?.status === 'succeeded';
  const isFailed = currentResult?.status === 'failed';
  const isCustomerAction = currentResult?.status === 'customer_action_required';

  const step5 = {
    title: '5. Audit Ledger',
    subtitle: currentResult
      ? isSucceeded
        ? `+${formatINR(currentResult.amount_recovered)}`
        : currentResult.status.replace('_', ' ')
      : 'Awaiting Run',
    status: currentResult
      ? isSucceeded
        ? ('complete' as const)
        : isFailed
        ? ('error' as const)
        : ('info' as const)
      : ('pending' as const),
    badge: currentResult
      ? isSucceeded
        ? 'RECOVERED'
        : currentResult.status.toUpperCase()
      : 'IDLE',
    badgeColor: isSucceeded
      ? 'text-emerald-300 border-emerald-500/50 bg-emerald-950/50'
      : isFailed
      ? 'text-rose-300 border-rose-500/50 bg-rose-950/50'
      : currentResult
      ? 'text-sky-300 border-sky-500/50 bg-sky-950/50'
      : 'text-slate-500 border-slate-700 bg-slate-800/40',
    icon: isSucceeded ? (
      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
    ) : isFailed ? (
      <XCircle className="w-3.5 h-3.5 text-rose-400" />
    ) : isCustomerAction ? (
      <Mail className="w-3.5 h-3.5 text-sky-400" />
    ) : (
      <History className="w-3.5 h-3.5 text-slate-400" />
    ),
  };

  const steps = [step1, step2, step3, step4, step5];

  return (
    <div className="rounded-xl border border-slate-800/90 bg-[#0b0e18] p-3 sm:p-4 mb-4">
      <div className="flex items-center justify-between mb-3 border-b border-slate-800/60 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
            End-to-End Governance Pipeline
          </span>
        </div>
        <span className="text-[10px] font-mono text-slate-400">
          Hardware Gate Active &bull; Zero Live Money Movement
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-2.5">
        {steps.map((step, idx) => {
          const isComplete = step.status === 'complete';
          const isWarning = step.status === 'warning';
          const isBlockedState = step.status === 'blocked';
          const isError = step.status === 'error';
          const isLoading = step.status === 'loading';

          let borderClass = 'border-slate-800 bg-[#0f1322]';
          if (isComplete) borderClass = 'border-emerald-500/30 bg-emerald-950/15 shadow-sm shadow-emerald-950/20';
          if (isWarning) borderClass = 'border-amber-500/40 bg-amber-950/20 shadow-sm shadow-amber-950/20';
          if (isBlockedState) borderClass = 'border-rose-500/40 bg-rose-950/20';
          if (isError) borderClass = 'border-rose-500/50 bg-rose-950/30';
          if (isLoading) borderClass = 'border-purple-500/40 bg-purple-950/20 animate-pulse';

          return (
            <div
              key={step.title}
              className={`rounded-lg border p-2.5 transition-all relative flex flex-col justify-between ${borderClass}`}
            >
              <div>
                <div className="flex items-center justify-between gap-1 mb-1">
                  <div className="flex items-center gap-1.5">
                    {step.icon}
                    <span className="font-semibold text-[11px] text-slate-200 tracking-tight">
                      {step.title}
                    </span>
                  </div>
                  <span
                    className={`font-mono text-[9px] px-1.5 py-0.2 rounded border font-bold ${step.badgeColor}`}
                  >
                    {step.badge}
                  </span>
                </div>

                <div className="text-[11px] font-medium text-slate-300 capitalize truncate mt-1">
                  {step.subtitle}
                </div>
              </div>

              {/* Connecting arrow for desktop, except last step */}
              {idx < 4 && (
                <div className="hidden sm:block absolute -right-2 top-1/2 -translate-y-1/2 z-10 text-slate-600 pointer-events-none">
                  <ArrowRight className="w-3 h-3 text-slate-600" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
