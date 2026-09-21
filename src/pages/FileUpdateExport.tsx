import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { dataService } from '../services/dataService';
import { CaseFile } from '../types';
import { formatDate } from '../services/dateFormat';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { 
  FileSpreadsheet, 
  FileText, 
  Filter, 
  CheckSquare, 
  Square, 
  Download, 
  Search,
  Building2,
  Calendar,
  Layers,
  ArrowUpDown,
  CheckCircle2,
  Info
} from 'lucide-react';

export interface ExportColumnDef {
  key: string;
  label: string;
  category: 'core' | 'customer' | 'financial' | 'field' | 'extra';
  getValue: (c: CaseFile) => string;
}

export const EXPORT_AVAILABLE_COLUMNS: ExportColumnDef[] = [
  // Core Bank & File
  { key: 'FILE_NO', label: 'File Number (FILE_NO)', category: 'core', getValue: c => c.file_number },
  { key: 'BANK_NAME', label: 'Bank Name (BANK_NAME)', category: 'core', getValue: c => c.bank_name || c.bank?.name || String(c.extra_attributes?.BANK_NAME || '') },
  { key: 'FILE_TYPE', label: 'File Type / Product (FILE_TYPE)', category: 'core', getValue: c => String(c.extra_attributes?.FILE_TYPE || c.product?.name || '') },
  { key: 'ACCOUNT_NUMBER', label: 'Account / Card # (ACCOUNT_NUMBER)', category: 'core', getValue: c => c.account_number || '' },
  { key: 'CASA', label: 'CASA Account (CASA)', category: 'core', getValue: c => String(c.extra_attributes?.CASA || '') },
  { key: 'FILE_STATUS', label: 'File Status / Classification (FILE_STATUS)', category: 'core', getValue: c => String(c.extra_attributes?.FILE_STATUS || c.status || '') },
  { key: 'LEGAL_STATUS', label: 'Legal Status (LEGAL_STATUS)', category: 'core', getValue: c => c.legal_status || '' },
  { key: 'LAP_STATUS', label: 'LAP Status (LAP_STATUS)', category: 'core', getValue: c => String(c.extra_attributes?.LAP_STATUS || '') },
  { key: 'BRANCH_NAME', label: 'Branch Name (BRANCH_NAME)', category: 'core', getValue: c => String(c.extra_attributes?.BRANCH_NAME || '') },
  { key: 'AREA', label: 'Area / Territory (AREA)', category: 'core', getValue: c => String(c.extra_attributes?.AREA || '') },
  { key: 'ALLOCATION_DATE', label: 'Allocation Date (ALLOCATION_DATE)', category: 'core', getValue: c => formatDate(c.allocation_date) },
  { key: 'EXPIRY_DATE', label: 'Expiry Date (EXPIRY_DATE)', category: 'core', getValue: c => formatDate(c.expiry_date) },

  // Customer Profile
  { key: 'CUSTOMER_NAME', label: 'Customer Name (CUSTOMER_NAME)', category: 'customer', getValue: c => c.customer_name },
  { key: 'CUSTOMER_PHONE', label: 'Customer Phone (CUSTOMER_PHONE)', category: 'customer', getValue: c => c.customer_phone || '' },
  { key: 'REF_PHONE', label: 'Reference / Alt Phone (REF_PHONE)', category: 'customer', getValue: c => c.customer_secondary_phone || String(c.extra_attributes?.REF_PHONE || '') },
  { key: 'PRESENT_ADDRESS', label: 'Present Address (PRESENT_ADDRESS)', category: 'customer', getValue: c => c.customer_address_present || '' },
  { key: 'PERMANENT_ADDRESS', label: 'Permanent Address (PERMANENT_ADDRESS)', category: 'customer', getValue: c => c.customer_address_permanent || '' },
  { key: 'EMP_OFFICE_NAME', label: 'Employer / Company (EMP_OFFICE_NAME)', category: 'customer', getValue: c => String(c.extra_attributes?.EMP_OFFICE_NAME || '') },
  { key: 'POSITION', label: 'Job Designation / Position (POSITION)', category: 'customer', getValue: c => String(c.extra_attributes?.POSITION || '') },
  { key: 'EMP_OFFICE_ADDRESS', label: 'Employer Address (EMP_OFFICE_ADDRESS)', category: 'customer', getValue: c => String(c.extra_attributes?.EMP_OFFICE_ADDRESS || '') },
  { key: 'GUARANTORS', label: 'Guarantor / Ref Info (GUARANTORS)', category: 'customer', getValue: c => String(c.extra_attributes?.GUARANTORS || '') },

  // Financials & Balances
  { key: 'OUTSTANDING_AMOUNT', label: 'Total Outstanding (OUTSTANDING_AMOUNT)', category: 'financial', getValue: c => String(c.outstanding_amount || 0) },
  { key: 'OVERDUE_AMOUNT', label: 'Overdue Amount (OVERDUE_AMOUNT)', category: 'financial', getValue: c => String(c.overdue_amount || 0) },
  { key: 'MINIMUM_PAYMENT', label: 'Minimum Payment / EMI (MINIMUM_PAYMENT)', category: 'financial', getValue: c => String(c.minimum_payment || 0) },
  { key: 'DPD', label: 'Days Past Due (DPD)', category: 'financial', getValue: c => String(c.extra_attributes?.DPD || '') },
  { key: 'TOTAL_COLLECTED_AMOUNT', label: 'Total Collected (TOTAL_COLLECTED_AMOUNT)', category: 'financial', getValue: c => String(c.total_collected_amount || 0) },

  // Field Activity & Recovery Updates
  { key: 'AGENT_NAME', label: 'Assigned Field Agent (AGENT_NAME)', category: 'field', getValue: c => c.agent_name || '' },
  { key: 'COLLECTOR_NAME', label: 'Bank Collector / Supervisor (COLLECTOR_NAME)', category: 'field', getValue: c => c.collector_name || '' },
  { key: 'VISITED_PRESENT', label: 'Present Address Visited? (VISITED_PRESENT)', category: 'field', getValue: c => c.present_address_visited ? 'Yes' : 'No' },
  { key: 'VISITED_PERMANENT', label: 'Permanent Address Visited? (VISITED_PERMANENT)', category: 'field', getValue: c => c.permanent_address_visited ? 'Yes' : 'No' },
  { key: 'LAST_VISIT_DATE', label: 'Last Visit Date (LAST_VISIT_DATE)', category: 'field', getValue: c => {
    const ci = dataService.getCheckInsByCase(c.id)[0];
    return ci?.visited_at ? new Date(ci.visited_at).toLocaleDateString() : '';
  }},
  { key: 'LAST_VISIT_NOTES', label: 'Last Visit Notes (LAST_VISIT_NOTES)', category: 'field', getValue: c => {
    const ci = dataService.getCheckInsByCase(c.id)[0];
    return ci?.notes || '';
  }},
  { key: 'LAST_PTP_AMOUNT', label: 'Last Promised Amount (LAST_PTP_AMOUNT)', category: 'field', getValue: c => {
    const r = dataService.getRemarksByCase(c.id)[0];
    return r?.promised_amount ? String(r.promised_amount) : '';
  }},
  { key: 'LAST_PTP_DATE', label: 'Last Promise Date (LAST_PTP_DATE)', category: 'field', getValue: c => {
    const r = dataService.getRemarksByCase(c.id)[0];
    return r?.promise_date || '';
  }},
  { key: 'LAST_REMARK', label: 'Last Remark / Call Notes (LAST_REMARK)', category: 'field', getValue: c => {
    const r = dataService.getRemarksByCase(c.id)[0];
    return r?.remarks || '';
  }},
  { key: 'CONTACT_STATUS', label: 'Contact Status (CONTACT_STATUS)', category: 'field', getValue: c => {
    const r = dataService.getRemarksByCase(c.id)[0];
    return r?.contact_status || '';
  }},
];

