import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { dataService, normalizeBankKey } from '../services/dataService';
import { CaseFile, Collection, CheckIn, CaseRemark, User } from '../types';
import {
  Users, Search, Target, TrendingUp, MapPin, ClipboardList,
  FileText, Banknote, AlertTriangle, CalendarCheck, ChevronDown, ChevronRight, Landmark,
} from 'lucide-react';

const TARGETS_KEY = 'recoverypro_agent_monthly_targets';

/** Collection date → 'YYYY-MM' (tolerates junk dates). */
const collectionMonth = (c: Collection): string => {
  const d = c.collected_at ? new Date(c.collected_at) : null;
  if (!d || isNaN(d.getTime())) return 'unknown';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const isApproved = (c: Collection) => {
  const st = (c.status || 'pending').toLowerCase();
  return st === 'approved' || st === 'verified';
};

/** Mirror of dataService.getCases agent matching: id match OR name/employee
 *  id/email string match against the case's agent_name column — many files
 *  are only linked by name (sheet upload), not by assigned_agent_id. */
const matchesAgent = (c: CaseFile, agent: User): boolean => {
  if (c.assigned_agent_id === agent.id) return true;
  const uName = (agent.name || '').trim().toLowerCase();
  const uEmp = (agent.employee_id || '').trim().toLowerCase();
  const uEmail = (agent.email || '').trim().toLowerCase();
  const rawAgent = (
    c.agent_name ||
    c.extra_attributes?.AGENT_NAME ||
    c.extra_attributes?.AGENT ||
    c.extra_attributes?.FIELD_AGENT ||
    ''
  ).trim().toLowerCase();
  if (!rawAgent) return false;
  return (
    rawAgent === uName ||
    (!!uEmp && rawAgent === uEmp) ||
    (!!uEmail && (rawAgent === uEmail || uEmail.startsWith(rawAgent))) ||
    (!!uName && uName.includes(rawAgent)) ||
    (!!uName && rawAgent.includes(uName))
  );
};

const fmtMoney = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 1e7) return `${(n / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `${(n / 1e5).toFixed(2)} L`;
  return n.toLocaleString();
};

interface AgentStats {
  id: number;
  name: string;
  employeeId: string;
  totalFiles: number;
  totalOverdue: number;
  totalOutstanding: number;
  monthlyTarget: number;
  monthCollected: number;
  totalCollected: number;
  visitedFiles: number;
  notVisitedFiles: number;
  remarkedFiles: number;
  notRemarkFiles: number;
  ptpTotal: number;
  ptpMissed: number;
  ptpReissued: number;
  ptpSuccessful: number;
  /** Bank–Product portfolio sections (One Bank – Loan, DBBL – Credit Card…) */
  portfolios: {
    label: string;
    count: number;
    visited: number;
    notVisited: number;
    updated: number;
    notUpdated: number;
    collected: number;
  }[];
}

const AgentProfilesPage: React.FC = () => {
  const { user, users } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [targets, setTargets] = useState<Record<number, number>>({});
  const [dataVersion, setDataVersion] = useState(0);

  // Shared monthly targets (same cloud-synced store the analytics page writes)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(TARGETS_KEY);
      if (saved) setTargets(JSON.parse(saved));
    } catch (_) { /* ignore */ }
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as Record<string, number> | undefined;
      if (detail) setTargets({ ...detail });
    };
    window.addEventListener('agent-targets-updated', handler);
    return () => window.removeEventListener('agent-targets-updated', handler);
  }, []);

  // Re-compute when dataService syncs new cases/remarks/checkins/collections
  useEffect(() => {
    const bump = () => setDataVersion(v => v + 1);
    return dataService.subscribe(bump);
  }, []);

  const currentMonth = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const stats = useMemo<AgentStats[]>(() => {
    void dataVersion; // recompute when data syncs
    const allCases: CaseFile[] = dataService.getCases({ role: 'admin' } as any);
    const allCollections: Collection[] = dataService.getAllCollections();
    const allRemarks: CaseRemark[] = dataService.getAllRemarks();
    const allCheckIns: CheckIn[] = dataService.getAllCheckIns();
    const todayStr = new Date().toISOString().split('T')[0];

    return users
      .filter(u => u.role === 'agent')
      .map(agent => {
        const agentCases = allCases.filter(c => matchesAgent(c, agent));
        const agentCaseIds = new Set(agentCases.map(c => c.id));
        // Collections/check-ins link to the agent by id OR by belonging to
        // one of the agent's cases (covers legacy rows with agent_id 0).
        const agentCollections = allCollections.filter(
          c => c.agent_id === agent.id || agentCaseIds.has(c.case_file_id)
        );
        const agentCheckIns = allCheckIns.filter(
          ci => ci.agent_id === agent.id || agentCaseIds.has(ci.case_file_id)
        );
        const agentRemarks = allRemarks.filter(r => agentCaseIds.has(r.case_file_id));

        // Per-case remark / checkin participation
        const visitedCaseIds = new Set(
          agentCases
            .filter(c => c.present_address_visited || c.permanent_address_visited)
            .map(c => c.id)
        );
        agentCheckIns.forEach(ci => visitedCaseIds.add(ci.case_file_id));

        const remarkedCaseIds = new Set(agentRemarks.map(r => r.case_file_id));

        // PTP analytics from remarks that carry a promise_date
        const ptpRemarks = agentRemarks.filter(r => r.promise_date).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        const latestPtpByCase = new Map<number, CaseRemark>();
        ptpRemarks.forEach(r => {
          if (!latestPtpByCase.has(r.case_file_id)) latestPtpByCase.set(r.case_file_id, r);
        });

        let ptpMissed = 0;
        let ptpSuccessful = 0;
        let ptpReissued = 0;
        latestPtpByCase.forEach((r, caseId) => {
          const caseCol = allCollections.filter(c => c.case_file_id === caseId && isApproved(c));
          const paidAfterPromise = caseCol.some(c => c.collected_at && c.collected_at > (r.promise_date as string));
          if (r.promise_date && (r.promise_date as string) < todayStr) {
            if (paidAfterPromise) ptpSuccessful++;
            else ptpMissed++;
          } else if (ptpRemarks.some(x => x.case_file_id === caseId && x.id !== r.id)) {
            // Still-future promise on a case that had an earlier one → reissued
            ptpReissued++;
          }
        });

        // Count reissues: cases with more than one promise over time
        const casesWithMultiPtp = new Set<number>();
        const seenCase = new Set<number>();
        ptpRemarks.forEach(r => {
          if (seenCase.has(r.case_file_id)) casesWithMultiPtp.add(r.case_file_id);
          seenCase.add(r.case_file_id);
        });
        ptpReissued = casesWithMultiPtp.size;

        // Bank–Product portfolio sections — same sources and precedence as the
        // Dashboard's "Bank Portfolio Distribution" widget so the labels match
        // (One Bank – Loan, DBBL – Credit Card, Asian Paints – Dealers …).
        const groupMap = new Map<string, { label: string; cases: CaseFile[] }>();
        agentCases.forEach(c => {
          const bank = (
            c.bank_name?.trim() ||
            c.extra_attributes?.BANK_NAME?.trim() ||
            c.bank?.name ||
            'Other'
          );
          const fileType = String(
            c.extra_attributes?.FILE_TYPE ||
            c.extra_attributes?.file_type ||
            c.product_name ||
            ''
          ).trim();
          const label = fileType && fileType.toUpperCase() !== 'N/A'
            ? `${bank} – ${fileType}`
            : bank;
          // Merge case-spelling variants ("DBBL Personal LOAN" vs "DBBL PERSONAL LOAN")
          const key = normalizeBankKey(label);
          const existing = groupMap.get(key);
          if (existing) {
            existing.cases.push(c);
            if (label.length < existing.label.length) existing.label = label;
          } else {
            groupMap.set(key, { label, cases: [c] });
          }
        });

        const portfolios = [...groupMap.values()]
          .map(({ label, cases }) => {
            const caseIds = new Set(cases.map(c => c.id));
            const visited = cases.filter(
              c => visitedCaseIds.has(c.id)
            ).length;
            const updated = cases.filter(c => remarkedCaseIds.has(c.id)).length;
            const collected = agentCollections
              .filter(col => isApproved(col) && caseIds.has(col.case_file_id))
              .reduce((sum, col) => sum + (Number(col.amount) || 0), 0);
            return {
              label,
              count: cases.length,
              visited,
              notVisited: cases.length - visited,
              updated,
              notUpdated: cases.length - updated,
              collected,
            };
          })
          .sort((a, b) => b.count - a.count);

        const monthCollected = agentCollections
          .filter(c => collectionMonth(c) === currentMonth && isApproved(c))
          .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

        return {
          id: agent.id,
          name: agent.name,
          employeeId: agent.employee_id || '',
          totalFiles: agentCases.length,
          totalOverdue: agentCases.reduce((s, c) => s + (Number(c.overdue_amount) || 0), 0),
          totalOutstanding: agentCases.reduce((s, c) => s + (Number(c.outstanding_amount) || 0), 0),
          monthlyTarget: targets[agent.id] || 0,
          monthCollected,
          totalCollected: agentCollections.filter(isApproved).reduce((s, c) => s + (Number(c.amount) || 0), 0),
          visitedFiles: visitedCaseIds.size,
          notVisitedFiles: agentCases.length - visitedCaseIds.size,
          remarkedFiles: remarkedCaseIds.size,
          notRemarkFiles: agentCases.length - remarkedCaseIds.size,
          ptpTotal: latestPtpByCase.size,
          ptpMissed,
          ptpReissued,
          ptpSuccessful,
          portfolios,
        };
      })
      .sort((a, b) => b.monthCollected - a.monthCollected);
  }, [users, targets, currentMonth, dataVersion]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return stats;
    return stats.filter(s =>
      s.name.toLowerCase().includes(q) || s.employeeId.toLowerCase().includes(q)
    );
  }, [stats, searchTerm]);

  const progress = (s: AgentStats) =>
    s.monthlyTarget > 0 ? Math.min(100, (s.monthCollected / s.monthlyTarget) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <Users className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            <span>Agent Profiles — Individual Performance</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Per-agent portfolio, targets, visits, remarks updates, and promise-to-pay outcomes for {currentMonth}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-2">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
          <input
            type="text"
            placeholder="Search agent by name or employee ID..."
            aria-label="Search agents by name or employee ID"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          />
        </div>
        <span className="ml-auto text-[11px] text-slate-500 dark:text-slate-400 font-bold" aria-live="polite">{filtered.length} agent(s)</span>
      </div>

      {/* Agent profile cards */}
      {filtered.length === 0 && (
        <div className="p-10 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-slate-400">
          <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm font-bold">No agents found</p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {filtered.map(s => {
          const pct = progress(s);
          const expanded = expandedId === s.id;
          return (
            <div
              key={s.id}
              className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
            >
              {/* Card header — always visible */}
              <button
                onClick={() => setExpandedId(expanded ? null : s.id)}
                aria-expanded={expanded}
                aria-controls={`agent-panel-${s.id}`}
                className="w-full text-left p-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-inset"
                aria-label={`${s.name} performance profile: ${s.totalFiles} files, ${s.monthlyTarget > 0 ? `${Math.round(pct)} percent of monthly target` : 'no monthly target set'}, ${s.visitedFiles} visited, ${s.ptpMissed} promises missed. Click to ${expanded ? 'collapse' : 'expand'} details.`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black text-base shrink-0">
                      {s.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0" aria-hidden="true">
                      <h3 className="font-extrabold text-slate-900 dark:text-white text-sm truncate">{s.name}</h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">{s.employeeId || 'Agent'} • {s.totalFiles} files</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0" aria-hidden="true">
                    <div className="text-right">
                      <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Target Progress</div>
                      <div className={`text-sm font-black font-mono ${pct >= 100 ? 'text-emerald-500' : pct >= 50 ? 'text-amber-500' : 'text-rose-500'}`}>
                        {s.monthlyTarget > 0 ? `${pct.toFixed(0)}%` : '—'}
                      </div>
                    </div>
                    {expanded ? <ChevronDown className="w-4 h-4 text-slate-500" aria-hidden="true" /> : <ChevronRight className="w-4 h-4 text-slate-500" aria-hidden="true" />}
                  </div>
                </div>

                {/* Target progress bar */}
                <div className="mt-3.5">
                  <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                    <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Target className="w-3 h-3" /> Monthly Target {s.monthlyTarget > 0 ? `BDT ${fmtMoney(s.monthlyTarget)}` : '(not set)'}
                    </span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-mono">BDT {fmtMoney(s.monthCollected)} collected</span>
                  </div>
                  <div
                    role="progressbar"
                    aria-label={`${s.name} monthly target progress`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(s.monthlyTarget > 0 ? pct : 0)}
                    aria-valuetext={s.monthlyTarget > 0 ? `${Math.round(pct)}% of BDT ${s.monthlyTarget.toLocaleString()} collected` : 'No target set'}
                    className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden"
                  >
                    <div
                      className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                      style={{ width: `${s.monthlyTarget > 0 ? Math.max(2, pct) : 0}%` }}
                    />
                  </div>
                </div>

                {/* Quick stats row — pastel tiles */}
                <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                  <div className="p-2 rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200/60 dark:border-sky-800/40">
                    <div className="text-[10px] uppercase font-bold text-sky-800/70 dark:text-sky-300/70">Files</div>
                    <div className="text-sm font-black text-sky-700 dark:text-sky-200 tabular-nums">{s.totalFiles}</div>
                  </div>
                  <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-800/40">
                    <div className="text-[10px] uppercase font-bold text-rose-800/70 dark:text-rose-300/70">Outstanding</div>
                    <div className="text-sm font-black text-rose-700 dark:text-rose-200 tabular-nums">{fmtMoney(s.totalOutstanding)}</div>
                  </div>
                  <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40">
                    <div className="text-[10px] uppercase font-bold text-amber-800/70 dark:text-amber-300/70">Overdue</div>
                    <div className="text-sm font-black text-amber-700 dark:text-amber-200 tabular-nums">{fmtMoney(s.totalOverdue)}</div>
                  </div>
                  <div className="p-2 rounded-xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200/60 dark:border-violet-800/40">
                    <div className="text-[10px] uppercase font-bold text-violet-800/70 dark:text-violet-300/70">PTP Missed</div>
                    <div className="text-sm font-black text-violet-700 dark:text-violet-200 tabular-nums">{s.ptpMissed}</div>
                  </div>
                </div>
              </button>

              {/* Expanded detail */}
              {expanded && (
                <div id={`agent-panel-${s.id}`} className="px-5 pb-5 space-y-4 border-t border-slate-100 dark:border-slate-800/60 pt-4">
                  {/* Field activity */}
                  <div>
                    <h4 className="text-[11px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-2">Field Activity</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex items-center gap-2.5">
                        <MapPin className="w-4 h-4 text-emerald-500 shrink-0" aria-hidden="true" />
                        <div>
                          <div className="font-black text-slate-800 dark:text-slate-100">{s.visitedFiles} visited</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">{s.notVisitedFiles} not visited yet</div>
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 flex items-center gap-2.5">
                        <ClipboardList className="w-4 h-4 text-blue-500 shrink-0" aria-hidden="true" />
                        <div>
                          <div className="font-black text-slate-800 dark:text-slate-100">{s.remarkedFiles} updated</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">{s.notRemarkFiles} without remarks</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* PTP outcomes */}
                  <div>
                    <h4 className="text-[11px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-2">
                      Promise-to-Pay (PTP) Outcomes
                    </h4>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="p-2.5 rounded-xl bg-rose-500/5 border border-rose-500/20">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-500 mx-auto mb-1" />
                        <div className="font-black text-rose-600 dark:text-rose-400">{s.ptpMissed}</div>
                        <div className="text-[10px] text-slate-400 font-bold">Missed</div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/20">
                        <CalendarCheck className="w-3.5 h-3.5 text-amber-500 mx-auto mb-1" />
                        <div className="font-black text-amber-600 dark:text-amber-400">{s.ptpReissued}</div>
                        <div className="text-[10px] text-slate-400 font-bold">Reissued</div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-500 mx-auto mb-1" />
                        <div className="font-black text-emerald-600 dark:text-emerald-400">{s.ptpSuccessful}</div>
                        <div className="text-[10px] text-slate-400 font-bold">Successful</div>
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5 font-medium">
                      Total active PTPs: {s.ptpTotal} • Lifetime collected: <span className="font-bold text-emerald-500">BDT {fmtMoney(s.totalCollected)}</span>
                    </div>
                  </div>

                  {/* Bank–Product portfolio sections */}
                  {s.portfolios.length > 0 && (
                    <div>
                      <h4 className="text-[11px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-2">Portfolio by Bank & Product</h4>
                      <div className="space-y-2">
                        {s.portfolios.map(p => {
                          const max = s.portfolios[0].count || 1;
                          return (
                            <div key={p.label} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800">
                              <div className="flex items-center gap-2.5">
                                <Landmark className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="font-bold text-slate-700 dark:text-slate-200 text-xs flex-1 truncate">{p.label}</span>
                                <span className="font-mono font-black text-slate-800 dark:text-slate-100 text-xs">{p.count} files</span>
                              </div>
                              <div className="mt-1.5 h-1.5 rounded-full bg-slate-200/60 dark:bg-slate-800 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-slate-400 dark:bg-slate-500"
                                  style={{ width: `${Math.max(4, (p.count / max) * 100)}%` }}
                                />
                              </div>
                              <div className="mt-2 grid grid-cols-4 gap-1.5 text-center">
                                <div className="p-1.5 rounded-lg bg-emerald-500/5 border border-emerald-500/15">
                                  <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Visited</div>
                                  <div className="text-xs font-black text-emerald-600 dark:text-emerald-400">{p.visited}</div>
                                  <div className="text-[10px] text-slate-500 dark:text-slate-400">{p.notVisited} left</div>
                                </div>
                                <div className="p-1.5 rounded-lg bg-blue-500/5 border border-blue-500/15">
                                  <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Updated</div>
                                  <div className="text-xs font-black text-blue-600 dark:text-blue-400">{p.updated}</div>
                                  <div className="text-[10px] text-slate-500 dark:text-slate-400">{p.notUpdated} left</div>
                                </div>
                                <div className="p-1.5 rounded-lg bg-amber-500/5 border border-amber-500/15">
                                  <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Not Visited</div>
                                  <div className="text-xs font-black text-amber-600 dark:text-amber-400">{p.notVisited}</div>
                                  <div className="text-[10px] text-slate-500 dark:text-slate-400">of {p.count}</div>
                                </div>
                                <div className="p-1.5 rounded-lg bg-rose-500/5 border border-rose-500/15">
                                  <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Collected</div>
                                  <div className="text-xs font-black text-rose-600 dark:text-rose-400 font-mono">{fmtMoney(p.collected)}</div>
                                  <div className="text-[10px] text-slate-500 dark:text-slate-400">BDT total</div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Totals */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60">
                      <FileText className="w-3.5 h-3.5 text-slate-400 mx-auto mb-1" />
                      <div className="font-black text-slate-800 dark:text-slate-100">{s.totalFiles}</div>
                      <div className="text-[10px] text-slate-400 font-bold">Assigned Files</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60">
                      <Banknote className="w-3.5 h-3.5 text-emerald-500 mx-auto mb-1" />
                      <div className="font-black text-emerald-600 dark:text-emerald-400 font-mono">{fmtMoney(s.monthCollected)}</div>
                      <div className="text-[10px] text-slate-400 font-bold">Collected ({currentMonth})</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60">
                      <Target className="w-3.5 h-3.5 text-amber-500 mx-auto mb-1" />
                      <div className="font-black text-amber-600 dark:text-amber-400 font-mono">{s.monthlyTarget > 0 ? fmtMoney(s.monthlyTarget) : '—'}</div>
                      <div className="text-[10px] text-slate-400 font-bold">Monthly Target</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export { AgentProfilesPage };
