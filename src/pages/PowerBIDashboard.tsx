import React, { useState, useMemo, useEffect } from 'react';
import {
  BarChart3, TrendingUp, Wallet, AlertTriangle, Percent, Users,
  Target, Save, Loader2, FileSpreadsheet, Banknote,
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, PointElement, LineElement,
  Tooltip, Legend, Filler, ArcElement,
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { useAuth } from '../context/AuthContext';
import { dataService, normalizeBankKey } from '../services/dataService';
import { CaseFile, Collection } from '../types';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, PointElement, LineElement,
  Tooltip, Legend, Filler, ArcElement,
);

const STORAGE_KEY = 'recoverypro_agent_monthly_targets';

/** '2026-09' → 'Sep 26' */
const monthLabel = (ym: string): string => {
  const [y, m] = ym.split('-');
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${names[Number(m) - 1] || '?'} ${y.slice(2)}`;
};

/** Collection date → '2026-09'. Tolerates missing/malformed dates. */
const collectionMonth = (c: Collection): string => {
  const d = c.collected_at ? new Date(c.collected_at) : null;
  if (!d || isNaN(d.getTime())) return 'unknown';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/** Case allocation date (may be ISO junk or yyyy-mm-dd) → '2026-09'. */
const caseMonth = (c: CaseFile): string => {
  const raw = (c.allocation_date || '').slice(0, 10);
  if (/^\d{4}-\d{2}/.test(raw)) return raw.slice(0, 7);
  const d = c.allocation_date ? new Date(c.allocation_date) : null;
  if (!d || isNaN(d.getTime())) return 'unknown';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const isApproved = (c: Collection) => {
  const st = (c.status || 'pending').toLowerCase();
  return st === 'approved' || st === 'verified';
};

const fmtMoney = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 1e7) return `${(n / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `${(n / 1e5).toFixed(2)} L`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString();
};

/** "DBBL PERSONAL LOAN" / "DBBL Personal LOAN" → "DBBL Personal Loan".
 * Acronyms without vowels (DBBL, MNC, PLC, SMBC) keep their casing. */
const smartTitle = (s: string): string =>
  String(s || '').split(/\s+/).filter(Boolean).map(w => {
    if (w === w.toUpperCase() && !/[AEIOUaeiou]/.test(w) && w.length <= 6) return w;
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join(' ');

const CHART_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { display: false }, ticks: { font: { size: 10 } } },
    y: { grid: { color: 'rgba(148,163,184,0.15)' }, ticks: { font: { size: 10 }, callback: (v: any) => fmtMoney(Number(v)) } },
  },
} as const;

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const PowerBIDashboard: React.FC = () => {
  const { user, users } = useAuth();
  const cases = dataService.getCases(user!);
  const collections = dataService.getAllCollections();
  const canEditTargets = user?.role === 'admin' || user?.role === 'manager';

  // Live refresh: re-render whenever dataService data changes (sync, uploads, approvals)
  const [, setDataTick] = useState(0);
  useEffect(() => {
    const unsub = dataService.subscribe(() => setDataTick(t => t + 1));
    return unsub;
  }, []);

  const [targetVersion, setTargetVersion] = useState(0);
  const [savingTargets, setSavingTargets] = useState(false);
  const [targetsSavedAt, setTargetsSavedAt] = useState<string>('');
  const [expandedAgent, setExpandedAgent] = useState<number | null>(null);

  // Load shared monthly targets (localStorage now, cloud key merges in)
  const [agentTargets, setAgentTargets] = useState<Record<number, number>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch (_) { return {}; }
  });
  const [targetDraft, setTargetDraft] = useState<Record<number, string>>({});

  // Cloud sync: when any device saves targets, every device picks them up
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as Record<string, number> | undefined;
      if (detail) setAgentTargets(prev => {
        const merged = { ...prev };
        Object.entries(detail).forEach(([k, v]) => { merged[Number(k)] = num(v); });
        return merged;
      });
    };
    window.addEventListener('agent-targets-updated', handler);
    return () => window.removeEventListener('agent-targets-updated', handler);
  }, []);

  const saveTargets = () => {
    const next: Record<number, number> = { ...agentTargets };
    Object.entries(targetDraft).forEach(([k, v]) => {
      const n = Number(String(v).replace(/[^0-9.]/g, ''));
      if (n > 0) next[Number(k)] = Math.round(n);
      else delete next[Number(k)];
    });
    setAgentTargets(next);
    setTargetDraft({});
    setSavingTargets(true);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    import('../services/offlineQueue').then(({ offlineQueue }) => {
      offlineQueue.runBackground({
        kind: 'upsert',
        table: 'file_templates',
        rows: [{ template_key: 'agent_monthly_targets', definition: { targets: next }, updated_at: new Date().toISOString() }],
        onConflict: 'template_key',
      });
      setTargetsSavedAt(new Date().toLocaleTimeString());
    }).catch(() => setTargetsSavedAt(''));
    setTimeout(() => setSavingTargets(false), 600);
    setTargetVersion(v => v + 1);
  };

  // ─── Field accessors (same sources as Bank & MNC Files page) ─────────────
  const bankOf = (c: CaseFile): string =>
    (c.bank_name || c.bank?.name || String(c.extra_attributes?.BANK_NAME || '')).trim();

  const typeOf = (c: CaseFile): string =>
    String(c.extra_attributes?.FILE_TYPE || c.extra_attributes?.file_type || c.product_name || c.product?.name || '').trim();

  // Cascading option counts: the File Type list respects the selected bank
  // and vice-versa, so you only see values that actually exist together.
  const groupOpts = (
    casesList: typeof cases,
    skip: 'bank' | 'type',
    getRaw: (c: typeof cases[number]) => string,
    keyFn: (raw: string) => string
  ) => {
    const groups = new Map<string, { name: string; count: number }>();
    casesList.forEach(c => {
      if (skip === 'bank' && selType !== 'all' && typeOf(c).toLowerCase().replace(/\s+/g, ' ') !== selType) return;
      if (skip === 'type' && selBank !== 'all' && normalizeBankKey(bankOf(c)) !== selBank) return;
      const raw = getRaw(c);
      if (!raw || raw.toUpperCase() === 'N/A') return;
      const key = keyFn(raw);
      const g = groups.get(key);
      if (g) { g.count += 1; if (raw.length < g.name.length) g.name = raw; }
      else groups.set(key, { name: raw, count: 1 });
    });
    return Array.from(groups.entries())
      .map(([key, g]) => ({ key, label: smartTitle(g.name), count: g.count }))
      .sort((a, b) => b.count - a.count);
  };

  const [selBank, setSelBank] = useState<string>('all');
  const [selType, setSelType] = useState<string>('all');
  const [selMonth, setSelMonth] = useState<string>('all');

  const typeKeyOf = (c: typeof cases[number]) => typeOf(c).toLowerCase().replace(/\s+/g, ' ');

  // Cases matching the selected bank + file type
  const scoped = useMemo(() => cases.filter(c => {
    if (selBank !== 'all' && normalizeBankKey(bankOf(c)) !== selBank) return false;
    if (selType !== 'all' && typeKeyOf(c) !== selType) return false;
    return true;
  }), [cases, selBank, selType, targetVersion]);

  const bankOptions = useMemo(
    () => groupOpts(cases, 'bank', bankOf, normalizeBankKey),
    [cases, selType, targetVersion]
  );
  const typeOptions = useMemo(
    () => groupOpts(cases, 'type', typeOf, r => r.toLowerCase().replace(/\s+/g, ' ')),
    [cases, selBank, targetVersion]
  );

  // Months available within the current bank + type selection
  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    scoped.forEach(c => { const m = caseMonth(c); if (m !== 'unknown') set.add(m); });
    return Array.from(set).sort().slice(-12);
  }, [scoped, targetVersion]);

  // Auto-reset stale selections (e.g. a type chosen under a bank that has none)
  useEffect(() => {
    if (selBank !== 'all' && !bankOptions.some(b => b.key === selBank)) setSelBank('all');
  }, [bankOptions, selBank]);
  useEffect(() => {
    if (selType !== 'all' && !typeOptions.some(t => t.key === selType)) setSelType('all');
  }, [typeOptions, selType]);
  useEffect(() => {
    if (selMonth !== 'all' && !monthOptions.includes(selMonth)) setSelMonth('all');
  }, [monthOptions, selMonth]);

  // Approved-collection flags: cases with at least one approved payment use
  // ONLY their approved payments (never the raw sheet total, which can be junk)
  const hasApproved = useMemo(() => {
    const s = new Set<number>();
    collections.forEach(col => { if (isApproved(col)) s.add(col.case_file_id); });
    return s;
  }, [collections, targetVersion]);

  /** Approved payments on the given files (fallback: recorded totals only for files with no approvals). */
  const collectedOf = (list: CaseFile[]): number => {
    let s = 0;
    const ids = new Set(list.map(c => c.id));
    collections.forEach(col => {
      if (isApproved(col) && ids.has(col.case_file_id)) s += num(col.amount);
    });
    list.forEach(c => {
      if (!hasApproved.has(c.id)) s += num(c.total_collected_amount);
    });
    return s;
  };

  const sumTiles = (list: CaseFile[]) => {
    const overdue = list.reduce((s, c) => s + num(c.overdue_amount), 0);
    const outstanding = list.reduce((s, c) => s + num(c.outstanding_amount), 0);
    const collected = collectedOf(list);
    return {
      files: list.length, overdue, outstanding, collected,
      rate: overdue > 0 ? (collected / overdue) * 100 : 0,
    };
  };

  // Tiles for the current bank + type + allocation-month selection
  const tileSum = useMemo(() => {
    const list = selMonth === 'all' ? scoped : scoped.filter(c => caseMonth(c) === selMonth);
    return sumTiles(list);
  }, [scoped, selMonth, collections, targetVersion]);

  // Monthly series for the scoped bank + type (charts always show all months,
  // picked month highlighted)
  const scopedMonths = useMemo(() => monthOptions.map(m => {
    const list = scoped.filter(c => caseMonth(c) === m);
    return { month: m, ...sumTiles(list) };
  }), [scoped, monthOptions, collections, targetVersion]);

  const barColors = (base: string, dim: string) =>
    scopedMonths.map(r => (selMonth === 'all' || r.month === selMonth ? base : dim));

  // ─── Overall portfolio per month (all banks, all types) ───────────────────
  const overallMonths = useMemo(() => monthOptions.map(m => {
    const list = cases.filter(c => caseMonth(c) === m);
    return { month: m, ...sumTiles(list) };
  }), [cases, monthOptions, collections, targetVersion]);

  const totals = useMemo(() => {
    const totalFiles = cases.length;
    const totalOverdue = cases.reduce((s, c) => s + num(c.overdue_amount), 0);
    const totalOutstanding = cases.reduce((s, c) => s + num(c.outstanding_amount), 0);
    const collectedTotal = collectedOf(cases);
    return {
      totalFiles, totalOverdue, totalOutstanding, collectedTotal,
      rate: totalOverdue > 0 ? (collectedTotal / totalOverdue) * 100 : 0,
    };
  }, [cases, collections, targetVersion]);

  // ─── Agent monthly performance (approved payments ONLY) + targets ────────
  const agents = useMemo(() => users.filter(u => u.role === 'agent'), [users, targetVersion]);

  const agentMonthly = useMemo(() => {
    const approvedByAgent = new Map<number, Map<string, number>>();
    collections.forEach(col => {
      if (!isApproved(col)) return;
      const m = collectionMonth(col);
      if (!approvedByAgent.has(col.agent_id)) approvedByAgent.set(col.agent_id, new Map());
      const mm = approvedByAgent.get(col.agent_id)!;
      mm.set(m, (mm.get(m) || 0) + num(col.amount));
    });
    return agents.map(a => {
      const own = cases.filter(c => c.assigned_agent_id === a.id);
      const perMonth = approvedByAgent.get(a.id) || new Map<string, number>();
      const monthly = monthOptions.map(m => {
        const own_m = own.filter(c => caseMonth(c) === m);
        const collected = perMonth.get(m) || 0;
        const overdue = own_m.reduce((s, c) => s + num(c.overdue_amount), 0);
        return { month: m, files: own_m.length, overdue, collected, rate: overdue > 0 ? (collected / overdue) * 100 : 0 };
      });
      let totalCollectedEver = 0;
      perMonth.forEach(v => { totalCollectedEver += v; });
      const totalOverdue = own.reduce((s, c) => s + num(c.overdue_amount), 0);
      const target = agentTargets[a.id] || 0;
      const latest = monthly[monthly.length - 1];
      const progress = target > 0 ? Math.min((latest?.collected || 0) / target, 1.5) : 0;
      return { agent: a, monthly, totalFiles: own.length, totalOverdue, totalCollected: totalCollectedEver, target, progress };
    });
  }, [agents, cases, collections, monthOptions, agentTargets, targetVersion]);

  const agentsWithFiles = agentMonthly.filter(r => r.totalFiles > 0 || r.target > 0);

  const selectedAgentRow = expandedAgent ? agentMonthly.find(r => r.agent.id === expandedAgent) : null;

  const overallChart = {
    labels: overallMonths.map(r => monthLabel(r.month)),
    datasets: [
      { label: 'Overdue', data: overallMonths.map(r => r.overdue), backgroundColor: 'rgba(244,63,94,0.75)', borderRadius: 5 },
      { label: 'Collected', data: overallMonths.map(r => r.collected), backgroundColor: 'rgba(16,185,129,0.75)', borderRadius: 5 },
    ],
  };

  const overallFilesChart = {
    labels: overallMonths.map(r => monthLabel(r.month)),
    datasets: [
      { label: 'Files allocated', data: overallMonths.map(r => r.files), fill: true, tension: 0.35, borderColor: '#0ea5e9', backgroundColor: 'rgba(14,165,233,0.14)', pointRadius: 3 },
    ],
  };

  const selectCls = "w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/40";

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-black dark:bg-white text-white dark:text-black flex items-center justify-center shadow-lg">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">Graphs &amp; Analytics</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Filter by bank, file type &amp; allocation month — overdue, outstanding, collection %
            </p>
          </div>
        </div>
      </div>

      {/* Filter bar: Partner Bank + File Type + Allocation Month */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">🏦 Partner Bank</label>
          <select value={selBank} onChange={e => setSelBank(e.target.value)} className={selectCls}>
            <option value="all">All Partner Banks ({cases.length})</option>
            {bankOptions.map(b => (
              <option key={b.key} value={b.key}>{b.label} ({b.count})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">📁 File Type</label>
          <select value={selType} onChange={e => setSelType(e.target.value)} className={selectCls}>
            <option value="all">All File Types ({cases.length})</option>
            {typeOptions.map(t => (
              <option key={t.key} value={t.key}>{t.label} ({t.count})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">📅 Allocation Month</label>
          <div className="flex gap-2">
            <select value={selMonth} onChange={e => setSelMonth(e.target.value)} className={selectCls}>
              <option value="all">All Months</option>
              {monthOptions.slice().reverse().map(m => (
                <option key={m} value={m}>{monthLabel(m)}</option>
              ))}
            </select>
            {selMonth !== 'all' && (
              <button
                onClick={() => setSelMonth('all')}
                className="px-3 py-2 rounded-xl bg-rose-500/10 text-rose-600 text-[11px] font-bold hover:bg-rose-500/20 transition-all"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Summary tiles for the current selection */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { icon: FileSpreadsheet, label: 'Files', value: tileSum.files.toLocaleString(), sub: selMonth === 'all' ? 'in selection' : `allocated ${monthLabel(selMonth)}`, color: 'text-sky-600 dark:text-sky-400 bg-sky-500/10' },
          { icon: AlertTriangle, label: 'Overdue', value: `BDT ${fmtMoney(tileSum.overdue)}`, sub: 'in selection', color: 'text-rose-600 dark:text-rose-400 bg-rose-500/10' },
          { icon: Banknote, label: 'Outstanding', value: `BDT ${fmtMoney(tileSum.outstanding)}`, sub: 'in selection', color: 'text-orange-600 dark:text-orange-400 bg-orange-500/10' },
          { icon: Wallet, label: 'Collection', value: `BDT ${fmtMoney(tileSum.collected)}`, sub: 'approved payments', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' },
          { icon: Percent, label: 'Collection %', value: `${tileSum.rate.toFixed(1)}%`, sub: 'collected vs overdue', color: 'text-amber-600 dark:text-amber-400 bg-amber-500/10' },
        ].map(kpi => (
          <div key={kpi.label} className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${kpi.color}`}>
              <kpi.icon className="w-4 h-4" />
            </div>
            <p className="mt-2 text-[10px] uppercase font-bold text-slate-400 tracking-wider">{kpi.label}</p>
            <p className="text-lg font-black text-slate-900 dark:text-white font-mono">{kpi.value}</p>
            <p className="text-[10px] text-slate-400">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Scoped charts for selected bank + type */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-500" />
            {selBank === 'all' ? 'All Partner Banks' : bankOptions.find(b => b.key === selBank)?.label || ''}
            {selType !== 'all' && ` — ${typeOptions.find(t => t.key === selType)?.label || ''}`}
          </h3>
          <span className="text-[10px] text-slate-400 font-bold uppercase">
            {selMonth === 'all' ? 'all allocation months' : `${monthLabel(selMonth)} highlighted`}
          </span>
        </div>
        {scopedMonths.every(r => r.files === 0) ? (
          <p className="text-xs text-slate-400 py-6 text-center">No files match this selection yet.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 h-56">
              <Bar
                data={{
                  labels: scopedMonths.map(r => monthLabel(r.month)),
                  datasets: [
                    { label: 'Overdue', data: scopedMonths.map(r => r.overdue), backgroundColor: barColors('rgba(244,63,94,0.75)', 'rgba(244,63,94,0.22)'), borderRadius: 5 },
                    { label: 'Outstanding', data: scopedMonths.map(r => r.outstanding), backgroundColor: barColors('rgba(249,115,22,0.7)', 'rgba(249,115,22,0.2)'), borderRadius: 5 },
                    { label: 'Collection', data: scopedMonths.map(r => r.collected), backgroundColor: barColors('rgba(16,185,129,0.75)', 'rgba(16,185,129,0.22)'), borderRadius: 5 },
                  ],
                }}
                options={{ ...CHART_OPTIONS, plugins: { legend: { display: true, labels: { boxWidth: 10, font: { size: 10 } } } } } as any}
              />
            </div>
            <div className="h-56">
              <Bar
                data={{
                  labels: scopedMonths.map(r => monthLabel(r.month)),
                  datasets: [{ label: 'Files', data: scopedMonths.map(r => r.files), backgroundColor: barColors('rgba(99,102,241,0.75)', 'rgba(99,102,241,0.22)'), borderRadius: 5 }],
                }}
                options={CHART_OPTIONS as any}
              />
            </div>
          </div>
        )}
      </div>

      {/* Overall portfolio charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Banknote className="w-4 h-4 text-emerald-500" /> Monthly Collection vs Overdue
            </h3>
            <span className="text-[10px] text-slate-400 font-bold uppercase">All banks · total files {totals.totalFiles}</span>
          </div>
          <div className="h-60">
            <Bar data={overallChart} options={{ ...CHART_OPTIONS, plugins: { legend: { display: true, labels: { boxWidth: 10, font: { size: 10 } } } } } as any} />
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-sky-500" /> Files Allocated per Month
            </h3>
            <span className="text-[10px] text-slate-400 font-bold uppercase">overdue {`BDT ${fmtMoney(totals.totalOverdue)}`}</span>
          </div>
          <div className="h-60">
            <Line data={overallFilesChart} options={CHART_OPTIONS as any} />
          </div>
        </div>
      </div>

      {/* Doughnut + agent targets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-200 mb-3">Portfolio Share by Bank (files)</h3>
          <div className="h-60">
            <Doughnut
              data={{
                labels: bankOptions.slice(0, 10).map(b => `${b.label} (${b.count})`),
                datasets: [{
                  data: bankOptions.slice(0, 10).map(b => b.count),
                  backgroundColor: ['#0ea5e9', '#10b981', '#f43f5e', '#f59e0b', '#6366f1', '#a855f7', '#14b8a6', '#ef4444', '#84cc16', '#64748b'],
                  borderWidth: 0,
                }],
              }}
              options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 9 } } } } } as any}
            />
          </div>
        </div>

        {/* Agent monthly targets */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Target className="w-4 h-4 text-amber-500" /> Monthly Collection Target per Agent
            </h3>
            <div className="flex items-center gap-2">
              {targetsSavedAt && <span className="text-[10px] font-bold text-emerald-500">Synced {targetsSavedAt}</span>}
              {canEditTargets && (
                <button
                  onClick={saveTargets}
                  className="px-3 py-1.5 rounded-xl bg-black dark:bg-white text-white dark:text-black text-[11px] font-bold flex items-center gap-1.5 shadow hover:opacity-90 transition-opacity"
                >
                  {savingTargets ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save Targets
                </button>
              )}
            </div>
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {agents.length === 0 && <p className="text-xs text-slate-400 py-4 text-center">No agents found.</p>}
            {agents.map(a => {
              const t = agentTargets[a.id] || 0;
              const draft = targetDraft[a.id] ?? (t > 0 ? String(t) : '');
              const row = agentMonthly.find(r => r.agent.id === a.id);
              const latestCollected = row?.monthly[row.monthly.length - 1]?.collected || 0;
              const pct = t > 0 ? Math.min((latestCollected / t) * 100, 100) : 0;
              return (
                <div key={a.id} className="flex items-center gap-2">
                  <span className="w-28 sm:w-36 truncate text-xs font-bold text-slate-700 dark:text-slate-200" title={a.name}>{a.name}</span>
                  <input
                    inputMode="numeric"
                    value={draft}
                    disabled={!canEditTargets}
                    onChange={e => setTargetDraft(d => ({ ...d, [a.id]: e.target.value }))}
                    placeholder="0"
                    className="w-24 px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-right text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/30 disabled:opacity-60"
                  />
                  <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-10 text-right text-[10px] font-bold text-slate-500">{t > 0 ? `${Math.round((latestCollected / t) * 100)}%` : '—'}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[10px] text-slate-400">Targets are monthly (BDT), shared across every device. Progress = latest month approved collection vs target.</p>
        </div>
      </div>

      {/* Agent performance table with per-agent charts */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-500" /> Individual Agent Performance (per month)
          </h3>
          <span className="text-[10px] text-slate-400 font-bold uppercase">tap a row for monthly charts · collected = approved only</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-2.5 px-4">Agent</th>
                <th className="py-2.5 px-3 text-center">Files</th>
                <th className="py-2.5 px-3 text-right">Overdue</th>
                <th className="py-2.5 px-3 text-right">Collected</th>
                <th className="py-2.5 px-3 text-center">Target</th>
                <th className="py-2.5 px-3 text-center">Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {agentsWithFiles.map(row => (
                <React.Fragment key={row.agent.id}>
                  <tr
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer"
                    onClick={() => setExpandedAgent(prev => (prev === row.agent.id ? null : row.agent.id))}
                  >
                    <td className="py-2.5 px-4">
                      <div className="font-bold text-slate-900 dark:text-white">{row.agent.name}</div>
                      <div className="text-[10px] font-mono text-slate-400">{row.agent.employee_id || ''}</div>
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-slate-800 dark:text-slate-200">{row.totalFiles}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400">BDT {fmtMoney(row.totalOverdue)}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">BDT {fmtMoney(row.totalCollected)}</td>
                    <td className="py-2.5 px-3 text-center font-mono text-slate-600 dark:text-slate-300">{row.target > 0 ? row.target.toLocaleString() : '—'}</td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${row.progress >= 1 ? 'bg-emerald-500' : row.progress >= 0.5 ? 'bg-amber-500' : 'bg-rose-500'}`}
                            style={{ width: `${Math.min(row.progress * 100, 100)}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-slate-500">{row.target > 0 ? `${Math.round(row.progress * 100)}%` : '—'}</span>
                      </div>
                    </td>
                  </tr>
                  {expandedAgent === row.agent.id && selectedAgentRow && (
                    <tr>
                      <td colSpan={6} className="px-4 py-3 bg-slate-50/60 dark:bg-slate-950/40">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <div className="h-48">
                            <Bar
                              data={{
                                labels: selectedAgentRow.monthly.map(r => monthLabel(r.month)),
                                datasets: [
                                  { label: 'Overdue', data: selectedAgentRow.monthly.map(r => r.overdue), backgroundColor: 'rgba(244,63,94,0.75)', borderRadius: 4 },
                                  { label: 'Collected', data: selectedAgentRow.monthly.map(r => r.collected), backgroundColor: 'rgba(16,185,129,0.75)', borderRadius: 4 },
                                ],
                              }}
                              options={{ ...CHART_OPTIONS, plugins: { legend: { display: true, labels: { boxWidth: 10, font: { size: 10 } } } } } as any}
                            />
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 content-start">
                            {selectedAgentRow.monthly.slice().reverse().map(r => (
                              <div key={r.month} className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800/70">
                                <p className="text-[9px] uppercase font-bold text-slate-400">{monthLabel(r.month)}</p>
                                <p className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-200">{r.files} files</p>
                                <p className="text-[11px] font-mono font-bold text-rose-500">OD {fmtMoney(r.overdue)}</p>
                                <p className="text-[11px] font-mono font-bold text-emerald-600">Col {fmtMoney(r.collected)}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {agentsWithFiles.length === 0 && (
          <p className="text-xs text-slate-400 py-6 text-center">No agent data yet.</p>
        )}
      </div>
    </div>
  );
};
