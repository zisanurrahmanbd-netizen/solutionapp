// ═══════════════════════════════════════════════════════════════════════
// Bulk messaging: WhatsApp (wa.me deep links) + Email (mailto)
// No API keys needed — works on web AND the Android APK.
// ═══════════════════════════════════════════════════════════════════════

export interface BulkRecipient {
  key: string | number;
  name: string;
  phone?: string;
  email?: string;
  /** Extra template variables, e.g. { file_no: 'ONE-CC-101', bank: 'One Bank', amount: 75000 } */
  vars?: Record<string, string | number>;
}

/** Normalize a Bangladeshi phone to international form 8801XXXXXXXXX */
export function normalizeBdPhone(raw?: string | null): string | null {
  if (!raw) return null;
  let d = String(raw).replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('00880')) d = d.slice(5);
  else if (d.startsWith('880')) d = d.slice(3);
  if (d.startsWith('0')) d = d.slice(1);
  // Now expect 1XXXXXXXXX (10 digits)
  if (/^1[3-9]\d{8}$/.test(d)) return '880' + d;
  return null;
}

/** Render a template, replacing {{var}} tokens with recipient values */
export function renderTemplate(template: string, r: BulkRecipient): string {
  const vars: Record<string, string> = {
    name: r.name,
    ...(r.vars || {}),
  };
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => {
    const v = vars[k];
    return v === undefined || v === null ? '' : String(v);
  });
}

export function waLink(normalizedPhone: string, message: string): string {
  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}

/**
 * Open WhatsApp chats for many recipients, one at a time with a small delay
 * (browsers block rapid popups). Returns the list of recipients whose popup
 * was blocked so the UI can offer manual one-tap links.
 */
export async function bulkWhatsApp(
  recipients: { phone: string; message: string }[],
  onProgress?: (sent: number, total: number) => void
): Promise<{ blocked: { phone: string; message: string }[] }> {
  const blocked: { phone: string; message: string }[] = [];
  for (let i = 0; i < recipients.length; i++) {
    const r = recipients[i];
    const url = waLink(r.phone, r.message);
    const win = window.open(url, '_blank');
    if (!win) {
      // Popup blocked — collect the rest so the user can tap them manually
      blocked.push(...recipients.slice(i));
      onProgress?.(i, recipients.length);
      return { blocked };
    }
    onProgress?.(i + 1, recipients.length);
    if (i < recipients.length - 1) {
      await new Promise(res => setTimeout(res, 1200));
    }
  }
  return { blocked };
}

/**
 * Open the user's email client with ONE email addressed to many recipients
 * (same subject + body for all). Large lists are split into chunks because
 * mailto URLs have a length limit.
 */
export function bulkMailto(
  emails: string[],
  subject: string,
  body: string,
  maxPerChunk = 35
): number {
  const clean = emails.map(e => e.trim()).filter(Boolean);
  const chunks: string[][] = [];
  for (let i = 0; i < clean.length; i += maxPerChunk) {
    chunks.push(clean.slice(i, i + maxPerChunk));
  }
  chunks.forEach((chunk, i) => {
    const url = `mailto:${chunk.join(',')}?subject=${encodeURIComponent(
      chunks.length > 1 ? `${subject} (${i + 1}/${chunks.length})` : subject
    )}&body=${encodeURIComponent(body)}`;
    window.open(url, '_self');
  });
  return chunks.length;
}

/** Default reminder template for customers (Bank & MNC files) */
export const CUSTOMER_TEMPLATE_DEFAULT = `Dear {{name}},

This is a gentle reminder regarding your {{bank}} {{file_type}} (File No: {{file_no}}) with an outstanding amount of BDT {{amount}}.

Kindly arrange the payment at your earliest convenience to avoid further actions. If you have already paid, please share the receipt with us.

Thank you,
{{company}}`;

/** Default template for bank officers / C.S. contacts */
export const OFFICER_TEMPLATE_DEFAULT = `Dear {{name}},

{{company}} team would like to connect with you regarding the recovery portfolio of {{bank}} ({{branch}}).

Please let us know a convenient time for a discussion.

Thank you`;
