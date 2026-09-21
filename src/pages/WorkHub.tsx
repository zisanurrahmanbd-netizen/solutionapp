import React, { useState, useEffect, useMemo } from 'react';
import {
  Wallet, Clock, UserSearch, TrendingUp, Users, Package, CalendarOff,
  FileBarChart, Plus, Edit3, Trash2, Search, FileSpreadsheet, FileText,
  CheckCircle2, XCircle, Download, RefreshCw, Info, ShieldAlert,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../context/PermissionsContext';
import { hrService, HrRecord, HrRecordType } from '../services/hrService';
import { exportTableToExcel, exportTableToPdf } from '../services/exportService';
import { User } from '../types';

// ── Module definitions (matching the requested module tiles) ─────────────
type ModuleKey = 'payroll' | 'attendance' | 'hiring' | 'growth' | 'people' | 'inventory' | 'leave' | 'reports';

const MODULES: {
  key: ModuleKey; label: string; icon: any; type?: HrRecordType;
  tile: string; desc: string;
}[] = [
  { key: 'payroll',    label: 'Payroll',    icon: Wallet,       type: 'payroll',     tile: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300', desc: 'Monthly salary runs & payouts' },
  { key: 'attendance', label: 'Attendance', icon: Clock,        type: 'attendance',  tile: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300', desc: 'Daily check-in / check-out log' },
  { key: 'hiring',     label: 'Hiring',     icon: UserSearch,   type: 'candidate',   tile: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300', desc: 'Candidate pipeline & interviews' },
  { key: 'growth',     label: 'Growth',     icon: TrendingUp,   type: 'growth_goal', tile: 'bg-lime-50 text-lime-700 dark:bg-lime-950/40 dark:text-lime-300', desc: 'Targets & performance goals' },
  { key: 'people',     label: 'People',     icon: Users,        type: 'employee',    tile: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300', desc: 'Employee master directory' },
  { key: 'inventory',  label: 'Inventory',  icon: Package,      type: 'inventory',   tile: 'bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950/40 dark:text-fuchsia-300', desc: 'Field assets & ID cards' },
  { key: 'leave',      label: 'Leave',      icon: CalendarOff,  type: 'leave',       tile: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300', desc: 'Leave requests & approvals' },
  { key: 'reports',    label: 'Reports',    icon: FileBarChart, type: undefined,     tile: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300', desc: 'Export everything (Excel / PDF)' },
];

// ── Per-module form + table schema ────────────────────────────────────────
interface FieldDef { key: string; label: string; type?: 'text' | 'number' | 'date' | 'select' | 'user'; options?: string[]; required?: boolean }

const SCHEMA: Record<Exclude<ModuleKey, 'reports'>, { fields: FieldDef[]; headers: string[]; rowOf: (d: any, nameOf: (id: number) => string) => any[] }> = {
  people: {
    fields: [
      { key: 'employee_id', label: 'Employee ID', required: true },
      { key: 'name', label: 'Full Name', required: true },
      { key: 'designation', label: 'Designation' },
      { key: 'department', label: 'Department', type: 'select', options: ['Recovery', 'Cards', 'Collections', 'Field Ops', 'Admin', 'HR'] },
      { key: 'phone', label: 'Phone' },
      { key: 'email', label: 'Email' },
      { key: 'join_date', label: 'Joining Date', type: 'date' },
      { key: 'salary', label: 'Monthly Salary', type: 'number' },
      { key: 'status', label: 'Status', type: 'select', options: ['active', 'inactive'] },
    ],
    headers: ['EMP_ID', 'NAME', 'DESIGNATION', 'DEPARTMENT', 'PHONE', 'EMAIL', 'JOIN_DATE', 'SALARY', 'STATUS'],
    rowOf: d => [d.employee_id, d.name, d.designation, d.department, d.phone, d.email, d.join_date, d.salary, d.status],
  },
  attendance: {
    fields: [
      { key: 'employee', label: 'Employee', type: 'user', required: true },
      { key: 'date', label: 'Date', type: 'date', required: true },
      { key: 'check_in', label: 'Check In (HH:MM)', required: true },
      { key: 'check_out', label: 'Check Out (HH:MM)' },
      { key: 'status', label: 'Status', type: 'select', options: ['present', 'absent', 'late', 'leave', 'field'] },
      { key: 'notes', label: 'Notes' },
    ],
    headers: ['EMPLOYEE', 'DATE', 'CHECK_IN', 'CHECK_OUT', 'STATUS', 'NOTES'],
    rowOf: (d, nameOf) => [nameOf(Number(d.employee)), d.date, d.check_in, d.check_out, d.status, d.notes],
  },
  payroll: {
    fields: [
      { key: 'employee', label: 'Employee', type: 'user', required: true },
      { key: 'month', label: 'Month (YYYY-MM)', required: true },
      { key: 'basic', label: 'Basic Salary', type: 'number', required: true },
      { key: 'allowances', label: 'Allowances / Commission', type: 'number' },
      { key: 'deductions', label: 'Deductions', type: 'number' },
      { key: 'status', label: 'Status', type: 'select', options: ['pending', 'paid'] },
      { key: 'paid_on', label: 'Paid On', type: 'date' },
    ],
    headers: ['EMPLOYEE', 'MONTH', 'BASIC', 'ALLOWANCES', 'DEDUCTIONS', 'NET_PAY', 'STATUS', 'PAID_ON'],
    rowOf: (d, nameOf) => {
      const net = (Number(d.basic) || 0) + (Number(d.allowances) || 0) - (Number(d.deductions) || 0);
      return [nameOf(Number(d.employee)), d.month, d.basic, d.allowances || 0, d.deductions || 0, net, d.status, d.paid_on];
    },
  },
  leave: {
    fields: [
      { key: 'employee', label: 'Employee', type: 'user', required: true },
      { key: 'type', label: 'Leave Type', type: 'select', options: ['casual', 'sick', 'earned', 'unpaid'], required: true },
      { key: 'from', label: 'From', type: 'date', required: true },
      { key: 'to', label: 'To', type: 'date', required: true },
      { key: 'reason', label: 'Reason' },
      { key: 'status', label: 'Status', type: 'select', options: ['pending', 'approved', 'rejected'] },
    ],
    headers: ['EMPLOYEE', 'TYPE', 'FROM', 'TO', 'REASON', 'STATUS'],
    rowOf: (d, nameOf) => [nameOf(Number(d.employee)), d.type, d.from, d.to, d.reason, d.status],
  },
  hiring: {
    fields: [
      { key: 'name', label: 'Candidate Name', required: true },
      { key: 'position', label: 'Position Applied', required: true },
      { key: 'phone', label: 'Phone' },
      { key: 'email', label: 'Email' },
      { key: 'interview_date', label: 'Interview Date', type: 'date' },
      { key: 'stage', label: 'Stage', type: 'select', options: ['applied', 'interview', 'offer', 'hired', 'rejected'] },
      { key: 'notes', label: 'Notes' },
    ],
    headers: ['CANDIDATE', 'POSITION', 'PHONE', 'EMAIL', 'INTERVIEW_DATE', 'STAGE', 'NOTES'],
    rowOf: d => [d.name, d.position, d.phone, d.email, d.interview_date, d.stage, d.notes],
  },
  growth: {
    fields: [
      { key: 'employee', label: 'Employee', type: 'user', required: true },
      { key: 'period', label: 'Period (e.g. 2026-Q3)', required: true },
      { key: 'target', label: 'Target (BDT)', type: 'number', required: true },
      { key: 'achieved', label: 'Achieved (BDT)', type: 'number' },
      { key: 'rating', label: 'Rating (1-5)', type: 'number' },
      { key: 'notes', label: 'Notes' },
    ],
    headers: ['EMPLOYEE', 'PERIOD', 'TARGET', 'ACHIEVED', 'ACHIEVEMENT_%', 'RATING', 'NOTES'],
    rowOf: (d, nameOf) => {
      const t = Number(d.target) || 0;
      const a = Number(d.achieved) || 0;
      const pct = t > 0 ? Math.round((a / t) * 100) : 0;
      return [nameOf(Number(d.employee)), d.period, t, a, `${pct}%`, d.rating, d.notes];
    },
  },
  inventory: {
    fields: [
      { key: 'item', label: 'Item Name', required: true },
      { key: 'category', label: 'Category', type: 'select', options: ['ID Card', 'Device', 'SIM', 'Documents', 'Other'] },
      { key: 'assigned_to', label: 'Assigned To', type: 'user' },
      { key: 'qty', label: 'Quantity', type: 'number' },
      { key: 'condition', label: 'Condition', type: 'select', options: ['new', 'good', 'damaged', 'lost'] },
      { key: 'notes', label: 'Notes' },
    ],
    headers: ['ITEM', 'CATEGORY', 'ASSIGNED_TO', 'QTY', 'CONDITION', 'NOTES'],
    rowOf: (d, nameOf) => [d.item, d.category, d.assigned_to ? nameOf(Number(d.assigned_to)) : '', d.qty, d.condition, d.notes],
  },
};

export const WorkHubPage: React.FC = () => {
  const { user, users } = useAuth();
  const { can } = usePermissions();
  const [active, setActive] = useState<ModuleKey>('payroll');
  const [forceTick, setForceTick] = useState(0);
  const [searchQ, setSearchQ] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<HrRecord | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // ── Access control: agents can't open WorkHub unless granted view_workhub ──
  const canViewWorkhub = can('view_workhub');

  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const canExport = isAdmin || isManager;
  const canManage = isAdmin || isManager;

  useEffect(() => {
    const unsub = hrService.subscribe(() => setForceTick(n => n + 1));
    return unsub;
  }, []);

  const nameOf = (id: number): string => users.find(u => u.id === id)?.name || `#${id}`;
  const mod = MODULES.find(m => m.key === active)!;
  const schema = mod.type ? SCHEMA[mod.key as Exclude<ModuleKey, 'reports'>] : null;

  const allCount = hrService.getAll().length;
  const records: HrRecord[] = useMemo(() => {
    if (!mod.type) return [];
    let list = hrService.byType(mod.type);
    // Agents only see their own records for personal modules
    if (user?.role === 'agent' && ['attendance', 'payroll', 'leave', 'growth'].includes(active)) {
      list = list.filter(r => String(r.data.employee) === String(user.id));
    }
    if (searchQ) {
      const q = searchQ.toLowerCase();
      list = list.filter(r => JSON.stringify(r.data).toLowerCase().includes(q));
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mod.type, active, searchQ, user, allCount, forceTick]);

  const openAdd = () => {
    setEditing(null);
    setForm({});
    setShowModal(true);
    setErr(null);
  };

  const openEdit = (r: HrRecord) => {
    setEditing(r);
    setForm({ ...r.data });
    setShowModal(true);
    setErr(null);
  };

  const handleSave = async () => {
    if (!mod.type || !schema) return;
    // Validate required fields
    for (const f of schema.fields) {
      if (f.required && (form[f.key] === undefined || form[f.key] === '')) {
        setErr(`${f.label} is required`);
        return;
      }
    }
    setBusy(true);
    setErr(null);
    try {
      await hrService.upsert(mod.type, form, editing?.id);
      setShowModal(false);
      setMsg(`✓ ${active.charAt(0).toUpperCase() + active.slice(1)} record ${editing ? 'updated' : 'added'} — synced to all devices`);
      setTimeout(() => setMsg(null), 4000);
    } catch (e: any) {
      setErr(e?.message || 'Save failed — make sure the hr_records table exists (run supabase_schema_additions.sql)');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (r: HrRecord) => {
    if (!window.confirm('Delete this record?')) return;
    try {
      await hrService.remove(r.id);
    } catch (e: any) {
      setErr(e?.message || 'Delete failed');
    }
  };

  const exportRows = (): any[][] => {
    if (!schema) return [];
    return records.map(r => schema.rowOf(r.data, nameOf));
  };

  const doExportExcel = () => {
    if (!schema) return;
    exportTableToExcel(
      `RecoveryCORE_${active}_${new Date().toISOString().slice(0, 10)}.xlsx`,
      active,
      schema.headers,
      exportRows()
    );
  };

  const doExportPdf = () => {
    if (!schema) return;
    exportTableToPdf(
      `RecoveryCORE_${active}_${new Date().toISOString().slice(0, 10)}.pdf`,
      `RecoveryCORE — ${mod.label} Report`,
      schema.headers,
      exportRows()
    );
  };

  // ── Reports module: exports of every module ──
  const doReportsExport = (kind: 'excel' | 'pdf') => {
    const sections: { title: string; headers: string[]; rows: any[][] }[] = [];
    for (const m of MODULES) {
      if (!m.type || m.key === active) continue;
      const sch = SCHEMA[m.key as Exclude<ModuleKey, 'reports'>];
      const recs = hrService.byType(m.type);
      if (recs.length === 0) continue;
      sections.push({ title: m.label, headers: sch.headers, rows: recs.map(r => sch.rowOf(r.data, nameOf)) });
    }
    const stamp = new Date().toISOString().slice(0, 10);
    if (kind === 'excel') {
      const wb = XLSX.utils.book_new();
      sections.forEach(s => {
        const ws = XLSX.utils.aoa_to_sheet([s.headers, ...s.rows]);
        XLSX.utils.book_append_sheet(wb, ws, s.title.slice(0, 31));
      });
      XLSX.writeFile(wb, `RecoveryCORE_HR_Report_${stamp}.xlsx`);
    } else {
      import('jspdf').then(({ default: jsPDF }) =>
        import('jspdf-autotable').then(({ default: autoTable }) => {
          const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
          let y = 40;
          doc.setFontSize(14);
          doc.text('RecoveryCORE — HR & Operations Report', 40, y);
          y += 24;
          sections.forEach(s => {
            autoTable(doc, {
              head: [s.headers],
              body: s.rows.map(r => r.map(v => (v === null || v === undefined ? '' : String(v)))),
              startY: y + 8,
              styles: { fontSize: 7, cellPadding: 2.5 },
              headStyles: { fillColor: [24, 24, 27], textColor: 255 },
              margin: { left: 40, right: 40 },
              didDrawPage: () => {},
            });
            y = (doc as any).lastAutoTable.finalY + 30;
          });
          doc.save(`RecoveryCORE_HR_Report_${stamp}.pdf`);
        })
      );
    }
  };

  // ── Access denied screen (shown when a user without permission lands here) ──
  if (!canViewWorkhub) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">WorkHub (HR) — Access Restricted</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
          You don't have permission to view the HR & Operations module. Ask an administrator to grant
          "WorkHub (HR) Access" in Roles & Permissions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">WorkHub — HR & Operations</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Payroll, attendance, hiring, growth, people, inventory and leave — synced live to every device
        </p>
      </div>

      {/* Module tiles (from the requested layout) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {MODULES.map(m => {
          const Icon = m.icon;
          const isActive = active === m.key;
          const count = m.type ? hrService.byType(m.type).length : null;
          return (
            <button
              key={m.key}
              onClick={() => { setActive(m.key); setSearchQ(''); }}
              className={`group flex items-center gap-2.5 px-3.5 py-3 rounded-2xl border text-left transition-all ${
                isActive
                  ? 'border-zinc-900 dark:border-white bg-zinc-900 dark:bg-white text-white dark:text-black shadow-lg'
                  : `${m.tile} border-transparent hover:shadow-md`
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-extrabold truncate">{m.label}{count !== null && count > 0 ? ` (${count})` : ''}</p>
                {!isActive && <p className="text-[10px] opacity-70 truncate">{m.desc}</p>}
              </div>
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {mod.type && (
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              placeholder={`Search ${mod.label.toLowerCase()}…`}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100"
            />
          </div>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          {canExport && (
            <>
              <button onClick={mod.type ? doExportExcel : () => doReportsExport('excel')} className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 transition-all">
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Excel
              </button>
              <button onClick={mod.type ? doExportPdf : () => doReportsExport('pdf')} className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 transition-all">
                <FileText className="w-3.5 h-3.5 text-rose-500" /> PDF
              </button>
            </>
          )}
          {mod.type && canManage && (
            <button onClick={openAdd} className="px-3.5 py-2 rounded-xl bg-black dark:bg-white text-white dark:text-black text-xs font-extrabold flex items-center gap-1.5 hover:opacity-90 transition-all shadow-md">
              <Plus className="w-4 h-4" /> Add {mod.label}
            </button>
          )}
        </div>
      </div>

      {/* Role notice */}
      {!canExport && (
        <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-zinc-400 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Export to Excel/PDF is available to <b>Admin & Manager</b> only. You can view your own records above.
          </p>
        </div>
      )}

      {/* Status banners */}
      {msg && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">{msg}</p>
        </div>
      )}
      {err && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 flex items-center gap-2">
          <XCircle className="w-4 h-4 text-rose-500" />
          <p className="text-xs font-bold text-rose-700 dark:text-rose-400">{err}</p>
        </div>
      )}

      {/* Records table */}
      {mod.type && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
                  {schema?.headers.map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-extrabold text-[10px] uppercase tracking-wide text-slate-500 whitespace-nowrap">{h}</th>
                  ))}
                  {canManage && <th className="px-3 py-2.5 text-right font-extrabold text-[10px] uppercase tracking-wide text-slate-500">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {records.length === 0 && (
                  <tr>
                    <td colSpan={(schema?.headers.length || 1) + 1} className="px-4 py-12 text-center text-slate-400">
                      No {mod.label.toLowerCase()} records yet{canManage ? ' — click "Add" to create the first one' : ''}.
                    </td>
                  </tr>
                )}
                {records.map(r => (
                  <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-950/50 transition-colors">
                    {schema?.rowOf(r.data, nameOf).map((cell, i) => (
                      <td key={i} className="px-3 py-2 text-slate-700 dark:text-slate-300 whitespace-nowrap max-w-[220px] truncate">{String(cell ?? '')}</td>
                    ))}
                    {canManage && (
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 inline-block">
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(r)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 inline-block">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reports module body */}
      {active === 'reports' && (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Download a consolidated report of <b>all WorkHub modules</b> — one sheet per module in Excel, or a multi-section PDF.
          </p>
          {!canExport ? (
            <p className="text-xs font-bold text-rose-500">Only Admin & Manager can export reports.</p>
          ) : (
            <div className="flex gap-3 flex-wrap">
              <button onClick={() => doReportsExport('excel')} className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center gap-2 transition-all">
                <Download className="w-4 h-4" /> Download Excel (all modules)
              </button>
              <button onClick={() => doReportsExport('pdf')} className="px-5 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold flex items-center gap-2 transition-all">
                <Download className="w-4 h-4" /> Download PDF (all modules)
              </button>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit modal */}
      {showModal && mod.type && schema && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {editing ? `Edit ${mod.label}` : `Add ${mod.label}`}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              {schema.fields.map(f => (
                <div key={f.key} className={f.type === 'select' && (f.options?.length || 0) > 3 ? 'col-span-2' : ''}>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {f.label}{f.required && <span className="text-rose-500"> *</span>}
                  </label>
                  {f.type === 'select' ? (
                    <select
                      value={form[f.key] || ''}
                      onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
                    >
                      <option value="">Select…</option>
                      {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : f.type === 'user' ? (
                    <select
                      value={form[f.key] || ''}
                      onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
                    >
                      <option value="">Select employee…</option>
                      {users.map((u: User) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                    </select>
                  ) : (
                    <input
                      type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                      value={form[f.key] || ''}
                      onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
                    />
                  )}
                </div>
              ))}
            </div>
            {err && <p className="text-xs font-bold text-rose-500">{err}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs">Cancel</button>
              <button onClick={handleSave} disabled={busy} className="px-4 py-2 rounded-xl bg-black dark:bg-white text-white dark:text-black font-bold text-xs flex items-center gap-1.5 disabled:opacity-50">
                {busy && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                {editing ? 'Save Changes' : 'Add Record'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
