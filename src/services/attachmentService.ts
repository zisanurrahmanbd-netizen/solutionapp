import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '../lib/supabase';

export interface AttachmentSpec {
  fileName: string;
  headers: string[];
  rows: any[][];
  /** 'xlsx' (default) or 'pdf' */
  format?: 'xlsx' | 'pdf';
  /** Report title shown on the PDF header */
  title?: string;
}

const BUCKET = 'bulk-message-attachments';

function buildBlob(spec: AttachmentSpec): Blob {
  if (spec.format === 'pdf') {
    const headers = spec.headers;
    const body = spec.rows.map(r => r.map(v => String(v ?? '')));
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    autoTable(doc, {
      head: [headers],
      body,
      styles: { fontSize: 6, cellPadding: 1.2, overflow: 'linebreak' },
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [244, 244, 245] },
      margin: { top: 16, left: 6, right: 6 },
      didDrawPage: () => {
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text(spec.title || 'File Update Report', 6, 9);
        doc.setFontSize(7);
        doc.setTextColor(120);
        doc.text(
          `Generated ${new Date().toLocaleString()} — ${body.length} files`,
          6,
          13
        );
      },
    });
    const total = doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text(
        `Page ${i}/${total}`,
        doc.internal.pageSize.getWidth() - 6,
        doc.internal.pageSize.getHeight() - 4,
        { align: 'right' }
      );
    }
    return new Blob([doc.output('arraybuffer')], { type: 'application/pdf' });
  }

  // Excel (default)
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([spec.headers, ...spec.rows]);
  ws['!cols'] = spec.headers.map(h => ({ wch: Math.max(10, Math.min(34, String(h).length + 6)) }));
  XLSX.utils.book_append_sheet(wb, ws, 'Report');
  const data: ArrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * Build an .xlsx or .pdf from headers/rows, upload it to Supabase Storage and
 * return a shareable download URL. Creates the public bucket on first use.
 * Falls back to a local object URL if storage upload fails (still works,
 * but the link only lives for this browser session).
 */
export async function buildAttachment(spec: AttachmentSpec): Promise<string> {
  const blob = buildBlob(spec);

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const safeName = spec.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const objectPath = `reports/${stamp}_${safeName}`;
  const contentType = spec.format === 'pdf'
    ? 'application/pdf'
    : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  // 1) Try to ensure the bucket exists (best-effort)
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    if (buckets && !buckets.some(b => b.name === BUCKET)) {
      await supabase.storage.createBucket(BUCKET, { public: true, fileSizeLimit: 52428800 });
    }
  } catch { /* anon key may not be allowed to list/create buckets — try upload anyway */ }

  // 2) Upload
  try {
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(objectPath, blob, { contentType, upsert: false });
    if (!error) {
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
      if (pub?.publicUrl) return pub.publicUrl;
    } else {
      console.warn('Attachment upload notice:', error.message);
    }
  } catch (e) {
    console.warn('Attachment upload failed:', e);
  }

  // 3) Fallback: local object URL (downloadable in this browser session)
  return URL.createObjectURL(blob);
}
