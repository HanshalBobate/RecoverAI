'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  User,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Layers,
  RefreshCw,
  Mail,
  ShieldCheck,
  AlertTriangle,
  Bot,
  Sparkles,
  ArrowRight,
  Shield,
  Zap,
  Lock,
  History,
  ShieldAlert,
  Smartphone,
  Globe,
  Clock,
} from 'lucide-react';
import { PaymentRecord } from '@/lib/types';
import { assessPayment, RecoveryAction } from '@/lib/recovery';
import type { AIAssessmentAudit } from '@/lib/llm/types';
import type { ExecutionPreview, RecoveryExecutionResult } from '@/lib/execution/types';
import { formatINR, formatFailureReason, formatDate } from '@/lib/format';
import { StatusBadge } from '@/components/StatusBadge';
import { PipelineStepper } from '@/components/PipelineStepper';

/* ─── Style helpers ───────────────────────────────────── */
const sLabel: React.CSSProperties = {
  fontFamily: 'var(--font-sans)',
  fontSize: 10,
  fontWeight: 500,
  color: 'var(--ink-muted)',
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  display: 'block',
  marginBottom: 3,
};

function getActionInfo(action: RecoveryAction) {
  switch (action) {
    case 'retry_payment':
      return { label: 'Retry Payment', icon: <RefreshCw style={{ width: 13, height: 13 }} />, color: 'var(--accent-sage)', bg: 'var(--accent-sage-light)' };
    case 'contact_customer':
      return { label: 'Contact Customer', icon: <Mail style={{ width: 13, height: 13 }} />, color: 'var(--accent-sky)', bg: 'var(--accent-sky-light)' };
    case 'request_payment_method_update':
      return { label: 'Request Method Update', icon: <CreditCard style={{ width: 13, height: 13 }} />, color: 'var(--accent-butter)', bg: 'var(--accent-butter-light)' };
    case 'escalate_to_human':
      return { label: 'Escalate to Human', icon: <ShieldAlert style={{ width: 13, height: 13 }} />, color: 'var(--accent-clay)', bg: 'var(--accent-clay-light)' };
    default:
      return { label: 'Do Nothing (Hold)', icon: <AlertCircle style={{ width: 13, height: 13 }} />, color: 'var(--ink-muted)', bg: 'var(--paper-alt)' };
  }
}

function ActionPill({ action }: { action: RecoveryAction }) {
  const info = getActionInfo(action);
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: 'var(--font-sans)',
        fontSize: 12,
        fontWeight: 500,
        color: info.color,
        background: info.bg,
        borderLeft: `2px solid ${info.color}`,
        borderRadius: 'var(--radius-subtle)',
        padding: '4px 10px 4px 8px',
      }}
    >
      {info.icon}
      {info.label}
    </span>
  );
}

interface Tab { id: string; label: string }
const TABS: Tab[] = [
  { id: 'context', label: 'Context' },
  { id: 'pipeline', label: 'Recovery Pipeline' },
  { id: 'execution', label: 'Execution' },
];