export const FileUpdateExportPage: React.FC<{ onSelectCase?: (id: number) => void }> = ({ onSelectCase }) => {
  const { user } = useAuth();
  const { t } = useLanguage();

  // Selected column keys for export
  const [selectedColKeys, setSelectedColKeys] = useState<Set<string>>(() => new Set([
    'FILE_NO', 'BANK_NAME', 'FILE_TYPE', 'ACCOUNT_NUMBER',
    'CUSTOMER_NAME', 'CUSTOMER_PHONE', 'REF_PHONE',
    'OUTSTANDING_AMOUNT', 'OVERDUE_AMOUNT', 'FILE_STATUS',
    'AGENT_NAME', 'COLLECTOR_NAME', 'ALLOCATION_DATE',
    'VISITED_PRESENT', 'LAST_PTP_AMOUNT', 'LAST_PTP_DATE', 'LAST_REMARK'
  ]));

  // Filters
  const [bankFilter, setBankFilter] = useState('all');
  const [fileTypeFilter, setFileTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [agentFilter, setAgentFilter] = useState('all');
  const [collectorFilter, setCollectorFilter] = useState('all');
  const [visitFilter, setVisitFilter] = useState<'all' | 'visited' | 'not_visited'>('all');
  const [ptpFilter, setPtpFilter] = useState<'all' | 'has_ptp' | 'no_ptp'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Cases
  const rawCases = useMemo(() => {
    return user ? dataService.getCases(user) : [];
  }, [user]);

  // Unique dropdown options
  const banks = useMemo(() => {
    const s = new Set<string>();
    rawCases.forEach(c => {
      const b = c.bank_name || c.bank?.name;
      if (b) s.add(b);
    });
    return Array.from(s).sort();
  }, [rawCases]);

  const fileTypes = useMemo(() => {
    const s = new Set<string>();
    rawCases.forEach(c => {
      const ft = c.extra_attributes?.FILE_TYPE || c.product?.name;
      if (ft) s.add(String(ft));
    });
    return Array.from(s).sort();
  }, [rawCases]);

  const agents = useMemo(() => {
    const s = new Set<string>();
    rawCases.forEach(c => {
      if (c.agent_name) s.add(c.agent_name);
    });
    return Array.from(s).sort();
  }, [rawCases]);

  const collectors = useMemo(() => {
    const s = new Set<string>();
    rawCases.forEach(c => {
      if (c.collector_name) s.add(c.collector_name);
    });
    return Array.from(s).sort();
  }, [rawCases]);

  // Filtered cases
  const filteredCases = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return rawCases.filter(c => {
      if (bankFilter !== 'all' && (c.bank_name || c.bank?.name) !== bankFilter) return false;
      if (fileTypeFilter !== 'all' && String(c.extra_attributes?.FILE_TYPE || c.product?.name) !== fileTypeFilter) return false;
      if (statusFilter !== 'all' && String(c.extra_attributes?.FILE_STATUS || c.status) !== statusFilter) return false;
      if (agentFilter !== 'all' && c.agent_name !== agentFilter) return false;
      if (collectorFilter !== 'all' && c.collector_name !== collectorFilter) return false;

      if (visitFilter === 'visited' && !c.present_address_visited && !c.permanent_address_visited) return false;
      if (visitFilter === 'not_visited' && (c.present_address_visited || c.permanent_address_visited)) return false;

      const remarks = dataService.getRemarksByCase(c.id);
      const hasPtp = remarks.some(r => r.promised_amount || r.promise_date);
      if (ptpFilter === 'has_ptp' && !hasPtp) return false;
      if (ptpFilter === 'no_ptp' && hasPtp) return false;

      if (q) {
        const matchFile = c.file_number.toLowerCase().includes(q);
        const matchCust = c.customer_name.toLowerCase().includes(q);
        const matchAcc = (c.account_number || '').toLowerCase().includes(q);
        const matchPhone = (c.customer_phone || '').includes(q);
        if (!matchFile && !matchCust && !matchAcc && !matchPhone) return false;
      }

      return true;
    });
  }, [rawCases, bankFilter, fileTypeFilter, statusFilter, agentFilter, collectorFilter, visitFilter, ptpFilter, searchQuery]);

  // Toggle single column
  const toggleColumn = (key: string) => {
    setSelectedColKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Select all / none
  const selectAllCols = () => {
    setSelectedColKeys(new Set(EXPORT_AVAILABLE_COLUMNS.map(c => c.key)));
  };
  const selectNoneCols = () => {
    setSelectedColKeys(new Set(['FILE_NO', 'CUSTOMER_NAME', 'OUTSTANDING_AMOUNT']));
  };

  // Active columns in order
  const activeColumns = useMemo(() => {
    return EXPORT_AVAILABLE_COLUMNS.filter(c => selectedColKeys.has(c.key));
  }, [selectedColKeys]);

  // Export to real Excel (.xlsx) — opens natively in Excel, no import wizard
  const handleExportExcel = () => {
    if (activeColumns.length === 0 || filteredCases.length === 0) return;

    const headers = activeColumns.map(c => c.key);
    const rows = filteredCases.map(c => activeColumns.map(col => col.getValue(c) ?? ''));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = headers.map(h => ({ wch: Math.max(10, Math.min(34, String(h).length + 6)) }));
    XLSX.utils.book_append_sheet(wb, ws, 'File_Update_Report');
    XLSX.writeFile(wb, `File_Update_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Export to PDF
  const handleExportPDF = () => {
    if (activeColumns.length === 0 || filteredCases.length === 0) return;

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    const pageW = doc.internal.pageSize.getWidth();
    const today = new Date().toLocaleString();

    // Header Banner
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageW, 18, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Bank Recovery — File Update & Performance Report', 10, 11);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Exported: ${today}  |  Total: ${filteredCases.length} Cases`, pageW - 10, 11, { align: 'right' });

    // Table
    const headers = activeColumns.map(c => c.key);
    const body = filteredCases.map(c => {
      return activeColumns.map(col => String(col.getValue(c) ?? ''));
    });

    autoTable(doc, {
      startY: 24,
      head: [headers],
      body: body,
      styles: {
        fontSize: activeColumns.length > 12 ? 5.5 : 7,
        cellPadding: 1.5,
        overflow: 'linebreak',
      },
      headStyles: {
        fillColor: [5, 150, 105],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: activeColumns.length > 12 ? 6 : 7.5,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
    });

    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text(`Page ${i} / ${totalPages}  |  Confidential File Update Report`, pageW / 2, doc.internal.pageSize.getHeight() - 5, { align: 'center' });
    }

    doc.save(`File_Update_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Export is restricted to Admin & Manager only
  const canExport = user?.role === 'admin' || user?.role === 'manager';
  if (!canExport) {
    return (
      <div className="p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 max-w-lg">
        <p className="text-sm font-extrabold text-rose-700 dark:text-rose-400">Export restricted</p>
        <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">
          Exporting file data to Excel/PDF is available to <b>Admin & Manager</b> accounts only.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Download className="w-5 h-5" />
            </div>
            <span>File Update Format & Custom Export</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Choose exactly which data columns to include or omit, apply custom filters, and export as Excel or PDF.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            disabled={filteredCases.length === 0 || activeColumns.length === 0}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-emerald-600/30 transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Excel .xlsx ({filteredCases.length})</span>
          </button>

          <button
            onClick={handleExportPDF}
            disabled={filteredCases.length === 0 || activeColumns.length === 0}
            className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white disabled:opacity-50 font-bold text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer border border-slate-700"
          >
            <FileText className="w-4 h-4 text-rose-400" />
            <span>Export PDF Report</span>
          </button>
        </div>
      </div>

      {/* Column Selector Card */}
      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-500" />
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
              Select Columns to Include in File Update
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">
              {selectedColKeys.size} of {EXPORT_AVAILABLE_COLUMNS.length} Columns Selected
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={selectAllCols}
              className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-[11px] transition-all"
            >
              Select All
            </button>
            <button
              onClick={selectNoneCols}
              className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-[11px] transition-all"
            >
              Reset to Minimal
            </button>
          </div>
        </div>

        {/* Grouped Checkboxes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 text-xs">
          {EXPORT_AVAILABLE_COLUMNS.map(col => {
            const isChecked = selectedColKeys.has(col.key);
            return (
              <label
                key={col.key}
                onClick={() => toggleColumn(col.key)}
                className={`p-2.5 rounded-xl border flex items-center gap-2.5 cursor-pointer select-none transition-all ${
                  isChecked
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-slate-900 dark:text-white font-bold'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-400 hover:border-slate-300'
                }`}
              >
                <div className="flex-shrink-0">
                  {isChecked ? (
                    <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                </div>
                <span className="truncate text-[11px]">{col.label}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Filter Options */}
      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
          <Filter className="w-4 h-4 text-blue-500" />
          <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
            Filter Data Before Exporting
          </h3>
          <span className="text-[11px] text-slate-400 ml-auto font-mono">
            {filteredCases.length} Matching Records
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
          {/* Search Keyword */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Search Keyword</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="File #, customer, phone..."
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-medium"
              />
            </div>
          </div>

          {/* Partner Bank */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Partner Bank</label>
            <select
              value={bankFilter}
              onChange={e => setBankFilter(e.target.value)}
              className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-semibold"
            >
              <option value="all">All Banks ({rawCases.length})</option>
              {banks.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* File Type */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">File Type</label>
            <select
              value={fileTypeFilter}
              onChange={e => setFileTypeFilter(e.target.value)}
              className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-semibold"
            >
              <option value="all">All File Types</option>
              {fileTypes.map(ft => (
                <option key={ft} value={ft}>{ft}</option>
              ))}
            </select>
          </div>

          {/* Field Agent */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Field Agent</label>
            <select
              value={agentFilter}
              onChange={e => setAgentFilter(e.target.value)}
              className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-semibold"
            >
              <option value="all">All Agents</option>
              {agents.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          {/* Bank Collector */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Bank Collector</label>
            <select
              value={collectorFilter}
              onChange={e => setCollectorFilter(e.target.value)}
              className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-semibold"
            >
              <option value="all">All Collectors</option>
              {collectors.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* GPS Visit Status */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">GPS Visit Status</label>
            <select
              value={visitFilter}
              onChange={e => setVisitFilter(e.target.value as any)}
              className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-semibold"
            >
              <option value="all">All (Visited + Pending)</option>
              <option value="visited">✓ Address Visited Only</option>
              <option value="not_visited">⏳ Pending Visit Only</option>
            </select>
          </div>

          {/* PTP Status */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Promise to Pay (PTP)</label>
            <select
              value={ptpFilter}
              onChange={e => setPtpFilter(e.target.value as any)}
              className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-semibold"
            >
              <option value="all">All Files</option>
              <option value="has_ptp">🤝 Has Committed PTP</option>
              <option value="no_ptp">No PTP Recorded</option>
            </select>
          </div>

          {/* Reset Filters */}
          <div className="flex items-end">
            <button
              onClick={() => {
                setBankFilter('all');
                setFileTypeFilter('all');
                setStatusFilter('all');
                setAgentFilter('all');
                setCollectorFilter('all');
                setVisitFilter('all');
                setPtpFilter('all');
                setSearchQuery('');
              }}
              className="w-full p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-xs transition-all cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Preview Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <span className="font-extrabold text-xs text-slate-900 dark:text-white">
            Export Preview ({filteredCases.length} Records, {activeColumns.length} Columns)
          </span>
          <span className="text-[11px] text-slate-400">
            Scroll horizontally to view all columns
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[700px]">
            <thead className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[10px]">
              <tr>
                {activeColumns.map(col => (
                  <th key={col.key} className="py-2.5 px-3 whitespace-nowrap font-bold">
                    {col.key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredCases.slice(0, 15).map(c => (
                <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  {activeColumns.map(col => (
                    <td key={col.key} className="py-2.5 px-3 whitespace-nowrap text-slate-800 dark:text-slate-200 font-medium">
                      {col.getValue(c) || '—'}
                    </td>
                  ))}
                </tr>
              ))}
              {filteredCases.length === 0 && (
                <tr>
                  <td colSpan={activeColumns.length || 1} className="text-center py-10 text-slate-400 italic">
                    No matching records found with current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {filteredCases.length > 15 && (
          <div className="p-3 bg-slate-50 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800 text-center text-xs text-slate-400 font-medium">
            Showing first 15 of {filteredCases.length} matching rows in preview. All {filteredCases.length} rows will be exported in full.
          </div>
        )}
      </div>
    </div>
  );
};
