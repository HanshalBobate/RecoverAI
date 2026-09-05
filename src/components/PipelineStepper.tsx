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
    accentColor: 'var(--accent-sage)',
    accentLight: 'var(--accent-sage-light)',
    icon: <Database style={{ width: 12, height: 12, color: 'var(--accent-sage)' }} />,
  };

  // Step 2: Diagnose (AI)
  const rec = aiAudit?.ai_recommendation;
  const hasAi = !!rec;
  const step2 = {
    title: '2. Diagnose',
    subtitle: isAiLoading
      ? 'Analyzing…'
      : rec
      ? `${Math.round(rec.confidence * 100)}% Conf`
      : 'Rule Engine',
    status: isAiLoading ? ('loading' as const) : hasAi ? ('complete' as const) : ('ready' as const),
    badge: rec ? rec.risk_level.toUpperCase() : 'HEURISTIC',
    accentColor: rec
      ? rec.risk_level === 'low'
        ? 'var(--accent-sage)'
        : rec.risk_level === 'medium'
        ? 'var(--accent-butter)'
        : 'var(--accent-clay)'
      : 'var(--accent-lavender)',
    accentLight: rec
      ? rec.risk_level === 'low'
        ? 'var(--accent-sage-light)'
        : rec.risk_level === 'medium'
        ? 'var(--accent-butter-light)'
        : 'var(--accent-clay-light)'
      : 'var(--accent-lavender-light)',
    icon: <Sparkles style={{ width: 12, height: 12, color: 'var(--accent-lavender)' }} />,
  };

  // Step 3: Policy Gate
  const isOverridden = aiAudit?.policy_overridden;
  const policyRule = aiAudit?.final_decision?.policy_rule || executionPreview?.policy_rule || 'POL-100';
  const step3 = {
    title: '3. Policy Gate',
    subtitle: isOverridden ? 'Overridden' : 'Approved',
    status: isOverridden ? ('warning' as const) : ('complete' as const),
    badge: policyRule.split(':')[0],
    accentColor: isOverridden ? 'var(--accent-butter)' : 'var(--accent-sage)',
    accentLight: isOverridden ? 'var(--accent-butter-light)' : 'var(--accent-sage-light)',
    icon: isOverridden ? (
      <AlertTriangle style={{ width: 12, height: 12, color: 'var(--accent-butter)' }} />
    ) : (
      <Shield style={{ width: 12, height: 12, color: 'var(--accent-sky)' }} />
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
    accentColor: isAlreadyRecovered
      ? 'var(--accent-sky)'
      : isBlocked
      ? 'var(--accent-clay)'
      : isEligible
      ? 'var(--accent-sage)'
      : 'var(--accent-sky)',
    accentLight: isAlreadyRecovered
      ? 'var(--accent-sky-light)'
      : isBlocked
      ? 'var(--accent-clay-light)'
      : isEligible
      ? 'var(--accent-sage-light)'
      : 'var(--accent-sky-light)',
    icon: isBlocked ? (
      <Lock style={{ width: 12, height: 12, color: 'var(--accent-clay)' }} />
    ) : isExecuting ? (
      <Zap style={{ width: 12, height: 12, color: 'var(--accent-sage)' }} className="animate-pulse" />
    ) : (
      <Zap style={{ width: 12, height: 12, color: 'var(--accent-sage)' }} />
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
    accentColor: isSucceeded
      ? 'var(--accent-sage)'
      : isFailed
      ? 'var(--accent-clay)'
      : currentResult
      ? 'var(--accent-sky)'
      : 'var(--border-strong)',
    accentLight: isSucceeded
      ? 'var(--accent-sage-light)'
      : isFailed
      ? 'var(--accent-clay-light)'
      : currentResult
      ? 'var(--accent-sky-light)'
      : 'var(--paper-alt)',
    icon: isSucceeded ? (
      <CheckCircle2 style={{ width: 12, height: 12, color: 'var(--accent-sage)' }} />
    ) : isFailed ? (
      <XCircle style={{ width: 12, height: 12, color: 'var(--accent-clay)' }} />
    ) : isCustomerAction ? (
      <Mail style={{ width: 12, height: 12, color: 'var(--accent-sky)' }} />
    ) : (
      <History style={{ width: 12, height: 12, color: 'var(--ink-muted)' }} />
    ),
  };

  const steps = [step1, step2, step3, step4, step5];

  return (
    <div
      style={{
        background: 'var(--paper-alt)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-medium)',
        padding: '14px 16px',
        marginBottom: 16,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
          paddingBottom: 10,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--accent-sage)',
              display: 'inline-block',
            }}
            className="animate-pulse"
          />
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 11,
              fontWeight: 500,
              color: 'var(--ink-secondary)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            End-to-End Governance Pipeline
          </span>
        </div>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--ink-muted)',
          }}
        >
          Hardware Gate Active · Zero Live Money Movement
        </span>
      </div>

      {/* Steps Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 8,
        }}
        className="pipeline-steps"
      >
        {steps.map((step, idx) => {
          const isLoading = step.status === 'loading';
          return (
            <div
              key={step.title}
              style={{
                position: 'relative',
                background: 'var(--paper)',
                border: '1px solid var(--border)',
                borderTop: `3px solid ${step.accentColor}`,
                borderRadius: 'var(--radius-medium)',
                padding: '10px 10px 8px',
                transition: 'box-shadow 0.15s ease',
                opacity: isLoading ? 0.7 : 1,
              }}
              className={isLoading ? 'animate-pulse' : undefined}
            >
              {/* Title row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 4,
                  marginBottom: 4,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {step.icon}
                  <span
                    style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: 10,
                      fontWeight: 500,
                      color: 'var(--ink-secondary)',
                      lineHeight: 1.2,
                    }}
                  >
                    {step.title}
                  </span>
                </div>
              </div>

              {/* Badge */}
              <span
                style={{
                  display: 'inline-block',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  fontWeight: 500,
                  color: step.accentColor,
                  background: step.accentLight,
                  borderLeft: `2px solid ${step.accentColor}`,
                  borderRadius: 'var(--radius-subtle)',
                  padding: '1px 5px',
                  letterSpacing: '0.04em',
                  marginBottom: 4,
                }}
              >
                {step.badge}
              </span>

              {/* Subtitle */}
              <div
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 11,
                  fontWeight: 400,
                  color: 'var(--ink-muted)',
                  lineHeight: 1.3,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  textTransform: 'capitalize',
                }}
              >
                {step.subtitle}
              </div>

              {/* Connecting arrow (hidden on mobile via CSS) */}
              {idx < 4 && (
                <div
                  style={{
                    position: 'absolute',
                    right: -10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    zIndex: 10,
                    color: 'var(--border-strong)',
                    pointerEvents: 'none',
                  }}
                  className="pipeline-arrow"
                >
                  <ArrowRight style={{ width: 10, height: 10 }} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile: 2-column fallback via inline style — handled by responsive grid below */}
      <style>{`
        @media (max-width: 640px) {
          .pipeline-steps {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .pipeline-arrow {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
