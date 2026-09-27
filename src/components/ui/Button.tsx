import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-ghost';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary-600 text-white hover:bg-primary-500 active:bg-primary-700 shadow-sm shadow-primary-600/30',
  secondary:
    'bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-400 active:bg-neutral-50 shadow-sm',
  ghost:
    'bg-transparent text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 active:bg-neutral-200/60',
  danger: 'bg-danger-600 text-white hover:bg-danger-500 active:bg-danger-700 shadow-sm shadow-danger-600/30',
  'danger-ghost':
    'bg-danger-500/10 border border-danger-500/30 text-danger-600 dark:text-danger-400 hover:bg-danger-500/20',
};

const SIZES = {
  sm: 'h-8 px-2.5 text-2xs',
  md: 'h-9 px-3.5 text-xs',
  lg: 'h-11 px-5 text-sm',
} as const;

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: keyof typeof SIZES;
  loading?: boolean;
  /** Render an anchor styled as a button. */
  href?: string;
  /** React 19: ref is a regular prop on function components. */
  ref?: React.Ref<HTMLButtonElement>;
}

/**
 * Design-system button. One primary action per view uses `variant="primary"`;
 * everything else is secondary/ghost. Destructive always uses danger variants.
 */
export const Button = ({
  variant = 'secondary',
  size = 'md',
  loading = false,
  href,
  className,
  children,
  disabled,
  type = 'button',
  ref,
  ...rest
}: ButtonProps) => {
  const classes = cn(
    'inline-flex items-center justify-center gap-1.5 font-bold rounded-xl select-none',
    'transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
    'disabled:opacity-50 disabled:pointer-events-none',
    'aria-busy:opacity-70 aria-busy:pointer-events-none',
    SIZES[size],
    VARIANTS[variant],
    className
  );

  if (href) {
    return (
      <a href={href} className={classes} aria-busy={loading || undefined} {...(rest as any)}>
        {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
        {children}
      </a>
    );
  }

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={classes}
      {...rest}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />}
      {children}
    </button>
  );
};
