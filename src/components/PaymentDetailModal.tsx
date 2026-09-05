'use client';

import React, { useMemo, useState, useEffect } from 'react';
import {
  X,
  CreditCard,
  User,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Info,
  Layers,
  RefreshCw,
  Mail,
  ShieldCheck,
  Cpu,
  AlertTriangle,
  Bot,
  Sparkles,
  ArrowRight,
  Shield,
  Zap,
  Lock,
  History,
  Play,
} from 'lucide-react';
import { PaymentRecord } from '@/lib/types';
import { assessPayment, RecoveryAction } from '@/lib/recovery';
import type { AIAssessmentAudit } from '@/lib/llm/types';
import type { ExecutionPreview, RecoveryExecutionResult } from '@/lib/execution/types';
import { formatINR, formatFailureReason, formatDate } from '@/lib/format';
import { StatusBadge } from './StatusBadge';
import { PipelineStepper } from './PipelineStepper';

interface PaymentDetailModalProps {
  payment: PaymentRecord | null;
  onClose: () => void;
}

function getActionBadge(action: RecoveryAction) {
  switch (action) {
    case 'retry_payment':
      return {
        label: 'Retry Payment',
        icon: <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />,
        bg: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
      };
    case 'contact_customer':
      return {
        label: 'Contact Customer',
        icon: <Mail className="w-3.5 h-3.5 text-sky-400" />,
        bg: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
      };
    case 'request_payment_method_update':
      return {
        label: 'Request Method Update',
        icon: <CreditCard className="w-3.5 h-3.5 text-amber-400" />,
        bg: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
      };
    case 'escalate_to_human':
      return {
        label: 'Escalate to Human Operator',
        icon: <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />,
        bg: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
      };
    case 'do_nothing':
    default:
      return {
        label: 'Do Nothing (Hold)',
        icon: <AlertCircle className="w-3.5 h-3.5 text-slate-400" />,
        bg: 'bg-slate-500/10 text-slate-300 border-slate-700',
      };
  }
}

function getClassificationBadge(classification: string) {
  switch (classification) {
    case 'recoverable':
      return {
        label: 'Recoverable',
        badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
      };
    case 'requires_escalation':
      return {
        label: 'Requires Escalation',
        badge: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
      };
    case 'unlikely_recoverable':
    default:
      return {
        label: 'Unlikely Recoverable',
        badge: 'bg-slate-700/40 text-slate-300 border-slate-600',
      };
  }
}

