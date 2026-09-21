import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { CaseStatus } from '../types';

export const StatusBadge: React.FC<{ status: CaseStatus | string }> = ({ status }) => {
  const { t } = useLanguage();

  const configs: Record<string, { bg: string; text: string; label: string; border: string }> = {
    new: { bg: 'bg-zinc-100 dark:bg-zinc-800', text: 'text-zinc-600 dark:text-zinc-300', border: 'border-zinc-300 dark:border-zinc-700', label: t('status.new', 'New') },
    in_progress: { bg: 'bg-zinc-200 dark:bg-zinc-700', text: 'text-zinc-700 dark:text-zinc-200', border: 'border-zinc-400 dark:border-zinc-600', label: t('status.in_progress', 'In Progress') },
    visited: { bg: 'bg-zinc-900 dark:bg-white', text: 'text-white dark:text-black', border: 'border-zinc-900 dark:border-white', label: t('status.visited', 'Visited') },
    broken_promise: { bg: 'bg-zinc-800 dark:bg-zinc-200', text: 'text-zinc-200 dark:text-zinc-800', border: 'border-zinc-700 dark:border-zinc-300', label: t('status.broken_promise', 'Broken Promise') },
    disputed: { bg: 'bg-zinc-300 dark:bg-zinc-600', text: 'text-zinc-800 dark:text-zinc-100', border: 'border-zinc-400 dark:border-zinc-500', label: t('status.disputed', 'Disputed') },
    legal: { bg: 'bg-black dark:bg-white', text: 'text-white dark:text-black font-black', border: 'border-black dark:border-white', label: t('status.legal', 'Legal Case') },
    untraceable: { bg: 'bg-zinc-100 dark:bg-zinc-900', text: 'text-zinc-500 dark:text-zinc-500', border: 'border-zinc-300 dark:border-zinc-700', label: t('status.untraceable', 'Untraceable') },
    settled: { bg: 'bg-zinc-900 dark:bg-white', text: 'text-white dark:text-black font-bold', border: 'border-black dark:border-white', label: t('status.settled', 'Settled') },
    closed: { bg: 'bg-zinc-100 dark:bg-zinc-900', text: 'text-zinc-400', border: 'border-zinc-300 dark:border-zinc-700', label: t('status.closed', 'Closed') },

    // Sheet-derived statuses (Daily File Upload)
    active:      { bg: 'bg-zinc-900 dark:bg-white', text: 'text-white dark:text-black', border: 'border-zinc-900 dark:border-white', label: 'Active' },
    '✅-active': { bg: 'bg-zinc-900 dark:bg-white', text: 'text-white dark:text-black', border: 'border-zinc-900 dark:border-white', label: 'Active' },
    '✔-active':  { bg: 'bg-zinc-900 dark:bg-white', text: 'text-white dark:text-black', border: 'border-zinc-900 dark:border-white', label: 'Active' },
    expired:     { bg: 'bg-zinc-100 dark:bg-zinc-900', text: 'text-zinc-500', border: 'border-zinc-300 dark:border-zinc-700', label: 'Expired' },
    '❌-expired': { bg: 'bg-zinc-100 dark:bg-zinc-900', text: 'text-zinc-500', border: 'border-zinc-300 dark:border-zinc-700', label: 'Expired' },

    // Bank Credit / Loan Classifications — B&W
    df: { bg: 'bg-zinc-800 dark:bg-zinc-200', text: 'text-zinc-200 dark:text-zinc-800 font-black', border: 'border-zinc-700 dark:border-zinc-300', label: 'DF (Doubtful)' },
    bl: { bg: 'bg-black dark:bg-white', text: 'text-white dark:text-black font-black', border: 'border-black dark:border-white', label: 'BL (Bad & Loss)' },
    ss: { bg: 'bg-zinc-200 dark:bg-zinc-700', text: 'text-zinc-800 dark:text-zinc-200 font-bold', border: 'border-zinc-400 dark:border-zinc-500', label: 'SS (Substandard)' },
    sma: { bg: 'bg-zinc-200 dark:bg-zinc-700', text: 'text-zinc-700 dark:text-zinc-300 font-bold', border: 'border-zinc-400 dark:border-zinc-500', label: 'SMA' },
    std: { bg: 'bg-zinc-100 dark:bg-zinc-800', text: 'text-zinc-700 dark:text-zinc-300 font-bold', border: 'border-zinc-300 dark:border-zinc-600', label: 'STD (Standard)' },
    uc: { bg: 'bg-zinc-200 dark:bg-zinc-700', text: 'text-zinc-700 dark:text-zinc-200 font-bold', border: 'border-zinc-400 dark:border-zinc-500', label: 'UC' },
    npl: { bg: 'bg-black dark:bg-white', text: 'text-white dark:text-black font-black', border: 'border-black dark:border-white', label: 'NPL' },
    'write-off': { bg: 'bg-zinc-100 dark:bg-zinc-900', text: 'text-zinc-500 font-black', border: 'border-zinc-300 dark:border-zinc-700', label: 'Write-off' },
    'write_off':  { bg: 'bg-zinc-100 dark:bg-zinc-900', text: 'text-zinc-500 font-black', border: 'border-zinc-300 dark:border-zinc-700', label: 'Write-off' },
    writeoff:     { bg: 'bg-zinc-100 dark:bg-zinc-900', text: 'text-zinc-500 font-black', border: 'border-zinc-300 dark:border-zinc-700', label: 'Write-off' },
  };

  const statusKey = String(status || '').toLowerCase().trim().replace(/\s+/g, '-');
  const c = configs[statusKey] || { bg: 'bg-zinc-100 dark:bg-zinc-800', text: 'text-zinc-700 dark:text-zinc-300 font-bold', border: 'border-zinc-300 dark:border-zinc-700', label: String(status || '—') };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border shadow-2xs ${c.bg} ${c.text} ${c.border}`}>
      {c.label}
    </span>
  );
};