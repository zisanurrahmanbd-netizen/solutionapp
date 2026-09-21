import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { dataService } from '../services/dataService';
import { CaseFile } from '../types';
import { formatDate } from '../services/dateFormat';
import { 
  CalendarClock, 
  AlertTriangle, 
  CheckCircle2, 
  Download, 
  FileText, 
  Printer, 
  Filter, 
  Building2, 
  Clock, 
  Search, 
  CheckSquare, 
  Square, 
  Eye, 
  Layers, 
  UserCheck, 
  TrendingUp 
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const ExpiryTrackerPage: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [dataVersion, setDataVersion] = useState(0);

  // Subscribe to background cloud sync
  useEffect(() => {
    return dataService.subscribe(() => {
      setDataVersion(v => v + 1);
    });
  }, []);

  const cases = dataService.getCases(user!);
  const banks = dataService.getBanks();

  // Selective filters state
  const [selectedBankId, setSelectedBankId] = useState<string>('all');
  const [selectedBucket, setSelectedBucket] = useState<string>('all');
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'matrix' | 'cases'>('matrix');
  const [selectedBanks, setSelectedBanks] = useState<Set<number>>(new Set());

  // Extract all unique agents from cases with counts
  const allAgents = useMemo(() => {
    const map = new Map<string, number>();
    cases.forEach(c => {
      const name = c.agent_name?.trim();
      if (name && name.toLowerCase() !== 'unassigned') {
        map.set(name, (map.get(name) || 0) + 1);
      }
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [cases, dataVersion]);

  const unassignedCount = useMemo(() => {
    return cases.filter(c => !c.assigned_agent_id && (!c.agent_name || c.agent_name.trim() === '' || c.agent_name.toLowerCase() === 'unassigned')).length;
  }, [cases, dataVersion]);

  // Initialize selectedBanks with all bank IDs
  useEffect(() => {
    if (banks.length > 0 && selectedBanks.size === 0) {
      setSelectedBanks(new Set(banks.map(b => b.id)));
    }
  }, [banks]);

  const now = new Date();
  const sevenDays = new Date(now.getTime() + 7 * 86400000);
  const thirtyDays = new Date(now.getTime() + 30 * 86400000);

  // Helper to categorize case expiry
  const getExpiryCategory = (c: CaseFile) => {
    if (c.status === 'settled') return 'settled';
    if (!c.expiry_date) return 'active';
    const d = new Date(c.expiry_date);
    if (d < now) return 'expired';
    if (d <= sevenDays) return 'expiring7';
    if (d <= thirtyDays) return 'expiring30';
    return 'active';
  };

  // Compute Matrix per bank (respecting selectedAgent)
  const matrix = useMemo(() => {
    return banks.map(b => {
      const bankCases = cases.filter(c => {
        if (c.bank_id !== b.id) return false;
        if (selectedAgent === 'unassigned') {
          return !c.assigned_agent_id && (!c.agent_name || c.agent_name.trim() === '' || c.agent_name.toLowerCase() === 'unassigned');
        } else if (selectedAgent !== 'all') {
          return c.agent_name?.trim().toLowerCase() === selectedAgent.trim().toLowerCase();
        }
        return true;
      });
      const active = bankCases.filter(c => !['settled', 'closed'].includes(c.status)).length;
      const expiring7 = bankCases.filter(c => {
        if (!c.expiry_date || ['settled', 'closed'].includes(c.status)) return false;
        const d = new Date(c.expiry_date);
        return d >= now && d <= sevenDays;
      }).length;
      const expiring30 = bankCases.filter(c => {
        if (!c.expiry_date || ['settled', 'closed'].includes(c.status)) return false;
        const d = new Date(c.expiry_date);
        return d > sevenDays && d <= thirtyDays;
      }).length;
      const expired = bankCases.filter(c => {
        if (!c.expiry_date || ['settled', 'closed'].includes(c.status)) return false;
        return new Date(c.expiry_date) < now;
      }).length;
      const settled = bankCases.filter(c => c.status === 'settled').length;

      return {
        bankId: b.id,
        bankName: b.name,
        bankCode: b.code,
        active,
        expiring7,
        expiring30,
        expired,
        settled,
        total: bankCases.length
      };
    });
  }, [banks, cases, selectedAgent, dataVersion]);

  // Filtered detailed cases based on selective options
  const filteredCases = useMemo(() => {
    return cases.filter(c => {
      // Bank filter
      if (selectedBankId !== 'all' && c.bank_id !== Number(selectedBankId)) return false;
      // Selective checkboxes filter
      if (selectedBankId === 'all' && selectedBanks.size > 0 && !selectedBanks.has(c.bank_id)) return false;

      // Agent filter
      if (selectedAgent === 'unassigned') {
        const isUnassigned = !c.assigned_agent_id && (!c.agent_name || c.agent_name.trim() === '' || c.agent_name.toLowerCase() === 'unassigned');
        if (!isUnassigned) return false;
      } else if (selectedAgent !== 'all') {
        if (!c.agent_name || c.agent_name.trim().toLowerCase() !== selectedAgent.trim().toLowerCase()) return false;
      }

      // Expiry bucket filter
      const cat = getExpiryCategory(c);
      if (selectedBucket === 'expiring7' && cat !== 'expiring7') return false;
      if (selectedBucket === 'expiring30' && cat !== 'expiring30') return false;
      if (selectedBucket === 'expired' && cat !== 'expired') return false;
      if (selectedBucket === 'active' && cat !== 'active') return false;
      if (selectedBucket === 'settled' && cat !== 'settled') return false;

      // Search term
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const match = 
          c.file_number.toLowerCase().includes(q) ||
          c.customer_name.toLowerCase().includes(q) ||
          (c.account_number && c.account_number.toLowerCase().includes(q)) ||
          (c.agent_name && c.agent_name.toLowerCase().includes(q)) ||
          (c.bank?.name && c.bank.name.toLowerCase().includes(q));
        if (!match) return false;
      }

      return true;
    });
  }, [cases, selectedBankId, selectedBanks, selectedAgent, selectedBucket, searchQuery, dataVersion]);

  // Matrix rows filtered by bank selection & checkboxes
  const filteredMatrix = useMemo(() => {
    return matrix.filter(row => {
      if (selectedBankId !== 'all') return row.bankId === Number(selectedBankId);
      return selectedBanks.has(row.bankId);
    });
  }, [matrix, selectedBankId, selectedBanks]);

  // Summary Totals
  const totals = useMemo(() => {
    return filteredMatrix.reduce((acc, r) => ({
      active: acc.active + r.active,
      expiring7: acc.expiring7 + r.expiring7,
      expiring30: acc.expiring30 + r.expiring30,
      expired: acc.expired + r.expired,
      settled: acc.settled + r.settled,
      total: acc.total + r.total,
    }), { active: 0, expiring7: 0, expiring30: 0, expired: 0, settled: 0, total: 0 });
  }, [filteredMatrix]);

  // Checkbox toggle handlers
  const toggleSelectBank = (bankId: number) => {
    const next = new Set(selectedBanks);
    if (next.has(bankId)) {
      next.delete(bankId);
    } else {
      next.add(bankId);
    }
    setSelectedBanks(next);
  };

  const toggleSelectAll = () => {
    if (selectedBanks.size === banks.length) {
      setSelectedBanks(new Set());
    } else {
      setSelectedBanks(new Set(banks.map(b => b.id)));
    }
  };

  // 📕 Selective Export to PDF (.pdf)
  const handleExportPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4'); // Landscape for rich table width
    const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    // Document Header
    doc.setFillColor(15, 23, 42); // Slate-900 header
    doc.rect(0, 0, 297, 24, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('RECOVERYPRO — PORTFOLIO EXPIRY & ALLOCATION AUDIT REPORT', 14, 11);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225);
    doc.text(`Generated: ${dateStr} ${timeStr} | User: ${user?.name || 'Admin'} (${user?.role || 'Admin'}) | Filter: ${selectedBankId === 'all' ? 'All Banks' : banks.find(b => b.id === Number(selectedBankId))?.name} | Bucket: ${selectedBucket.toUpperCase()}`, 14, 18);

    // Section 1: Expiry Summary Matrix Table
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('1. Institutional Expiry & Mandate Status Matrix', 14, 32);

    const summaryTableRows = [
      ...filteredMatrix.map(r => [
        r.bankName,
        String(r.active),
        String(r.expiring7),
        String(r.expiring30),
        String(r.expired),
        String(r.settled),
        String(r.total)
      ]),
      ['TOTAL PORTFOLIO', String(totals.active), String(totals.expiring7), String(totals.expiring30), String(totals.expired), String(totals.settled), String(totals.total)]
    ];

    autoTable(doc, {
      startY: 35,
      head: [['Partner Bank / Institution', 'Active Pipeline', 'Expiring <=7 Days', 'Expiring 8-30 Days', 'Expired Mandates', 'Settled Accounts', 'Total Cases']],
      body: summaryTableRows,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5,
        halign: 'center',
      },
      columnStyles: {
        0: { halign: 'left', fontStyle: 'bold', cellWidth: 70 },
        1: { halign: 'center' },
        2: { halign: 'center', textColor: [217, 119, 6] },   // Amber
        3: { halign: 'center', textColor: [37, 99, 235] },   // Blue
        4: { halign: 'center', textColor: [225, 29, 72] },   // Rose
        5: { halign: 'center', textColor: [16, 185, 129] },  // Emerald
        6: { halign: 'center', fontStyle: 'bold' },
      },
      styles: {
        fontSize: 8,
        cellPadding: 2.5,
      },
      didParseCell: (data) => {
        // Style total row
        if (data.row.index === summaryTableRows.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [241, 245, 249];
        }
      }
    });

    // Section 2: Filtered Detailed Cases List
    const lastY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 10 : 90;

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`2. Filtered Case Allocation Records (${filteredCases.length} Cases)`, 14, lastY);

    const caseTableRows = filteredCases.slice(0, 150).map(c => {
      const cat = getExpiryCategory(c);
      const catLabel = 
        cat === 'expiring7' ? '<=7 Days' :
        cat === 'expiring30' ? '8-30 Days' :
        cat === 'expired' ? 'EXPIRED' :
        cat === 'settled' ? 'Settled' : 'Active';

      return [
        c.file_number,
        c.customer_name.substring(0, 20),
        c.account_number || 'N/A',
        c.bank?.name?.split(' ')[0] || '',
        c.agent_name ? c.agent_name.substring(0, 16) : 'Unassigned',
        formatDate(c.allocation_date) || '-',
        formatDate(c.expiry_date) || '-',
        catLabel,
        (Number(c.outstanding_amount) || 0).toLocaleString('en-US'),
        (c.legal_status || 'Normal').substring(0, 15)
      ];
    });

    autoTable(doc, {
      startY: lastY + 4,
      head: [['File No', 'Customer Name', 'Account No', 'Bank', 'Agent', 'Alloc Date', 'Expiry Date', 'Bucket', 'Outstanding', 'Status']],
      body: caseTableRows,
      theme: 'striped',
      headStyles: {
        fillColor: [51, 65, 85],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5,
      },
      styles: {
        fontSize: 7,
        cellPadding: 2,
      },
      columnStyles: {
        0: { fontStyle: 'bold' },
        7: { fontStyle: 'bold' },
        8: { halign: 'right', fontStyle: 'bold' },
      }
    });

    // Page Numbering Footer
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text(`RecoveryPro Audit Report • Confidential & Proprietary • Page ${i} of ${totalPages}`, 14, 203);
    }

    doc.save(`Portfolio_Expiry_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Page Header with Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <CalendarClock className="w-6 h-6 text-blue-500 flex-shrink-0" />
            <span>{t('expiry.title', 'Portfolio Expiry Matrix & Allocation Tracker')}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t('expiry.subtitle', 'Monitor contract expiration buckets, filter selectively, and export audit-ready Excel/PDF reports')}
          </p>
        </div>

        {/* Export & View Control Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View Toggle */}
          <button
            onClick={() => setViewMode(viewMode === 'matrix' ? 'cases' : 'matrix')}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border ${
              viewMode === 'cases' 
                ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/30' 
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
            }`}
          >
            {viewMode === 'matrix' ? <Eye className="w-3.5 h-3.5" /> : <Layers className="w-3.5 h-3.5" />}
            <span>{viewMode === 'matrix' ? 'View Cases Detail' : 'View Matrix Table'}</span>
          </button>


          {/* Export PDF Button */}
          <button
            onClick={handleExportPDF}
            className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-600/30 flex items-center gap-1.5 transition-all"
            title="Generate and download printable PDF report"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Export PDF (.pdf)</span>
          </button>

          {/* Print Button */}
          <button
            onClick={() => window.print()}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-all"
            title="Print report"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Selective Filter Control Bar */}
      <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
            <Filter className="w-4 h-4 text-blue-500" />
            <span>Selective Filter & Scope:</span>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">
            Showing <b>{filteredCases.length}</b> cases across <b>{filteredMatrix.length}</b> banks
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {/* Select Bank */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
              🏦 Partner Bank
            </label>
            <select
              value={selectedBankId}
              onChange={(e) => setSelectedBankId(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              <option value="all">All Partner Banks</option>
              {banks.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          {/* Select Expiry Bucket */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
              ⏱️ Expiration Bucket
            </label>
            <select
              value={selectedBucket}
              onChange={(e) => setSelectedBucket(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-purple-500/40"
            >
              <option value="all">All Expiry Categories</option>
              <option value="expiring7">Expiring in ≤ 7 Days</option>
              <option value="expiring30">Expiring in 8-30 Days</option>
              <option value="expired">Expired Mandates</option>
              <option value="active">Active Pipeline</option>
              <option value="settled">Settled Accounts</option>
            </select>
          </div>

          {/* Select Field Agent */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
              👮 Assigned Field Agent
            </label>
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            >
              <option value="all">All Field Agents ({cases.length})</option>
              {unassignedCount > 0 && (
                <option value="unassigned">⚠️ Unallocated / Unassigned ({unassignedCount})</option>
              )}
              {allAgents.map(([name, count]) => (
                <option key={name} value={name}>{name} ({count} cases)</option>
              ))}
            </select>
          </div>

          {/* Search Query */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
              🔍 Search Cases / Accounts
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search file, customer, account..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
          </div>
        </div>
      </div>

      {/* MATRIX TABLE VIEW */}
      {viewMode === 'matrix' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4 w-10">
                    <button 
                      onClick={toggleSelectAll}
                      className="text-slate-400 hover:text-blue-500 transition-all"
                      title={selectedBanks.size === banks.length ? "Deselect All" : "Select All for Export"}
                    >
                      {selectedBanks.size === banks.length ? (
                        <CheckSquare className="w-4 h-4 text-blue-500" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-4">{t('cases.bank_product', 'Partner Bank')}</th>
                  <th className="py-3 px-4 text-center">{t('expiry.active', 'Active Pipeline')}</th>
                  <th className="py-3 px-4 text-center text-amber-500">{t('expiry.expiring_7', 'Expiring ≤7 Days')}</th>
                  <th className="py-3 px-4 text-center text-blue-500">{t('expiry.expiring_30', 'Expiring 8-30 Days')}</th>
                  <th className="py-3 px-4 text-center text-rose-500">{t('expiry.expired', 'Expired Mandates')}</th>
                  <th className="py-3 px-4 text-center text-emerald-500">{t('status.settled', 'Settled Accounts')}</th>
                  <th className="py-3 px-4 text-right">{t('dash.total_allocated', 'Total Cases')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredMatrix.map((row) => {
                  const isChecked = selectedBanks.has(row.bankId);
                  return (
                    <tr 
                      key={row.bankId} 
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-all ${!isChecked ? 'opacity-40' : ''}`}
                    >
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => toggleSelectBank(row.bankId)}
                          className="text-slate-400 hover:text-blue-500"
                        >
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-blue-500" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-blue-500/70" />
                        <span>{row.bankName}</span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-slate-800 dark:text-slate-200">
                        {row.active}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => {
                            setSelectedBankId(String(row.bankId));
                            setSelectedBucket('expiring7');
                            setViewMode('cases');
                          }}
                          className="inline-flex px-2.5 py-0.5 rounded-full font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500 hover:text-white transition-all cursor-pointer"
                          title="Click to view cases expiring within 7 days"
                        >
                          {row.expiring7}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => {
                            setSelectedBankId(String(row.bankId));
                            setSelectedBucket('expiring30');
                            setViewMode('cases');
                          }}
                          className="inline-flex px-2.5 py-0.5 rounded-full font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white transition-all cursor-pointer"
                          title="Click to view cases expiring in 8-30 days"
                        >
                          {row.expiring30}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => {
                            setSelectedBankId(String(row.bankId));
                            setSelectedBucket('expired');
                            setViewMode('cases');
                          }}
                          className="inline-flex px-2.5 py-0.5 rounded-full font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white transition-all cursor-pointer"
                          title="Click to view expired mandate cases"
                        >
                          {row.expired}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => {
                            setSelectedBankId(String(row.bankId));
                            setSelectedBucket('settled');
                            setViewMode('cases');
                          }}
                          className="inline-flex px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600 hover:text-white transition-all cursor-pointer"
                          title="Click to view settled cases"
                        >
                          {row.settled}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-right font-extrabold text-slate-900 dark:text-white">
                        {row.total}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Matrix Totals Row */}
              <tfoot className="bg-slate-100/70 dark:bg-slate-950 border-t-2 border-slate-200 dark:border-slate-800 font-extrabold text-xs">
                <tr>
                  <td className="py-3 px-4"></td>
                  <td className="py-3 px-4 text-slate-900 dark:text-white uppercase tracking-wider">
                    Total Portfolio
                  </td>
                  <td className="py-3 px-4 text-center text-slate-900 dark:text-white">
                    {totals.active}
                  </td>
                  <td className="py-3 px-4 text-center text-amber-600 dark:text-amber-400">
                    {totals.expiring7}
                  </td>
                  <td className="py-3 px-4 text-center text-blue-600 dark:text-blue-400">
                    {totals.expiring30}
                  </td>
                  <td className="py-3 px-4 text-center text-rose-600 dark:text-rose-400">
                    {totals.expired}
                  </td>
                  <td className="py-3 px-4 text-center text-emerald-600 dark:text-emerald-400">
                    {totals.settled}
                  </td>
                  <td className="py-3 px-4 text-right text-slate-900 dark:text-white text-sm">
                    {totals.total}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* DETAILED CASES LIST VIEW */}
      {viewMode === 'cases' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm space-y-3">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" />
              <h3 className="font-bold text-xs text-slate-900 dark:text-white">
                Detailed Case Allocation Records ({filteredCases.length})
              </h3>
            </div>
            <button
              onClick={() => {
                setSelectedBankId('all');
                setSelectedBucket('all');
                setSearchQuery('');
              }}
              className="text-[11px] text-blue-500 font-bold hover:underline"
            >
              Reset Filters
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">File / Account</th>
                  <th className="py-3 px-4">Customer Details</th>
                  <th className="py-3 px-4">Bank & Product</th>
                  <th className="py-3 px-4">Assigned Agent</th>
                  <th className="py-3 px-4">Allocation & Expiry</th>
                  <th className="py-3 px-4 text-center">Expiry Bucket</th>
                  <th className="py-3 px-4 text-right">Outstanding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredCases.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 font-medium">
                      No recovery cases match the selected filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredCases.map(c => {
                    const cat = getExpiryCategory(c);
                    return (
                      <tr key={c.id || c.file_number} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                          <div>{c.file_number}</div>
                          {c.account_number && (
                            <div className="text-[10px] font-mono text-slate-400">{c.account_number}</div>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900 dark:text-white">{c.customer_name}</div>
                          {c.customer_phone && (
                            <div className="text-[10px] text-slate-400">{c.customer_phone}</div>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-800 dark:text-slate-200">{c.bank?.name || 'Bank'}</div>
                          <div className="text-[10px] text-slate-400">{c.product?.name || 'Portfolio'}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          {c.agent_name && c.agent_name.toLowerCase() !== 'unassigned' ? (
                            <button
                              onClick={() => setSelectedAgent(c.agent_name)}
                              className="font-bold text-slate-800 dark:text-slate-200 hover:text-blue-500 hover:underline flex items-center gap-1 text-xs"
                              title={`Filter all cases for ${c.agent_name}`}
                            >
                              <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                              <span>{c.agent_name}</span>
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                              <AlertTriangle className="w-3 h-3" />
                              <span>Unallocated</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-[11px]">
                          <div><span className="text-slate-400">Alloc:</span> {c.allocation_date || 'N/A'}</div>
                          <div><span className="text-slate-400">Exp:</span> <b className="text-slate-700 dark:text-slate-300">{c.expiry_date || 'N/A'}</b></div>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {cat === 'expiring7' && (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                              ≤ 7 Days
                            </span>
                          )}
                          {cat === 'expiring30' && (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                              8-30 Days
                            </span>
                          )}
                          {cat === 'expired' && (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                              EXPIRED
                            </span>
                          )}
                          {cat === 'settled' && (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                              SETTLED
                            </span>
                          )}
                          {cat === 'active' && (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                              ACTIVE
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right font-extrabold text-slate-900 dark:text-white font-mono">
                          ৳{(Number(c.outstanding_amount) || 0).toLocaleString('en-US')}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};