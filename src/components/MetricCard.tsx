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
  const colorMap = {
    rose: {
      border: 'border-rose-900/40 hover:border-rose-700/60',
      iconBg: 'bg-rose-500/10 text-rose-400',
      badge: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
      highlight: 'from-rose-500/5',
    },
    amber: {
      border: 'border-amber-900/40 hover:border-amber-700/60',
      iconBg: 'bg-amber-500/10 text-amber-400',
      badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
      highlight: 'from-amber-500/5',
    },
    sky: {
      border: 'border-sky-900/40 hover:border-sky-700/60',
      iconBg: 'bg-sky-500/10 text-sky-400',
      badge: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
      highlight: 'from-sky-500/5',
    },
    indigo: {
      border: 'border-indigo-900/40 hover:border-indigo-700/60',
      iconBg: 'bg-indigo-500/10 text-indigo-400',
      badge: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
      highlight: 'from-indigo-500/5',
    },
    emerald: {
      border: 'border-emerald-900/40 hover:border-emerald-700/60',
      iconBg: 'bg-emerald-500/10 text-emerald-400',
      badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
      highlight: 'from-emerald-500/5',
    },
    teal: {
      border: 'border-teal-900/40 hover:border-teal-700/60',
      iconBg: 'bg-teal-500/10 text-teal-400',
      badge: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
      highlight: 'from-teal-500/5',
    },
    slate: {
      border: 'border-slate-800 hover:border-slate-700',
      iconBg: 'bg-slate-800 text-slate-300',
      badge: 'bg-slate-800 text-slate-300 border-slate-700',
      highlight: 'from-slate-800/10',
    },
  };

  const currentTheme = colorMap[accentColor];

  return (
    <div
      className={`relative overflow-hidden rounded-xl border bg-[#0d0f17] p-5 shadow-lg transition-all duration-200 ${currentTheme.border}`}
    >
      <div
        className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${currentTheme.highlight} to-transparent`}
      />

      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {title}
        </span>
        <div className="flex items-center gap-2">
          {badgeText && (
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium border ${currentTheme.badge}`}
            >
              {badgeText}
            </span>
          )}
          <div className={`rounded-lg p-2 ${currentTheme.iconBg}`}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
      </div>

      <div className="text-2xl lg:text-3xl font-bold tracking-tight text-white mb-1.5 font-mono">
        {value}
      </div>

      {subtext && (
        <p className={`text-xs ${subtextColor} flex items-center gap-1.5`}>
          {subtext}
        </p>
      )}
    </div>
  );
}
