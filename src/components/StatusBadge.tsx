import React from 'react';
import { PaymentStatus } from '@/lib/types';
import { formatStatus } from '@/lib/format';

interface StatusBadgeProps {
  status: PaymentStatus;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  // Left-border strip style: light tinted background + colored left border + ink text
  const styleMap: Record<string, { borderColor: string; bg: string; dotColor: string; textColor: string; pulse?: boolean }> = {
    failed: {
      borderColor: 'var(--accent-clay)',
      bg: 'var(--accent-clay-light)',
      dotColor: 'var(--accent-clay)',
      textColor: 'var(--accent-clay)',
      pulse: true,
    },
    abandoned: {
      borderColor: 'var(--accent-butter)',
      bg: 'var(--accent-butter-light)',
      dotColor: 'var(--accent-butter)',
      textColor: 'var(--accent-butter)',
    },
    pending: {
      borderColor: 'var(--accent-sky)',
      bg: 'var(--accent-sky-light)',
      dotColor: 'var(--accent-sky)',
      textColor: 'var(--accent-sky)',
    },
    successful: {
      borderColor: 'var(--accent-sage)',
      bg: 'var(--accent-sage-light)',
      dotColor: 'var(--accent-sage)',
      textColor: 'var(--accent-sage)',
    },
  };

  const theme = styleMap[status] || {
    borderColor: 'var(--border-strong)',
    bg: 'var(--paper-alt)',
    dotColor: 'var(--ink-muted)',
    textColor: 'var(--ink-muted)',
  };

  const fontSize = size === 'sm' ? '10px' : '11px';
  const padding = size === 'sm' ? '2px 8px 2px 6px' : '3px 10px 3px 8px';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        fontFamily: 'var(--font-sans)',
        fontSize,
        fontWeight: 500,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: theme.textColor,
        background: theme.bg,
        borderLeft: `2px solid ${theme.borderColor}`,
        borderRadius: 'var(--radius-subtle)',
        padding,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: '5px',
          height: '5px',
          borderRadius: '50%',
          backgroundColor: theme.dotColor,
          flexShrink: 0,
        }}
        className={theme.pulse ? 'animate-pulse' : undefined}
      />
      {formatStatus(status)}
    </span>
  );
}
