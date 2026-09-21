import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../context/PermissionsContext';
import { useLanguage } from '../context/LanguageContext';
import { dataService, PtpAlertItem } from '../services/dataService';
import { StatusBadge } from '../components/StatusBadge';
import { formatDate } from '../services/dateFormat';
import { 
  FolderCheck, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Coins, 
  Users, 
  TrendingUp, 
  ArrowUpRight,
  ShieldAlert,
  Calendar,
  Building2,
  Phone,
  Receipt,
  BellRing,
  Sparkles,
  AlertCircle,
  X,
  UserX,
  PhoneCall,
  UploadCloud
} from 'lucide-react';

interface DashboardProps {
  onSelectCase: (caseId: number) => void;
  onNavigate: (page: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onSelectCase, onNavigate }) => {
  const { user } = useAuth();
  const { can } = usePermissions();
  const { t } = useLanguage();
  const activeUser = user!;
  const [metrics, setMetrics] = useState<any>(() => dataService.getDashboardMetrics(activeUser));
  const [cases, setCases] = useState<any[]>(() => dataService.getCases(activeUser));

  // Automatic popup modal state for Today's PTPs & Missed Payments
  const [showPtpPopup, setShowPtpPopup] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'today' | 'missed'>('today');

  useEffect(() => {
    if (user) {
      setMetrics(dataService.getDashboardMetrics(user));
      setCases(dataService.getCases(user));
    }
    const unsub = dataService.subscribe(() => {
      if (user) {
        setMetrics(dataService.getDashboardMetrics(user));
        setCases(dataService.getCases(user));
      }
    });
    return unsub;
  }, [user]);

  if (!metrics) return <div className="p-8 text-center text-slate-500">Loading dashboard metrics...</div>;

  const { summary, charts, todayPtps = [], missedPtps = [] } = metrics;
  const expiringCases = cases.filter(c => c.expiry_date && !['settled', 'closed'].includes(c.status)).slice(0, 5);

  // Unallocated cases calculation
  const unallocatedCases = cases.filter(c => {
    const hasAgentId = c.assigned_agent_id && c.assigned_agent_id > 0;
    const hasAgentName = c.agent_name && c.agent_name.trim() !== '' && c.agent_name.toLowerCase() !== 'unassigned';
    return !hasAgentId && !hasAgentName;
  });
  const unallocatedOutstanding = unallocatedCases.reduce((sum, c) => sum + (Number(c.outstanding_amount) || 0), 0);

  // Missing collector contacts
  const missingCollectors = dataService.getMissingCollectorContacts();

  const totalActionAlerts = todayPtps.length + missedPtps.length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {t('dash.title', 'Operational Dashboard')}
            </h2>
            {totalActionAlerts > 0 && (
              <button
                onClick={() => setShowPtpPopup(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-bold animate-pulse hover:bg-rose-500/20 transition-all cursor-pointer"
              >
                <BellRing className="w-3.5 h-3.5" />
                <span>{totalActionAlerts} {t('dash.urgent_followups', 'Urgent Follow-Ups')}</span>
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t('dash.subtitle', 'Real-time multi-bank debt recovery tracking & automated customer payment follow-ups')}
          </p>
        </div>

        {can('view_imports') && (
          <div className="flex items-center gap-2">              <button
                onClick={() => onNavigate('excel_upload')}
                className="px-3.5 py-2 rounded-xl bg-black dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-black font-bold text-xs shadow-md flex items-center gap-2 transition-all"
              >
              <UploadCloud className="w-4 h-4" />
              <span>Daily File Upload</span>
            </button>
          </div>
        )}
      </div>

      {/* AUTOMATIC URGENT ACTION POPUP MODAL */}
      {showPtpPopup && totalActionAlerts > 0 && (
        <div className="fixed inset-0 z-[100] w-screen h-screen flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <BellRing className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    Daily Payment Follow-Up Alert
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Customers committed to pay today & missed payment dates requiring immediate action
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowPtpPopup(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
              <button
                onClick={() => setActiveTab('today')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'today'
                    ? 'bg-black dark:bg-white text-white dark:text-black shadow-md'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Today's Commitments ({todayPtps.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('missed')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'missed'
                    ? 'bg-zinc-800 dark:bg-zinc-200 text-white dark:text-black shadow-md'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Missed / Broken Promises ({missedPtps.length})</span>
              </button>
            </div>

            {/* Modal Content List */}
            <div className="max-h-72 overflow-y-auto space-y-3 pr-1">
              {activeTab === 'today' ? (
                todayPtps.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">No payment commitments scheduled for today.</p>
                ) : (
                  todayPtps.map((item: PtpAlertItem) => (
                    <div key={'pop-today-' + item.caseItem.id} className="p-3.5 rounded-2xl bg-emerald-500/5 dark:bg-emerald-950/20 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 dark:text-white text-sm">{item.caseItem.customer_name}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold uppercase">{item.caseItem.bank?.name}</span>
                        </div>
                        <div className="text-slate-600 dark:text-slate-400 mt-0.5">
                          Promised: <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">BDT {item.promisedAmount.toLocaleString()}</span> (Due Today)
                        </div>
                        <div className="text-[11px] text-slate-500 italic mt-1">"{item.remark.remarks}"</div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <a
                          href={'tel:' + item.caseItem.customer_phone}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold flex items-center gap-1.5"
                        >
                          <Phone className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Call</span>
                        </a>
                        <button
                          onClick={() => {
                            setShowPtpPopup(false);
                            onSelectCase(item.caseItem.id);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-md shadow-emerald-600/30 flex items-center gap-1.5"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          <span>Collect / View</span>
                        </button>
                      </div>
                    </div>
                  ))
                )
              ) : (
                missedPtps.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">No missed payment promises recorded.</p>
                ) : (
                  missedPtps.map((item: PtpAlertItem) => (
                    <div key={'pop-missed-' + item.caseItem.id} className="p-3.5 rounded-2xl bg-rose-500/5 dark:bg-rose-950/20 border border-rose-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 dark:text-white text-sm">{item.caseItem.customer_name}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold uppercase">
                            {item.daysDiff} Days Overdue
                          </span>
                        </div>
                        <div className="text-slate-600 dark:text-slate-400 mt-0.5">
                          Missed Promised Date: <span className="font-bold font-mono text-rose-600 dark:text-rose-400">{item.promiseDate}</span> (BDT {item.promisedAmount.toLocaleString()})
                        </div>
                        <div className="text-[11px] text-slate-500 italic mt-1">"{item.remark.remarks}"</div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <a
                          href={'tel:' + item.caseItem.customer_phone}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold flex items-center gap-1.5"
                        >
                          <Phone className="w-3.5 h-3.5 text-rose-500" />
                          <span>Call</span>
                        </a>
                        <button
                          onClick={() => {
                            setShowPtpPopup(false);
                            onSelectCase(item.caseItem.id);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold shadow-md shadow-rose-600/30 flex items-center gap-1.5"
                        >
                          <span>Re-Engage</span>
                        </button>
                      </div>
                    </div>
                  ))
                )
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setShowPtpPopup(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs"
              >
                Close & Proceed to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UNALLOCATED FILES ALERT BANNER (Admin / Manager only - never for agents) */}
      {user?.role !== 'agent' && unallocatedCases.length > 0 && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
          <div className="flex items-center gap-3">              <div className="w-9 h-9 rounded-2xl bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center flex-shrink-0">
              <UserX className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-amber-900 dark:text-amber-200 text-sm flex items-center gap-1.5">
                <span>{unallocatedCases.length} Recovery Files Unallocated</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500 text-white font-bold">Action Required</span>
              </span>
              <p className="text-amber-800/80 dark:text-amber-300/80 text-[11px] mt-0.5">
                Total unassigned balance: <b>BDT {unallocatedOutstanding.toLocaleString()}</b>. These cases currently have no field recovery officer assigned.
              </p>
            </div>
          </div>              <button
              onClick={() => onNavigate('cases')}
              className="px-4 py-2 rounded-xl bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-black font-bold flex items-center justify-center gap-1.5 shadow-md transition-all flex-shrink-0"
            >
              <span>Assign in Cases List</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* MISSING COLLECTOR CONTACTS ALERT BANNER (Admin / Manager only - never for agents) */}
      {user?.role !== 'agent' && missingCollectors.length > 0 && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-500/10 via-pink-500/10 to-rose-500/10 border border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
          <div className="flex items-center gap-3">              <div className="w-9 h-9 rounded-2xl bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center flex-shrink-0">
              <PhoneCall className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-rose-900 dark:text-rose-200 text-sm flex items-center gap-1.5">
                <span>{missingCollectors.length} Bank Collectors Missing Contact Info</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500 text-white font-bold animate-pulse">Missing Directory Info</span>
              </span>
              <p className="text-rose-800/80 dark:text-rose-300/80 text-[11px] mt-0.5">
                New bank collectors/officers detected in recovery files (e.g., <b>{missingCollectors.slice(0, 2).map(m => m.collectorName).join(', ')}{missingCollectors.length > 2 ? ` +${missingCollectors.length - 2} more` : ''}</b>) do not have phone/email saved in Bank Contacts Directory.
              </p>
            </div>
          </div>              <button
              onClick={() => onNavigate('contacts')}
              className="px-4 py-2 rounded-xl bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-black font-bold flex items-center justify-center gap-1.5 shadow-md transition-all flex-shrink-0"
            >
              <span>Add to Bank Contacts</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${user?.role === 'agent' ? '2xl:grid-cols-4' : '2xl:grid-cols-5'} gap-4`}>
        {/* Today's PTP Card */}
        <div 
          onClick={() => { setActiveTab('today'); setShowPtpPopup(true); }}
          className="p-5 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-sm cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-600 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
              {t('dash.ptp_today', 'Due Today (PTP)')}
            </span>
            <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
              {todayPtps.length} Cases
            </div>
            <div className="text-xs text-zinc-500 mt-1 flex items-center gap-1">
              <span className="font-bold text-zinc-700 dark:text-zinc-300">Click to view & follow up</span>
            </div>
          </div>
        </div>

        {/* Missed Payment Card */}
        <div 
          onClick={() => { setActiveTab('missed'); setShowPtpPopup(true); }}
          className="p-5 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 shadow-sm cursor-pointer hover:border-zinc-500 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
              {t('dash.overdue_portfolio', 'Missed PTP / Broken')}
            </span>
            <div className="w-8 h-8 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
              {missedPtps.length} Cases
            </div>
            <div className="text-xs text-zinc-500 mt-1">
              Overdue commitment dates
            </div>
          </div>
        </div>

        {/* Unallocated Files Card (Hidden for agents) */}
        {user?.role !== 'agent' && (
          <div 
            onClick={() => onNavigate('cases')}
            className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-amber-500/30 shadow-sm cursor-pointer hover:border-amber-500 transition-all"
            title="Click to view all unallocated cases"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                Unallocated Files
              </span>
              <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center">
                <UserX className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
                {unallocatedCases.length} Files
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {unallocatedOutstanding > 0 ? `BDT ${unallocatedOutstanding.toLocaleString()} unassigned` : 'All files assigned'}
              </div>
            </div>
          </div>
        )}

        {/* Total Portfolio Card / My Assigned Portfolio Card */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              {user?.role === 'agent' ? 'My Assigned Portfolio' : t('dash.total_allocated', 'Total Portfolio')}
            </span>
            <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              BDT {summary.total_outstanding.toLocaleString()}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {summary.total_files} {user?.role === 'agent' ? 'my assigned files' : 'active recovery cases'}
            </div>
          </div>
        </div>

        {/* Total Collected Card / My Collected Cash */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              {user?.role === 'agent' ? 'My Collected Cash' : t('dash.total_collected', 'Total Collected')}
            </span>
            <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
              BDT {summary.total_collected.toLocaleString()}
            </div>
            <div className="text-xs text-zinc-500 mt-1">
              {summary.total_outstanding > 0 ? ((summary.total_collected / summary.total_outstanding) * 100).toFixed(1) : 0}% {t('dash.recovery_rate', 'recovery rate')}
            </div>
          </div>
        </div>
      </div>

      {/* Middle Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="p-6 rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-emerald-500" />
            <span>Bank Portfolio Distribution</span>
          </h3>

          <div className="space-y-4">
            {charts.files_by_bank.labels.map((bankName: string, i: number) => {
              const count = charts.files_by_bank.counts[i];
              const outstanding = charts.files_by_bank.outstandings[i];
              const pct = summary.total_outstanding > 0 ? ((outstanding / summary.total_outstanding) * 100).toFixed(0) : 0;
              return (
                <div key={bankName} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 dark:text-slate-200">{bankName}</span>
                    <span className="font-mono text-slate-500 dark:text-slate-400">BDT {outstanding.toLocaleString()} ({count} cases)</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${i === 0 ? 'bg-black dark:bg-white' : i === 1 ? 'bg-zinc-600 dark:bg-zinc-400' : 'bg-zinc-400 dark:bg-zinc-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-2 p-6 rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span>Urgent Expiry Cases Watchlist</span>
            </h3>
            <button
              onClick={() => onNavigate('cases')}
              className="text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:underline flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="pb-3">File / Customer</th>
                  <th className="pb-3">Bank / Product</th>
                  <th className="pb-3 text-right">Outstanding</th>
                  <th className="pb-3">Expiry Date</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {expiringCases.map((c: any) => (
                  <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="py-3 font-medium">
                      <div className="text-slate-900 dark:text-white font-bold">{c.customer_name}</div>
                      <div className="text-[11px] font-mono text-slate-400">{c.file_number}</div>
                    </td>
                    <td className="py-3 text-slate-600 dark:text-slate-300">
                      <div>{c.bank?.name || 'Bank'}</div>
                      <div className="text-[10px] text-slate-400">{c.product?.name}</div>
                    </td>
                    <td className="py-3 text-right font-bold text-slate-900 dark:text-slate-100">
                      BDT {c.outstanding_amount.toLocaleString()}
                    </td>
                    <td className="py-3 text-amber-600 dark:text-amber-400 font-mono font-semibold">
                      {formatDate(c.expiry_date) || 'N/A'}
                    </td>
                    <td className="py-3">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => onSelectCase(c.id)}
                        className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all text-xs"
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};