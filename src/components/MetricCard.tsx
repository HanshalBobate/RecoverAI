import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string;
  subtext?: string;
  subtextColor?: string;
  icon: LucideIcon;
  accentColor: 'rose' | 'amber' | 'sky' | 'indigo' | 'slate' | 'emerald' | 'teal';
  badgeText?: string;
}

export function MetricCard({
  title,
  value,
  subtext,
  subtextColor = 'text-slate-400',
  icon: Icon,
  accentColor,
  badgeText,
}: MetricCardProps) {
  // Map old dark-mode accent names to new pastel CSS variables
  const borderColorMap: Record<string, string> = {
    rose:    'var(--accent-clay)',
    amber:   'var(--accent-butter)',
    sky:     'var(--accent-sky)',
    indigo:  'var(--accent-lavender)',
    emerald: 'var(--accent-sage)',
    teal:    'var(--accent-sage)',
    slate:   'var(--border-strong)',
  };

  const iconColorMap: Record<string, string> = {
    rose:    'var(--accent-clay)',
    amber:   'var(--accent-butter)',
    sky:     'var(--accent-sky)',
    indigo:  'var(--accent-lavender)',
    emerald: 'var(--accent-sage)',
    teal:    'var(--accent-sage)',
    slate:   'var(--ink-muted)',
  };

  const badgeBgMap: Record<string, string> = {
    rose:    'var(--accent-clay-light)',
    amber:   'var(--accent-butter-light)',
    sky:     'var(--accent-sky-light)',
    indigo:  'var(--accent-lavender-light)',
    emerald: 'var(--accent-sage-light)',
    teal:    'var(--accent-sage-light)',
    slate:   'var(--paper-alt)',
  };

  const accentBorder = borderColorMap[accentColor];
  const iconColor = iconColorMap[accentColor];
  const badgeBg = badgeBgMap[accentColor];

  return (
    <div
      className="fold-corner paper-stack relative overflow-hidden"
      style={{
        background: 'var(--paper)',
        border: '1px solid var(--border)',
        borderLeft: `3px solid ${accentBorder}`,
        borderRadius: 'var(--radius-medium)',
        padding: '18px 18px 16px',
        transition: 'box-shadow 0.15s ease, transform 0.15s ease',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
        (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-elevated)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = '';
        (e.currentTarget as HTMLElement).style.boxShadow = '';
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '11px',
            fontWeight: 500,
            color: 'var(--ink-muted)',
            letterSpacing: '0.03em',
            lineHeight: 1.3,
            maxWidth: '70%',
          }}
        >
          {title}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {badgeText && (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '9px',
                fontWeight: 500,
                color: iconColor,
                background: badgeBg,
                border: `1px solid ${accentBorder}`,
                borderRadius: 'var(--radius-subtle)',
                padding: '2px 6px',
                letterSpacing: '0.04em',
                opacity: 0.9,
              }}
            >
              {badgeText}
            </span>
          )}
          <Icon
            style={{ width: 14, height: 14, color: iconColor, opacity: 0.7, flexShrink: 0 }}
          />
        </div>
      </div>

      {/* Value */}
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '22px',
          fontWeight: 500,
          color: 'var(--ink)',
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
          marginBottom: '6px',
        }}
      >
        {value}
      </div>

      {/* Subtext */}
      {subtext && (
        <p
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '11px',
            color: 'var(--ink-secondary)',
            lineHeight: 1.4,
          }}
        >
          {subtext}
        </p>
      )}
    </div>
  );
}