/* ─── Main Component ───────────────────────────────────── */
export function PaymentDetailClient({ payment }: { payment: PaymentRecord }) {
  const [activeTab, setActiveTab] = useState<string>('context');
  const [aiAudit, setAiAudit] = useState<AIAssessmentAudit | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [executionPreview, setExecutionPreview] = useState<ExecutionPreview | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<RecoveryExecutionResult | null>(null);

  const loadExecutionPreview = useCallback(async () => {
    try {
      const res = await fetch(`/api/payments/${payment.payment_id}/execution-preview`);
      if (res.ok) {
        const j = await res.json();
        if (j?.data) setExecutionPreview(j.data);
      }
    } catch (err) {
      console.error('Failed to load execution preview:', err);
    }
  }, [payment.payment_id]);

  useEffect(() => {
    setIsAiLoading(true);
    setAiAudit(null);
    setExecutionResult(null);

    fetch(`/api/payments/${payment.payment_id}/ai-assessment`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.data) setAiAudit(j.data); })
      .catch(console.error)
      .finally(() => setIsAiLoading(false));

    loadExecutionPreview();
  }, [payment.payment_id, loadExecutionPreview]);

  const handleExecute = async () => {
    if (isExecuting) return;
    setIsExecuting(true);
    try {
      const res = await fetch('/api/recovery/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_id: payment.payment_id }),
      });
      const j = await res.json();
      if (j?.data) {
        setExecutionResult(j.data);
        loadExecutionPreview();
      }
    } catch (err) {
      console.error('Failed to execute recovery:', err);
    } finally {
      setIsExecuting(false);
    }
  };

  const fallbackDecision = useMemo(() => assessPayment(payment), [payment]);
  const activeDecision = aiAudit ? aiAudit.final_decision : fallbackDecision;
  const actionInfo = getActionInfo(activeDecision.action);

  const totalHistory = payment.previous_successful_payments + payment.previous_failed_payments;
  const successRate = totalHistory > 0
    ? Math.round((payment.previous_successful_payments / totalHistory) * 100)
    : null;

  const execStatus = executionResult?.status || executionPreview?.previous_execution?.status;
  const execResultData = executionResult || executionPreview?.previous_execution;

  const execColors: Record<string, { border: string; bg: string; text: string }> = {
    succeeded:                { border: 'var(--accent-sage)',   bg: 'var(--accent-sage-light)',   text: 'var(--accent-sage)' },
    failed:                   { border: 'var(--accent-clay)',   bg: 'var(--accent-clay-light)',   text: 'var(--accent-clay)' },
    customer_action_required: { border: 'var(--accent-sky)',    bg: 'var(--accent-sky-light)',    text: 'var(--accent-sky)' },
    blocked:                  { border: 'var(--accent-butter)', bg: 'var(--accent-butter-light)', text: 'var(--accent-butter)' },
  };
  const currentExecColor = execStatus ? execColors[execStatus] : null;

  const methodIcon = payment.payment_method_type === 'upi'
    ? <Smartphone style={{ width: 12, height: 12, color: 'var(--accent-sage)' }} />
    : payment.payment_method_type === 'netbanking'
    ? <Globe style={{ width: 12, height: 12, color: 'var(--accent-sky)' }} />
    : <CreditCard style={{ width: 12, height: 12, color: 'var(--accent-lavender)' }} />;

  return (
    <div
      style={{
        maxWidth: 1100,
        margin: '0 auto',
        padding: '28px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}
    >
      {/* ── Back Link ── */}
      <Link
        href="/payments"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          fontFamily: 'var(--font-sans)',
          fontSize: 12,
          color: 'var(--ink-muted)',
          textDecoration: 'none',
          width: 'fit-content',
          transition: 'color 0.12s',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--ink)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--ink-muted)'; }}
      >
        <ArrowLeft style={{ width: 13, height: 13 }} />
        Back to Payments
      </Link>

      {/* ── Payment Header ── */}
      <div
        style={{
          background: 'var(--paper)',
          border: '1px solid var(--border)',
          borderLeft: '3px solid var(--accent-clay)',
          borderRadius: 'var(--radius-medium)',
          padding: '20px 24px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 20,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <h1
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 18,
                fontWeight: 500,
                color: 'var(--ink)',
                letterSpacing: '-0.01em',
                lineHeight: 1,
              }}
            >
              {payment.payment_id}
            </h1>
            <StatusBadge status={payment.status} />
          </div>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--ink-muted)' }}>
            {payment.failure_reason ? formatFailureReason(payment.failure_reason) : 'No failure reason'} · Created {formatDate(payment.created_at)}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', flexDirection: 'column', gap: 4 }}>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 32,
              fontWeight: 500,
              color: 'var(--ink)',
              letterSpacing: '-0.03em',
              lineHeight: 1,
            }}
          >
            {formatINR(payment.amount)}
          </div>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--ink-muted)' }}>
            {payment.currency} · {payment.attempt_count} {payment.attempt_count === 1 ? 'attempt' : 'attempts'}
          </span>
        </div>
      </div>

      {/* ── Visual Equation Banner ── */}
      <div
        style={{
          background: 'var(--paper)',
          border: '1px solid var(--border)',
          borderLeft: '4px solid var(--accent-lavender)',
          borderRadius: 'var(--radius-medium)',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
          boxShadow: 'var(--shadow-surface)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles style={{ width: 14, height: 14, color: 'var(--accent-lavender)' }} />
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>
            AI Recommendation <span style={{ color: 'var(--accent-clay)' }}>≠</span> Approved Action <span style={{ color: 'var(--accent-clay)' }}>≠</span> Executed Outcome
          </span>
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-muted)' }}>
          Deterministic Policy Engine Validates & Governs All Actions
        </span>
      </div>

      {/* ── Tabs ── */}
      <div>
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border)',
            marginBottom: 24,
          }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '8px 18px',
                fontFamily: 'var(--font-sans)',
                fontSize: 13,
                fontWeight: activeTab === tab.id ? 600 : 400,
                color: activeTab === tab.id ? 'var(--ink)' : 'var(--ink-muted)',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid var(--accent-clay)' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'color 0.12s',
                position: 'relative',
                top: 1,
              }}
              onMouseEnter={(e) => {
                if (activeTab !== tab.id) (e.currentTarget as HTMLElement).style.color = 'var(--ink)';
              }}
              onMouseLeave={(e) => {
                if (activeTab !== tab.id) (e.currentTarget as HTMLElement).style.color = 'var(--ink-muted)';
              }}
            >
              {tab.label}
              {tab.id === 'pipeline' && isAiLoading && (
                <span
                  style={{
                    display: 'inline-block',
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: 'var(--accent-lavender)',
                    marginLeft: 6,
                    position: 'relative',
                    top: -1,
                  }}
                  className="animate-pulse"
                />
              )}
            </button>
          ))}
        </div>

        {/* ──────── TAB: CONTEXT ──────── */}
        {activeTab === 'context' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {/* Customer Profile */}
              <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-medium)', padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                  <User style={{ width: 13, height: 13, color: 'var(--accent-lavender)' }} />
                  <span style={{ ...sLabel, display: 'inline', marginBottom: 0 }}>Customer Profile</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { label: 'Name', value: payment.customer_name },
                    { label: 'Email', value: payment.customer_email, mono: true },
                    { label: 'Customer ID', value: payment.customer_id, mono: true, muted: true },
                    { label: 'Subscription', value: payment.subscription_status.replace('_', ' '), capitalize: true },
                  ].map(({ label, value, mono, muted, capitalize }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--ink-muted)', flexShrink: 0 }}>{label}</span>
                      <span
                        style={{
                          fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
                          fontSize: 12,
                          color: muted ? 'var(--ink-muted)' : 'var(--ink-secondary)',
                          textAlign: 'right',
                          textTransform: capitalize ? 'capitalize' : undefined,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '70%',
                        }}
                      >
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment Method */}
              <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-medium)', padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                  {methodIcon}
                  <span style={{ ...sLabel, display: 'inline', marginBottom: 0 }}>Payment Method & Channel</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { label: 'Type', value: payment.payment_method_type.toUpperCase(), mono: true },
                    { label: 'Instrument', value: payment.payment_method_detail || 'Standard Gateway' },
                    { label: 'Last Attempt', value: formatDate(payment.last_attempt_at) },
                    { label: 'Total Attempts', value: String(payment.attempt_count), mono: true },
                  ].map(({ label, value, mono }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--ink-muted)', flexShrink: 0 }}>{label}</span>
                      <span
                        style={{
                          fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
                          fontSize: 12,
                          color: 'var(--ink-secondary)',
                          textAlign: 'right',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '70%',
                        }}
                      >
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Failure Diagnosis */}
            {payment.failure_reason && (
              <div
                style={{
                  border: '1px solid var(--border)',
                  borderLeft: '3px solid var(--accent-clay)',
                  borderRadius: 'var(--radius-medium)',
                  padding: '14px 16px',
                  background: 'var(--accent-clay-light)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <AlertCircle style={{ width: 13, height: 13, color: 'var(--accent-clay)' }} />
                  <span style={{ ...sLabel, color: 'var(--accent-clay)', display: 'inline', marginBottom: 0 }}>Failure Diagnosis</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <span style={sLabel}>Categorized Reason</span>
                    <p style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 500, color: 'var(--accent-clay)', lineHeight: 1.3 }}>
                      {formatFailureReason(payment.failure_reason)}
                    </p>
                  </div>
                  <div>
                    <span style={sLabel}>System Reason Code</span>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-secondary)' }}>
                      {payment.failure_reason}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Historical Profile */}
            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-medium)', padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Layers style={{ width: 12, height: 12, color: 'var(--accent-butter)' }} />
                  <span style={{ ...sLabel, display: 'inline', marginBottom: 0 }}>Customer Payment History</span>
                </div>
                {successRate !== null && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-sage)' }}>
                    {successRate}% Lifetime Success
                  </span>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {[
                  { icon: <CheckCircle2 style={{ width: 13, height: 13, color: 'var(--accent-sage)' }} />, val: payment.previous_successful_payments, label: 'Past Successes', color: 'var(--accent-sage)' },
                  { icon: <XCircle style={{ width: 13, height: 13, color: 'var(--accent-clay)' }} />, val: payment.previous_failed_payments, label: 'Past Failures', color: 'var(--accent-clay)' },
                  { icon: <Clock style={{ width: 13, height: 13, color: 'var(--ink-secondary)' }} />, val: totalHistory, label: 'Total History', color: 'var(--ink-secondary)' },
                ].map(({ icon, val, label, color }) => (
                  <div
                    key={label}
                    style={{
                      background: 'var(--paper-alt)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-medium)',
                      padding: '10px 12px',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 4 }}>
                      {icon}
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 500, color, lineHeight: 1 }}>{val}</span>
                    </div>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--ink-muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ──────── TAB: RECOVERY PIPELINE ──────── */}
        {activeTab === 'pipeline' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* PipelineStepper summary */}
            <PipelineStepper
              payment={payment}
              aiAudit={aiAudit}
              executionPreview={executionPreview}
              executionResult={executionResult}
              isAiLoading={isAiLoading}
              isExecuting={isExecuting}
            />

            {/* Stage 1: AI Recommendation */}
            <div
              style={{
                background: 'var(--paper)',
                border: '1px solid var(--border)',
                borderTop: '3px solid var(--accent-lavender)',
                borderRadius: 'var(--radius-medium)',
                padding: '16px 18px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Bot style={{ width: 13, height: 13, color: 'var(--accent-lavender)' }} />
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, color: 'var(--ink-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    Stage 1 · AI Diagnostic
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {isAiLoading && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-lavender)' }} className="animate-pulse">
                      Evaluating…
                    </span>
                  )}
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      color: 'var(--accent-lavender)',
                      background: 'var(--accent-lavender-light)',
                      borderLeft: '2px solid var(--accent-lavender)',
                      borderRadius: 'var(--radius-subtle)',
                      padding: '2px 7px',
                    }}
                  >
                    {aiAudit ? `${aiAudit.provider.toUpperCase()} · ${aiAudit.model}` : 'Deterministic Fallback'}
                  </span>
                </div>
              </div>

              {/* Diagnosis */}
              <div style={{ marginBottom: 14 }}>
                <span style={sLabel}>AI Diagnosis</span>
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>
                  {aiAudit?.ai_recommendation?.diagnosis || activeDecision.diagnosis}
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, paddingTop: 12, borderTop: '1px solid var(--border)', marginBottom: 12 }}>
                <div>
                  <span style={sLabel}>Proposed Action</span>
                  <ActionPill action={aiAudit?.ai_recommendation?.recommended_action || activeDecision.action} />
                </div>
                <div>
                  <span style={sLabel}>AI Confidence</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 500, color: 'var(--accent-sage)', lineHeight: 1 }}>
                    {Math.round((aiAudit?.ai_recommendation?.confidence || activeDecision.confidence) * 100)}%
                  </span>
                </div>
                <div>
                  <span style={sLabel}>Risk Level</span>
                  <span
                    style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: 13,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      color:
                        (aiAudit?.ai_recommendation?.risk_level || activeDecision.risk_level) === 'low' ? 'var(--accent-sage)'
                          : (aiAudit?.ai_recommendation?.risk_level || activeDecision.risk_level) === 'medium' ? 'var(--accent-butter)'
                          : 'var(--accent-clay)',
                    }}
                  >
                    {aiAudit?.ai_recommendation?.risk_level || activeDecision.risk_level}
                  </span>
                </div>
              </div>

              <div style={{ paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <span style={sLabel}>AI Contextual Reasoning</span>
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--ink-secondary)', lineHeight: 1.6 }}>
                  {aiAudit?.ai_recommendation?.reason || activeDecision.reason}
                </p>
              </div>
            </div>

            {/* Stage 2: Policy Validation */}
            <div
              style={{
                background: 'var(--paper)',
                border: '1px solid var(--border)',
                borderTop: '3px solid var(--accent-sky)',
                borderRadius: 'var(--radius-medium)',
                padding: '16px 18px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Shield style={{ width: 13, height: 13, color: 'var(--accent-sky)' }} />
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, color: 'var(--ink-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    Stage 2 · Policy Validation
                  </span>
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-muted)' }}>Safety Boundary Enforced</span>
              </div>

              {aiAudit?.policy_overridden || activeDecision.policy_overridden ? (
                <div
                  style={{
                    background: 'var(--accent-butter-light)',
                    border: '1px solid var(--border)',
                    borderLeft: '3px solid var(--accent-butter)',
                    borderRadius: 'var(--radius-medium)',
                    padding: '12px 14px',
                    marginBottom: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent-butter)', fontWeight: 600, fontFamily: 'var(--font-sans)', fontSize: 12, marginBottom: 8 }}>
                    <AlertTriangle style={{ width: 13, height: 13 }} />
                    Policy Safety Override Applied
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 11, marginBottom: 8 }}>
                    <span style={{ padding: '4px 8px', background: 'var(--paper-alt)', color: 'var(--ink-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-subtle)' }}>
                      AI suggested: {aiAudit?.ai_recommendation?.recommended_action || activeDecision.original_action}
                    </span>
                    <ArrowRight style={{ width: 11, height: 11, color: 'var(--accent-butter)' }} />
                    <span style={{ padding: '4px 8px', background: 'var(--accent-butter-light)', color: 'var(--accent-butter)', border: '1px solid var(--accent-butter)', borderRadius: 'var(--radius-subtle)' }}>
                      {activeDecision.policy_rule.split(':')[0]}: Policy rejected recommendation
                    </span>
                    <ArrowRight style={{ width: 11, height: 11, color: 'var(--accent-butter)' }} />
                    <span style={{ padding: '4px 8px', background: 'var(--accent-clay-light)', color: 'var(--accent-clay)', border: '1px solid var(--accent-clay)', borderRadius: 'var(--radius-subtle)', fontWeight: 600 }}>
                      Final action: {activeDecision.action}
                    </span>
                  </div>
                  <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--ink-secondary)', lineHeight: 1.5 }}>
                    {aiAudit?.policy_result?.reason || activeDecision.reason}
                  </p>
                </div>
              ) : (
                <div
                  style={{
                    background: 'var(--accent-sage-light)',
                    border: '1px solid var(--border)',
                    borderLeft: '3px solid var(--accent-sage)',
                    borderRadius: 'var(--radius-medium)',
                    padding: '10px 14px',
                    marginBottom: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--accent-sage)' }}>
                    <CheckCircle2 style={{ width: 13, height: 13 }} />
                    Action Permitted · Complies with retry caps & risk boundaries
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent-sage)' }}>
                    {activeDecision.policy_rule.split(':')[0]}
                  </span>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { label: 'Governing Policy Rule', val: activeDecision.policy_rule, color: 'var(--accent-lavender)' },
                  { label: 'Mandatory Stop Condition', val: activeDecision.stop_condition, color: 'var(--accent-clay)' },
                ].map(({ label, val, color }) => (
                  <div
                    key={label}
                    style={{ background: 'var(--paper-alt)', border: '1px solid var(--border)', borderRadius: 'var(--radius-medium)', padding: '10px 12px' }}
                  >
                    <span style={{ ...sLabel, color }}>{label}</span>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-secondary)', lineHeight: 1.4 }}>{val}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Stage 3: Final Decision */}
            <div
              style={{
                background: 'var(--paper)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-medium)',
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <CheckCircle2 style={{ width: 12, height: 12, color: 'var(--accent-sage)' }} />
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, color: 'var(--ink-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    Stage 3 · Final Policy-Approved Action
                  </span>
                </div>
                <ActionPill action={activeDecision.action} />
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={sLabel}>Audit Record ID</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-secondary)' }}>
                  {aiAudit?.assessment_id || `audit_${payment.payment_id}`}
                </span>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--accent-sage)', display: 'block', marginTop: 2 }}>
                  Cleared by Policy · Go to Execution tab to run
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ──────── TAB: EXECUTION ──────── */}
        {activeTab === 'execution' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Execution parameters */}
            <div
              style={{
                background: 'var(--paper)',
                border: '1px solid var(--border)',
                borderTop: '3px solid var(--accent-sage)',
                borderRadius: 'var(--radius-medium)',
                padding: '16px 18px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Zap style={{ width: 13, height: 13, color: 'var(--accent-sage)' }} />
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, color: 'var(--ink-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    Stage 4 · Execution Gate & Attribution
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      color: 'var(--ink-muted)',
                      background: 'var(--paper-alt)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-subtle)',
                      padding: '2px 8px',
                    }}
                  >
                    Mode: {executionPreview?.execution_mode === 'razorpay_test' ? 'Razorpay (Test)' : 'Mock (Test)'}
                  </span>
                  {executionPreview && (
                    <span
                      style={{
                        fontFamily: 'var(--font-sans)',
                        fontSize: 10,
                        fontWeight: 500,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        color:
                          executionPreview.execution_eligibility === 'already_recovered' || executionPreview.execution_eligibility === 'eligible'
                            ? 'var(--accent-sage)'
                            : executionPreview.execution_eligibility === 'customer_action_required'
                            ? 'var(--accent-sky)'
                            : 'var(--accent-clay)',
                        background:
                          executionPreview.execution_eligibility === 'already_recovered' || executionPreview.execution_eligibility === 'eligible'
                            ? 'var(--accent-sage-light)'
                            : executionPreview.execution_eligibility === 'customer_action_required'
                            ? 'var(--accent-sky-light)'
                            : 'var(--accent-clay-light)',
                        borderLeft: `2px solid ${
                          executionPreview.execution_eligibility === 'already_recovered' || executionPreview.execution_eligibility === 'eligible'
                            ? 'var(--accent-sage)'
                            : executionPreview.execution_eligibility === 'customer_action_required'
                            ? 'var(--accent-sky)'
                            : 'var(--accent-clay)'
                        }`,
                        borderRadius: 'var(--radius-subtle)',
                        padding: '2px 8px',
                      }}
                    >
                      {executionPreview.execution_eligibility.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
              </div>

              {/* Pre-Execution Briefing Parameters Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
                {[
                  { label: 'Target Payment', val: payment.payment_id, color: 'var(--ink)', mono: true },
                  { label: 'Amount Attempted', val: formatINR(payment.amount), color: 'var(--ink)', mono: true },
                  { label: 'Approved Action', val: actionInfo.label, color: 'var(--ink-secondary)' },
                  { label: 'Execution Mode', val: executionPreview?.execution_mode === 'razorpay_test' ? 'Razorpay (Test)' : 'Mock (Test)', color: 'var(--accent-sage)' },
                  { label: 'Governing Policy Rule', val: activeDecision.policy_rule.split(':')[0], color: 'var(--accent-lavender)', mono: true },
                  { label: 'Execution Eligibility', val: (executionPreview?.execution_eligibility || 'eligible').replace(/_/g, ' '), color: executionPreview?.execution_eligibility === 'blocked' ? 'var(--accent-clay)' : 'var(--accent-sage)' },
                ].map(({ label, val, color, mono }) => (
                  <div key={label} style={{ background: 'var(--paper-alt)', border: '1px solid var(--border)', borderRadius: 'var(--radius-medium)', padding: '10px 12px' }}>
                    <span style={{ ...sLabel, marginBottom: 4 }}>{label}</span>
                    <span style={{ fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)', fontSize: 12, fontWeight: 600, color, textTransform: label === 'Execution Eligibility' ? 'uppercase' : undefined }}>
                      {val}
                    </span>
                  </div>
                ))}
              </div>

              {/* Execution result */}
              {execStatus && currentExecColor && execResultData && (
                <div
                  style={{
                    background: currentExecColor.bg,
                    border: '1px solid var(--border)',
                    borderLeft: `4px solid ${currentExecColor.border}`,
                    borderRadius: 'var(--radius-medium)',
                    padding: '14px 16px',
                    marginBottom: 14,
                  }}
                >
                  {execStatus === 'succeeded' && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600, color: currentExecColor.text, marginBottom: 8 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <CheckCircle2 style={{ width: 16, height: 16 }} />
                          RECOVERY SUCCESSFUL
                        </span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700 }}>
                          +{formatINR(execResultData.amount_recovered)} recovered
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, paddingTop: 8, borderTop: '1px solid var(--border)', fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--ink-secondary)' }}>
                        <div><span style={{ color: 'var(--ink-muted)' }}>Action: </span>{actionInfo.label}</div>
                        <div><span style={{ color: 'var(--ink-muted)' }}>Mode: </span>{execResultData.execution_mode === 'razorpay_test' ? 'Razorpay Test' : 'Mock Test'}</div>
                        <div style={{ fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          <span style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-sans)' }}>Execution ID: </span>
                          {execResultData.execution_id}
                        </div>
                      </div>
                      <div style={{ marginTop: 10 }}>
                        <Link
                          href="/audit"
                          style={{
                            fontFamily: 'var(--font-sans)',
                            fontSize: 11,
                            fontWeight: 500,
                            color: 'var(--accent-sage)',
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          View verified record in Audit Ledger →
                        </Link>
                      </div>
                    </>
                  )}
                  {execStatus === 'failed' && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600, color: currentExecColor.text, marginBottom: 6 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <XCircle style={{ width: 16, height: 16 }} />
                          RECOVERY FAILED
                        </span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500 }}>
                          ₹0 recovered
                        </span>
                      </div>
                      <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--ink-secondary)', marginTop: 4 }}>
                        Reason: {execResultData.failure_reason || 'Re-attempt declined by test payment processor.'}
                      </p>
                    </>
                  )}
                  {execStatus === 'customer_action_required' && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600, color: currentExecColor.text, marginBottom: 6 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Mail style={{ width: 16, height: 16 }} />
                          CUSTOMER ACTION REQUIRED
                        </span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500 }}>
                          ₹0 recovered (Awaiting customer input)
                        </span>
                      </div>
                      <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--ink-secondary)', marginTop: 4 }}>
                        {execResultData.failure_reason || 'Outreach link generated and queued. Zero automated charges attempted.'}
                      </p>
                    </>
                  )}
                  {execStatus === 'blocked' && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600, color: currentExecColor.text, marginBottom: 6 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Lock style={{ width: 16, height: 16 }} />
                          EXECUTION BLOCKED BY POLICY
                        </span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500 }}>
                          ₹0 recovered
                        </span>
                      </div>
                      <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--ink-secondary)', marginTop: 4 }}>
                        Reason: {execResultData.failure_reason || executionPreview?.block_reason || 'Blocked by safety rule limit.'}
                      </p>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-muted)', marginTop: 4 }}>
                        Governing Rule: {activeDecision.policy_rule}
                      </div>
                    </>
                  )}
                  {(executionResult?.already_recovered || executionPreview?.execution_eligibility === 'already_recovered') && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 500, color: 'var(--accent-sage)', paddingTop: execStatus ? 8 : 0 }}>
                      <CheckCircle2 style={{ width: 14, height: 14 }} />
                      ALREADY RECOVERED · Idempotency lock active. No additional revenue recorded.
                    </div>
                  )}
                </div>
              )}

              {/* Execute Controls */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  paddingTop: 12,
                  borderTop: '1px solid var(--border)',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--ink-muted)' }}>
                  {executionPreview?.execution_eligibility === 'already_recovered' ? (
                    <span style={{ color: 'var(--accent-sage)', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <CheckCircle2 style={{ width: 12, height: 12 }} />
                      Payment recovered. Idempotency guard prevents double-recovery.
                    </span>
                  ) : executionPreview?.execution_eligibility === 'blocked' ? (
                    <span style={{ color: 'var(--accent-clay)', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Lock style={{ width: 12, height: 12 }} />
                      {executionPreview.block_reason || 'Execution blocked by retry policy limit.'}
                    </span>
                  ) : (
                    <span>Server executes the policy-approved action · Zero live money movement</span>
                  )}
                </div>

                <div>
                  {executionPreview?.execution_eligibility === 'already_recovered' ? (
                    <button
                      disabled
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 500,
                        color: 'var(--accent-sage)', background: 'var(--accent-sage-light)',
                        border: '1px solid var(--border)', borderLeft: '2px solid var(--accent-sage)',
                        borderRadius: 'var(--radius-medium)', padding: '7px 16px',
                        cursor: 'not-allowed', opacity: 0.8,
                      }}
                    >
                      <CheckCircle2 style={{ width: 13, height: 13 }} />
                      Already Recovered
                    </button>
                  ) : executionPreview?.execution_eligibility === 'blocked' ? (
                    <button
                      disabled
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 500,
                        color: 'var(--ink-muted)', background: 'var(--paper-alt)',
                        border: '1px solid var(--border)', borderRadius: 'var(--radius-medium)',
                        padding: '7px 16px', cursor: 'not-allowed', opacity: 0.6,
                      }}
                    >
                      <Lock style={{ width: 13, height: 13 }} />
                      Execution Blocked
                    </button>
                  ) : (
                    <button
                      onClick={handleExecute}
                      disabled={isExecuting}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600,
                        color: 'var(--paper)',
                        background: isExecuting ? 'var(--ink-muted)' : 'var(--accent-sage)',
                        border: 'none', borderRadius: 'var(--radius-medium)',
                        padding: '8px 20px', cursor: isExecuting ? 'not-allowed' : 'pointer',
                        transition: 'background 0.15s, transform 0.15s, box-shadow 0.15s',
                        boxShadow: 'var(--shadow-surface)',
                      }}
                      onMouseEnter={(e) => {
                        if (!isExecuting) {
                          (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
                          (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-elevated)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.transform = '';
                        (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-surface)';
                      }}
                    >
                      {isExecuting ? (
                        <><RefreshCw style={{ width: 13, height: 13 }} className="animate-spin" />Executing…</>
                      ) : (
                        <><Zap style={{ width: 13, height: 13 }} />Execute Recovery</>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Safety reminder */}
            <div
              style={{
                background: 'var(--paper-alt)',
                border: '1px solid var(--border)',
                borderLeft: '3px solid var(--accent-butter)',
                borderRadius: 'var(--radius-medium)',
                padding: '10px 14px',
                display: 'flex',
                gap: 8,
              }}
            >
              <ShieldCheck style={{ width: 13, height: 13, color: 'var(--accent-butter)', flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--ink-secondary)', lineHeight: 1.5 }}>
                <strong style={{ color: 'var(--ink)' }}>Strict Financial Governance: </strong>
                The LLM engine diagnoses failure root causes; the deterministic policy engine has supreme authority over the final action. Recovered Revenue is calculated exclusively from completed, verified execution records — never from AI confidence or potential estimates.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
