import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { dataService } from '../services/dataService';
import { TrendingUp, Printer, Award, Users, Search } from 'lucide-react';

export const AgentPerformancePage: React.FC = () => {
  const { user, users } = useAuth();
  const { t } = useLanguage();
  const [managerFilter, setManagerFilter] = useState('all');

  const agents = users.filter(u => u.role === 'agent');
  const allCases = dataService.getCases(user!);

  // Aggregate agent metrics
  const performanceData = agents.map((agent, index) => {
    const agentCases = allCases.filter(c => c.assigned_agent_id === agent.id);
    const totalFiles = agentCases.length;
    const visitedFiles = agentCases.filter(c => c.present_address_visited || c.permanent_address_visited).length;
    const totalCollected = agentCases.reduce((sum, c) => sum + (c.total_collected_amount || 0), 0);
    const totalOutstanding = agentCases.reduce((sum, c) => sum + (c.outstanding_amount || 0), 0);
    const recoveryRate = totalOutstanding > 0 ? ((totalCollected / totalOutstanding) * 100).toFixed(1) : '0.0';

    return {
      rank: index + 1,
      id: agent.id,
      name: agent.name,
      employeeId: agent.employee_id,
      managerName: agent.manager_name || 'Dhaka Team',
      totalFiles,
      visitedFiles,
      totalOutstanding,
      totalCollected,
      recoveryRate: Number(recoveryRate),
    };
  }).sort((a, b) => b.totalCollected - a.totalCollected);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {t('perf.title', 'Field Agent Performance & Recovery Analytics')}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t('perf.subtitle', 'Comparative performance rankings, visit completions, and recovery collection totals')}
          </p>
        </div>

        <button
          onClick={() => window.print()}
          className="px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 text-white font-bold text-xs hover:bg-slate-800 flex items-center gap-2 transition-all border border-slate-700/50"
          title="Print or save as PDF"
        >
          <Printer className="w-4 h-4 text-emerald-400" />
          <span>Print / PDF Report</span>
        </button>
      </div>

      {/* Top Performer Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {performanceData.slice(0, 3).map((top, idx) => (
          <div
            key={top.id}
            className={`p-5 rounded-3xl border shadow-sm relative overflow-hidden ${
              idx === 0 ? 'bg-gradient-to-tr from-amber-500/10 to-yellow-500/5 border-amber-500/30' :
              idx === 1 ? 'bg-gradient-to-tr from-slate-300/10 to-slate-400/5 border-slate-300/30' :
              'bg-gradient-to-tr from-orange-500/10 to-amber-700/5 border-orange-500/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                idx === 0 ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300' :
                idx === 1 ? 'bg-slate-400/20 text-slate-700 dark:text-slate-300' :
                'bg-orange-500/20 text-orange-600 dark:text-orange-300'
              }`}>
                {idx === 0 ? '🥇 1st Rank' : idx === 1 ? '🥈 2nd Rank' : '🥉 3rd Rank'}
              </span>
              <Award className="w-5 h-5 text-amber-500" />
            </div>

            <div className="mt-3">
              <h3 className="font-extrabold text-slate-900 dark:text-white text-base">{top.name}</h3>
              <p className="text-xs text-slate-500">{top.employeeId} • {top.managerName}</p>
              <div className="mt-3 pt-3 border-t border-slate-200/40 dark:border-slate-800/40 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">{t('perf.total_collected', 'Total Recovered')}</span>
                  <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono">BDT {top.totalCollected.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400">{t('perf.visited_files', 'Visits')}</span>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{top.visitedFiles} / {top.totalFiles}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Performance Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Rank / Agent</th>
                <th className="py-3 px-4">Reporting Team</th>
                <th className="py-3 px-4 text-center">Assigned Files</th>
                <th className="py-3 px-4 text-center">GPS Visited</th>
                <th className="py-3 px-4 text-right">Outstanding Portfolio</th>
                <th className="py-3 px-4 text-right">Total Recovered</th>
                <th className="py-3 px-4 text-right">Recovery Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {performanceData.map((row, i) => (
                <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-3.5 px-4 font-medium flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-[10px]">
                      {i + 1}
                    </span>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">{row.name}</div>
                      <div className="text-[11px] font-mono text-slate-400">{row.employeeId}</div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                    {row.managerName}
                  </td>
                  <td className="py-3.5 px-4 text-center font-bold text-slate-800 dark:text-slate-200">
                    {row.totalFiles}
                  </td>
                  <td className="py-3.5 px-4 text-center font-semibold text-purple-600 dark:text-purple-400">
                    {row.visitedFiles}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                    BDT {row.totalOutstanding.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                    BDT {row.totalCollected.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                    {row.recoveryRate}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};