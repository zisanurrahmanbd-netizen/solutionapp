// ── Row mapping + active-case filtering (used by Daily File Upload) ──────
// Column aliases: sheet/Excel header → CaseFile field

export const COL_MAP: Record<string, string> = {
  FILE_NO:                    'file_number',
  FILE_NUMBER:                'file_number',
  CASE_NO:                    'file_number',
  BANK_NAME:                  'bank_name',
  BANK:                       'bank_name',
  FILE_TYPE:                  'file_type',
  PRODUCT_NAME:               'product_name',
  PRODUCT:                    'product_name',
  CARD_TYPE:                  'product_name',
  ACCOUNT_NUMBER:             'account_number',
  ACCOUNT_NO:                 'account_number',
  CARD_NUMBER:                'account_number',
  CASA:                       'casa',
  CUSTOMER_NAME:              'customer_name',
  CLIENT_NAME:                'customer_name',
  NAME:                       'customer_name',
  CUSTOMER_PHONE:             'customer_phone',
  PHONE:                      'customer_phone',
  MOBILE:                     'customer_phone',
  CUSTOMER_SECONDARY_PHONE:   'customer_secondary_phone',
  SECONDARY_PHONE:            'customer_secondary_phone',
  REF_PHONE:                  'customer_secondary_phone',
  ALT_PHONE:                  'customer_secondary_phone',
  EMP_OFFICE_NAME:            'emp_office_name',
  POSITION:                   'position',
  EMP_OFFICE_ADDRESS:         'emp_office_address',
  PRESENT_ADDRESS:            'customer_address_present',
  CURRENT_ADDRESS:            'customer_address_present',
  PERMANENT_ADDRESS:          'customer_address_permanent',
  OUTSTANDING_AMOUNT:         'outstanding_amount',
  OUTSTANDING:                'outstanding_amount',
  TOTAL_OUTSTANDING:          'outstanding_amount',
  OVERDUE_AMOUNT:             'overdue_amount',
  OVERDUE:                    'overdue_amount',
  MINIMUM_PAYMENT:            'minimum_payment',
  MIN_PAYMENT:                'minimum_payment',
  DPD:                        'dpd',
  STATUS:                     'status',
  FILE_STATUS:                'file_status',
  LEGAL_STATUS:               'legal_status',
  AGENT_NAME:                 'agent_name',
  AGENT:                      'agent_name',
  FIELD_AGENT:                'agent_name',
  COLLECTOR_NAME:             'collector_name',
  COLLECTOR:                  'collector_name',
  BANK_COLLECTOR:             'collector_name',
  BANK_OFFICER:               'collector_name',
  BRANCH_NAME:                'branch_name',
  AREA:                       'area',
  ALLOCATION_DATE:            'allocation_date',
  ALLOC_DATE:                 'allocation_date',
  EXPIRY_DATE:                'expiry_date',
  EXPIRY:                     'expiry_date',
  LAP_STATUS:                 'lap_status',
};

export function parseValue(field: string, raw: any): any {
  if (raw === null || raw === undefined || raw === '') {
    if (['outstanding_amount', 'overdue_amount', 'minimum_payment'].includes(field)) {
      return 0;
    }
    if (['allocation_date', 'expiry_date'].includes(field)) {
      return null;
    }
    return '';
  }
  const str = String(raw).trim();
  if (['outstanding_amount', 'overdue_amount', 'minimum_payment'].includes(field)) {
    const n = parseFloat(str.replace(/[^0-9.-]/g, ''));
    return isNaN(n) ? 0 : n;
  }
  if (['allocation_date', 'expiry_date'].includes(field)) {
    if (!str) return null;
    try {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        // Store date-only in yyyy-mm-dd. Using local components (not UTC
        // toISOString) so a date like "2026-09-29 00:00 +06" never shifts
        // to the previous day — and never leaks the raw timestamp into the UI.
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      }
    } catch (_) {}
    return str;
  }
  if (field === 'status') {
    // The STATUS column holds bank classifications (STD, SMA, SS, DF, BL,
    // Write-off, 12m+, …) — preserve them EXACTLY as given so the badge shows
    // the real classification instead of a generic "New". Only normalize the
    // ✅/❌ markers used by the active-file filter.
    const lower = str.toLowerCase();
    if (lower.includes('✅') || lower === 'active') return 'active';
    if (lower.includes('❌') || lower === 'expired') return 'expired';
    // Short bank codes → STD, SMA, SS, DF, BL…; longer text ("Write OFF",
    // "12m+") keeps its original casing so it stays human-readable.
    return /^[a-z]{1,4}$/i.test(str.trim()) ? str.trim().toUpperCase() : str.trim();
  }
  if (field === 'dpd') {
    const n = parseInt(str.replace(/[^0-9]/g, ''), 10);
    return isNaN(n) ? str : n;
  }
  return str;
}

