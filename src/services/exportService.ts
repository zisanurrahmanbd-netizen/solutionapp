import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ═══════════════════════════════════════════════════════════════════════
// Canonical upload formats (exact headers requested)
// ═══════════════════════════════════════════════════════════════════════

export const CASE_TEMPLATE_HEADERS: string[] = [
  'BANK_NAME', 'FILE_TYPE', 'FILE_NO', 'ACCOUNT_NUMBER', 'CASA', 'CUSTOMER_NAME',
  'PRODUCT_NAME', 'CUSTOMER_PHONE', 'REF_PHONE', 'EMP_OFFICE_NAME', 'POSITION',
  'EMP_OFFICE_ADDRESS', 'PRESENT_ADDRESS', 'PERMANENT_ADDRESS',
  'OUTSTANDING_AMOUNT', 'OVERDUE_AMOUNT', 'DPD', 'FILE_STATUS', 'AGENT_NAME',
  'COLLECTOR_NAME', 'BRANCH_NAME', 'AREA', 'ALLOCATION_DATE', 'EXPIRY_DATE',
  'LAP_STATUS', 'LAST_VISIT_DATE', 'LAST_VISIT_TYPE', 'LAST_VISIT_NOTES',
  'VISIT_PHOTO', 'LAST_REMARK', 'LAST_PTP_AMOUNT', 'LAST_PTP_DATE',
  'CONTACT_STATUS', 'LAST_PAYMENT_AMOUNT', 'LAST_PAYMENT_DATE', 'PAYMENT_METHOD',
  'RECEIPT_NO', 'PAYMENT_PHOTO', 'GUARANTORS', 'STATUS',
];

export const CONTACTS_TEMPLATE_HEADERS: string[] = [
  'BANK_NAME', 'OFFICER_NAME', 'DESIGNATION', 'DEPARTMENT', 'PHONE', 'EMAIL',
  'BRANCH', 'NOTES',
];

const CASE_SAMPLE_ROWS: any[][] = [
  [
    'One Bank Limited', 'Credit Card', 'ONE-CC-2026-00101', '4521098877665544', 'CASA-8899',
    'Md. Kamal Uddin', 'Credit Card', '01711-123456', '01812-654321', 'Square Pharmaceuticals',
    'Manager', 'Salahuddin Road, Chittagong', 'House 12, Road 4, Banani, Dhaka',
    'Vill: Alinagar, Comilla', 75000, 18500, 62, 'SMA', 'Tariqul Islam', 'Rakib Hasan',
    'Banani Branch', 'Dhaka North', '2026-08-01', '2026-10-31', 'Normal',
    '2026-09-10', 'Present Address', 'Customer promised to pay 5,000 by Friday', '',
    'PTP taken for 5000 BDT', 5000, '2026-09-15', 'Contacted', 10000, '2026-08-28',
    'Cash', 'RCP-100234', '', 'Md. Shahin (Brother) 01777-123456', '✅ Active',
  ],
  [
    'Dutch-Bangla Bank Limited', 'NEXUS Card', 'DBBL-CC-2026-00301', '5534109988776655', '',
    'Nasrin Akter', 'NEXUS Credit Card', '01912-334455', '01612-998877', 'BRAC Bank Head Office',
    'Officer', 'Anik Tower, Gulshan, Dhaka', 'Flat 3B, Agrabad, Chittagong',
    'Vill: Rangunia, Chittagong', 62000, 12000, 45, 'SS', 'Tariqul Islam', 'Shamim Reza',
    'Agrabad Branch', 'Chittagong', '2026-07-15', '2026-11-15', 'Normal',
    '', '', '', '', '', 0, '', 'Not Contacted', 0, '', '', '', '',
    'Father: Abdul Gafur 01811-223344', '✅ Active',
  ],
];

const CONTACTS_SAMPLE_ROWS: any[][] = [
  [
    'One Bank Limited', 'Rakib Hasan', 'Recovery Officer', 'Cards Recovery',
    '01711-998877', 'rakib.hasan@onebank.com.bd', 'Banani Branch', 'Prefers calls after 4 PM',
  ],
  [
    'Dutch-Bangla Bank Limited', 'Shamim Reza', 'Senior Manager', 'Special Asset Management',
    '01912-445566', 'shamim.reza@dbbl.com.bd', 'Agrabad Branch', '',
  ],
];

// ═══════════════════════════════════════════════════════════════════════
// Template downloads (blank format file for daily upload)
// ═══════════════════════════════════════════════════════════════════════

