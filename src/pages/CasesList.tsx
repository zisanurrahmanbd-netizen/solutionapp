import React, { useState, useMemo, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { usePermissions } from "../context/PermissionsContext";
import { useLanguage } from "../context/LanguageContext";
import { dataService } from "../services/dataService";
import { StatusBadge } from "../components/StatusBadge";
import { CaseFile, CaseStatus } from "../types";
import { 
  Search, 
  Download, 
  FileText,
  Phone, 
  MapPin, 
  CheckCircle2, 
  Trash2, 
  CheckSquare, 
  Square, 
  AlertTriangle,
  UserCheck,
  UserX,
  Calendar,
  Filter,
  Briefcase,
  FileSpreadsheet
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { BulkMessageModal } from "../components/BulkMessageModal";
import { BulkRecipient } from "../services/messaging";
import { formatDate } from "../services/dateFormat";


interface FilterCache {
  bankFilter: string;
  statusFilter: string;
  fileTypeFilter: string;
  agentFilter: string;
  collectorFilter: string;
  lapFilter: string;
  dateFilter: string;
  customDateFrom: string;
  customDateTo: string;
  localSearch: string;
}

// Module-level persistent cache: keeps filter state when opening/closing cases
let cachedFilters: FilterCache = {
  bankFilter: "all",
  statusFilter: "all",
  fileTypeFilter: "all",
  agentFilter: "all",
  collectorFilter: "all",
  lapFilter: "all",
  dateFilter: "all",
  customDateFrom: "",
  customDateTo: "",
  localSearch: "",
};

interface CasesListProps {
  onSelectCase: (caseId: number) => void;
  searchQuery?: string;
}

export const CasesList: React.FC<CasesListProps> = ({ onSelectCase, searchQuery = "" }) => {
  const { user, users } = useAuth();
  const { can } = usePermissions();
  const { t } = useLanguage();
  const [bankFilter, setBankFilter] = useState<string>(cachedFilters.bankFilter);
  const [statusFilter, setStatusFilter] = useState<string>(cachedFilters.statusFilter);
  const [fileTypeFilter, setFileTypeFilter] = useState<string>(cachedFilters.fileTypeFilter);
  const [agentFilter, setAgentFilter] = useState<string>(cachedFilters.agentFilter);
  const [collectorFilter, setCollectorFilter] = useState<string>(cachedFilters.collectorFilter);
  const [lapFilter, setLapFilter] = useState<string>(cachedFilters.lapFilter);
  const [dateFilter, setDateFilter] = useState<string>(cachedFilters.dateFilter);
  const [customDateFrom, setCustomDateFrom] = useState<string>(cachedFilters.customDateFrom);
  const [customDateTo, setCustomDateTo] = useState<string>(cachedFilters.customDateTo);
  const [localSearch, setLocalSearch] = useState<string>(cachedFilters.localSearch);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showBulkMsg, setShowBulkMsg] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  // Keep module cache in sync so filters are never lost when navigating to Case Details and back
  useEffect(() => {
    cachedFilters = {
      bankFilter,
      statusFilter,
      fileTypeFilter,
      agentFilter,
      collectorFilter,
      lapFilter,
      dateFilter,
      customDateFrom,
      customDateTo,
      localSearch,
    };
  }, [bankFilter, statusFilter, fileTypeFilter, agentFilter, collectorFilter, lapFilter, dateFilter, customDateFrom, customDateTo, localSearch]);

  useEffect(() => {
    const unsub = dataService.subscribe(() => {
      setDataVersion(v => v + 1);
    });
    return unsub;
  }, []);

  const allCases = useMemo(() => user ? dataService.getCases(user) : [], [user, dataVersion]);

  const getLap = (c: CaseFile) => String(c.extra_attributes?.LAP_STATUS || '').trim();

  type FilterKey = 'bank' | 'type' | 'status' | 'agent' | 'collector' | 'lap' | 'date' | 'search';

  // Central filter predicate. `skip` excludes one filter so each dropdown can
  // show CASCADING options: e.g. the File Type list only contains types that
  // actually exist under the currently selected bank (and vice-versa).
  const matchCase = (c: CaseFile, skip?: FilterKey): boolean => {
    const q = (searchQuery || localSearch).toLowerCase().trim();

    if (skip !== 'bank' && bankFilter !== 'all') {
      const caseBankName = (c.bank_name?.trim() || c.bank?.name?.trim() || String(c.extra_attributes?.BANK_NAME || '').trim()).toLowerCase();
      if (caseBankName !== bankFilter.trim().toLowerCase()) return false;
    }

    if (skip !== 'type' && fileTypeFilter !== 'all') {
      const ft = String(c.extra_attributes?.FILE_TYPE || c.extra_attributes?.file_type || c.product?.name || '').trim().toLowerCase();
      if (ft !== fileTypeFilter.trim().toLowerCase()) return false;
    }

    if (skip !== 'status' && statusFilter !== 'all') {
      const rawStatus = String(c.extra_attributes?.FILE_STATUS || c.status || '').trim().toLowerCase();
      if (rawStatus !== statusFilter.trim().toLowerCase()) return false;
    }

    if (skip !== 'agent' && agentFilter !== 'all') {
      if (agentFilter === 'unassigned') {
        const isUnassigned = !c.assigned_agent_id && (!c.agent_name || c.agent_name.trim() === '' || c.agent_name.toLowerCase() === 'unassigned');
        if (!isUnassigned) return false;
      } else if (!c.agent_name || c.agent_name.trim().toLowerCase() !== agentFilter.trim().toLowerCase()) return false;
    }

    if (skip !== 'collector' && collectorFilter !== 'all') {
      if (!c.collector_name || c.collector_name.trim().toLowerCase() !== collectorFilter.trim().toLowerCase()) return false;
    }

    if (skip !== 'lap' && lapFilter !== 'all') {
      if (lapFilter === 'none') {
        if (getLap(c)) return false;
      } else if (getLap(c).toLowerCase() !== lapFilter.toLowerCase()) return false;
    }

    if (skip !== 'date' && dateFilter !== 'all' && c.allocation_date) {
      const alloc = new Date(c.allocation_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (dateFilter === 'today') {
        const allocDay = new Date(alloc);
        allocDay.setHours(0, 0, 0, 0);
        if (allocDay.getTime() !== today.getTime()) return false;
      } else if (dateFilter === '7days') {
        if (alloc < new Date(today.getTime() - 7 * 86400000)) return false;
      } else if (dateFilter === '30days') {
        if (alloc < new Date(today.getTime() - 30 * 86400000)) return false;
      } else if (dateFilter === 'custom') {
        if (customDateFrom && c.allocation_date < customDateFrom) return false;
        if (customDateTo && c.allocation_date > customDateTo) return false;
      }
    }

    if (skip !== 'search' && q) {
      const matchesFile = c.file_number.toLowerCase().includes(q);
      const matchesCust = c.customer_name.toLowerCase().includes(q);
      const matchesPhone = (c.customer_phone || '').includes(q);
      const matchesAcc = (c.account_number || '').toLowerCase().includes(q);
      const matchesAgent = (c.agent_name || '').toLowerCase().includes(q);
      const matchesCollector = (c.collector_name || '').toLowerCase().includes(q);
      const matchesType = String(c.extra_attributes?.FILE_TYPE || c.product?.name || '').toLowerCase().includes(q);
      if (!matchesFile && !matchesCust && !matchesPhone && !matchesAcc && !matchesAgent && !matchesCollector && !matchesType) return false;
    }

    return true;
  };

  const filterDeps = [allCases, bankFilter, statusFilter, fileTypeFilter, agentFilter, collectorFilter, lapFilter, dateFilter, customDateFrom, customDateTo, searchQuery, localSearch] as const;

  // Count values of one field among the cases passing `pred`
  const countBy = (pred: (c: CaseFile) => boolean, get: (c: CaseFile) => string | undefined): [string, number][] => {
    const map = new Map<string, number>();
    allCases.forEach(c => {
      if (!pred(c)) return;
      const clean = get(c)?.trim();
      if (clean && clean.toUpperCase() !== 'N/A') {
        map.set(clean, (map.get(clean) || 0) + 1);
      }
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  };

  const getBank = (c: CaseFile) => c.bank_name?.trim() || c.bank?.name?.trim() || String(c.extra_attributes?.BANK_NAME || '').trim() || undefined;
  const getType = (c: CaseFile) => String(c.extra_attributes?.FILE_TYPE || c.extra_attributes?.file_type || c.product?.name || '').trim() || undefined;
  const getStatus = (c: CaseFile) => String(c.extra_attributes?.FILE_STATUS || c.status || '').trim() || undefined;
  const getAgentName = (c: CaseFile) => c.agent_name?.trim() || undefined;
  const getCollectorName = (c: CaseFile) => c.collector_name?.trim() || undefined;

  // ── Cascaded dropdown options: each list respects every OTHER filter ──
  const allBanks = useMemo(
    () => countBy(c => matchCase(c, 'bank'), getBank),
    filterDeps
  );
  const allFileTypes = useMemo(() => countBy(c => matchCase(c, 'type'), getType), filterDeps);
  const allStatuses = useMemo(() => countBy(c => matchCase(c, 'status'), getStatus), filterDeps);
  const allAgents = useMemo(
    () => countBy(c => matchCase(c, 'agent'), getAgentName).filter(([n]) => n.toLowerCase() !== 'unassigned'),
    filterDeps
  );
  const allLapStatuses = useMemo(() => countBy(c => matchCase(c, 'lap'), c => getLap(c) || undefined), filterDeps);

  // Extract count of unallocated cases
  const unassignedCount = useMemo(() => {
    return allCases.filter(c => {
      const hasId = c.assigned_agent_id && c.assigned_agent_id > 0;
      const hasName = c.agent_name && c.agent_name.trim() !== '' && c.agent_name.toLowerCase() !== 'unassigned';
      return !hasId && !hasName;
    }).length;
  }, [allCases]);

  // Extract all unique collectors with case counts
  const allCollectors = useMemo(
    () => countBy(c => matchCase(c, 'collector'), getCollectorName).filter(([n]) => {
      const l = n.toLowerCase();
      return l !== 'unassigned' && l !== 'n/a';
    }),
    filterDeps
  );

  const filteredCases = useMemo(() => allCases.filter(c => matchCase(c)), filterDeps);

  // Auto-reset: if a selected value no longer exists under the other filters,
  // clear it so the list never dead-ends empty.
  useEffect(() => {
    if (bankFilter !== 'all' && !allBanks.some(([n]) => n.toLowerCase() === bankFilter.trim().toLowerCase())) setBankFilter('all');
  }, [allBanks, bankFilter]);
  useEffect(() => {
    if (fileTypeFilter !== 'all' && !allFileTypes.some(([n]) => n.toLowerCase() === fileTypeFilter.trim().toLowerCase())) setFileTypeFilter('all');
  }, [allFileTypes, fileTypeFilter]);
  useEffect(() => {
    if (statusFilter !== 'all' && !allStatuses.some(([n]) => n.toLowerCase() === statusFilter.trim().toLowerCase())) setStatusFilter('all');
  }, [allStatuses, statusFilter]);
  useEffect(() => {
    if (agentFilter !== 'all' && agentFilter !== 'unassigned' && !allAgents.some(([n]) => n.toLowerCase() === agentFilter.trim().toLowerCase())) setAgentFilter('all');
  }, [allAgents, agentFilter]);
  useEffect(() => {
    if (collectorFilter !== 'all' && !allCollectors.some(([n]) => n.toLowerCase() === collectorFilter.trim().toLowerCase())) setCollectorFilter('all');
  }, [allCollectors, collectorFilter]);
  useEffect(() => {
    if (lapFilter !== 'all' && lapFilter !== 'none' && !allLapStatuses.some(([n]) => n.toLowerCase() === lapFilter.toLowerCase())) setLapFilter('all');
  }, [allLapStatuses, lapFilter]);

  const allFilteredIds = filteredCases.map(c => c.id);
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selectedIds.has(id));
  const someSelected = allFilteredIds.some(id => selectedIds.has(id));

  // ── Pagination: render 50 rows per page instead of all ~1,500+ ──────
  // Rendering every row built 15,000+ DOM nodes per page view — the cause
  // of the 6-8s delay opening Bank & MNC Files.
  const totalPages = Math.max(1, Math.ceil(filteredCases.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedCases = useMemo(
    () => filteredCases.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filteredCases, safePage]
  );
  const gotoPage = (p: number) => {
    setPage(Math.min(Math.max(1, p), totalPages));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        allFilteredIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        allFilteredIds.forEach(id => next.add(id));
        return next;
      });
    }
  };

  const toggleOne = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = () => {
    dataService.deleteCases(Array.from(selectedIds));
    setSelectedIds(new Set());
    setShowDeleteConfirm(false);
    setLocalSearch(prev => prev + "");
  };

  // ── Export helpers ──────────────────────────────────────────────
  const getCasesToExport = () =>
    selectedIds.size > 0 ? filteredCases.filter(c => selectedIds.has(c.id)) : filteredCases;

  // PDF export — landscape, bank-grade report with visited files highlighted

  // PDF export — landscape, bank-grade report with visited files highlighted
  const handleExportPDF = () => {
    const casesToExport = getCasesToExport();
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const today = new Date().toLocaleDateString("en-BD", { day: "2-digit", month: "short", year: "numeric" });

    // Header
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageW, 18, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Bank Recovery — Case Files Report", 10, 11);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${today}  |  Total Files: ${casesToExport.length}  |  Selected Filters Applied`, pageW - 10, 11, { align: "right" });

    // Section 1: Case Summary Table
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("CASE SUMMARY", 10, 24);

    autoTable(doc, {
      startY: 27,
      head: [["File No", "Customer", "Bank / Product", "Collector", "Agent", "Outstanding\n(BDT)", "Status", "Visit", "Alloc Date", "Expiry Date"]],
      body: casesToExport.map(c => [
        c.file_number,
        `${c.customer_name}\n${c.customer_phone || ""}`,
        `${c.bank?.name || ""}\n${c.product?.name || ""}`,
        c.collector_name || "—",
        c.agent_name || "Unassigned",
        c.outstanding_amount.toLocaleString(),
        c.status.replace(/_/g, " ").toUpperCase(),
        [
          c.present_address_visited ? "Pres ✓" : "Pres ✗",
          c.permanent_address_visited ? "Perm ✓" : "Perm ✗"
        ].join(" | "),
        formatDate(c.allocation_date) || "—",
        formatDate(c.expiry_date) || "—",
      ]),
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 36 },
        2: { cellWidth: 36 },
        3: { cellWidth: 28 },
        4: { cellWidth: 28 },
        5: { cellWidth: 22, halign: "right" },
        6: { cellWidth: 22 },
        7: { cellWidth: 22 },
        8: { cellWidth: 24 },
        9: { cellWidth: 24 },
      },
      willDrawCell: (data) => {
        // Highlight visited rows in light green
        if (data.section === "body") {
          const cRow = casesToExport[data.row.index];
          if (cRow && (cRow.present_address_visited || cRow.permanent_address_visited)) {
            doc.setFillColor(236, 253, 245);
          }
        }
      },
    });

    // Section 2: Visit Details (GPS + PTP + Remarks)
    const visitedCases = casesToExport.filter(c => c.present_address_visited || c.permanent_address_visited);
    if (visitedCases.length > 0) {
      doc.addPage("a4", "landscape");
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageW, 18, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("Bank Recovery — Visit Details (GPS · PTP · Remarks)", 10, 11);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(`Generated: ${today}`, pageW - 10, 11, { align: "right" });

      const visitPdfRows: string[][] = [];
      visitedCases.forEach(c => {
        const checkIns = dataService.getCheckInsByCase(c.id);
        const remarks = dataService.getRemarksByCase(c.id);

        if (checkIns.length > 0) {
          checkIns.forEach(ci => {
            const closeRemark = remarks.find(r => {
              const diff = Math.abs(new Date(r.created_at).getTime() - new Date(ci.visited_at).getTime());
              return diff < 24 * 3600000;
            });
            const lat = ci.latitude ?? "";
            const lng = ci.longitude ?? "";
            const coords = (lat !== "" && lng !== "") ? `${lat}, ${lng}` : "—";
            visitPdfRows.push([
              c.file_number,
              c.customer_name,
              c.bank?.name || "",
              c.agent_name || "—",
              ci.visited_at ? new Date(ci.visited_at).toLocaleString() : "—",
              ci.address_type || "—",
              coords,
              ci.notes || "—",
              closeRemark?.promised_amount ? `BDT ${Number(closeRemark.promised_amount).toLocaleString()}` : "—",
              closeRemark?.promise_date || "—",
              closeRemark?.remarks || "—",
            ]);
          });
        } else {
          // No check-in but has remarks — show PTP info
          remarks.forEach(r => {
            visitPdfRows.push([
              c.file_number,
              c.customer_name,
              c.bank?.name || "",
              c.agent_name || "—",
              "—",
              "—",
              "—",
              "—",
              r.promised_amount ? `BDT ${Number(r.promised_amount).toLocaleString()}` : "—",
              r.promise_date || "—",
              r.remarks || "—",
            ]);
          });
        }
      });

      doc.setTextColor(15, 23, 42);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("VISIT DETAILS — GPS COORDINATES, PTP & REMARKS", 10, 24);

      autoTable(doc, {
        startY: 27,
        head: [["File No", "Customer", "Bank", "Agent", "Visit Date/Time", "Addr Type", "GPS Coordinates", "Visit Note", "PTP Amount", "PTP Date", "Remarks"]],
        body: visitPdfRows,
        styles: { fontSize: 6.5, cellPadding: 2 },
        headStyles: { fillColor: [5, 150, 105], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
        columnStyles: {
          0: { cellWidth: 20 },
          1: { cellWidth: 30 },
          2: { cellWidth: 24 },
          3: { cellWidth: 24 },
          4: { cellWidth: 30 },
          5: { cellWidth: 18 },
          6: { cellWidth: 32 },
          7: { cellWidth: 30 },
          8: { cellWidth: 22 },
          9: { cellWidth: 20 },
          10: { cellWidth: 36 },
        },
      });
    }

    // Page numbering
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text(`Page ${i} / ${totalPages}  |  Bank Recovery System — Confidential`, pageW / 2, doc.internal.pageSize.getHeight() - 5, { align: "center" });
    }

    doc.save(`Recovery_Cases_${new Date().toISOString().split("T")[0]}.pdf`);
  };

  // ── Excel Export (CSV format, opens natively in Excel) ──────────────
  const handleExportExcel = () => {
    const targetCases = selectedIds.size > 0
      ? filteredCases.filter(c => selectedIds.has(c.id))
      : filteredCases;

    const headers = [
      "FILE_NO", "BANK_NAME", "FILE_TYPE", "ACCOUNT_NUMBER", "CASA",
      "CUSTOMER_NAME", "CUSTOMER_PHONE", "REF_PHONE",
      "PRESENT_ADDRESS", "PERMANENT_ADDRESS",
      "EMP_OFFICE_NAME", "POSITION", "EMP_OFFICE_ADDRESS",
      "OUTSTANDING_AMOUNT", "OVERDUE_AMOUNT", "DPD",
      "FILE_STATUS", "AGENT_NAME", "COLLECTOR_NAME",
      "BRANCH_NAME", "AREA", "ALLOCATION_DATE", "EXPIRY_DATE", "LAP_STATUS",
      "VISITED_PRESENT", "VISITED_PERMANENT",
      "LAST_PTP_AMOUNT", "LAST_PTP_DATE", "LAST_REMARK"
    ];

    const rows = targetCases.map(c => {
      const remarks = dataService.getRemarksByCase(c.id);
      const lastRemark = remarks[0];
      return [
        c.file_number,
        c.bank_name || c.bank?.name || String(c.extra_attributes?.BANK_NAME || ''),
        String(c.extra_attributes?.FILE_TYPE || c.product?.name || ''),
        c.account_number || '',
        String(c.extra_attributes?.CASA || ''),
        c.customer_name,
        c.customer_phone || '',
        c.customer_secondary_phone || String(c.extra_attributes?.REF_PHONE || ''),
        c.customer_address_present || '',
        c.customer_address_permanent || '',
        String(c.extra_attributes?.EMP_OFFICE_NAME || ''),
        String(c.extra_attributes?.POSITION || ''),
        String(c.extra_attributes?.EMP_OFFICE_ADDRESS || ''),
        c.outstanding_amount || 0,
        c.overdue_amount || 0,
        String(c.extra_attributes?.DPD || ''),
        c.status || String(c.extra_attributes?.FILE_STATUS || ''),
        c.agent_name || '',
        c.collector_name || '',
        String(c.extra_attributes?.BRANCH_NAME || ''),
        String(c.extra_attributes?.AREA || ''),
        formatDate(c.allocation_date),
        formatDate(c.expiry_date),
        String(c.extra_attributes?.LAP_STATUS || ''),
        c.present_address_visited ? 'Yes' : 'No',
        c.permanent_address_visited ? 'Yes' : 'No',
        lastRemark?.promised_amount || '',
        lastRemark?.promise_date || '',
        lastRemark?.remarks || '',
      ].map(v => v === null || v === undefined ? '' : (typeof v === 'number' ? v : String(v)));
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = headers.map(h => ({ wch: Math.max(10, Math.min(34, String(h).length + 6)) }));
    XLSX.utils.book_append_sheet(wb, ws, 'Bank_MNC_Files');
    XLSX.writeFile(wb, `Bank_MNC_Files_${new Date().toISOString().split("T")[0]}.xlsx`);
  };



  return (
    <div className="space-y-6">
      {/* Header & Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {t("cases.title", "Bank & MNC Files")}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Showing {filteredCases.length} of {allCases.length} {t("cases.subtitle", "assigned recovery files")}
            {selectedIds.size > 0 && (
              <span className="ml-2 px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 font-bold text-[11px]">
                ✓ {selectedIds.size} files selected
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Reset Filters Button */}
          {(bankFilter !== "all" || statusFilter !== "all" || fileTypeFilter !== "all" || agentFilter !== "all" || collectorFilter !== "all" || lapFilter !== "all" || dateFilter !== "all" || localSearch) && (
            <button
              onClick={() => {
                setBankFilter("all");
                setStatusFilter("all");
                setFileTypeFilter("all");
                setAgentFilter("all");
                setCollectorFilter("all");
                setLapFilter("all");
                setDateFilter("all");
                setCustomDateFrom("");
                setCustomDateTo("");
                setLocalSearch("");
                cachedFilters = {
                  bankFilter: "all",
                  statusFilter: "all",
                  fileTypeFilter: "all",
                  agentFilter: "all",
                  collectorFilter: "all",
                  lapFilter: "all",
                  dateFilter: "all",
                  customDateFrom: "",
                  customDateTo: "",
                  localSearch: "",
                };
              }}
              className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 transition-all"
            >
              Reset Filters
            </button>
          )}

          {/* Bulk Delete Button */}
          {selectedIds.size > 0 && can("manage_team_users") && (
            <button 
              onClick={() => setShowDeleteConfirm(true)}
              className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-600/30 flex items-center gap-2 transition-all"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Selected ({selectedIds.size})</span>
            </button>
          )}

          {can("send_bulk_messages") && (
            <button 
              onClick={() => setShowBulkMsg(true)}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-md shadow-emerald-600/30"
              title="Send one WhatsApp message or email to all selected customers at once"
            >
              <Phone className="w-4 h-4" />
              <span>{selectedIds.size > 0 ? `Message Selected (${selectedIds.size})` : "Message Customers"}</span>
            </button>
          )}

          {can("export_excel") && (
            <button 
              onClick={handleExportExcel}
              className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-md shadow-emerald-700/30 border border-emerald-600/50"
              title="Export to Excel (.xlsx) — all columns including visit updates, PTP, and remarks"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
              <span>{selectedIds.size > 0 ? `Export Excel (${selectedIds.size})` : "Export Excel"}</span>
            </button>
          )}

          {can("export_excel") && (
            <button 
              onClick={handleExportPDF}
              className="px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-md shadow-slate-900/30 border border-slate-700/50 hover:bg-slate-800"
              title="Export to PDF — includes case summary, visit GPS coordinates, PTP amounts, PTP dates and field remarks"
            >
              <FileText className="w-4 h-4 text-rose-400" />
              <span>{selectedIds.size > 0 ? `Export PDF (${selectedIds.size})` : "Export PDF Report"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Comprehensive Selective Filter Bar */}
      <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-3 text-xs">
          {/* Search Query */}
          <div className="sm:col-span-2 md:col-span-1 xl:col-span-1 relative">
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
              🔍 Search Cases
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder={t("cases.search", "Search file, customer, account...")} 
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40" 
              />
            </div>
          </div>

          {/* Partner Bank */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
              🏦 Partner Bank
            </label>
            <select 
              value={bankFilter} 
              onChange={(e) => setBankFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              <option value="all">All Partner Banks ({allCases.length})</option>
              {allBanks.map(([name, count]) => (
                <option key={name} value={name}>{name} ({count})</option>
              ))}
            </select>
          </div>

          {/* File Type Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
              📁 File Type
            </label>
            <select 
              value={fileTypeFilter} 
              onChange={(e) => setFileTypeFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
            >
              <option value="all">All File Types ({allCases.length})</option>
              {allFileTypes.map(([type, count]) => (
                <option key={type} value={type}>{type} ({count})</option>
              ))}
            </select>
          </div>

          {/* File Status Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
              📌 File Status
            </label>
            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/40"
            >
              <option value="all">All File Statuses ({allCases.length})</option>
              {allStatuses.map(([status, count]) => (
                <option key={status} value={status}>{status} ({count})</option>
              ))}
            </select>
          </div>

          {/* Assigned Agent & Unallocated Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
              👮 Assigned Field Agent
            </label>
            <select 
              value={agentFilter} 
              onChange={(e) => setAgentFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            >
              <option value="all">All Field Agents ({allCases.length})</option>
              {unassignedCount > 0 && (
                <option value="unassigned">⚠️ Unallocated Files ({unassignedCount})</option>
              )}
              {allAgents.map(([name, count]) => (
                <option key={name} value={name}>{name} ({count})</option>
              ))}
            </select>
          </div>

          {/* Bank Collector Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
              💼 Bank Collector
            </label>
            <select 
              value={collectorFilter} 
              onChange={(e) => setCollectorFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500/40"
            >
              <option value="all">All Bank Collectors</option>
              {allCollectors.map(([name, count]) => (
                <option key={name} value={name}>{name} ({count})</option>
              ))}
            </select>
          </div>

          {/* LAP Status Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
              🏷️ LAP Status
            </label>
            <select 
              value={lapFilter} 
              onChange={(e) => setLapFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500/40"
            >
              <option value="all">All LAP Statuses</option>
              <option value="none">No LAP Status (blank)</option>
              {allLapStatuses.map(([lap, count]) => (
                <option key={lap} value={lap}>{lap} ({count})</option>
              ))}
            </select>
          </div>

          {/* Allocation Date Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
              📅 Allocation Date
            </label>
            <select 
              value={dateFilter} 
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/40"
            >
              <option value="all">All Allocation Dates</option>
              <option value="today">Allocated Today</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="custom">Custom Date Range...</option>
            </select>
          </div>
        </div>

        {/* Custom Date Range Pickers if selected */}
        {dateFilter === "custom" && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
            <span className="font-bold text-slate-500 dark:text-slate-400">Date Range:</span>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-[11px]">From:</span>
              <input
                type="date"
                value={customDateFrom}
                onChange={(e) => setCustomDateFrom(e.target.value)}
                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 font-mono text-xs"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-[11px]">To:</span>
              <input
                type="date"
                value={customDateTo}
                onChange={(e) => setCustomDateTo(e.target.value)}
                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 font-mono text-xs"
              />
            </div>
          </div>
        )}
      </div>

      {/* Case Table with Checkboxes, Collector, Agent, and Dates */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto custom-scrollbar pb-2">
          <table className="w-full min-w-[1050px] text-left text-xs border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
              <tr>
                {/* Select All Checkbox Header */}
                {can("manage_team_users") && (
                  <th className="py-3 px-4 w-10">
                    <button 
                      onClick={toggleSelectAll} 
                      title={allSelected ? "Deselect All" : "Select All"}
                      className="flex items-center justify-center p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                    >
                      {allSelected ? (
                        <CheckSquare className="w-4 h-4 text-emerald-600" />
                      ) : someSelected ? (
                        <CheckSquare className="w-4 h-4 text-blue-500" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                  </th>
                )}
                <th className="py-3 px-4 whitespace-nowrap">File No / Account</th>
                <th className="py-3 px-4 whitespace-nowrap">Customer Details</th>
                <th className="py-3 px-4 whitespace-nowrap">Bank & Product</th>
                <th className="py-3 px-4 whitespace-nowrap">Bank Collector</th>
                <th className="py-3 px-4 whitespace-nowrap">Assigned Agent</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Outstanding</th>
                <th className="py-3 px-4 whitespace-nowrap">Address Visited</th>
                <th className="py-3 px-4 whitespace-nowrap">Status</th>
                <th className="py-3 px-4 whitespace-nowrap">Allocation & Expiry</th>
                <th className="py-3 px-4 text-right sticky right-0 bg-slate-50 dark:bg-slate-950 shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.1)] dark:shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.5)] z-20 whitespace-nowrap min-w-[110px]">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredCases.length === 0 && (
                <tr>
                  <td colSpan={can("manage_team_users") ? 10 : 9} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                      <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        <CheckCircle2 className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-500 dark:text-slate-400 text-sm">{t("cases.no_records", "No case files found")}</p>
                        <p className="text-xs text-slate-400 mt-1">{t("cases.no_records_hint", "Import cases via Excel or adjust your filters")}</p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
              {pagedCases.map(c => {
                const isSelected = selectedIds.has(c.id);
                const displayAgent = c.agent_name || c.agent?.name;
                const hasAccount = displayAgent && users.some(u => 
                  u.name.trim().toLowerCase() === displayAgent.trim().toLowerCase() ||
                  (u.employee_id && u.employee_id.trim().toLowerCase() === displayAgent.trim().toLowerCase())
                );

                return (
                  <tr 
                    key={c.id} 
                    className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group ${isSelected ? "bg-blue-50/70 dark:bg-blue-950/30" : ""}`}
                  >
                    {/* Row Selection Checkbox */}
                    {can("manage_team_users") && (
                      <td className="py-3.5 px-4">
                        <button 
                          onClick={() => toggleOne(c.id)} 
                          className="flex items-center justify-center p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300 dark:text-slate-600 hover:text-slate-500" />
                          )}
                        </button>
                      </td>
                    )}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 dark:text-white font-mono">{c.file_number}</div>
                      <div className="text-[11px] text-slate-500">{c.account_number || "N/A"}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 dark:text-white">{c.customer_name}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{c.customer_phone || "No phone"}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-800 dark:text-slate-200">{c.bank?.name || "Bank"}</div>
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-[10px]">
                          {c.extra_attributes?.FILE_TYPE || c.extra_attributes?.file_type || c.product?.name || "File"}
                        </span>
                        {c.extra_attributes?.CASA && (
                          <span className="text-[10px] text-slate-400 font-mono">CASA: {c.extra_attributes.CASA}</span>
                        )}
                      </div>
                    </td>

                    {/* Bank Collector Column */}
                    <td className="py-3.5 px-4">
                      {c.collector_name && c.collector_name.toLowerCase() !== 'unassigned' && c.collector_name.toLowerCase() !== 'n/a' ? (
                        <button
                          onClick={() => setCollectorFilter(c.collector_name!)}
                          className="font-bold text-slate-800 dark:text-slate-200 hover:text-purple-600 hover:underline flex items-center gap-1.5 text-xs text-left"
                          title={`Filter all cases for collector ${c.collector_name}`}
                        >
                          <Briefcase className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
                          <span>{c.collector_name}</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">No Collector</span>
                      )}
                    </td>

                    {/* Assigned Agent Column */}
                    <td className="py-3.5 px-4">
                      {displayAgent && displayAgent.toLowerCase() !== 'unassigned' ? (
                        <button
                          onClick={() => setAgentFilter(displayAgent)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all hover:ring-2 ${
                            hasAccount 
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:ring-emerald-500/30" 
                              : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 hover:ring-amber-500/30"
                          }`}
                          title={`Filter cases for agent ${displayAgent}`}
                        >
                          {hasAccount ? <UserCheck className="w-3 h-3 flex-shrink-0" /> : <UserX className="w-3 h-3 flex-shrink-0" />}
                          <span>{displayAgent}</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => setAgentFilter('unassigned')}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-all"
                          title="Click to filter all unallocated files"
                        >
                          <AlertTriangle className="w-3 h-3" />
                          <span>Unallocated</span>
                        </button>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="font-bold text-slate-900 dark:text-white font-mono">
                        BDT {c.outstanding_amount.toLocaleString()}
                      </div>
                      {c.overdue_amount > 0 && (
                        <div className="text-[10px] text-rose-500 font-semibold">
                          OD: BDT {c.overdue_amount.toLocaleString()}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          c.present_address_visited ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                        }`}>
                          <MapPin className="w-3 h-3" /> Pres
                        </span>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          c.permanent_address_visited ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                        }`}>
                          <MapPin className="w-3 h-3" /> Perm
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <StatusBadge status={c.status} />
                      {getLap(c) && (
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium truncate max-w-[130px]" title={getLap(c)}>
                          {getLap(c)}
                        </div>
                      )}
                    </td>

                    {/* Allocation & Expiry Dates */}
                    <td className="py-3.5 px-4 text-[11px]">
                      <div><span className="text-slate-400">Alloc:</span> <span className="font-mono text-slate-600 dark:text-slate-300">{formatDate(c.allocation_date) || 'N/A'}</span></div>
                      <div><span className="text-slate-400">Exp:</span> <b className="font-mono text-slate-800 dark:text-slate-200">{formatDate(c.expiry_date) || 'N/A'}</b></div>
                    </td>

                    {/* Sticky Action Column — always visible right on desktop & mobile scroll */}
                    <td className="py-3.5 px-4 text-right sticky right-0 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.1)] dark:shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.5)] z-10">
                      <button 
                        onClick={() => onSelectCase(c.id)}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/30 transition-all whitespace-nowrap active:scale-95"
                      >
                        Open Case
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination bar */}
        {totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 dark:border-slate-800">
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Showing <b className="text-slate-700 dark:text-slate-200">{(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filteredCases.length)}</b> of <b className="text-slate-700 dark:text-slate-200">{filteredCases.length}</b> files
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => gotoPage(safePage - 1)}
                disabled={safePage <= 1}
                className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ← Prev
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                .map((p, idx, arr) => (
                  <React.Fragment key={p}>
                    {idx > 0 && p - arr[idx - 1] > 1 && <span className="px-1 text-slate-400 text-xs">…</span>}
                    <button
                      onClick={() => gotoPage(p)}
                      className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
                        p === safePage
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                          : 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {p}
                    </button>
                  </React.Fragment>
                ))}
              <button
                onClick={() => gotoPage(safePage + 1)}
                disabled={safePage >= totalPages}
                className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showBulkMsg && (
        <BulkMessageModal
          isOpen={showBulkMsg}
          onClose={() => setShowBulkMsg(false)}
          kind="customer"
          recipients={(() => {
            const target = selectedIds.size > 0 ? filteredCases.filter(c => selectedIds.has(c.id)) : filteredCases;
            return target.map(c => ({
              key: c.id,
              name: c.customer_name,
              phone: c.customer_phone,
              email: (c as any).customer_email || (c.extra_attributes?.CUSTOMER_EMAIL ?? c.extra_attributes?.EMAIL) || '',
              vars: {
                file_no: c.file_number,
                bank: c.bank_name || c.bank?.name || String(c.extra_attributes?.BANK_NAME || ''),
                file_type: String(c.extra_attributes?.FILE_TYPE || c.product_name || c.product?.name || ''),
                amount: (c.outstanding_amount || 0).toLocaleString(),
                agent: c.agent_name || '',
              },
            }));
          })()}
        />
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-500" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">Confirm Bulk Delete</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  You are about to permanently delete <strong className="text-rose-500">{selectedIds.size} case file{selectedIds.size > 1 ? "s" : ""}</strong> from the system database. This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs"
              >
                Cancel
              </button>
              <button 
                onClick={handleBulkDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-rose-600/30"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete {selectedIds.size} Files</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};