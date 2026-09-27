import React from 'react';
import { cn } from '../../lib/cn';

/**
 * Pastel gradient KPI card — the colorful SaaS dashboard style.
 * tone: mint (success/money), sky (info), amber (warning/due),
 * rose (danger/missed), violet (people/neutral).
 */
export type StatTone = 'mint' | 'sky' | 'amber' | 'rose' | 'violet';

const TONES: Record<StatTone, { card: string; chip: string; value: string; label: string; sub: string; ring: string }> = {
  mint: {
    card: 'bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/30 border-emerald-200/70 dark:border-emerald-800/50',
    chip: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
    value: 'text-emerald-700 dark:text-emerald-200',
    label: 'text-emerald-800/70 dark:text-emerald-300/70',
    sub: 'text-emerald-700/60 dark:text-emerald-400/60',
    ring: 'hover:border-emerald-400 dark:hover:border-emerald-600',
  },
  sky: {
    card: 'bg-gradient-to-br from-sky-50 to-cyan-50 dark:from-sky-950/40 dark:to-cyan-950/30 border-sky-200/70 dark:border-sky-800/50',
    chip: 'bg-sky-500/15 text-sky-600 dark:text-sky-300',
    value: 'text-sky-700 dark:text-sky-200',
    label: 'text-sky-800/70 dark:text-sky-300/70',
    sub: 'text-sky-700/60 dark:text-sky-400/60',
    ring: 'hover:border-sky-400 dark:hover:border-sky-600',
  },
  amber: {
    card: 'bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30 border-amber-200/70 dark:border-amber-800/50',
    chip: 'bg-amber-500/15 text-amber-600 dark:text-amber-300',
    value: 'text-amber-700 dark:text-amber-200',
    label: 'text-amber-800/70 dark:text-amber-300/70',
    sub: 'text-amber-700/60 dark:text-amber-400/60',
    ring: 'hover:border-amber-400 dark:hover:border-amber-600',
  },
  rose: {
    card: 'bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-950/40 dark:to-pink-950/30 border-rose-200/70 dark:border-rose-800/50',
    chip: 'bg-rose-500/15 text-rose-600 dark:text-rose-300',
    value: 'text-rose-700 dark:text-rose-200',
    label: 'text-rose-800/70 dark:text-rose-300/70',
    sub: 'text-rose-700/60 dark:text-rose-400/60',
    ring: 'hover:border-rose-400 dark:hover:border-rose-600',
  },
  violet: {
    card: 'bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/40 dark:to-purple-950/30 border-violet-200/70 dark:border-violet-800/50',
    chip: 'bg-violet-500/15 text-violet-600 dark:text-violet-300',
    value: 'text-violet-700 dark:text-violet-200',
    label: 'text-violet-800/70 dark:text-violet-300/70',
    sub: 'text-violet-700/60 dark:text-violet-400/60',
    ring: 'hover:border-violet-400 dark:hover:border-violet-600',
  },
};

interface StatCardProps {
  tone?: StatTone;
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  onClick?: () => void;
  className?: string;
  /** Compact density for grids of 5+ */
  compact?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({
  tone = 'mint',
  label,
  value,
  sub,
  icon,
  onClick,
  className,
  compact = false,
}) => {
  const t = TONES[tone];
  const Tag: any = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      {...(onClick ? { type: 'button' as const } : {})}
      className={cn(
        'text-left rounded-2xl border shadow-sm p-4 sm:p-5 transition-all',
        t.card,
        onClick && cn('cursor-pointer hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500', t.ring),
        compact && 'p-3.5',
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn('text-[11px] font-bold uppercase tracking-wider truncate', t.label)}>
          {label}
        </span>
        <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center shrink-0', t.chip)} aria-hidden="true">
          {icon}
        </div>
      </div>
      <div className={cn('mt-2 font-black tracking-tight tabular-nums', compact ? 'text-lg' : 'text-xl sm:text-2xl', t.value)}>
        {value}
      </div>
      {sub && <div className={cn('text-[11px] font-semibold mt-0.5', t.sub)}>{sub}</div>}
    </Tag>
  );
};
