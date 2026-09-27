import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { dataService } from '../services/dataService';
import { CaseFile, Collection, CheckIn, CaseRemark } from '../types';
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
  /** bank_name → file count (for the bank breakdown like the portfolio widget) */
  banks: { name: string; count: number }[];
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
        const agentCases = allCases.filter(c => c.assigned_agent_id === agent.id);
        const agentCaseIds = new Set(agentCases.map(c => c.id));
        const agentCollections = allCollections.filter(c => c.agent_id === agent.id);
        const agentCheckIns = allCheckIns.filter(ci => ci.agent_id === agent.id && agentCaseIds.has(ci.case_file_id));
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

        // Bank-wise file distribution (like the portfolio summary widget)
        const bankMap = new Map<string, number>();
        agentCases.forEach(c => {
          const bankName = c.bank?.name || c.bank_name || 'Unassigned Bank';
          bankMap.set(bankName, (bankMap.get(bankName) || 0) + 1);
        });

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
          banks: [...bankMap.entries()]
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count),
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search agent by name or employee ID..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
        </div>
        <span className="ml-auto text-[11px] text-slate-400 font-bold">{filtered.length} agent(s)</span>
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
                className="w-full text-left p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black text-base shrink-0">
                      {s.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-extrabold text-slate-900 dark:text-white text-sm truncate">{s.name}</h3>
                      <p className="text-[11px] text-slate-400 font-semibold">{s.employeeId || 'Agent'} • {s.totalFiles} files</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <div className="text-[10px] uppercase font-bold text-slate-400">Target Progress</div>
                      <div className={`text-sm font-black font-mono ${pct >= 100 ? 'text-emerald-500' : pct >= 50 ? 'text-amber-500' : 'text-rose-500'}`}>
                        {s.monthlyTarget > 0 ? `${pct.toFixed(0)}%` : '—'}
                      </div>
                    </div>
                    {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
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
                  <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                      style={{ width: `${s.monthlyTarget > 0 ? Math.max(2, pct) : 0}%` }}
                    />
                  </div>
                </div>

                {/* Quick stats row */}
                <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                  <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-950/60">
                    <div className="text-[9px] uppercase font-bold text-slate-400">Files</div>
                    <div className="text-sm font-black text-slate-800 dark:text-slate-100">{s.totalFiles}</div>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-950/60">
                    <div className="text-[9px] uppercase font-bold text-slate-400">Outstanding</div>
                    <div className="text-sm font-black text-rose-600 dark:text-rose-400 font-mono">{fmtMoney(s.totalOutstanding)}</div>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-950/60">
                    <div className="text-[9px] uppercase font-bold text-slate-400">Overdue</div>
                    <div className="text-sm font-black text-amber-600 dark:text-amber-400 font-mono">{fmtMoney(s.totalOverdue)}</div>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-950/60">
                    <div className="text-[9px] uppercase font-bold text-slate-400">PTP Missed</div>
                    <div className="text-sm font-black text-rose-600 dark:text-rose-400">{s.ptpMissed}</div>
                  </div>
                </div>
              </button>

              {/* Expanded detail */}
              {expanded && (
                <div className="px-5 pb-5 space-y-4 border-t border-slate-100 dark:border-slate-800/60 pt-4">
                  {/* Field activity */}
                  <div>
                    <h4 className="text-[11px] uppercase font-bold text-slate-400 mb-2">Field Activity</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex items-center gap-2.5">
                        <MapPin className="w-4 h-4 text-emerald-500 shrink-0" />
                        <div>
                          <div className="font-black text-slate-800 dark:text-slate-100">{s.visitedFiles} visited</div>
                          <div className="text-[10px] text-slate-400">{s.notVisitedFiles} not visited yet</div>
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 flex items-center gap-2.5">
                        <ClipboardList className="w-4 h-4 text-blue-500 shrink-0" />
                        <div>
                          <div className="font-black text-slate-800 dark:text-slate-100">{s.remarkedFiles} updated</div>
                          <div className="text-[10px] text-slate-400">{s.notRemarkFiles} without remarks</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* PTP outcomes */}
                  <div>
                    <h4 className="text-[11px] uppercase font-bold text-slate-400 mb-2">Promise-to-Pay Outcomes</h4>
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
                    <div className="text-[10px] text-slate-400 mt-1.5 font-medium">
                      Total active PTPs: {s.ptpTotal} • Lifetime collected: <span className="font-bold text-emerald-500">BDT {fmtMoney(s.totalCollected)}</span>
                    </div>
                  </div>

                  {/* Bank-wise files */}
                  {s.banks.length > 0 && (
                    <div>
                      <h4 className="text-[11px] uppercase font-bold text-slate-400 mb-2">Files by Bank</h4>
                      <div className="space-y-1.5">
                        {s.banks.slice(0, 6).map(b => (
                          <div key={b.name} className="flex items-center gap-2.5 text-xs">
                            <Landmark className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="font-bold text-slate-700 dark:text-slate-200 w-40 truncate">{b.name}</span>
                            <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-slate-400 dark:bg-slate-500"
                                style={{ width: `${Math.max(4, (b.count / s.totalFiles) * 100)}%` }}
                              />
                            </div>
                            <span className="font-mono font-bold text-slate-500 w-10 text-right">{b.count}</span>
                          </div>
                        ))}
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
