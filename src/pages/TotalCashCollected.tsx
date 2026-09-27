import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { dataService } from '../services/dataService';
import { exportTableToExcel, exportTableToPdf } from '../services/exportService';
import { AccessibleModal } from '../components/AccessibleModal';
import { Collection, CaseFile } from '../types';
import { 
  DollarSign, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Trash2, 
  Search, 
  Camera, 
  ChevronRight,
  FileDown,
  FileSpreadsheet
} from 'lucide-react';

interface TotalCashCollectedProps {
  onSelectCase?: (caseId: number) => void;
}

export const TotalCashCollected: React.FC<TotalCashCollectedProps> = ({ onSelectCase }) => {
  const { user } = useAuth();
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  // Rejection modal state
  const [rejectingCol, setRejectingCol] = useState<Collection | null>(null);
  const [rejectionReason, setRejectionReason] = useState('Amount does not match receipt');

  const [refreshKey, setRefreshKey] = useState(0);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const selectAllRef = useRef<HTMLInputElement>(null);
  const bulkDeleteRef = useRef<HTMLButtonElement>(null);

  // Screen-reader announcement region.
  useEffect(() => {
    if (!announcement) return;
    const t = setTimeout(() => setAnnouncement(''), 5000);
    return () => clearTimeout(t);
  }, [announcement]);

  // Set indeterminate state on the select-all checkbox.
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selectedIds.size > 0 && !allVisibleSelected;
    }
  });

  // Move focus to the bulk-delete button when it appears.
  useEffect(() => {
    if (selectedIds.size > 0 && !deleting) bulkDeleteRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds.size === 0]);

  // Announce selection count changes.
  useEffect(() => {
    if (selectedIds.size > 0) {
      setAnnouncement(`${selectedIds.size} record${selectedIds.size === 1 ? '' : 's'} selected`);
    }
  }, [selectedIds.size]);

  const collections = useMemo(() => {
    const all = dataService.getAllCollections();
    if (user?.role === 'agent') {
      return all.filter(c => c.agent_id === user.id);
    }
    return all;
  }, [user, refreshKey]);

  const allCases = useMemo(() => {
    return dataService.getCases(user!);
  }, [user, refreshKey]);

  const caseMap = useMemo(() => {
    // Keys are stringified so lookups never miss on string vs number ids
    // (e.g. ids arriving from Supabase as strings or from Date.now()).
    const map = new Map<string, CaseFile>();
    // For admin, load all cases so every collection file matches
    const casesToMap = user?.role === 'admin' ? dataService.getCases({ role: 'admin' } as any) : allCases;
    casesToMap.forEach(c => map.set(String(c.id), c));
    return map;
  }, [allCases, user]);

  // Shared lookup: map first, then the collection's embedded case_file, then
  // a direct dataService fetch (covers cases not in the permission-filtered list).
  const resolveCase = (c: Collection): CaseFile | undefined =>
    caseMap.get(String(c.case_file_id))
    || (c.case_file as CaseFile | undefined)
    || dataService.getCaseById(c.case_file_id);

  // Calculations
  const stats = useMemo(() => {
    let totalCollected = 0;
    let approvedAmount = 0;
    let pendingAmount = 0;
    let rejectedAmount = 0;
    let pendingCount = 0;
    let approvedCount = 0;
    let rejectedCount = 0;

    collections.forEach(c => {
      totalCollected += Number(c.amount) || 0;
      const st = c.status || 'pending';
      if (st === 'approved') {
        approvedAmount += Number(c.amount) || 0;
        approvedCount++;
      } else if (st === 'rejected') {
        rejectedAmount += Number(c.amount) || 0;
        rejectedCount++;
      } else {
        pendingAmount += Number(c.amount) || 0;
        pendingCount++;
      }
    });

    return {
      totalCollected,
      approvedAmount,
      pendingAmount,
      rejectedAmount,
      pendingCount,
      approvedCount,
      rejectedCount,
      totalCount: collections.length
    };
  }, [collections]);

  const filtered = useMemo(() => {
    return collections.filter(c => {
      const st = c.status || 'pending';
      if (filterStatus !== 'all' && st !== filterStatus) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const cItem = resolveCase(c);
        const matchFile = cItem?.file_number.toLowerCase().includes(q);
        const matchCust = cItem?.customer_name.toLowerCase().includes(q);
        const matchRec = c.receipt_number?.toLowerCase().includes(q);
        const matchAgent = c.agent?.name?.toLowerCase().includes(q) || cItem?.agent_name?.toLowerCase().includes(q);
        if (!matchFile && !matchCust && !matchRec && !matchAgent) return false;
      }

      return true;
    });
  }, [collections, filterStatus, searchTerm, caseMap]);

  const handleApprove = (id: number) => {
    dataService.verifyCollection(id, 'approved', undefined, user?.name || 'Admin');
    setAnnouncement('Payment approved.');
    setRefreshKey(k => k + 1);
  };

  const handleOpenRejectModal = (col: Collection) => {
    setRejectingCol(col);
    setRejectionReason('Amount does not match deposit');
  };

  const handleConfirmReject = () => {
    if (!rejectingCol) return;
    dataService.verifyCollection(rejectingCol.id, 'rejected', rejectionReason, user?.name || 'Admin');
    setRejectingCol(null);
    setAnnouncement('Payment rejected. The assigned agent will see the reason.');
    setRefreshKey(k => k + 1);
  };

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this payment record? It will be permanently removed.')) {
      dataService.deleteCollection(id);
      setRefreshKey(k => k + 1);
    }
  };

  // ── Bulk selection ──
  const allVisibleSelected = filtered.length > 0 && filtered.every(c => selectedIds.has(c.id));

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        filtered.forEach(c => next.delete(c.id));
      } else {
        filtered.forEach(c => next.add(c.id));
      }
      return next;
    });
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Permanently delete ${selectedIds.size} selected payment record(s)? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      selectedIds.forEach(id => dataService.deleteCollection(id));
      setSelectedIds(new Set());
      setAnnouncement(`${selectedIds.size} payment record(s) permanently deleted.`);
      setRefreshKey(k => k + 1);
    } finally {
      setDeleting(false);
    }
  };

  // ── Export: rows matching the visible table, respecting current search + status filter ──
  const buildExportRows = (): (string | number)[][] =>
    filtered.map(c => {
      const cItem = resolveCase(c);
      const rawSt = c.status || 'pending';
      const st = rawSt.charAt(0).toUpperCase() + rawSt.slice(1);
      return [
        cItem?.file_number || `Case #${c.case_file_id}`,
        cItem?.customer_name || 'Unknown',
        cItem?.bank?.name || cItem?.bank_name || '',
        Number(c.amount) || 0,
        (c.payment_method || '').replace('_', ' '),
        c.receipt_number ? `#${c.receipt_number}` : '',
        c.collected_at ? new Date(c.collected_at).toLocaleDateString() : '',
        c.agent?.name || cItem?.agent_name || 'Assigned Agent',
        c.photo_url ? 'Yes' : 'No',
        st,
        c.verified_by || '',
        c.rejection_reason || '',
      ];
    });

  const EXPORT_HEADERS = [
    'File #', 'Customer', 'Bank', 'Amount (BDT)', 'Payment Method', 'Receipt #',
    'Collected Date', 'Agent', 'Proof Photo', 'Status', 'Verified By', 'Rejection Reason',
  ];

  const handleExportExcel = () => {
    exportTableToExcel(
      `Total_Cash_Collected_${new Date().toISOString().slice(0, 10)}.xlsx`,
      'Cash Collections',
      EXPORT_HEADERS,
      buildExportRows()
    );
    setAnnouncement(`Excel export started: ${filtered.length} records.`);
  };

  const handleExportPdf = () => {
    exportTableToPdf(
      `Total_Cash_Collected_${new Date().toISOString().slice(0, 10)}.pdf`,
      'Total Cash Collected & Verifications Report',
      EXPORT_HEADERS,
      buildExportRows()
    );
    setAnnouncement(`PDF export started: ${filtered.length} records.`);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <DollarSign className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            <span>Total Cash Collected & Verifications</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Review, approve, or reject field recovery collections and sync status to assigned agents
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleExportPdf}
            className="px-3.5 py-2 min-h-[36px] rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-rose-400 hover:text-rose-600 dark:hover:text-rose-400 text-slate-600 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
            aria-label={`Export ${filtered.length} currently filtered records as a PDF report`}
          >
            <FileDown className="w-4 h-4" aria-hidden="true" />
            <span>Export PDF</span>
          </button>
          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2 min-h-[36px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm shadow-emerald-600/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2"
            aria-label={`Export ${filtered.length} currently filtered records as an Excel spreadsheet`}
          >
            <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Total Collections</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white mt-2 font-mono">
            BDT {stats.totalCollected.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{stats.totalCount} payment entries</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-500/30 bg-emerald-50/20 dark:bg-emerald-950/10 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Approved (Verified)</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-2 font-mono">
            BDT {stats.approvedAmount.toLocaleString()}
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400/80 mt-0.5">{stats.approvedCount} approved files</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-amber-500/30 bg-amber-50/20 dark:bg-amber-950/10 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700 dark:text-amber-400">Pending Verification</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-amber-600 dark:text-amber-400 mt-2 font-mono">
            BDT {stats.pendingAmount.toLocaleString()}
          </div>
          <div className="text-[11px] text-amber-600 dark:text-amber-400/80 mt-0.5">{stats.pendingCount} awaiting approval</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-rose-500/30 bg-rose-50/20 dark:bg-rose-950/10 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-700 dark:text-rose-400">Rejected / Disputed</span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-600 flex items-center justify-center">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-rose-600 dark:text-rose-400 mt-2 font-mono">
            BDT {stats.rejectedAmount.toLocaleString()}
          </div>
          <div className="text-[11px] text-rose-600 dark:text-rose-400/80 mt-0.5">{stats.rejectedCount} payments rejected</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
            <input
              type="text"
              placeholder="Search by file #, customer name, receipt #, agent..."
              aria-label="Search payments by file number, customer name, receipt number, or agent"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {(['all', 'pending', 'approved', 'rejected'] as const).map(st => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              aria-pressed={filterStatus === st}
              className={`px-3 py-2 min-h-[36px] rounded-xl font-bold capitalize transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                filterStatus === st
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {st} {st === 'pending' && stats.pendingCount > 0 && `(${stats.pendingCount})`}
            </button>
          ))}

          {selectedIds.size > 0 && (
            <button
              ref={bulkDeleteRef}
              onClick={handleBulkDelete}
              disabled={deleting}
              className="px-3 py-2 min-h-[36px] rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm shadow-rose-600/30 ml-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{deleting ? 'Deleting…' : `Delete Selected (${selectedIds.size})`}</span>
            </button>
          )}
        </div>
      </div>

      {/* Collections Table */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[850px]">
            <caption className="sr-only">
              Payment collections with amount, agent, verification status, and actions. Select rows to delete in bulk.
            </caption>
            <thead className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase text-[11px] font-bold">
              <tr>
                <th scope="col" className="py-3 px-4 w-10">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAll}
                    aria-label="Select or deselect all visible rows"
                    className="w-6 h-6 rounded cursor-pointer accent-rose-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                  />
                </th>
                <th scope="col" className="py-3 px-4">File & Customer</th>
                <th scope="col" className="py-3 px-4">Amount</th>
                <th scope="col" className="py-3 px-4">Payment Method / Receipt</th>
                <th scope="col" className="py-3 px-4">Collected Date</th>
                <th scope="col" className="py-3 px-4">Agent</th>
                <th scope="col" className="py-3 px-4">Proof Photo</th>
                <th scope="col" className="py-3 px-4">Verification Status</th>
                <th scope="col" className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filtered.length === 0 && (                  <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500 dark:text-slate-400">
                    <p className="font-semibold text-sm">No payment records found</p>
                    <p className="text-xs mt-1">Payments recorded on case files will appear here for verification</p>
                  </td>
                </tr>
              )}
              {filtered.map(c => {
                const cItem = resolveCase(c);
                const st = c.status || 'pending';

                return (
                  <tr key={c.id} className={`transition-colors ${
                    selectedIds.has(c.id)
                      ? 'bg-rose-50 dark:bg-rose-950/20'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}>
                    <td className="py-3.5 px-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(c.id)}
                        onChange={() => toggleSelect(c.id)}
                        aria-label={`Select payment record for ${cItem ? `${cItem.customer_name}, file ${cItem.file_number}` : `case ${c.case_file_id}`}`}
                        className="w-6 h-6 rounded cursor-pointer accent-rose-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                      />
                    </td>
                    <td className="py-3.5 px-4">
                      {cItem ? (
                        <button
                          onClick={() => onSelectCase?.(cItem.id)}
                          className="text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-lg"
                          aria-label={`Open case ${cItem.file_number} for ${cItem.customer_name}`}
                        >
                          <div className="font-mono font-bold text-slate-900 dark:text-white group-hover:text-emerald-500 flex items-center gap-1">
                            {cItem.file_number}
                            <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <div className="text-[11px] text-slate-500 font-medium mt-0.5">{cItem.customer_name}</div>
                          <div className="text-[10px] text-slate-400 font-semibold">{cItem.bank?.name}</div>
                        </button>
                      ) : (
                        <span className="font-mono text-slate-400">Case #{c.case_file_id}</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400">
                      BDT {Number(c.amount).toLocaleString()}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800 dark:text-slate-200 capitalize">{c.payment_method.replace('_', ' ')}</div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {c.receipt_number ? `#${c.receipt_number}` : 'No receipt #'}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                      {c.collected_at ? new Date(c.collected_at).toLocaleDateString() : 'N/A'}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {c.agent?.name || 'Assigned Agent'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      {c.photo_url ? (
                        <button
                          onClick={() => setSelectedPhoto(c.photo_url!)}
                          className="flex items-center gap-1 px-2.5 py-2 min-h-[36px] rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold transition-all border border-emerald-500/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                          aria-label={`View proof photo for ${cItem ? cItem.customer_name : 'this payment'}`}
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>View Photo</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">No Photo</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      {st === 'approved' && (
                        <div>
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3" /> Approved
                          </span>
                          {c.verified_by && (
                            <div className="text-[9px] text-slate-400 mt-0.5">by {c.verified_by}</div>
                          )}
                        </div>
                      )}
                      {st === 'rejected' && (
                        <div>
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                            <XCircle className="w-3 h-3" /> Rejected
                          </span>
                          {c.rejection_reason && (
                            <div className="text-[10px] text-rose-500 font-medium mt-0.5 max-w-[150px] leading-tight">
                              Note: {c.rejection_reason}
                            </div>
                          )}
                        </div>
                      )}
                      {st === 'pending' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                          <Clock className="w-3 h-3" /> Pending Review
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {user?.role !== 'agent' && (
                          <>
                            {st !== 'approved' && (
                              <button
                                onClick={() => handleApprove(c.id)}
                                className="px-2.5 py-2 min-h-[36px] rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1 transition-all shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2"
                                aria-label={`Approve payment of BDT ${Number(c.amount).toLocaleString()} for ${cItem ? cItem.customer_name : 'this case'}`}
                              >
                                <CheckCircle2 className="w-3 h-3" aria-hidden="true" /> Approve
                              </button>
                            )}
                            {st !== 'rejected' && (
                              <button
                                onClick={() => handleOpenRejectModal(c)}
                                className="px-2.5 py-2 min-h-[36px] rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold text-[11px] flex items-center gap-1 transition-all border border-rose-500/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                                aria-label={`Reject payment for ${cItem ? cItem.customer_name : 'this case'} with a reason note`}
                              >
                                <XCircle className="w-3 h-3" aria-hidden="true" /> Reject
                              </button>
                            )}
                          </>
                        )}
                        <button
                          onClick={() => handleDelete(c.id)}
                          className="p-2.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                          aria-label={`Permanently delete payment record for ${cItem ? cItem.customer_name : `case ${c.case_file_id}`}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Screen-reader announcement region */}
      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>

      {/* Photo Preview Modal */}
      {selectedPhoto && (
        <AccessibleModal
          title="Payment Receipt Proof"
          onClose={() => setSelectedPhoto(null)}
          panelClassName="max-w-lg"
          titleIcon={<Camera className="w-4 h-4 text-emerald-500" aria-hidden="true" />}
        >
          <img
            src={selectedPhoto}
            alt="Payment receipt proof photo"
            className="rounded-2xl max-h-[70vh] w-full object-contain border border-slate-100 dark:border-slate-800"
          />
          <div className="flex justify-end mt-3">
            <button
              onClick={() => setSelectedPhoto(null)}
              className="px-4 py-2 min-h-[36px] rounded-xl bg-slate-100 dark:bg-slate-800 font-bold text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              Close
            </button>
          </div>
        </AccessibleModal>
      )}

      {/* Reject Payment with Reason Modal */}
      {rejectingCol && (
        <AccessibleModal
          title="Reject Payment Record"
          onClose={() => setRejectingCol(null)}
          panelClassName="max-w-sm"
          titleClassName="font-bold text-sm text-rose-600"
          titleIcon={<XCircle className="w-4 h-4" aria-hidden="true" />}
        >
          <div className="space-y-3 text-xs">
            <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
              Specify the reason why this collection of <b>BDT {rejectingCol.amount.toLocaleString()}</b> is being rejected. The assigned agent will see this note.
            </p>

            <div className="space-y-1.5">
              <label htmlFor="rejection-reason" className="block font-bold text-slate-600 dark:text-slate-300">
                Rejection Reason
              </label>
              <select
                id="rejection-reason"
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              >
                <option value="Amount was not right / Does not match bank deposit">Amount was not right / Does not match deposit</option>
                <option value="Customer did not actually pay / Fake slip">Customer did not pay / Fake receipt slip</option>
                <option value="Cheque dishonoured / Bounced">Cheque dishonoured / Bounced</option>
                <option value="Duplicate payment entry">Duplicate payment entry</option>
                <option value="Proof photo unclear or missing receipt stamp">Proof photo unclear or missing receipt stamp</option>
                <option value="Other discrepancy">Other discrepancy</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setRejectingCol(null)}
                className="px-3.5 py-2 min-h-[36px] rounded-xl bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                className="px-4 py-2 min-h-[36px] rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold shadow-md shadow-rose-600/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </AccessibleModal>
      )}
    </div>
  );
};