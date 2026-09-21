// ═══════════════════════════════════════════════════════════════════════
// Date formatting — every date in the UI displays as "09 Sep 2026".
// ═══════════════════════════════════════════════════════════════════════

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Format any date-ish value (yyyy-mm-dd, full ISO timestamp, Date) as
 * "09 Sep 2026". Returns '' for empty/invalid values.
 * Uses LOCAL date components so no timezone shift occurs.
 */
export function formatDate(value?: string | Date | null): string {
  if (!value) return '';
  let d: Date | null = null;
  if (value instanceof Date) {
    d = value;
  } else {
    const s = String(value).trim();
    if (!s) return '';
    // "2026-09-29" or "2026-09-29T17:59:40.000Z" → parse parts to stay timezone-safe
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      return `${m[3]} ${MONTHS[Number(m[2]) - 1] || ''} ${m[1]}`;
    }
    // Excel serial number as string (e.g. "45243")
    if (/^\d{5}$/.test(s)) {
      const serial = Number(s);
      const parsed = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
      d = parsed;
    } else {
      const parsed = new Date(s);
      d = isNaN(parsed.getTime()) ? null : parsed;
    }
  }
  if (!d || isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Sanitize a stored date to clean "yyyy-mm-dd" (strips any accidental ISO
 * timestamp that was uploaded raw). Used when reading data so legacy rows
 * with "2026-09-29T17:59:40.000Z" render correctly everywhere.
 */
export function toDateOnly(value?: string | null): string {
  if (!value) return '';
  const s = String(value).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
  }
  return s;
}