export function downloadCasesTemplate(): void {
  const ws = XLSX.utils.aoa_to_sheet([CASE_TEMPLATE_HEADERS, ...CASE_SAMPLE_ROWS]);
  ws['!cols'] = CASE_TEMPLATE_HEADERS.map(h => ({ wch: Math.max(12, Math.min(34, h.length + 6)) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Cases');
  XLSX.writeFile(wb, `Daily_File_Upload_Format_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function downloadContactsTemplate(): void {
  const ws = XLSX.utils.aoa_to_sheet([CONTACTS_TEMPLATE_HEADERS, ...CONTACTS_SAMPLE_ROWS]);
  ws['!cols'] = CONTACTS_TEMPLATE_HEADERS.map(h => ({ wch: Math.max(14, Math.min(34, h.length + 8)) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Bank_Contacts');
  XLSX.writeFile(wb, `Bank_Contacts_Upload_Format.xlsx`);
}

// ═══════════════════════════════════════════════════════════════════════
// Generic data exports (Excel + PDF)
// ═══════════════════════════════════════════════════════════════════════

export function exportTableToExcel(
  fileName: string,
  sheetName: string,
  headers: string[],
  rows: any[][]
): void {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = headers.map(h => ({ wch: Math.max(10, Math.min(36, String(h).length + 6)) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, fileName);
}

export function exportTableToPdf(
  fileName: string,
  title: string,
  headers: string[],
  rows: any[][]
): void {
  const landscape = headers.length > 8;
  const doc = new jsPDF({
    orientation: landscape ? 'landscape' : 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 40, 34);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(110);
  doc.text(`Generated ${new Date().toLocaleString()} • ${rows.length.toLocaleString()} record(s)`, 40, 50);

  autoTable(doc, {
    head: [headers],
    body: rows.map(r => r.map(v => (v === null || v === undefined ? '' : String(v)))),
    startY: 62,
    styles: {
      fontSize: headers.length > 20 ? 5.5 : headers.length > 10 ? 7 : 8,
      cellPadding: 2.5,
      overflow: 'linebreak',
      cellWidth: headers.length > 20 ? 'wrap' : 'auto',
    },
    headStyles: { fillColor: [24, 24, 27], textColor: 255, fontStyle: 'bold', fontSize: headers.length > 20 ? 5.5 : 7.5 },
    alternateRowStyles: { fillColor: [246, 246, 247] },
    margin: { left: 40, right: 40 },
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Page ${i} of ${pageCount}`,
      doc.internal.pageSize.getWidth() - 70,
      doc.internal.pageSize.getHeight() - 16
    );
  }

  doc.save(fileName);
}

// ═══════════════════════════════════════════════════════════════════════
// Case / Contact → canonical row values
// ═══════════════════════════════════════════════════════════════════════

export function caseToExportValues(c: any): (string | number)[] {
  const a: Record<string, any> = c?.extra_attributes || {};
  const s = (v: any) => (v === null || v === undefined ? '' : String(v));
  const num = (v: any) => {
    const n = Number(String(v ?? '').replace(/[^0-9.-]/g, ''));
    return isNaN(n) ? 0 : n;
  };
  const dateOnly = (v: any) => {
    if (!v) return '';
    const d = new Date(v);
    return isNaN(d.getTime()) ? s(v) : d.toISOString().slice(0, 10);
  };

  return [
    s(a.BANK_NAME ?? c.bank_name ?? c.bank?.name),
    s(a.FILE_TYPE ?? c.product_name ?? c.product?.name),
    s(c.file_number),
    s(c.account_number ?? a.ACCOUNT_NUMBER),
    s(a.CASA),
    s(c.customer_name),
    s(c.product_name ?? a.PRODUCT_NAME),
    s(c.customer_phone ?? a.CUSTOMER_PHONE),
    s(c.customer_secondary_phone ?? a.REF_PHONE),
    s(a.EMP_OFFICE_NAME),
    s(a.POSITION),
    s(a.EMP_OFFICE_ADDRESS),
    s(c.customer_address_present ?? a.PRESENT_ADDRESS),
    s(c.customer_address_permanent ?? a.PERMANENT_ADDRESS),
    num(a.OUTSTANDING_AMOUNT ?? c.outstanding_amount),
    num(a.OVERDUE_AMOUNT ?? c.overdue_amount),
    s(a.DPD),
    s(a.FILE_STATUS ?? c.status),
    s(c.agent_name ?? a.AGENT_NAME),
    s(c.collector_name ?? a.COLLECTOR_NAME),
    s(a.BRANCH_NAME ?? c.branch_name),
    s(a.AREA ?? c.area),
    dateOnly(c.allocation_date ?? a.ALLOCATION_DATE),
    dateOnly(c.expiry_date ?? a.EXPIRY_DATE),
    s(a.LAP_STATUS ?? c.lap_status),
    c.last_visit_at ? dateOnly(c.last_visit_at) : s(a.LAST_VISIT_DATE),
    s(a.LAST_VISIT_TYPE),
    s(a.LAST_VISIT_NOTES),
    s(a.VISIT_PHOTO),
    s(a.LAST_REMARK),
    num(a.LAST_PTP_AMOUNT),
    s(a.LAST_PTP_DATE),
    s(a.CONTACT_STATUS),
    num(a.LAST_PAYMENT_AMOUNT),
    s(a.LAST_PAYMENT_DATE),
    s(a.PAYMENT_METHOD),
    s(a.RECEIPT_NO),
    s(a.PAYMENT_PHOTO),
    s(a.GUARANTORS),
    s(a.STATUS ?? c.status),
  ];
}

export function contactToExportValues(c: any, bankName: string): (string | number)[] {
  return [
    bankName || '',
    c.name || '',
    c.designation || '',
    c.department || '',
    c.phone || '',
    c.email || '',
    c.branch || '',
    c.notes || '',
  ];
}
