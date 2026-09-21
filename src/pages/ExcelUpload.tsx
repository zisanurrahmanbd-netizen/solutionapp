import React, { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Database,
  Users,
  Trash2,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { dataService } from '../services/dataService';
import {
  mapRowToCaseData,
  mapRowToContactData,
  filterActiveCases,
} from '../services/rowMapping';
import { downloadCasesTemplate, downloadContactsTemplate } from '../services/exportService';
import { Download } from 'lucide-react';

interface Breakdown {
  rawRows: number;
  active: number;
  skippedExpired: number;
  duplicatesRemoved: number;
  droppedInvalid: number;
  contacts: number;
  fileName: string;
}

export const ExcelUploadPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null);
  const [pendingData, setPendingData] = useState<{
    cases: Record<string, any>[];
    contacts: Record<string, any>[];
  } | null>(null);

  const canUpload = isAdmin; // Only admins replace the whole file set

  const parseWorkbook = useCallback(async (file: File) => {
    setError(null);
    setSuccess(null);
    setBreakdown(null);
    setPendingData(null);
    setProcessing(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      const caseSheetName =
        wb.SheetNames.find(n => /case|file/i.test(n)) || wb.SheetNames[0];
      const contactSheetName = wb.SheetNames.find(n =>
        /contact|bank/i.test(n)
      );

      // ── Parse cases sheet (header row 1 → objects) ──
      const caseWs = wb.Sheets[caseSheetName];
      const rawCaseRows: Record<string, any>[] = caseWs
        ? XLSX.utils.sheet_to_json(caseWs, { defval: '' })
        : [];

      const mappedCases = rawCaseRows
        .map(mapRowToCaseData)
        .filter(Boolean) as Record<string, any>[];
      const droppedInvalid = Math.max(0, rawCaseRows.length - mappedCases.length);

      // ── Parse contacts sheet if present ──
      let contacts: Record<string, any>[] = [];
      if (contactSheetName) {
        const contactWs = wb.Sheets[contactSheetName];
        const rawContactRows: Record<string, any>[] = contactWs
          ? XLSX.utils.sheet_to_json(contactWs, { defval: '' })
          : [];
        contacts = rawContactRows
          .map(mapRowToContactData)
          .filter(Boolean) as Record<string, any>[];
      }

      // ── Active-only filter (same rules as the sheet sync) ──
      const result = filterActiveCases(mappedCases, rawCaseRows.length);
      // droppedInvalid computed above from actual mapped rows is more accurate
      result.droppedInvalid = droppedInvalid;

      setPendingData({ cases: result.active, contacts });
      setBreakdown({
        rawRows: rawCaseRows.length,
        active: result.active.length,
        skippedExpired: result.skippedExpired,
        duplicatesRemoved: result.duplicatesRemoved,
        droppedInvalid: result.droppedInvalid,
        contacts: contacts.length,
        fileName: file.name,
      });
    } catch (e: any) {
      setError(
        `Could not read the file: ${e?.message || e}. Make sure it's a valid .xlsx/.xls/.csv with headers in row 1.`
      );
    } finally {
      setProcessing(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) parseWorkbook(file);
    },
    [parseWorkbook]
  );

  const handleApply = async () => {
    if (!pendingData) return;
    setUploading(true);
    setError(null);
    try {
      await dataService.replaceAllCasesFromSheet(pendingData.cases);
      if (pendingData.contacts.length > 0) {
        await dataService.replaceAllContactsFromSheet(pendingData.contacts);
      }
      setSuccess(
        `✓ Uploaded ${pendingData.cases.length.toLocaleString()} active files${
          pendingData.contacts.length > 0
            ? ` and ${pendingData.contacts.length} contacts`
            : ''
        }. Every device updates automatically in a few seconds.`
      );
      setPendingData(null);
      setBreakdown(null);
    } catch (e: any) {
      setError(e?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setPendingData(null);
    setBreakdown(null);
    setError(null);
    setSuccess(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-zinc-900 dark:bg-white flex items-center justify-center">
          <UploadCloud className="w-5 h-5 text-white dark:text-black" />
        </div>
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Daily File Upload
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Upload today's Excel file — active files replace the database, expired ones are skipped automatically
          </p>
        </div>
      </div>

      {!canUpload && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-amber-700 dark:text-amber-400 text-sm">Admin only</p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              Only administrators can upload the daily file. Ask your admin to upload it — updates reach every device automatically.
            </p>
          </div>
        </div>
      )}

      {/* Download the official upload format */}
      {canUpload && (
        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <p className="text-xs font-extrabold text-zinc-900 dark:text-white">Official upload format</p>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              Download the template with the exact 39-column header (BANK_NAME … STATUS) or the Bank Contacts format — fill it and drop it above.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={downloadCasesTemplate}
              className="px-3.5 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-black text-xs font-bold flex items-center gap-1.5 hover:opacity-90 transition-all"
            >
              <Download className="w-3.5 h-3.5" /> Cases Format
            </button>
            <button
              onClick={downloadContactsTemplate}
              className="px-3.5 py-2 rounded-xl border-2 border-zinc-900 dark:border-white text-zinc-900 dark:text-white text-xs font-bold flex items-center gap-1.5 hover:bg-zinc-900 hover:text-white dark:hover:bg-white dark:hover:text-black transition-all"
            >
              <Download className="w-3.5 h-3.5" /> Contacts Format
            </button>
          </div>
        </div>
      )}

      {/* Drop zone */}
      {canUpload && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`p-10 rounded-3xl border-2 border-dashed cursor-pointer text-center transition-all ${
            dragOver
              ? 'border-zinc-900 dark:border-white bg-zinc-100 dark:bg-zinc-900 scale-[1.01]'
              : 'border-zinc-300 dark:border-zinc-700 hover:border-zinc-500 dark:hover:border-zinc-500 bg-white dark:bg-zinc-950'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) parseWorkbook(f);
            }}
          />
          {processing ? (
            <div className="flex flex-col items-center gap-3">
              <RefreshCw className="w-10 h-10 text-zinc-900 dark:text-white animate-spin" />
              <p className="text-sm font-bold text-zinc-900 dark:text-white">Reading file…</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-3xl bg-zinc-900 dark:bg-white flex items-center justify-center">
                <FileSpreadsheet className="w-8 h-8 text-white dark:text-black" />
              </div>
              <p className="text-base font-extrabold text-zinc-900 dark:text-white">
                Drop today's Excel file here
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                .xlsx, .xls or .csv — Cases in the first tab, Bank_Contacts in a second tab (optional)
              </p>
            </div>
          )}
        </div>
      )}

      {/* Success banner */}
      {success && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">{success}</p>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-rose-700 dark:text-rose-400 text-sm">Upload Failed</p>
            <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Preview breakdown */}
      {breakdown && pendingData && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-extrabold text-zinc-900 dark:text-white">Preview — {breakdown.fileName}</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">Check the numbers before applying. Nothing is changed yet.</p>
              </div>
              <button
                onClick={reset}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Discard
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60">
                <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Rows in File</p>
                <p className="text-xl font-extrabold text-zinc-900 dark:text-white">{breakdown.rawRows.toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30">
                <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">✅ Active</p>
                <p className="text-xl font-extrabold text-emerald-700 dark:text-emerald-400">{breakdown.active.toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30">
                <p className="text-[10px] font-bold uppercase tracking-wide text-rose-500">❌ Expired</p>
                <p className="text-xl font-extrabold text-rose-600 dark:text-rose-400">{breakdown.skippedExpired.toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30">
                <p className="text-[10px] font-bold uppercase tracking-wide text-amber-600">Duplicates</p>
                <p className="text-xl font-extrabold text-amber-600 dark:text-amber-400">{breakdown.duplicatesRemoved.toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60">
                <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">👥 Contacts</p>
                <p className="text-xl font-extrabold text-zinc-900 dark:text-white">{breakdown.contacts.toLocaleString()}</p>
              </div>
            </div>

            {(breakdown.droppedInvalid > 0 || breakdown.duplicatesRemoved > 0) && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-3">
                {breakdown.droppedInvalid} row(s) missing both File No and Customer Name were dropped, and {breakdown.duplicatesRemoved} duplicate File No(s) removed (last one kept).
              </p>
            )}

            <div className="mt-5 flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleApply}
                disabled={uploading}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-black text-sm font-extrabold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {uploading ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> Replacing database…</>
                ) : (
                  <>
                    <Database className="w-4 h-4" />
                    Replace with {breakdown.active.toLocaleString()} active files
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-zinc-500 mt-3 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              Files no longer in this upload are removed from the app. Visit logs, remarks and collections are kept.
            </p>
          </div>
        </div>
      )}

      {/* How it works */}
      <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
        <p className="text-xs font-extrabold text-zinc-900 dark:text-white mb-3 uppercase tracking-wide">How it works</p>
        <ol className="space-y-2 text-xs text-zinc-600 dark:text-zinc-400 list-decimal list-inside">
          <li>Export today's file from your system as .xlsx (same columns as before)</li>
          <li>Drop it here — the app reads row 1 as headers and matches column names automatically (FILE_NO, BANK_NAME, CUSTOMER_NAME, ✅/❌ status…)</li>
          <li>Preview shows exactly what will happen: active, expired, duplicates</li>
          <li>Click replace — Supabase updates and every agent's device refreshes instantly via real-time sync</li>
        </ol>
      </div>
    </div>
  );
};
