import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { dataService, getAllSystemBanks } from '../services/dataService';
import { mapRowToContactData } from '../services/rowMapping';
import { downloadContactsTemplate, exportTableToExcel, exportTableToPdf, CONTACTS_TEMPLATE_HEADERS, contactToExportValues } from '../services/exportService';
import { Download, FileSpreadsheet as FsIcon, FileText as FtIcon, MessageCircle } from 'lucide-react';
import { BankContact, Bank } from '../types';
import { usePermissions } from '../context/PermissionsContext';
import { BulkMessageModal } from '../components/BulkMessageModal';
import { normalizeBdPhone } from '../services/messaging';
import * as XLSX from 'xlsx';
import { 
  PhoneCall, 
  Mail, 
  Building2, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  UserCheck,
  UploadCloud,
  RefreshCw,
  AlertTriangle,
  FileSpreadsheet
} from 'lucide-react';

export const BankContactsPage: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { can } = usePermissions();
  const banks = dataService.getBanks();
  const [contacts, setContacts] = useState<BankContact[]>(() => dataService.getContacts(user || undefined));
  const [bankFilter, setBankFilter] = useState<string>('all');
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [searchQ, setSearchQ] = useState('');
  const [showBulkMsg, setShowBulkMsg] = useState(false);

  // Missing collectors / C.S from uploaded files (scoped to agent files if agent)
  const missingCollectors = dataService.getMissingCollectorContacts(user || undefined);

  // Add/Edit Modal
  const [showModal, setShowModal] = useState(false);
  const [editingContact, setEditingContact] = useState<BankContact | null>(null);
  const [formBankId, setFormBankId] = useState(1);
  const [formName, setFormName] = useState('');
  const [formDesignation, setFormDesignation] = useState('');
  const [formDept, setFormDept] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formBranch, setFormBranch] = useState('');

  const reload = () => {
    setContacts(dataService.getContacts(user || undefined));
  };

  // ── Excel upload (admin): replaces the whole contact directory ──────
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const isAdmin = user?.role === 'admin';
  const canExport = user?.role === 'admin' || user?.role === 'manager';
  const [uploadingContacts, setUploadingContacts] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleContactsExcel = async (file: File) => {
    setUploadMsg(null);
    setUploadError(null);
    setUploadingContacts(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      const sheetName =
        wb.SheetNames.find(n => /contact|bank/i.test(n)) || wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const rawRows: Record<string, any>[] = ws
        ? XLSX.utils.sheet_to_json(ws, { defval: '' })
        : [];
      const mapped = rawRows
        .map(mapRowToContactData)
        .filter(Boolean) as Record<string, any>[];

      if (mapped.length === 0) {
        setUploadError(
          'No usable rows found. Row 1 must be headers (e.g. BANK_NAME, NAME/OFFICER_NAME/CS_NAME, PHONE/CS_NUMBER…).'
        );
        return;
      }

      // Purge existing contacts, then import the uploaded list
      await dataService.purgeAllContactsFromCloud();
      await dataService.replaceAllContactsFromSheet(mapped);
      setUploadMsg(
        `✓ Imported ${mapped.length.toLocaleString()} contacts from ${file.name}. Directory replaced on all devices.`
      );
      reload();
    } catch (e: any) {
      setUploadError(e?.message || 'Could not read the file.');
    } finally {
      setUploadingContacts(false);
      if (uploadInputRef.current) uploadInputRef.current.value = '';
    }
  };

  useEffect(() => {
    reload();
    const unsub = dataService.subscribe(reload);
    return () => unsub();
  }, [user]);

  const openAddModal = () => {
    setEditingContact(null);
    setFormBankId(1);
    setFormName('');
    setFormDesignation('');
    setFormDept('');
    setFormPhone('');
    setFormEmail('');
    setFormBranch('');
    setShowModal(true);
  };

  const openQuickAddMissing = (missing: { collectorName: string; bankId: number; bankName: string }) => {
    setEditingContact(null);
    setFormBankId(missing.bankId || 1);
    setFormName(missing.collectorName);
    setFormDesignation('Bank Recovery Officer / Collector');
    setFormDept('Special Asset Management');
    setFormPhone('');
    setFormEmail('');
    setFormBranch('Principal Branch');
    setShowModal(true);
  };

  const openEditModal = (c: BankContact) => {
    setEditingContact(c);
    setFormBankId(c.bank_id);
    setFormName(c.name);
    setFormDesignation(c.designation);
    setFormDept(c.department);
    setFormPhone(c.phone);
    setFormEmail(c.email);
    setFormBranch(c.branch);
    setShowModal(true);
  };

  const handleDelete = (id: number) => {
    if (window.confirm('Delete this bank contact?')) {
      dataService.deleteContact(id);
      reload();
    }
  };

  const handleSaveContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingContact) {
      dataService.updateContact(editingContact.id, {
        bank_id: formBankId,
        name: formName,
        designation: formDesignation,
        department: formDept,
        phone: formPhone,
        email: formEmail,
        branch: formBranch,
      });
    } else {
      dataService.addContact({
        bank_id: formBankId,
        name: formName,
        designation: formDesignation,
        department: formDept,
        phone: formPhone,
        email: formEmail,
        branch: formBranch,
      });
    }
    setShowModal(false);
    reload();
  };

  // Punctuation-insensitive bank-name key: "Dutch-Bangla Bank" and
  // "Dutch Bangla Bank" collapse to one bank instead of two half-empty ids.
  const bankKeyOf = (s: string) =>
    String(s || '').toLowerCase().replace(/[^a-z0-9\u0980-\u09FF]+/g, '');

  // Banks that actually HAVE contacts — only these appear in the filter
  // dropdown, each with a live contact count.
  const contactBanks = useMemo(() => {
    const sysBankByKey = new Map<string, Bank>();
    getAllSystemBanks().forEach(b => sysBankByKey.set(bankKeyOf(b.name), b));
    const byKey = new Map<string, { id: number; name: string; count: number }>();
    contacts.forEach(c => {
      const raw = (c as any).bank_name?.trim();
      const sys = raw ? sysBankByKey.get(bankKeyOf(raw)) : sysBankByKey.get(bankKeyOf(String(c.bank_id))) || getAllSystemBanks().find(b => b.id === c.bank_id);
      const name = sys?.name || raw || `Bank #${c.bank_id}`;
      const k = bankKeyOf(name);
      const entry = byKey.get(k);
      if (entry) {
        entry.count += 1;
      } else {
        byKey.set(k, { id: sys?.id ?? c.bank_id, name, count: 1 });
      }
    });
    return Array.from(byKey.values()).sort((a, b) => a.name.localeCompare(b.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contacts]);

  const bankNameOf = (c: BankContact): string => {
    const raw = (c as any).bank_name?.trim();
    if (raw) {
      const sys = getAllSystemBanks().find(b => bankKeyOf(b.name) === bankKeyOf(raw));
      return sys?.name || raw;
    }
    const sys = getAllSystemBanks().find(b => b.id === c.bank_id);
    return sys?.name || contactBanks.find(b => b.id === c.bank_id)?.name || `Bank #${c.bank_id}`;
  };

  // Distinct departments/branches present in the loaded contacts (for dropdowns)
  const departments = useMemo(
    () => Array.from(new Set(contacts.map(c => (c.department || '').trim()).filter(Boolean))).sort(),
    [contacts]
  );
  const branches = useMemo(
    () => Array.from(new Set(contacts.map(c => (c.branch || '').trim()).filter(Boolean))).sort(),
    [contacts]
  );

  const filtered = useMemo(() => contacts.filter(c => {
    // Bank filter matches by normalized bank NAME first (robust across devices
    // and legacy hashed ids), with id match as a fallback.
    if (bankFilter !== 'all') {
      const sel = contactBanks.find(b => String(b.id) === bankFilter);
      const selKey = sel ? bankKeyOf(sel.name) : '';
      const cName = bankNameOf(c);
      if (!(selKey && bankKeyOf(cName) === selKey) && String(c.bank_id) !== bankFilter) return false;
    }
    if (deptFilter !== 'all' && (c.department || '').trim() !== deptFilter) return false;
    if (branchFilter !== 'all' && (c.branch || '').trim() !== branchFilter) return false;
    if (searchQ) {
      const q = searchQ.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        bankNameOf(c).toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.branch.toLowerCase().includes(q) ||
        c.designation.toLowerCase().includes(q) ||
        c.department.toLowerCase().includes(q)
      );
    }
    return true;
  }), [contacts, bankFilter, deptFilter, branchFilter, searchQ, contactBanks]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {t('contacts.title', 'Partner Bank & Institutional Directory')}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t('contacts.subtitle', 'Direct phone numbers and email contacts for bank liaisons and credit managers')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Bulk WhatsApp / Email to filtered officers */}
          {can("send_bulk_messages") && filtered.length > 0 && (
            <button
              onClick={() => setShowBulkMsg(true)}
              className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/30 transition-all"
              title={`Send one WhatsApp message or email to all ${filtered.length} filtered contacts`}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              Message ({filtered.length})
            </button>
          )}
          {/* Export (Admin & Manager only) */}
          {canExport && filtered.length > 0 && (
            <>
              <button
                onClick={() =>
                  exportTableToExcel(
                    `Bank_Contacts_${new Date().toISOString().slice(0, 10)}.xlsx`,
                    'Bank_Contacts',
                    CONTACTS_TEMPLATE_HEADERS,
                    filtered.map(c => contactToExportValues(c, bankNameOf(c)))
                  )
                }
                className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 transition-all"
              >
                <FsIcon className="w-3.5 h-3.5 text-emerald-600" /> Excel
              </button>
              <button
                onClick={() =>
                  exportTableToPdf(
                    `Bank_Contacts_${new Date().toISOString().slice(0, 10)}.pdf`,
                    'Bank Contacts Directory',
                    CONTACTS_TEMPLATE_HEADERS,
                    filtered.map(c => contactToExportValues(c, bankNameOf(c)))
                  )
                }
                className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 transition-all"
              >
                <FtIcon className="w-3.5 h-3.5 text-rose-500" /> PDF
              </button>
            </>
          )}
          {isAdmin && (
            <>
              <button
                onClick={downloadContactsTemplate}
                className="px-3 py-2 rounded-xl border-2 border-zinc-900 dark:border-white text-zinc-900 dark:text-white text-xs font-bold flex items-center gap-1.5 hover:bg-zinc-900 hover:text-white dark:hover:bg-white dark:hover:text-black transition-all"
              >
                <Download className="w-3.5 h-3.5" /> Format
              </button>
              <input
                ref={uploadInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleContactsExcel(f);
                }}
              />
              <button
                onClick={() => uploadInputRef.current?.click()}
                disabled={uploadingContacts}
                className="px-3.5 py-2 rounded-xl border-2 border-zinc-900 dark:border-white text-zinc-900 dark:text-white hover:bg-zinc-900 hover:text-white dark:hover:bg-white dark:hover:text-black font-bold text-xs flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {uploadingContacts ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> Importing…</>
                ) : (
                  <><UploadCloud className="w-4 h-4" /> Upload Excel</>
                )}
              </button>
            </>
          )}
          <button
            onClick={openAddModal}
            className="px-3.5 py-2 rounded-xl bg-black dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-black font-bold text-xs shadow-md flex items-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>{t('contacts.add_new', 'Add Bank Officer')}</span>
          </button>
        </div>
      </div>

      {/* Upload status banners */}
      {uploadMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">{uploadMsg}</p>
        </div>
      )}
      {uploadError && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs font-bold text-rose-700 dark:text-rose-400">{uploadError}</p>
        </div>
      )}
      {isAdmin && (
        <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-start gap-2.5">
          <FileSpreadsheet className="w-4 h-4 text-zinc-400 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            <b>Upload Excel</b> replaces the whole directory with your file's rows. Row 1 = headers; use the official format: BANK_NAME, OFFICER_NAME, DESIGNATION, DEPARTMENT, PHONE, EMAIL, BRANCH, NOTES (download via the <b>Format</b> button). Existing contacts are removed first.
          </p>
        </div>
      )}

      {/* MISSING COLLECTORS / C.S NUMBERS DETECTED IN RECOVERY FILES BANNER */}
      {missingCollectors.length > 0 && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-500/10 via-pink-500/10 to-rose-500/10 border border-rose-500/30 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
              <span className="text-xs font-extrabold text-rose-900 dark:text-rose-200">
                {missingCollectors.length} Bank Collector / C.S Contact Numbers Missing in Directory
              </span>
            </div>
            <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">
              Click "+ Add Info" to register their phone & email
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {missingCollectors.map(m => (
              <div 
                key={`${m.collectorName}_${m.bankId}`}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-900/60 shadow-xs text-xs"
              >
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{m.collectorName}</span>
                  <span className="text-[10px] text-slate-400 ml-1.5">({m.bankName} • {m.caseCount} files)</span>
                </div>
                <button
                  onClick={() => openQuickAddMissing(m)}
                  className="px-2 py-0.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] transition-all"
                >
                  + Add Info
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={t('contacts.search', 'Search officer name, phone, department, branch...')}
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400"
            />
          </div>

          <div>
            <select
              value={bankFilter}
              onChange={(e) => setBankFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100"
            >
              <option value="all">{t('cases.all_banks', 'All Partner Banks')}</option>
              {contactBanks.map(b => (
                <option key={b.name} value={String(b.id)}>{b.name} ({b.count})</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100"
            >
              <option value="all">All Departments</option>
              {departments.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100"
            >
              <option value="all">All Branches</option>
              {branches.map(br => (
                <option key={br} value={br}>{br}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Active filters summary + clear */}
        {(bankFilter !== 'all' || deptFilter !== 'all' || branchFilter !== 'all' || searchQ) && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              {filtered.length} of {contacts.length} contacts
            </span>
            {bankFilter !== 'all' && (
              <button onClick={() => setBankFilter('all')} className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold hover:bg-blue-500/20 transition-all">
                Bank: {contactBanks.find(b => String(b.id) === bankFilter)?.name || bankFilter} ✕
              </button>
            )}
            {deptFilter !== 'all' && (
              <button onClick={() => setDeptFilter('all')} className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-bold hover:bg-purple-500/20 transition-all">
                Dept: {deptFilter} ✕
              </button>
            )}
            {branchFilter !== 'all' && (
              <button onClick={() => setBranchFilter('all')} className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold hover:bg-amber-500/20 transition-all">
                Branch: {branchFilter} ✕
              </button>
            )}
            {searchQ && (
              <button onClick={() => setSearchQ('')} className="px-2 py-0.5 rounded-full bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 text-[10px] font-bold hover:bg-zinc-500/20 transition-all">
                Search: "{searchQ}" ✕
              </button>
            )}
            <button
              onClick={() => { setBankFilter('all'); setDeptFilter('all'); setBranchFilter('all'); setSearchQ(''); }}
              className="ml-auto text-[10px] font-bold text-slate-400 hover:text-rose-500 transition-all"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Contacts Cards Grid */}
      {contacts.length > 0 && filtered.length === 0 && (
        <p className="text-[11px] font-bold text-slate-400 text-center">
          No contacts match the current filters — try clearing them below the search bar.
        </p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 && (
          <div className="col-span-full py-16 flex flex-col items-center gap-3 text-slate-400">
            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <UserCheck className="w-8 h-8 text-slate-300 dark:text-slate-600" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-slate-500 dark:text-slate-400 text-sm">{t('contacts.no_records', 'No bank contacts found')}</p>
              <p className="text-xs text-slate-400 mt-1">{t('contacts.no_records_hint', 'Add a new contact using the button above')}</p>
            </div>
          </div>
        )}
        {filtered.map(contact => (
          <div
            key={contact.id}
            className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4"
          >
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <span className="inline-block max-w-full px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 uppercase break-words leading-snug">
                    {bankNameOf(contact)}
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1.5 break-words">{contact.name}</h3>
                  <p className="text-xs text-slate-500 font-medium break-words">{contact.designation}{contact.department ? ` • ${contact.department}` : ''}</p>
                  {contact.branch && <p className="text-[11px] text-slate-400 mt-0.5 break-words">{contact.branch}</p>}

                  {/* Direct Contact Numbers & Email */}
                  <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
                    {contact.phone ? (
                      <div className="flex items-center gap-1.5">
                        <PhoneCall className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                        <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400 tracking-wide select-all">{contact.phone}</span>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400 italic">No phone number</div>
                    )}
                    {contact.email && (
                      <div className="flex items-center gap-1.5 truncate">
                        <Mail className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                        <span className="text-[11px] text-slate-600 dark:text-slate-300 truncate select-all">{contact.email}</span>
                      </div>
                    )}
                  </div>
                </div>

                {user?.role === 'admin' && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(contact)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(contact.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
              <a
                href={`tel:${contact.phone}`}
                className="py-2 px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-900 dark:hover:bg-white hover:text-white dark:hover:text-black text-zinc-700 dark:text-zinc-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>Call</span>
              </a>

              <a
                href={`mailto:${contact.email}`}
                className="py-2 px-3 rounded-xl bg-blue-500/10 hover:bg-blue-500 hover:text-white text-blue-600 dark:text-blue-400 font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Email</span>
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL: Bulk WhatsApp / Email */}
      {showBulkMsg && (
        <BulkMessageModal
          isOpen={showBulkMsg}
          onClose={() => setShowBulkMsg(false)}
          kind="officer"
          recipients={filtered.map(c => ({
            key: c.id,
            name: c.name,
            phone: c.phone,
            email: c.email,
            vars: {
              bank: bankNameOf(c),
              branch: c.branch || 'Head Office',
              designation: c.designation || '',
            },
          }))}
        />
      )}

      {/* MODAL: Add / Edit Contact */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-500" />
                <span>{editingContact ? 'Edit Bank Officer' : 'Add Bank Officer'}</span>
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSaveContact} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Partner Bank</label>
                <select
                  value={formBankId}
                  onChange={(e) => setFormBankId(Number(e.target.value))}
                  className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
                >
                  {banks.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Officer Full Name</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Mr. Tanzim Ahmed"
                  className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Designation</label>
                  <input
                    type="text"
                    required
                    value={formDesignation}
                    onChange={(e) => setFormDesignation(e.target.value)}
                    placeholder="e.g. Recovery Manager"
                    className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Department</label>
                  <input
                    type="text"
                    required
                    value={formDept}
                    onChange={(e) => setFormDept(e.target.value)}
                    placeholder="e.g. Cards Recovery"
                    className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Phone Number</label>
                  <input
                    type="text"
                    required
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="01711-XXXXXX"
                    className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="officer@bank.com"
                    className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Branch / Location</label>
                <input
                  type="text"
                  required
                  value={formBranch}
                  onChange={(e) => setFormBranch(e.target.value)}
                  placeholder="e.g. Head Office, Motijheel, Chittagong"
                  className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-black dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-black font-bold"
                >
                  Save Officer Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};