export const COL_MAP_CONTACTS: Record<string, string> = {
  BANK_NAME:      'bank_name',
  BANK:           'bank_name',
  BANK_ID:        'bank_id_text',
  OFFICER_NAME:   'name',
  NAME:           'name',
  OFFICER:        'name',
  CS_NAME:        'name',
  C_S_NAME:       'name',
  COLLECTOR_NAME: 'name',
  COLLECTOR:      'name',
  AGENT_NAME:     'name',
  CONTACT_NAME:   'name',
  CONTACT_PERSON: 'name',
  PERSON_NAME:    'name',
  EMPLOYEE_NAME:  'name',
  FULL_NAME:      'name',
  CONTACT_NUMBER: 'phone',
  CS_NUMBER:      'phone',
  C_S_NUMBER:     'phone',
  CS_CONTACT:     'phone',
  PHONE_NUMBER:   'phone',
  CELL:           'phone',
  CELL_NO:        'phone',
  NUMBER:         'phone',
  DESIGNATION:    'designation',
  TITLE:          'designation',
  DEPARTMENT:     'department',
  DEPT:           'department',
  PHONE:          'phone',
  MOBILE:         'phone',
  MOBILE_NO:      'phone',
  CONTACT_NO:     'phone',
  PHONE_NO:       'phone',
  EMAIL:          'email',
  EMAIL_ADDRESS:  'email',
  BRANCH:         'branch',
  BRANCH_NAME:    'branch',
  NOTES:          'notes',
  REMARKS:        'notes',
};

export function mapRowToContactData(row: Record<string, any>): Record<string, any> | null {
  const mapped: Record<string, any> = {};
  for (const [sheetCol, rawVal] of Object.entries(row)) {
    const normalKey = String(sheetCol).trim().toUpperCase().replace(/\s+/g, '_');
    const field = COL_MAP_CONTACTS[normalKey];
    if (field && rawVal !== null && rawVal !== undefined && String(rawVal).trim() !== '') {
      let val = String(rawVal).trim();
      if (field === 'phone') {
        if (/^1[3-9]\d{8}$/.test(val)) val = '0' + val;
      }
      if (field === 'bank_id_text') continue; // helper column, not stored directly
      mapped[field] = val;
    }
  }
  // Fallback: if no known name column matched, use the first non-bank text column as the name
  if (!mapped.name) {
    for (const [k, v] of Object.entries(row)) {
      const key = String(k).trim().toUpperCase().replace(/\s+/g, '_');
      const isBankCol = COL_MAP_CONTACTS[key] === 'bank_name' || key === 'BANK_ID';
      if (!isBankCol && v !== null && v !== undefined && String(v).trim() !== '' && /[a-zA-Z]/.test(String(v))) {
        mapped.name = String(v).trim();
        break;
      }
    }
  }
  // Must have at least a name
  if (!mapped.name) return null;
  return mapped;
}

export function mapRowToCaseData(row: Record<string, any>): Record<string, any> | null {
  const mapped: Record<string, any> = {
    extra_attributes: { ...row }
  };

  for (const [sheetCol, rawVal] of Object.entries(row)) {
    const normalKey = String(sheetCol).trim().toUpperCase().replace(/\s+/g, '_');
    const field = COL_MAP[normalKey];
    if (field) {
      const val = parseValue(field, rawVal);
      mapped[field] = val;
    }
  }

  // Must have at minimum a file number and customer name
  if (!mapped.file_number && !mapped.customer_name) return null;
  if (!mapped.file_number) mapped.file_number = `GS-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  return mapped;
}

export interface ActiveFilterResult {
  active: Record<string, any>[];
  skippedExpired: number;
  duplicatesRemoved: number;
  droppedInvalid: number;
}

export function filterActiveCases(
  allCaseData: Record<string, any>[],
  rawCount?: number
): ActiveFilterResult {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const STATUS_KEY_RE = /(STATUS|EXPIR|ACTIVE|RENEW)/i;
  const isExpiredText = (s: string) => {
    const lower = s.toLowerCase();
    return lower.includes('❌') || /\bexpired\b/.test(lower) || /\bexpire\b/.test(lower);
  };
  const isActiveText = (s: string) => {
    const lower = s.toLowerCase();
    return lower.includes('✅') || lower.includes('active');
  };
  let duplicatesRemoved = 0;
  const droppedInvalid = Math.max(0, (rawCount ?? allCaseData.length) - allCaseData.length);
  const seenFileNos = new Set<string>();
  const active = allCaseData
    .filter((row: any) => {
      const attrs = row.extra_attributes && typeof row.extra_attributes === 'object' ? row.extra_attributes : {};

      // Only status-like columns count (by header name)
      const values: string[] = [];
      for (const key of Object.keys(attrs)) {
        if (!STATUS_KEY_RE.test(key)) continue;
        const v = attrs[key];
        if (v !== null && v !== undefined && String(v).trim() !== '') values.push(String(v));
      }
      for (const key of ['expiry_date', 'status', 'file_status', 'legal_status', 'lap_status']) {
        const v = (row as any)[key];
        if (v !== null && v !== undefined && String(v).trim() !== '') values.push(String(v));
      }

      const hasActive = values.some(isActiveText);
      const hasExpired = values.some(isExpiredText);
      if (hasActive) return true;   // ✅ wins: dedicated status column is authoritative
      if (hasExpired) return false; // ❌ Expired → skip

      // Date fallback: a real date in the expiry column
      const expiryDate = row.expiry_date || attrs.EXPIRY_DATE;
      if (!expiryDate) return true; // No expiry info = keep it
      try {
        const exp = new Date(String(expiryDate));
        if (isNaN(exp.getTime())) return true; // Unparseable = keep it
        return exp >= today; // Only keep if expiry is today or future
      } catch {
        return true;
      }
    })
    .filter((row: any) => {
      // Duplicate FILE_NO tracking (last one wins, but count removals)
      const key = String(row.file_number || '').trim().toLowerCase();
      if (!key) return true;
      if (seenFileNos.has(key)) {
        duplicatesRemoved++;
        return false;
      }
      seenFileNos.add(key);
      return true;
    });
  const skippedExpired = Math.max(0, allCaseData.length - duplicatesRemoved - active.length);
  return { active, skippedExpired, duplicatesRemoved, droppedInvalid };
}
