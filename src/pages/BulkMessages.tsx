import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { dataService, getAllSystemBanks } from '../services/dataService';
import { usePermissions } from '../context/PermissionsContext';
import { BulkMessageModal } from '../components/BulkMessageModal';
import { BulkRecipient } from '../services/messaging';
import { CaseFile } from '../types';
import { EXPORT_AVAILABLE_COLUMNS } from './FileUpdateExport';
import {
  Users,
  MessageCircle,
  UserCheck,
  PhoneCall,
  Search,
  Briefcase,
  FileSpreadsheet,
  Filter,
  CheckSquare,
  Square,
} from 'lucide-react';

type AudienceKey = 'agents' | 'cs' | 'managers' | 'customers' | 'bank_officers';

const AUDIENCES: {
  key: AudienceKey;
  label: string;
  desc: string;
  icon: any;
  tint: string;
}[] = [
  { key: 'agents', label: 'Field Agents', desc: 'Send updates to your field agents — pick which files to attach', icon: Users, tint: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' },
  { key: 'cs', label: 'Customer Service (C.S.)', desc: 'All customer service accounts', icon: PhoneCall, tint: 'text-sky-600 dark:text-sky-400 bg-sky-500/10' },
  { key: 'managers', label: 'Managers', desc: 'All team manager accounts', icon: UserCheck, tint: 'text-blue-600 dark:text-blue-400 bg-blue-500/10' },
  { key: 'customers', label: 'Customers (Bank & MNC Files)', desc: 'Customer phone numbers from recovery files — filtered below', icon: Briefcase, tint: 'text-amber-600 dark:text-amber-400 bg-amber-500/10' },
  { key: 'bank_officers', label: 'Bank Officers / C.S. Contacts', desc: 'Send file updates to partner bank officers — filter & select who', icon: PhoneCall, tint: 'text-purple-600 dark:text-purple-400 bg-purple-500/10' },
];

export const BulkMessagesPage: React.FC = () => {
  const { user, users } = useAuth();
  const { t } = useLanguage();
  const { can } = usePermissions();
  const [audience, setAudience] = useState<AudienceKey | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [searchQ, setSearchQ] = useState('');

  // Which recipients are checked (empty selection = everyone in the filtered list)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  // ── File-update attachment filters (which files go into the Excel) ──
  const [fBank, setFBank] = useState('all');
  const [fType, setFType] = useState('all');
  const [fStatus, setFStatus] = useState('all');
  const [fAgent, setFAgent] = useState('all');
  const [fCollector, setFCollector] = useState('all');

  // ── Bank officer directory filters ──────────────────────────────────
  const [oBank, setOBank] = useState('all');
  const [oDept, setODept] = useState('all');
  const [oBranch, setOBranch] = useState('all');

  const banks = getAllSystemBanks();
  // Punctuation-insensitive bank key so "Dutch-Bangla Bank" == "Dutch Bangla Bank"
  const bankKeyOf = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9\u0980-\u09FF]+/g, '');
  const sysBankByKey = useMemo(() => {
    const m = new Map<string, string>();
    banks.forEach(b => m.set(bankKeyOf(b.name), b.name));
    return m;
  }, [banks]);
  const bankNameOf = (bankId: number, bankName?: string): string => {
    const raw = bankName?.trim();
    if (raw) return sysBankByKey.get(bankKeyOf(raw)) || raw;
    return banks.find(b => b.id === bankId)?.name || `Bank #${bankId}`;
  };

  const attachFiles = audience === 'agents' || audience === 'bank_officers';

  // ── Cases (for attachment + customer recipients) ─────────────────────
  const allCases = useMemo(() => (user ? dataService.getCases(user) : []), [user]);

  const caseBanks = useMemo(() => {
    const s = new Set<string>();
    allCases.forEach(c => {
      const n = c.bank_name || c.bank?.name || String(c.extra_attributes?.BANK_NAME || '');
      if (n.trim()) s.add(n);
    });
    return Array.from(s).sort();
  }, [allCases]);

  const caseTypes = useMemo(() => {
    const s = new Set<string>();
    allCases.forEach(c => {
      const v = String(c.extra_attributes?.FILE_TYPE || c.product?.name || c.product_name || '');
      if (v.trim()) s.add(v);
    });
    return Array.from(s).sort();
  }, [allCases]);

  const caseStatuses = useMemo(() => {
    const s = new Set<string>();
    allCases.forEach(c => {
      const v = String(c.extra_attributes?.FILE_STATUS || c.status || '');
      if (v.trim()) s.add(v);
    });
    return Array.from(s).sort();
  }, [allCases]);

  const caseAgents = useMemo(() => {
    const s = new Set<string>();
    allCases.forEach(c => { if (c.agent_name?.trim()) s.add(c.agent_name); });
    return Array.from(s).sort();
  }, [allCases]);

  const caseCollectors = useMemo(() => {
    const s = new Set<string>();
    allCases.forEach(c => { if (c.collector_name?.trim()) s.add(c.collector_name); });
    return Array.from(s).sort();
  }, [allCases]);

  // Files that match the attachment filters
  const filteredFiles = useMemo(() => {
    return allCases.filter(c => {
      if (fBank !== 'all' && (c.bank_name || c.bank?.name || String(c.extra_attributes?.BANK_NAME || '')) !== fBank) return false;
      if (fType !== 'all' && String(c.extra_attributes?.FILE_TYPE || c.product?.name || c.product_name || '') !== fType) return false;
      if (fStatus !== 'all' && String(c.extra_attributes?.FILE_STATUS || c.status || '') !== fStatus) return false;
      if (fAgent !== 'all' && c.agent_name !== fAgent) return false;
      if (fCollector !== 'all' && (c.collector_name || '') !== fCollector) return false;
      return true;
    });
  }, [allCases, fBank, fType, fStatus, fAgent, fCollector]);

  // The attachment spec — buildFile lets the modal pick Excel or PDF at send time
  const attachmentSpec = useMemo(() => {
    if (!attachFiles || filteredFiles.length === 0) return null;
    const headers = EXPORT_AVAILABLE_COLUMNS.map(c => c.key);
    const rowsOf = () => filteredFiles.map(c => EXPORT_AVAILABLE_COLUMNS.map(col => {
      const v = col.getValue(c);
      return typeof v === 'number' ? v : String(v ?? '');
    }));
    const parts: string[] = [];
    if (fBank !== 'all') parts.push(fBank);
    if (fType !== 'all') parts.push(fType);
    if (fStatus !== 'all') parts.push(fStatus);
    if (fAgent !== 'all') parts.push(fAgent.replace(/\s+/g, '-'));
    if (fCollector !== 'all') parts.push(fCollector.replace(/\s+/g, '-'));
    const label = parts.length ? `_${parts.join('_').replace(/[^a-zA-Z0-9]+/g, '-')}` : '';
    const date = new Date().toISOString().slice(0, 10);
    return {
      fileName: `File_Update${label}_${date}.xlsx`,
      headers,
      rows: rowsOf(),
      label: `File Update — ${filteredFiles.length} files`,
      buildFile: (format: 'xlsx' | 'pdf') => ({
        fileName: `File_Update${label}_${date}.${format}`,
        headers,
        rows: rowsOf(),
      }),
    };
  }, [attachFiles, filteredFiles, fBank, fType, fStatus, fAgent, fCollector]);

  // ── Recipients: team ─────────────────────────────────────────────────
  const teamRecipients: BulkRecipient[] = useMemo(() => {
    return users
      .filter(u => u.status !== 'inactive' && u.id !== user?.id)
      .map(u => ({
        key: `u_${u.id}`,
        name: u.name,
        phone: u.phone,
        email: u.email,
        vars: { role: u.role.toUpperCase(), employee_id: u.employee_id || 'ID' },
      }));
  }, [users, user]);

  // ── AGENT SELECTION → auto-detect their banks (1-click filter chips) ──
  const selectedAgentNames = useMemo(() => {
    if (audience !== 'agents' || selectedKeys.size === 0) return [];
    return teamRecipients
      .filter(r => r.vars?.role === 'AGENT' && selectedKeys.has(String(r.key)))
      .map(r => r.name);
  }, [audience, selectedKeys, teamRecipients]);

  // Banks present in the selected agent('s) files, with live file counts
  const agentBankChips = useMemo(() => {
    if (audience !== 'agents') return [];
    const scope = fAgent !== 'all'
      ? allCases.filter(c => c.agent_name === fAgent)
      : selectedAgentNames.length > 0
        ? allCases.filter(c => c.agent_name && selectedAgentNames.includes(c.agent_name))
        : [];
    return banksIn(scope);
  }, [audience, fAgent, selectedAgentNames, allCases]);

  const banksIn = (scope: CaseFile[]) => {
    const countByKey = new Map<string, { name: string; count: number }>();
    scope.forEach(c => {
      const b = (c.bank_name || c.bank?.name || String(c.extra_attributes?.BANK_NAME || '')).trim() || 'Unknown Bank';
      const k = bankKeyOf(b);
      const name = sysBankByKey.get(k) || b;
      const e = countByKey.get(k);
      if (e) e.count += 1;
      else countByKey.set(k, { name, count: 1 });
    });
    return Array.from(countByKey.values()).sort((a, b) => b.count - a.count);
  };

  // ── Recipients: customers ────────────────────────────────────────
  const customerRecipients: BulkRecipient[] = useMemo(() => {
    const seen = new Set<string>();
    const list: BulkRecipient[] = [];
    for (const c of allCases) {
      const phone = (c.customer_phone || '').trim();
      const name = c.customer_name?.trim() || 'Customer';
      const dedupe = `${phone}|${name.toLowerCase()}`;
      if (!phone || seen.has(dedupe)) continue;
      seen.add(dedupe);
      if (searchQ) {
        const q = searchQ.toLowerCase();
        const hay = `${name} ${c.file_number} ${c.bank_name || ''} ${c.agent_name || ''}`.toLowerCase();
        if (!hay.includes(q)) continue;
      }
      list.push({
        key: `c_${c.id}`,
        name,
        phone,
        email: (c as any).customer_email || c.extra_attributes?.CUSTOMER_EMAIL || c.extra_attributes?.EMAIL || '',
        vars: {
          file_no: c.file_number,
          bank: c.bank_name || c.bank?.name || String(c.extra_attributes?.BANK_NAME || ''),
          file_type: String(c.extra_attributes?.FILE_TYPE || c.product_name || c.product?.name || ''),
          amount: (c.outstanding_amount || 0).toLocaleString(),
          agent: c.agent_name || '',
        },
      });
    }
    return list;
  }, [allCases, searchQ]);

  // ── Recipients: bank officers (with C.S. directory filters) ──────────
  const allOfficerContacts = useMemo(() => dataService.getContacts(user || undefined), [user]);

  const officerDepts = useMemo(
    () => Array.from(new Set(allOfficerContacts.map(c => (c.department || '').trim()).filter(Boolean))).sort(),
    [allOfficerContacts]
  );
  const officerBranches = useMemo(
    () => Array.from(new Set(allOfficerContacts.map(c => (c.branch || '').trim()).filter(Boolean))).sort(),
    [allOfficerContacts]
  );
  const officerBankNames = useMemo(() => {
    // Only banks that actually HAVE contacts, with live counts, normalized names
    const byKey = new Map<string, { name: string; count: number }>();
    allOfficerContacts.forEach(c => {
      const name = bankNameOf(c.bank_id, (c as any).bank_name);
      const k = bankKeyOf(name);
      const e = byKey.get(k);
      if (e) e.count += 1;
      else byKey.set(k, { name, count: 1 });
    });
    return Array.from(byKey.values()).sort((a, b) => a.name.localeCompare(b.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allOfficerContacts]);

  const officerRecipients: BulkRecipient[] = useMemo(() => {
    return allOfficerContacts
      .filter(c => {
        if (oBank !== 'all' && bankKeyOf(bankNameOf(c.bank_id, (c as any).bank_name)) !== bankKeyOf(oBank)) return false;
        if (oDept !== 'all' && (c.department || '').trim() !== oDept) return false;
        if (oBranch !== 'all' && (c.branch || '').trim() !== oBranch) return false;
        if (searchQ) {
          const q = searchQ.toLowerCase();
          const hay = `${c.name} ${bankNameOf(c.bank_id, (c as any).bank_name)} ${c.branch || ''} ${c.designation || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .map(c => ({
        key: `b_${c.id}`,
        name: c.name,
        phone: c.phone,
        email: c.email,
        vars: {
          bank: bankNameOf(c.bank_id, (c as any).bank_name),
          branch: c.branch || 'Head Office',
          designation: c.designation || '',
        },
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allOfficerContacts, oBank, oDept, oBranch, searchQ]);

  // ── BANK OFFICER SELECTION → auto-detect the officer('s) banks ────────
  const selectedOfficerRecipients = useMemo(() => {
    if (audience !== 'bank_officers' || selectedKeys.size === 0) return [];
    return officerRecipients.filter(r => selectedKeys.has(String(r.key)));
  }, [audience, selectedKeys, officerRecipients]);

  // Banks tied to the selected officer(s): files from the officer('s) bank(s)
  // across the whole portfolio — chips show live file counts.
  const officerBankChips = useMemo(() => {
    if (audience !== 'bank_officers' || selectedOfficerRecipients.length === 0) return [];
    const names = selectedOfficerRecipients.map(r => String(r.vars?.bank || r.name));
    const scope = allCases.filter(c => {
      const cb = bankKeyOf(c.bank_name || c.bank?.name || String(c.extra_attributes?.BANK_NAME || ''));
      return names.some(n => n.trim() && cb === bankKeyOf(n));
    });
    return banksIn(scope);
  }, [audience, selectedOfficerRecipients, allCases]);

  const recipients: BulkRecipient[] =
    audience === 'agents' ? teamRecipients.filter(r => r.vars?.role === 'AGENT')
    : audience === 'cs' ? teamRecipients.filter(r => r.vars?.role === 'CS')
    : audience === 'managers' ? teamRecipients.filter(r => r.vars?.role === 'MANAGER')
    : audience === 'customers' ? customerRecipients
    : audience === 'bank_officers' ? officerRecipients
    : [];

  // Apply checkbox selection (empty selection = send to everyone listed)
  const finalRecipients = selectedKeys.size > 0
    ? recipients.filter(r => selectedKeys.has(String(r.key)))
    : recipients;

  const withPhone = finalRecipients.filter(r => !!r.phone?.trim()).length;
  const withEmail = finalRecipients.filter(r => !!r.email?.trim()).length;
  const activeAudience = AUDIENCES.find(a => a.key === audience);

  const toggleKey = (k: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      // Agent audience: selecting ONE agent auto-focuses the file filters on
      // that agent and reveals which banks their files are in (chips below).
      if (audience === 'agents') {
        const name = teamRecipients.find(r => String(r.key) === k)?.name;
        const justChecked = !prev.has(k);
        if (justChecked && name && next.size === 1) {
          setTimeout(() => setFAgent(name), 0);
        } else if (next.size !== 1) {
          setTimeout(() => setFAgent('all'), 0);
        }
      }
      // Bank officers: selecting ONE officer auto-focuses the bank filter on
      // that officer('s) bank so the attachment matches who you're sending to.
      if (audience === 'bank_officers') {
        const r = officerRecipients.find(x => String(x.key) === k);
        const justChecked = !prev.has(k);
        const bank = r ? String(r.vars?.bank || '') : '';
        if (justChecked && bank && next.size === 1) {
          setTimeout(() => setFBank(bank), 0);
        } else if (next.size !== 1) {
          setTimeout(() => setFBank('all'), 0);
        }
      }
      return next;
    });
  };

  const resetFor = (a: AudienceKey) => {
    setAudience(a);
    setSearchQ('');
    setSelectedKeys(new Set());
    setFBank('all'); setFType('all'); setFStatus('all'); setFAgent('all'); setFCollector('all');
    setOBank('all'); setODept('all'); setOBranch('all');
  };

  const selectInputCls = "px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <MessageCircle className="w-6 h-6 text-emerald-500" />
          {t('bulk.title', 'Bulk Messages')}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {t('bulk.subtitle', 'Send one WhatsApp message or email to your agents, C.S., managers, customers, or bank contacts — with an optional Excel file-update attachment')}
        </p>
      </div>

      {/* Audience picker */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {AUDIENCES.map(a => {
          const count =
            a.key === 'agents' ? teamRecipients.filter(r => r.vars?.role === 'AGENT').length :
            a.key === 'cs' ? teamRecipients.filter(r => r.vars?.role === 'CS').length :
            a.key === 'managers' ? teamRecipients.filter(r => r.vars?.role === 'MANAGER').length :
            a.key === 'customers' ? customerRecipients.length :
            officerRecipients.length;
          const Icon = a.icon;
          const isActive = audience === a.key;
          return (
            <button
              key={a.key}
              onClick={() => resetFor(a.key)}
              className={`p-4 rounded-2xl border text-left transition-all shadow-sm ${
                isActive
                  ? 'border-emerald-500 bg-emerald-500/5 ring-2 ring-emerald-500/30'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${a.tint}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-black text-slate-600 dark:text-slate-300">
                  {count}
                </span>
              </div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mt-2.5">{a.label}</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{a.desc}</p>
            </button>
          );
        })}
      </div>

      {audience && (
        <div className="space-y-4">
          {/* ── FILE UPDATE ATTACHMENT FILTERS (agents & bank officers) ── */}
          {attachFiles && (
            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    File Update to Attach
                  </h3>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    attachmentSpec
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                  }`}>
                    {attachmentSpec ? `${filteredFiles.length} files will be attached` : 'No files match'}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                  <Filter className="w-3 h-3" /> Filter which files go in the Excel
                </span>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <select value={fBank} onChange={e => setFBank(e.target.value)} className={selectInputCls}>
                  <option value="all">All Banks</option>
                  {caseBanks.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                <select value={fType} onChange={e => setFType(e.target.value)} className={selectInputCls}>
                  <option value="all">All File Types</option>
                  {caseTypes.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
                <select value={fStatus} onChange={e => setFStatus(e.target.value)} className={selectInputCls}>
                  <option value="all">All File Status</option>
                  {caseStatuses.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
                <select value={fAgent} onChange={e => setFAgent(e.target.value)} className={selectInputCls}>
                  <option value="all">All Agents (in file)</option>
                  {caseAgents.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
                <select value={fCollector} onChange={e => setFCollector(e.target.value)} className={selectInputCls}>
                  <option value="all">All Assigned Officers</option>
                  {caseCollectors.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              {/* AGENTS + BANK OFFICERS: banks detected from the selection — 1-click filter */}
              {(audience === 'agents' ? agentBankChips.length > 0 : officerBankChips.length > 0) && (
                <div className="pt-1 space-y-1.5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <UserCheck className="w-3 h-3 text-emerald-500" />
                    {audience === 'agents'
                      ? selectedAgentNames.length === 1
                        ? `${selectedAgentNames[0]}'s files by bank — tap to include`
                        : selectedAgentNames.length > 1
                          ? `${selectedAgentNames.length} selected agents' files by bank`
                          : 'Select an agent below to see their banks instantly'
                      : selectedOfficerRecipients.length === 1
                        ? `${selectedOfficerRecipients[0].name} (${selectedOfficerRecipients[0].vars?.bank}) — tap to include their bank files`
                        : `${selectedOfficerRecipients.length} selected officers' banks`}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(audience === 'agents' ? agentBankChips : officerBankChips).map(chip => {
                      const active = fBank !== 'all' && bankKeyOf(fBank) === bankKeyOf(chip.name);
                      return (
                        <button
                          key={chip.name}
                          onClick={() => setFBank(active ? 'all' : chip.name)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${
                            active
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                              : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-emerald-400 hover:text-emerald-600'
                          }`}
                          title={`${chip.count} file(s) — click to filter the attachment to just this bank`}
                        >
                          {chip.name} · {chip.count}
                        </button>
                      );
                    })}
                    {fBank !== 'all' && (
                      <button
                        onClick={() => setFBank('all')}
                        className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20 hover:bg-rose-500/20"
                      >
                        Clear bank filter ✕
                      </button>
                    )}
                  </div>
                </div>
              )}

              <p className="text-[10px] text-slate-400">
                The attached report includes the same columns as the File Update Export (file no, bank, status, amounts, visits, PTP, remarks…). Leave everything on "All" to attach the full portfolio.
              </p>
            </div>
          )}

          {/* ── BANK OFFICER DIRECTORY FILTERS (who receives it) ──────── */}
          {audience === 'bank_officers' && (
            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <PhoneCall className="w-4 h-4 text-purple-500" />
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                  Select Bank Officers / C.S. to Send To
                </h3>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <select value={oBank} onChange={e => setOBank(e.target.value)} className={selectInputCls}>
                  <option value="all">All Banks (directory)</option>
                  {officerBankNames.map(b => (
                    <option key={b.name} value={b.name}>{b.name} ({b.count})</option>
                  ))}
                </select>
                <select value={oDept} onChange={e => setODept(e.target.value)} className={selectInputCls}>
                  <option value="all">All Departments</option>
                  {officerDepts.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <select value={oBranch} onChange={e => setOBranch(e.target.value)} className={selectInputCls}>
                  <option value="all">All Branches</option>
                  {officerBranches.map(br => <option key={br} value={br}>{br}</option>)}
                </select>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search officer…"
                    value={searchQ}
                    onChange={e => setSearchQ(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── TEAM AUDIENCE: search + filter agents ─────────────────── */}
          {(audience === 'agents' || audience === 'cs' || audience === 'managers') && (
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder={`Filter ${activeAudience?.label.toLowerCase()} by name, email or employee ID…`}
                  value={searchQ}
                  onChange={e => setSearchQ(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400"
                />
              </div>
            </div>
          )}

          {/* ── Recipient list with selection ──────────────────────────── */}
          <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${activeAudience?.tint}`}>
                  {activeAudience && <activeAudience.icon className="w-4 h-4" />}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                    {activeAudience?.label} — {finalRecipients.length} selected of {recipients.length}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {withPhone} with phone (WhatsApp) • {withEmail} with email
                    {selectedKeys.size === 0 && recipients.length > 0 && ' • nothing checked = everyone listed'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {recipients.length > 0 && (
                  <button
                    onClick={() => setSelectedKeys(
                      selectedKeys.size >= recipients.length
                        ? new Set()
                        : new Set(recipients.map(r => String(r.key)))
                    )}
                    className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    {selectedKeys.size >= recipients.length ? 'Uncheck all' : 'Check all'}
                  </button>
                )}
                <button
                  onClick={() => setShowModal(true)}
                  disabled={finalRecipients.length === 0 || !can('send_bulk_messages')}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-emerald-600/30 transition-all"
                >
                  <MessageCircle className="w-4 h-4" />
                  Compose & Send{attachmentSpec ? ' + Update' : ''}
                </button>
              </div>
            </div>

            {/* Chips with checkbox selection */}
            <div className="flex flex-wrap gap-1.5 max-h-52 overflow-y-auto custom-scrollbar">
              {recipients.slice(0, 300).map(r => {
                const k = String(r.key);
                const checked = selectedKeys.has(k);
                const reachable = !!(r.phone?.trim() || r.email?.trim());
                return (
                  <button
                    key={k}
                    onClick={() => toggleKey(k)}
                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                      checked
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : reachable
                          ? 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-emerald-400'
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                    }`}
                    title={r.phone || r.email || 'No phone or email — will be skipped'}
                  >
                    {checked ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3 opacity-50" />}
                    {r.name}
                    {!reachable && ' ⚠'}
                  </button>
                );
              })}
              {recipients.length > 300 && (
                <span className="px-2 py-1 text-[10px] font-bold text-slate-400">
                  + {recipients.length - 300} more…
                </span>
              )}
              {recipients.length === 0 && (
                <span className="text-[11px] font-bold text-slate-400 py-2">
                  No recipients match the current filters.
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {!audience && (
        <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col items-center gap-3 text-slate-400">
          <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <MessageCircle className="w-8 h-8 text-slate-300 dark:text-slate-600" />
          </div>
          <p className="font-semibold text-slate-500 dark:text-slate-400 text-sm text-center">
            Pick an audience above, filter & select who receives it, attach a file update if needed, then compose your message.
          </p>
        </div>
      )}

      {showModal && (
        <BulkMessageModal
          isOpen={showModal}
          onClose={() => { setShowModal(false); setSelectedKeys(new Set()); }}
          kind={audience === 'bank_officers' ? 'officer' : 'customer'}
          recipients={finalRecipients}
          attachment={attachmentSpec}
        />
      )}
    </div>
  );
};