export function PaymentDetailModal({ payment, onClose }: PaymentDetailModalProps) {
  if (!payment) return null;

  const [aiAudit, setAiAudit] = useState<AIAssessmentAudit | null>(null);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [executionPreview, setExecutionPreview] = useState<ExecutionPreview | null>(null);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [executionResult, setExecutionResult] = useState<RecoveryExecutionResult | null>(null);

  // Fallback / initial deterministic evaluation
  const fallbackDecision = useMemo(() => assessPayment(payment), [payment]);

  const loadExecutionPreview = () => {
    if (!payment) return;
    fetch(`/api/payments/${payment.payment_id}/execution-preview`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.data) {
          setExecutionPreview(json.data);
        }
      })
      .catch((err) => {
        console.error('Failed to load execution preview:', err);
      });
  };

  useEffect(() => {
    if (!payment) {
      setAiAudit(null);
      setExecutionPreview(null);
      setExecutionResult(null);
      return;
    }

    let isMounted = true;
    setIsAiLoading(true);
    setExecutionResult(null);

    fetch(`/api/payments/${payment.payment_id}/ai-assessment`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (isMounted && json?.data) {
          setAiAudit(json.data);
        }
      })
      .catch((err) => {
        console.error('Failed to load AI assessment:', err);
      })
      .finally(() => {
        if (isMounted) setIsAiLoading(false);
      });

    loadExecutionPreview();

    return () => {
      isMounted = false;
    };
  }, [payment]);

  const handleExecute = async () => {
    if (!payment || isExecuting) return;
    setIsExecuting(true);
    try {
      const res = await fetch('/api/recovery/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_id: payment.payment_id }),
      });
      const json = await res.json();
      if (json?.data) {
        setExecutionResult(json.data);
        loadExecutionPreview();
      }
    } catch (err) {
      console.error('Failed to execute recovery:', err);
    } finally {
      setIsExecuting(false);
    }
  };

  const activeDecision = aiAudit ? aiAudit.final_decision : fallbackDecision;

  const totalHistorical =
    payment.previous_successful_payments + payment.previous_failed_payments;
  const successRate =
    totalHistorical > 0
      ? Math.round((payment.previous_successful_payments / totalHistorical) * 100)
      : null;

  const actionInfo = getActionBadge(activeDecision.action);
  const classInfo = getClassificationBadge(activeDecision.classification);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-800 bg-[#0d0f17] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-rose-500/10 p-2 text-rose-400 border border-rose-500/20">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white font-mono">
                  {payment.payment_id}
                </h2>
                <StatusBadge status={payment.status} />
              </div>
              <p className="text-xs text-slate-400">
                Created: {formatDate(payment.created_at)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Primary Amount Card */}
        <div className="mt-5 rounded-xl border border-slate-800/80 bg-[#121622] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Transaction Amount
            </span>
            <div className="text-3xl font-bold text-white font-mono mt-0.5">
              {formatINR(payment.amount)}
            </div>
            <span className="text-xs text-slate-400">Currency: {payment.currency}</span>
          </div>

          <div className="sm:text-right border-t sm:border-t-0 border-slate-800 pt-2 sm:pt-0">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Recovery Status
            </span>
            <div className="text-sm font-semibold text-amber-400 mt-0.5 flex items-center gap-1 sm:justify-end">
              <AlertCircle className="w-4 h-4" />
              Revenue at Risk
            </div>
            <span className="text-xs text-slate-500">
              {payment.attempt_count} {payment.attempt_count === 1 ? 'attempt' : 'attempts'} recorded
            </span>
          </div>
        </div>

        {/* Details Grid */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Customer Profile */}
          <div className="rounded-xl border border-slate-800/60 bg-[#10131e] p-4">
            <div className="flex items-center gap-2 mb-3 text-xs font-semibold uppercase tracking-wider text-slate-300">
              <User className="w-3.5 h-3.5 text-indigo-400" />
              Customer Details
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Name:</span>
                <span className="font-medium text-white">{payment.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Email:</span>
                <span className="font-mono text-slate-300">{payment.customer_email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Customer ID:</span>
                <span className="font-mono text-slate-400">{payment.customer_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Subscription:</span>
                <span className="capitalize font-medium text-indigo-300">
                  {payment.subscription_status.replace('_', ' ')}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Method & Gateway */}
          <div className="rounded-xl border border-slate-800/60 bg-[#10131e] p-4">
            <div className="flex items-center gap-2 mb-3 text-xs font-semibold uppercase tracking-wider text-slate-300">
              <CreditCard className="w-3.5 h-3.5 text-sky-400" />
              Payment Method & Channel
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Type:</span>
                <span className="uppercase font-mono text-white font-medium">
                  {payment.payment_method_type}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Instrument:</span>
                <span className="text-slate-200 text-right truncate max-w-[180px]">
                  {payment.payment_method_detail || 'Standard Gateway'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Last Attempt:</span>
                <span className="text-slate-300">{formatDate(payment.last_attempt_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Attempts:</span>
                <span className="font-mono font-medium text-white">
                  {payment.attempt_count}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Failure Diagnostics */}
        <div className="mt-4 rounded-xl border border-rose-900/30 bg-rose-950/10 p-4">
          <div className="flex items-center gap-2 mb-2 text-xs font-semibold uppercase tracking-wider text-rose-300">
            <AlertCircle className="w-4 h-4 text-rose-400" />
            Failure Diagnosis (Descriptive)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs mt-3">
            <div>
              <span className="text-slate-400">Categorized Reason:</span>
              <p className="font-semibold text-rose-300 mt-0.5 text-sm">
                {formatFailureReason(payment.failure_reason)}
              </p>
            </div>
            <div>
              <span className="text-slate-400">System Reason Code:</span>
              <p className="font-mono text-slate-300 mt-0.5">
                {payment.failure_reason || 'N/A'}
              </p>
            </div>
          </div>
        </div>

        {/* Historical Profile */}
        <div className="mt-4 rounded-xl border border-slate-800/60 bg-[#10131e] p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-300">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              Customer Historical Payment Profile
            </div>
            {successRate !== null && (
              <span className="text-xs font-mono text-emerald-400">
                {successRate}% Lifetime Success
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-slate-900/80 p-2.5 border border-slate-800">
              <div className="flex items-center justify-center gap-1 text-emerald-400 mb-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span className="text-base font-bold font-mono">
                  {payment.previous_successful_payments}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wide">
                Past Successes
              </span>
            </div>
            <div className="rounded-lg bg-slate-900/80 p-2.5 border border-slate-800">
              <div className="flex items-center justify-center gap-1 text-rose-400 mb-1">
                <XCircle className="w-3.5 h-3.5" />
                <span className="text-base font-bold font-mono">
                  {payment.previous_failed_payments}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wide">
                Past Failures
              </span>
            </div>
            <div className="rounded-lg bg-slate-900/80 p-2.5 border border-slate-800">
              <div className="flex items-center justify-center gap-1 text-indigo-400 mb-1">
                <Clock className="w-3.5 h-3.5" />
                <span className="text-base font-bold font-mono">
                  {totalHistorical}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wide">
                Total History
              </span>
            </div>
          </div>
        </div>

        {/* 5-STAGE END-TO-END PIPELINE STEPPER */}
        <div className="mt-5">
          <PipelineStepper
            payment={payment}
            aiAudit={aiAudit}
            executionPreview={executionPreview}
            executionResult={executionResult}
            isAiLoading={isAiLoading}
            isExecuting={isExecuting}
          />
        </div>

        {/* RECOVERY INTELLIGENCE (AI Brain + Deterministic Policy Guard) */}
        <div className="rounded-xl border border-indigo-900/50 bg-gradient-to-b from-[#131627] via-[#101322] to-[#0d0f19] p-5 shadow-xl">
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-900/40 pb-3 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="rounded-lg bg-indigo-500/20 p-2 text-indigo-400 border border-indigo-500/30">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-200">
                    Recovery Intelligence
                  </h3>
                  <span className="rounded bg-indigo-500/15 px-2 py-0.5 text-[10px] font-mono font-medium text-indigo-300 border border-indigo-500/30">
                    {aiAudit
                      ? `AI: ${aiAudit.provider.toUpperCase()} (${aiAudit.model})`
                      : isAiLoading
                      ? 'AI Brain: Thinking...'
                      : 'Deterministic Policy Engine'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Multi-Stage Autonomous Diagnosis &bull; Deterministic Policy Safety Authority
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {aiAudit?.fallback_occurred && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                  Fallback Active
                </span>
              )}
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${classInfo.badge}`}>
                {activeDecision.classification === 'recoverable' && <CheckCircle2 className="w-3.5 h-3.5" />}
                {activeDecision.classification === 'requires_escalation' && <AlertTriangle className="w-3.5 h-3.5" />}
                {classInfo.label}
              </span>
            </div>
          </div>

          {/* STAGE 1: AI RECOMMENDATION */}
          <div className="rounded-xl border border-indigo-800/40 bg-[#0e111d] p-4 relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-300">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                Stage 1 &bull; AI Diagnostic Recommendation
              </div>
              {isAiLoading && (
                <span className="text-[11px] text-indigo-400 animate-pulse font-mono">
                  Evaluating failure context...
                </span>
              )}
            </div>

            <div className="space-y-2.5 text-xs">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold">
                  AI Diagnosis
                </span>
                <p className="text-sm font-medium text-slate-200 mt-0.5">
                  {aiAudit?.ai_recommendation?.diagnosis || activeDecision.diagnosis}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-800/80">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold">
                    Proposed Action
                  </span>
                  <div className="mt-1">
                    {aiAudit?.ai_recommendation ? (
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${getActionBadge(aiAudit.ai_recommendation.recommended_action).bg}`}>
                        {getActionBadge(aiAudit.ai_recommendation.recommended_action).icon}
                        {getActionBadge(aiAudit.ai_recommendation.recommended_action).label}
                      </span>
                    ) : (
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${actionInfo.bg}`}>
                        {actionInfo.icon}
                        {actionInfo.label}
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold">
                    AI Confidence
                  </span>
                  <span className="text-sm font-mono font-bold text-emerald-400 block mt-1">
                    {Math.round((aiAudit?.ai_recommendation?.confidence || activeDecision.confidence) * 100)}%
                  </span>
                </div>

                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold">
                    AI Risk Assessment
                  </span>
                  <span className={`text-sm font-bold uppercase tracking-wider block mt-1 ${
                    (aiAudit?.ai_recommendation?.risk_level || activeDecision.risk_level) === 'low'
                      ? 'text-emerald-400'
                      : (aiAudit?.ai_recommendation?.risk_level || activeDecision.risk_level) === 'medium'
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }`}>
                    {aiAudit?.ai_recommendation?.risk_level || activeDecision.risk_level}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/80">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold">
                  AI Contextual Reasoning
                </span>
                <p className="text-slate-300 text-xs leading-relaxed mt-0.5">
                  {aiAudit?.ai_recommendation?.reason || activeDecision.reason}
                </p>
              </div>
            </div>
          </div>

          {/* STAGE 2: POLICY VALIDATION & OVERRIDE SAFETY BOUNDARY */}
          <div className="mt-3 rounded-xl border border-slate-800 bg-[#0d0f19] p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-300">
                <Shield className="w-3.5 h-3.5 text-sky-400" />
                Stage 2 &bull; Deterministic Policy Validation
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                Safety Boundary Enforced
              </span>
            </div>

            {/* If policy overrode the AI proposal */}
            {aiAudit?.policy_overridden || activeDecision.policy_overridden ? (
              <div className="rounded-lg border border-amber-900/50 bg-amber-950/25 p-3.5 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-amber-300 font-semibold">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Policy Safety Override Applied</span>
                </div>

                {/* Visual arrow flow: AI Suggested -> Policy Override -> Final Action */}
                <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-[11px]">
                  <span className="px-2 py-1 rounded bg-slate-900 text-slate-300 border border-slate-800">
                    AI: {aiAudit?.ai_recommendation?.recommended_action || activeDecision.original_action}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="px-2 py-1 rounded bg-amber-900/40 text-amber-200 border border-amber-700/50">
                    Policy Override: {activeDecision.policy_rule.split(':')[0]}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="px-2 py-1 rounded bg-rose-950 text-rose-200 border border-rose-800 font-bold">
                    Final: {activeDecision.action}
                  </span>
                </div>

                <p className="text-slate-300 text-[11px] leading-relaxed pt-1">
                  {aiAudit?.policy_result?.reason || activeDecision.reason}
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 p-3 text-xs text-emerald-300 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Action Permitted &bull; Complies with retry caps & risk boundaries</span>
                </span>
                <span className="font-mono text-[10px] text-emerald-400">
                  {activeDecision.policy_rule.split(':')[0]}
                </span>
              </div>
            )}

            {/* Policy Rule & Stop Condition Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 text-xs">
              <div className="rounded-lg bg-slate-900/80 p-2.5 border border-slate-800">
                <span className="text-[10px] uppercase tracking-wider text-indigo-400 block font-semibold mb-0.5">
                  Governing Policy Rule
                </span>
                <p className="font-mono text-[11px] text-slate-300">
                  {activeDecision.policy_rule}
                </p>
              </div>

              <div className="rounded-lg bg-slate-900/80 p-2.5 border border-slate-800">
                <span className="text-[10px] uppercase tracking-wider text-rose-400 block font-semibold mb-0.5">
                  Mandatory Stop Condition
                </span>
                <p className="text-xs text-slate-300">
                  {activeDecision.stop_condition}
                </p>
              </div>
            </div>
          </div>

          {/* STAGE 3: FINAL POLICY-APPROVED DECISION */}
          <div className="mt-3 rounded-xl border border-indigo-800/50 bg-[#0e111d] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Stage 3 &bull; Final Policy-Approved Action
              </div>
              <div className="mt-2">
                <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border ${actionInfo.bg}`}>
                  {actionInfo.icon}
                  {actionInfo.label}
                </span>
              </div>
            </div>

            <div className="text-xs sm:text-right border-t sm:border-t-0 border-slate-800 pt-2 sm:pt-0">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 block">
                Audit Record ID
              </span>
              <span className="font-mono text-[11px] text-slate-300">
                {aiAudit?.assessment_id || `audit_${payment.payment_id}`}
              </span>
              <span className="text-[10px] text-teal-300 block mt-0.5">
                Cleared by Policy for Execution Gate
              </span>
            </div>
          </div>

          {/* STAGE 4: HARDWARE EXECUTION GATE & ATTRIBUTION */}
          <div className="mt-4 rounded-xl border border-teal-800/40 bg-[#0d131f] p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-teal-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-teal-200">
                  Stage 4 &bull; Execution Gate & Financial Attribution
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-slate-800 px-2.5 py-0.5 font-mono text-[10px] text-slate-300 border border-slate-700">
                  Mode: {executionPreview?.execution_mode === 'razorpay_test' ? 'Razorpay (Test Mode)' : 'Mock (Test Environment)'}
                </span>
                {executionPreview && (
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase border ${
                      executionPreview.execution_eligibility === 'already_recovered'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : executionPreview.execution_eligibility === 'eligible'
                        ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                        : executionPreview.execution_eligibility === 'customer_action_required'
                        ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                        : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    }`}
                  >
                    {executionPreview.execution_eligibility.replace('_', ' ')}
                  </span>
                )}
              </div>
            </div>

            {/* Execution Parameters Preview */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mb-3.5">
              <div className="rounded-lg bg-slate-900/90 p-2.5 border border-slate-800/80">
                <span className="text-[10px] uppercase text-slate-400 font-semibold block mb-0.5">
                  Amount at Risk
                </span>
                <span className="font-mono font-bold text-white text-sm">
                  {formatINR(payment.amount)}
                </span>
              </div>
              <div className="rounded-lg bg-slate-900/90 p-2.5 border border-slate-800/80">
                <span className="text-[10px] uppercase text-slate-400 font-semibold block mb-0.5">
                  Potential Recovery
                </span>
                <span className="font-mono font-bold text-teal-300 text-sm">
                  {formatINR(executionPreview?.maximum_recoverable_amount || (activeDecision.action === 'retry_payment' ? payment.amount : 0))}
                </span>
              </div>
              <div className="rounded-lg bg-slate-900/90 p-2.5 border border-slate-800/80">
                <span className="text-[10px] uppercase text-slate-400 font-semibold block mb-0.5">
                  Authorized Action
                </span>
                <span className="text-slate-200 font-medium truncate block">
                  {actionInfo.label}
                </span>
              </div>
              <div className="rounded-lg bg-slate-900/90 p-2.5 border border-slate-800/80">
                <span className="text-[10px] uppercase text-slate-400 font-semibold block mb-0.5">
                  Policy Status
                </span>
                <span className="text-emerald-400 font-medium flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Approved</span>
                </span>
              </div>
            </div>

            {/* Live Execution Result Banner (if just executed or previously executed) */}
            {(executionResult || executionPreview?.previous_execution) && (
              <div className="mb-3.5">
                {(executionResult?.status === 'succeeded' || executionPreview?.previous_execution?.status === 'succeeded') && (
                  <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/20 p-3.5 text-xs">
                    <div className="flex items-center justify-between text-emerald-400 font-bold mb-2">
                      <span className="flex items-center gap-1.5 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ✓ RECOVERY SUCCESSFUL
                      </span>
                      <span className="font-mono text-emerald-300 text-sm">
                        +{formatINR(executionResult?.amount_recovered || executionPreview?.previous_execution?.amount_recovered || payment.amount)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-slate-300 pt-1 border-t border-emerald-900/40">
                      <div>
                        <span className="text-slate-500">Action:</span> {actionInfo.label}
                      </div>
                      <div>
                        <span className="text-slate-500">Execution:</span> Simulated Test Mode
                      </div>
                      <div className="font-mono truncate">
                        <span className="text-slate-500">ID:</span> {executionResult?.execution_id || executionPreview?.previous_execution?.execution_id}
                      </div>
                    </div>
                  </div>
                )}

                {(executionResult?.status === 'failed' || executionPreview?.previous_execution?.status === 'failed') && (
                  <div className="rounded-xl border border-rose-500/40 bg-rose-950/20 p-3.5 text-xs">
                    <div className="flex items-center justify-between text-rose-400 font-bold mb-1">
                      <span className="flex items-center gap-1.5">
                        <XCircle className="w-4 h-4 text-rose-400" />
                        ✕ RECOVERY FAILED
                      </span>
                      <span className="font-mono text-rose-300">Recovered: ₹0</span>
                    </div>
                    <p className="text-[11px] text-rose-300/90 mt-1">
                      {executionResult?.failure_reason || executionPreview?.previous_execution?.failure_reason || 'Re-attempt declined by test payment processor.'}
                    </p>
                  </div>
                )}

                {(executionResult?.status === 'customer_action_required' || executionPreview?.previous_execution?.status === 'customer_action_required') && (
                  <div className="rounded-xl border border-sky-500/40 bg-sky-950/20 p-3.5 text-xs">
                    <div className="flex items-center justify-between text-sky-400 font-bold mb-1">
                      <span className="flex items-center gap-1.5">
                        <Mail className="w-4 h-4 text-sky-400" />
                        → CUSTOMER ACTION REQUIRED
                      </span>
                      <span className="font-mono text-sky-300">Recovered: ₹0</span>
                    </div>
                    <p className="text-[11px] text-sky-300/90 mt-1">
                      {executionResult?.failure_reason || executionPreview?.previous_execution?.failure_reason || 'Notification queued via WhatsApp / Email link. Awaiting customer submission.'}
                    </p>
                  </div>
                )}

                {(executionResult?.status === 'blocked' || executionPreview?.previous_execution?.status === 'blocked') && (
                  <div className="rounded-xl border border-amber-500/40 bg-amber-950/20 p-3.5 text-xs">
                    <div className="flex items-center justify-between text-amber-400 font-bold mb-1">
                      <span className="flex items-center gap-1.5">
                        <Lock className="w-4 h-4 text-amber-400" />
                        🔒 EXECUTION BLOCKED
                      </span>
                      <span className="font-mono text-amber-300">Recovered: ₹0</span>
                    </div>
                    <p className="text-[11px] text-amber-300/90 mt-1">
                      {executionResult?.failure_reason || executionPreview?.previous_execution?.failure_reason || executionPreview?.block_reason || 'Blocked by policy stopping rule.'}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Execution Controls */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-slate-800">
              <div className="text-[11px] text-slate-400">
                {executionPreview?.execution_eligibility === 'already_recovered' ? (
                  <span className="text-emerald-300 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Payment was recovered. Idempotency guard prevents double-recovery.
                  </span>
                ) : executionPreview?.execution_eligibility === 'blocked' ? (
                  <span className="text-rose-400 flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5" />
                    {executionPreview.block_reason || 'Execution blocked by retry policy limit.'}
                  </span>
                ) : (
                  <span>
                    Server executes the policy-approved action &bull; Zero live money movement
                  </span>
                )}
              </div>

              <div>
                {executionPreview?.execution_eligibility === 'already_recovered' ? (
                  <button
                    disabled
                    className="w-full sm:w-auto rounded-xl px-5 py-2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold text-xs flex items-center justify-center gap-2 cursor-not-allowed"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Already Recovered</span>
                  </button>
                ) : executionPreview?.execution_eligibility === 'blocked' ? (
                  <button
                    disabled
                    className="w-full sm:w-auto rounded-xl px-5 py-2 bg-slate-800 text-slate-500 border border-slate-700 font-semibold text-xs flex items-center justify-center gap-2 cursor-not-allowed"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Execution Blocked</span>
                  </button>
                ) : (
                  <button
                    onClick={handleExecute}
                    disabled={isExecuting}
                    className="w-full sm:w-auto rounded-xl px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    {isExecuting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Executing Recovery...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4" />
                        <span>Execute Recovery</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="mt-5 flex justify-end gap-3 border-t border-slate-800 pt-4">
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
}
