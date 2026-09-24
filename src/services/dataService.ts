import { supabase } from '../lib/supabase';
import { Bank, Product, CaseFile, CheckIn, Collection, CaseRemark, BankContact, User } from '../types';
import { PREBUILT_TEMPLATES } from './templateService';
import { offlineQueue } from './offlineQueue';
import { applyCloudBranding, BRANDING_CLOUD_KEY } from '../context/BrandingContext';

/**
 * Fetch ALL rows from a Supabase table with pagination.
 * The REST API caps every response at 1000 rows by default; without paging,
 * anything past row 1000 silently never loads (the "only 1000 files" bug).
 */
export async function fetchAllRows<T = any>(
  table: string,
  select = '*',
  orderBy?: string,
  ascending = false,
  pageSize = 1000
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  // Safety cap so a huge table can't loop forever (10M rows)
  for (let guard = 0; guard < 10000; guard++) {
    let query = supabase.from(table).select(select).range(from, from + pageSize - 1);
    if (orderBy) query = query.order(orderBy, { ascending }) as typeof query;
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const rows = (data || []) as T[];
    all.push(...rows);
    if (rows.length < pageSize) break; // last page reached
    from += pageSize;
  }
  return all;
}

export const INITIAL_BANKS: Bank[] = [
  { id: 1, name: 'One Bank Limited', code: 'ONE', is_active: true },
  { id: 2, name: 'Dutch-Bangla Bank Limited', code: 'DBBL', is_active: true },
  { id: 3, name: 'Asian Paints Bangladesh', code: 'APB', is_active: true },
];

/**
 * Dedupe helper: PostgREST aborts a whole batch with "cannot affect row a second
 * time" if the same primary key appears twice in one upsert payload. Deduping by
 * id (and falling back to file_number) before upserting keeps every batch valid —
 * duplicate ids are the classic cause of "sync stops mid-way with an error".
 */
function dedupeById(rows: any[]): any[] {
  const seen = new Set<string>();
  const out: any[] = [];
  for (const row of rows) {
    const key = String(row?.id ?? `fn:${String(row?.file_number || '').trim().toLowerCase()}`);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

export const INITIAL_PRODUCTS: Product[] = [
  { id: 1, bank_id: 1, name: 'Credit Card', code: 'ONE-CC', commission_rate: 15.0 },
  { id: 2, bank_id: 1, name: 'Personal Loan', code: 'ONE-PL', commission_rate: 10.0 },
  { id: 3, bank_id: 2, name: 'NEXUS Credit Card', code: 'DBBL-CC', commission_rate: 12.0 },
  { id: 4, bank_id: 2, name: 'Agent Banking Loan', code: 'DBBL-ABL', commission_rate: 8.0 },
  { id: 5, bank_id: 3, name: 'Dealer Recovery', code: 'APB-DR', commission_rate: 5.0 },
];

// ── Persistent bank registry ────────────────────────────────────────────
// Banks discovered during Excel imports are stored here so every device and
// session sees them (previously a hashed bank_id from an unmatched BANK_NAME
// had no Bank entry — the Bank Contacts filter then showed nothing for it).
const REGISTERED_BANKS_KEY = 'recoverypro_registered_banks';
const REGISTERED_BANKS_CLOUD_KEY = '__registered_banks__';

export function getRegisteredBanks(): Bank[] {
  try {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(REGISTERED_BANKS_KEY) : null;
    return saved ? JSON.parse(saved) : [];
  } catch (_) {
    return [];
  }
}

/** Persist the bank registry locally AND to Supabase (file_templates row) so
 *  every device resolves the same bank names to the same ids — otherwise the
 *  Bank Contacts filter works on the uploading device only. */
export function persistRegisteredBanks(list: Bank[]) {
  try { localStorage.setItem(REGISTERED_BANKS_KEY, JSON.stringify(list)); } catch (_) {}
  try {
    offlineQueue.runBackground({
      kind: 'upsert',
      table: 'file_templates',
      rows: [{ template_key: REGISTERED_BANKS_CLOUD_KEY, definition: list, updated_at: new Date().toISOString() }],
      onConflict: 'template_key',
    });
  } catch (_) {}
}

/** Pull the shared bank registry from Supabase (called on cloud sync) so a
 *  device that never uploaded the sheet still gets every imported bank. */
export function applyCloudRegisteredBanks(def: any): boolean {
  try {
    const remote = (typeof def === 'string' ? JSON.parse(def) : def) as Bank[];
    if (!Array.isArray(remote) || remote.length === 0) return false;
    const local = getRegisteredBanks();
    const merged = [...local];
    let changed = false;
    remote.forEach(rb => {
      if (!rb || typeof rb.id !== 'number') return;
      if (!merged.some(lb => lb.id === rb.id)) {
        merged.push({ id: rb.id, name: rb.name, code: rb.code || 'BANK', is_active: true });
        changed = true;
      }
    });
    if (changed) {
      try { localStorage.setItem(REGISTERED_BANKS_KEY, JSON.stringify(merged)); } catch (_) {}
      // Push merged set back so every device converges on one registry
      persistRegisteredBanks(merged);
    }
    return changed;
  } catch (_) {
    return false;
  }
}

/**
 * Punctuation-insensitive bank-name key: lowercase, strip all non-alphanumerics.
 * "Dutch-Bangla Bank" and "Dutch Bangla Bank" then resolve to the SAME bank id,
 * instead of each spelling getting its own hashed id (classic filter bug).
 */
export function normalizeBankKey(name: string): string {
  return String(name || '').toLowerCase().replace(/[^a-z0-9\u0980-\u09FF]+/g, '');
}

export function ensureBankRegistered(name: string): number {
  const clean = String(name || '').trim();
  if (!clean) return 1;

  // Already a known bank (initial, template-derived, or registered)?
  // Match on the punctuation-insensitive key so variant spellings of the same
  // bank can never fork into two different ids.
  const key = normalizeBankKey(clean);
  const existing = getAllSystemBanks().find(
    b => normalizeBankKey(b.name) === key
  );
  if (existing) return existing.id;

  // Deterministic ID (same algorithm the importer used historically) so
  // pre-existing contacts keep their bank_id and now get a matching entry.
  let hash = 0;
  const lower = clean.toLowerCase();
  for (let i = 0; i < lower.length; i++) hash = ((hash << 5) - hash) + lower.charCodeAt(i);
  const id = Math.abs(hash % 100000) + 100;

  const registered = getRegisteredBanks();
  if (!registered.some(b => b.id === id)) {
    const code = clean.split(/\s+/).map(w => w[0]).join('').toUpperCase().substring(0, 6) || 'BANK';
    registered.push({ id, name: clean, code, is_active: true });
    persistRegisteredBanks(registered);
  }
  return id;
}

export function getAllSystemBanks(): Bank[] {
  const list = [...INITIAL_BANKS, ...getRegisteredBanks()];
  try {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('recoverypro_custom_templates') : null;
    const hidden = (() => {
      try {
        const h = typeof localStorage !== 'undefined' ? localStorage.getItem('recoverypro_hidden_prebuilts') : null;
        return h ? new Set<string>(JSON.parse(h)) : new Set<string>();
      } catch (_) { return new Set<string>(); }
    })();

    const allTpls: Record<string, any> = { ...PREBUILT_TEMPLATES };
    if (saved) {
      try {
        Object.assign(allTpls, JSON.parse(saved));
      } catch (_) {}
    }

    // Remove hidden prebuilts
    hidden.forEach((k: string) => delete allTpls[k]);

    Object.values(allTpls).forEach((t: any) => {
      if (!t?.bankName || typeof t.bankName !== 'string') return;
      const bName = t.bankName.trim();
      if (!bName) return;
      const exists = list.some(b => b.name.toLowerCase() === bName.toLowerCase());
      if (!exists) {
        let hash = 0;
        for (let i = 0; i < bName.length; i++) hash = ((hash << 5) - hash) + bName.charCodeAt(i);
        const newId = Math.abs(hash % 100000) + 100;
        const code = bName.split(/\s+/).map((w: string) => w[0]).join('').toUpperCase().substring(0, 6) || 'BANK';
        list.push({
          id: newId,
          name: bName,
          code: code,
          is_active: true
        });
      }
    });
  } catch (_) {}
  return list;
}

export function getAllSystemProducts(): Product[] {
  const banks = getAllSystemBanks();
  const list = [...INITIAL_PRODUCTS];
  try {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('recoverypro_custom_templates') : null;
    const hidden = (() => {
      try {
        const h = typeof localStorage !== 'undefined' ? localStorage.getItem('recoverypro_hidden_prebuilts') : null;
        return h ? new Set<string>(JSON.parse(h)) : new Set<string>();
      } catch (_) { return new Set<string>(); }
    })();

    const allTpls: Record<string, any> = { ...PREBUILT_TEMPLATES };
    if (saved) {
      try {
        Object.assign(allTpls, JSON.parse(saved));
      } catch (_) {}
    }

    // Remove hidden prebuilts
    hidden.forEach((k: string) => delete allTpls[k]);

    Object.values(allTpls).forEach((t: any) => {
      if (!t?.bankName || !t?.productName) return;
      const bName = String(t.bankName).trim();
      const pName = String(t.productName).trim();
      if (!bName || !pName) return;
      const bank = banks.find(b => b.name.toLowerCase() === bName.toLowerCase());
      if (!bank) return;
      const exists = list.some(p => p.bank_id === bank.id && p.name.toLowerCase() === pName.toLowerCase());
      if (!exists) {
        let hash = 0;
        const combined = `${bank.name}_${pName}`;
        for (let i = 0; i < combined.length; i++) hash = ((hash << 5) - hash) + combined.charCodeAt(i);
        const newProdId = Math.abs(hash % 100000) + 100;
        list.push({
          id: newProdId,
          bank_id: bank.id,
          name: pName,
          code: `${bank.code}-${pName.replace(/[^A-Za-z0-9]/g, '').substring(0, 3).toUpperCase()}`,
          commission_rate: 10.0
        });
      }
    });
  } catch (_) {}
  return list;
}

// Clean Production Initial State (All Sample Mock Data Deleted Permanently)
export const INITIAL_CONTACTS: BankContact[] = [];
export const INITIAL_CASES: CaseFile[] = [];
export const INITIAL_REMARKS: CaseRemark[] = [];
export const INITIAL_CHECKINS: CheckIn[] = [];
export const INITIAL_COLLECTIONS: Collection[] = [];

export interface PtpAlertItem {
  caseItem: CaseFile;
  remark: CaseRemark;
  promisedAmount: number;
  promiseDate: string;
  isOverdue: boolean;
  daysDiff: number;
}

function cleanNum(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const str = String(val).replace(/[^0-9.-]/g, '');
  const n = parseFloat(str);
  return isNaN(n) ? 0 : n;
}

function findAttr(attrs: Record<string, any> | undefined, keys: string[]): any {
  if (!attrs) return undefined;
  for (const k of keys) {
    if (attrs[k] !== undefined && attrs[k] !== null && String(attrs[k]).trim() !== '') {
      return attrs[k];
    }
  }
  const normMap: Record<string, any> = {};
  Object.keys(attrs).forEach(k => {
    normMap[k.toUpperCase().replace(/[^A-Z0-9]/g, '')] = attrs[k];
  });
  for (const k of keys) {
    const norm = k.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (normMap[norm] !== undefined && normMap[norm] !== null && String(normMap[norm]).trim() !== '') {
      return normMap[norm];
    }
  }
  return undefined;
}

export function enrichCase(c: CaseFile): CaseFile {
  const attrs = c.extra_attributes || {};

  // 1. Outstanding Amount
  let outstanding = c.outstanding_amount || 0;
  if (outstanding === 0) {
    const rawOut = findAttr(attrs, ['OUTSTANDING', 'TOTAL_OUTSTANDING', 'OUTSTANDING_AMOUNT', 'TOTAL_OS', 'OS_AMOUNT', 'BALANCE', 'POS', 'PRINCIPAL_OUTSTANDING']);
    if (rawOut) outstanding = cleanNum(rawOut);
  }

  // 2. Overdue Amount
  let overdue = c.overdue_amount || 0;
  if (overdue === 0) {
    const rawOd = findAttr(attrs, ['OVERDUE', 'OVERDUE_AMOUNT', 'OVERDUE_90_PLUS', 'INTEREST_OVERDUE', 'MINIMUM_DUE', 'MIN_DUE']);
    if (rawOd) overdue = cleanNum(rawOd);
  }

  // 3. EMI / Minimum Payment
  let emi = c.minimum_payment || 0;
  if (!emi) {
    const rawEmi = findAttr(attrs, ['EMI', 'EMI_AMOUNT', 'MINIMUM_DUE', 'MIN_DUE', 'MONTHLY_INSTALLMENT']);
    if (rawEmi) emi = cleanNum(rawEmi);
  }

  // 4. Account / Loan Number
  let accountNo = c.account_number || '';
  if (!accountNo) {
    const rawAcc = findAttr(attrs, ['LOAN_ACCOUNT', 'LOAN_ACC', 'ACCOUNT_NO', 'ACCOUNT_NUMBER', 'CARD_NO', 'CARD_NUMBER', 'ACC_NO', 'DEALER_CODE', 'A/C', 'A/C_NO', 'CONTRACT_NO']);
    if (rawAcc) accountNo = String(rawAcc);
  }

  // 5. Allocation Date
  let allocDate = c.allocation_date;
  const rawAlloc = findAttr(attrs, ['DATE_OF_ALLOCATION', 'ALLOCATION_DATE', 'ALLOC_DATE', 'DATE_ALLOCATED']);
  if (rawAlloc) allocDate = String(rawAlloc);

  // 6. Expiry Date
  let expDate = c.expiry_date;
  const rawExp = findAttr(attrs, ['WORK_ORDER_EXPIRY_DATE', 'EXPIRY_DATE', 'EXPIRY', 'EXPIRE_DATE']);
  if (rawExp) expDate = String(rawExp);

  // 7. Bank Classification Status (e.g. DF, BL, SS, SMA, STD)
  let bankStatus = c.legal_status;
  const rawStat = findAttr(attrs, ['STATUS', 'LOAN_STATUS', 'CLASSIFICATION', 'BUCKET', 'DPD_STATUS', 'LAP_STATUS']);
  if (rawStat) {
    bankStatus = String(rawStat);
  }

  // 8. Collector / Bank Officer Name
  let collectorName = c.collector_name || '';
  if (!collectorName) {
    const rawColl = findAttr(attrs, ['COLLECTOR_NAME', 'COLLECTOR', 'BANK_COLLECTOR', 'BANK_OFFICER', 'OFFICER_NAME', 'CONTACT_PERSON', 'RELATIONSHIP_OFFICER', 'RO_NAME', 'BANK_MANAGER', 'PORTFOLIO_OFFICER', 'COORDINATOR', 'RM_NAME']);
    if (rawColl) collectorName = String(rawColl).trim();
  }

  return {
    ...c,
    outstanding_amount: outstanding,
    overdue_amount: overdue,
    minimum_payment: emi,
    account_number: accountNo,
    collector_name: collectorName,
    allocation_date: allocDate,
    expiry_date: expDate,
    legal_status: bankStatus,
    bank: getAllSystemBanks().find(b => b.id === c.bank_id) || INITIAL_BANKS.find(b => b.id === c.bank_id),
    product: getAllSystemProducts().find(p => p.id === c.product_id) || INITIAL_PRODUCTS.find(p => p.id === c.product_id),
  };
}

function mapCaseToDb(c: CaseFile): any {
  return {
    id: c.id,
    file_number: c.file_number,
    bank_id: c.bank_id,
    product_id: c.product_id,
    account_number: c.account_number || '',
    customer_name: c.customer_name,
    customer_phone: c.customer_phone || '',
    customer_secondary_phone: c.customer_secondary_phone || '',
    customer_address_present: c.customer_address_present || '',
    customer_address_permanent: c.customer_address_permanent || '',
    present_address_visited: Boolean(c.present_address_visited),
    permanent_address_visited: Boolean(c.permanent_address_visited),
    outstanding_amount: Number(c.outstanding_amount) || 0,
    overdue_amount: Number(c.overdue_amount) || 0,
    minimum_payment: c.minimum_payment ? Number(c.minimum_payment) : null,
    status: c.status || 'new',
    legal_status: c.legal_status || 'Normal Recovery',
    availability_status: c.availability_status || null,
    assigned_agent_id: c.assigned_agent_id ? Number(c.assigned_agent_id) : null,
    agent_name: c.agent_name || '',
    assigned_manager_id: c.assigned_manager_id ? Number(c.assigned_manager_id) : null,
    allocation_date: c.allocation_date || null,
    expiry_date: c.expiry_date || null,
    last_visit_at: c.last_visit_at || null,
    total_collected_amount: Number(c.total_collected_amount) || 0,
    extra_attributes: {
      ...(c.extra_attributes || {}),
      AGENT_NAME: c.agent_name || '',
      COLLECTOR_NAME: c.collector_name || '',
      BANK_NAME: c.bank_name || c.extra_attributes?.BANK_NAME || c.bank?.name || '',
      PRODUCT_NAME: c.product_name || c.extra_attributes?.PRODUCT_NAME || c.product?.name || '',
      FILE_TYPE: c.extra_attributes?.FILE_TYPE || c.product_name || '',
      BRANCH_NAME: c.branch_name || c.extra_attributes?.BRANCH_NAME || '',
      AREA: c.area || c.extra_attributes?.AREA || '',
      LAP_STATUS: c.lap_status || c.extra_attributes?.LAP_STATUS || '',
      FILE_STATUS: c.extra_attributes?.FILE_STATUS || '',
    },
    created_at: c.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function mapCaseFromDb(row: any): CaseFile {
  const extraAttrs = typeof row.extra_attributes === 'object' && row.extra_attributes !== null ? row.extra_attributes : {};
  return enrichCase({
    id: Number(row.id),
    file_number: String(row.file_number || row.case_no || `FILE-${row.id}`),
    bank_id: Number(row.bank_id || 1),
    product_id: Number(row.product_id || 1),
    account_number: row.account_number || '',
    customer_name: row.customer_name || row.name || 'Customer',
    customer_phone: row.customer_phone || row.phone || '',
    customer_secondary_phone: row.customer_secondary_phone || '',
    customer_address_present: row.customer_address_present || row.present_address || '',
    customer_address_permanent: row.customer_address_permanent || row.permanent_address || '',
    present_address_visited: Boolean(row.present_address_visited),
    permanent_address_visited: Boolean(row.permanent_address_visited),
    outstanding_amount: Number(row.outstanding_amount) || 0,
    overdue_amount: Number(row.overdue_amount) || 0,
    minimum_payment: row.minimum_payment ? Number(row.minimum_payment) : undefined,
    status: row.status || 'new',
    legal_status: row.legal_status || 'Normal Recovery',
    availability_status: row.availability_status || undefined,
    assigned_agent_id: row.assigned_agent_id ? Number(row.assigned_agent_id) : undefined,
    agent_name: row.agent_name || '',
    collector_name: row.collector_name || extraAttrs.COLLECTOR_NAME || '',
    assigned_manager_id: row.assigned_manager_id ? Number(row.assigned_manager_id) : undefined,
    allocation_date: row.allocation_date || undefined,
    expiry_date: row.expiry_date || undefined,
    last_visit_at: row.last_visit_at || undefined,
    total_collected_amount: Number(row.total_collected_amount) || 0,
    extra_attributes: extraAttrs,
    bank_name: extraAttrs.BANK_NAME || row.bank_name || undefined,
    product_name: extraAttrs.PRODUCT_NAME || extraAttrs.FILE_TYPE || row.product_name || undefined,
    branch_name: extraAttrs.BRANCH_NAME || row.branch_name || undefined,
    area: extraAttrs.AREA || row.area || undefined,
    lap_status: extraAttrs.LAP_STATUS || row.lap_status || undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  });
}

class DataService {
  private cases: CaseFile[] = [];
  private remarks: CaseRemark[] = [];
  private checkIns: CheckIn[] = [];
  private collections: Collection[] = [];
  private contacts: BankContact[] = [];
  private listeners: Set<() => void> = new Set();
  private realtimeChannel: any = null;
  /** Prevents overlapping cloud syncs: a full sync of 1500+ rows takes several
   *  seconds, and the 15s poll + realtime events + focus events can start
   *  multiple syncs at once. Overlapping syncs abort with "request already running"
   *  style PostgREST errors and surface as the "sync stops at 1000 / shows error" bug. */
  private syncInFlight: Promise<{ success: boolean; count: number; error?: string }> | null = null;
  private realtimeSyncTimer: ReturnType<typeof setTimeout> | null = null;
  /** Guard for full-replace sheet syncs (replaceAllCasesFromSheet/Contacts):
   *  these rewrite every id; two running at once interleave Date.now()+idx
   *  assignments and produce duplicate ids that abort the upserts. */
  private sheetReplaceInFlight: Promise<void> | null = null;

  constructor() {
    this.loadState();
    // Self-heal: every bank name that ever appeared in an uploaded case file is
    // registered deterministically, so legacy contacts whose bank_id was hashed
    // from an unmatched BANK_NAME get their Bank entry back and the Bank
    // Contacts filter shows them again on every device.
    this.registerBanksFromCases();
    // One-time purge of sample/demo bank contacts (flag prevents it from ever re-running)
    this.purgeSampleContactsOnce();
    // One-time repair: files uploaded before the STATUS-column fix are stuck at
    // the generic 'new' even though their classification (STD/SMA/SS/DF/BL…)
    // is stored in extra_attributes.STATUS — promote it so the badge is real.
    if (!localStorage.getItem('rc_status_repair_v1')) {
      try {
        let repaired = 0;
        this.cases = this.cases.map(c => {
          if (String(c.status || '').toLowerCase() !== 'new') return c;
          const raw = String(c.extra_attributes?.STATUS || '').trim();
          if (!raw || raw.toLowerCase() === 'new') return c;
          const lower = raw.toLowerCase();
          const promoted = lower.includes('✅') || lower === 'active'
            ? 'active'
            : lower.includes('❌') || lower === 'expired'
              ? 'expired'
              : raw.toUpperCase();
          repaired++;
          return { ...c, status: promoted } as CaseFile;
        });
        if (repaired > 0) {
          this.saveState();
          // Persist the promoted classifications to Supabase for every device
          this.pushAllCasesToCloudStrict(this.cases).catch(() => {});
        }
      } catch (_) {}
      localStorage.setItem('rc_status_repair_v1', '1');
    }
    // Initial pull from Supabase on startup
    this.syncWithCloud();
    // Set up real-time subscriptions for instant cross-device sync
    this.setupRealtime();

    if (typeof window !== 'undefined') {
      // Periodic background poll as a safety net for missed realtime events.
      // Realtime pushes updates instantly, so this only needs to run once a
      // minute — polling all 5 tables every 15s made the app sluggish.
      setInterval(() => {
        if (document.visibilityState !== 'visible') return; // skip hidden tabs
        this.syncWithCloud();
      }, 60_000);

      // Instant refresh whenever user focuses window or turns on device screen
      window.addEventListener('focus', () => {
        this.syncWithCloud();
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.syncWithCloud();
        }
      });
    }
  }

  // ── Bank registry self-healing (see constructor) ─────────────────────────
  private registerBanksFromCases() {
    try {
      const names = new Set<string>();
      this.cases.forEach(c => {
        const n = String(
          c.bank_name ||
          c.extra_attributes?.BANK_NAME ||
          ''
        ).trim();
        if (n) names.add(n);
      });
      names.forEach(n => ensureBankRegistered(n));
      // Sync the registry to cloud so OTHER devices see the same banks/ids
      const registered = getRegisteredBanks();
      if (registered.length > 0) persistRegisteredBanks(registered);
    } catch (_) {}
  }

  // ── Real-time Supabase subscriptions ─────────────────────────────────────
  private setupRealtime() {
    if (typeof window === 'undefined') return;
    try {
      // A 1500-row upsert fires ~60 realtime events, each previously starting a full
      // sync → request storm → aborted requests → "sync stops and errors". Debounce
      // so the refresh runs once, 2s after the last change in a burst.
      const debouncedFullSync = () => {
        if (this.realtimeSyncTimer) clearTimeout(this.realtimeSyncTimer);
        this.realtimeSyncTimer = setTimeout(() => {
          this.realtimeSyncTimer = null;
          this.syncWithCloud();
        }, 2000);
      };
      this.realtimeChannel = supabase
        .channel('recovery-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'cases' }, debouncedFullSync)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'case_remarks' }, () => {
          this.syncRemarks();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'check_ins' }, () => {
          this.syncCheckIns();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'collections' }, () => {
          this.syncCollections();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bank_contacts' }, () => {
          this.syncContacts();
        })
        .subscribe();      } catch (_) {
      // Fallback to polling every 60s if real-time unavailable
      setInterval(() => {
        if (document.visibilityState !== 'visible') return;
        this.syncWithCloud();
      }, 60_000);
    }
  }

  // ── Individual table sync helpers ─────────────────────────────────────────
  private async syncRemarks() {
    try {
      const data = await fetchAllRows('case_remarks', '*', 'created_at', false).catch(() => []);
      if (Array.isArray(data) && data.length > 0) {
        this.remarks = data as CaseRemark[];
        this.saveState();
        this.notifySubscribers();
      }
    } catch (_) {}
  }

  private async syncCheckIns() {
    try {
      const data = await fetchAllRows('check_ins', '*', 'created_at', false).catch(() => []);
      if (Array.isArray(data) && data.length > 0) {
        this.checkIns = data as CheckIn[];
        this.saveState();
        this.notifySubscribers();
      }
    } catch (_) {}
  }

  private async syncCollections() {
    try {
      const data = await fetchAllRows('collections', '*', 'created_at', false).catch(() => []);
      if (Array.isArray(data) && data.length > 0) {
        this.collections = data.map((col: any) => ({
          ...col,
          // Coerce ids to numbers so case-map lookups (string/number) never miss.
          id: Number(col.id),
          case_file_id: Number(col.case_file_id || col.case_id || 0),
          agent_id: Number(col.agent_id || 0),
          // Preserve verification state — without this, approved/rejected
          // payments flip back to "pending" on every sync/refresh.
          status: col.status || undefined,
          rejection_reason: col.rejection_reason || undefined,
          verified_at: col.verified_at || undefined,
          verified_by: col.verified_by || undefined,
        })) as Collection[];
        this.saveState();
        this.notifySubscribers();
      }
    } catch (_) {}
  }

  private async syncContacts() {
    const SUPABASE_URL = 'https://qjcuzydfxbdhepcumale.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_IBUA2iCD_p1b3rmTuC7zGg_Lk-ViIaA';

    try {
      // 1. Try Supabase client (paginated — loads ALL contacts)
      const data = await fetchAllRows('bank_contacts').catch(() => []);
      if (Array.isArray(data) && data.length > 0) {
        this.contacts = this.backfillContactBankNames(data as BankContact[]);
        this.saveState();
        this.notifySubscribers();
        return;
      }
    } catch (_) {}

    // 2. Direct REST fallback
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/bank_contacts?select=*`, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Accept': 'application/json',
        }
      });
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows.length > 0) {
          this.contacts = this.backfillContactBankNames(rows as BankContact[]);
          this.saveState();
          this.notifySubscribers();
          return;
        }
      }
    } catch (_) {}

    // 3. If cloud is empty but local has contacts, auto-push to cloud
    if (this.contacts.length > 0) {
      this.pushContactsToCloud(this.contacts).catch(() => {});
    }
  }

  /**
   * One-time cleanup (v2): wipes ALL existing bank contacts so the directory
   * starts empty — the admin then uploads the real contact list via the
   * Bank Contacts → Upload Excel button. The flag value is versioned so this
   * purge runs once even if an earlier flag ('1') was already set.
   */
  private purgeSampleContactsOnce() {
    try {
      if (localStorage.getItem('recovery_contacts_purged') === '2') return;
      // Also drop leftover Google Sheet sync settings (feature removed)
      localStorage.removeItem('gsheet_sync_settings');
      // Purge and only set the flag after the cloud delete completes
      this.purgeAllContactsFromCloud()
        .then(() => {
          try { localStorage.setItem('recovery_contacts_purged', '2'); } catch (_) {}
        })
        .catch(() => {});
    } catch (_) {}
  }

  /** Deletes ALL bank contacts from cloud and local storage (used to purge sample/demo data once). */
  public async purgeAllContactsFromCloud(): Promise<number> {
    let deleted = 0;
    try {
      const { data, error } = await supabase.from('bank_contacts').delete().neq('id', 0).select('id');
      if (!error && Array.isArray(data)) deleted = data.length;
    } catch (_) {}
    // REST fallback in case the client call failed
    if (deleted === 0) {
      try {
        const SUPABASE_URL = 'https://qjcuzydfxbdhepcumale.supabase.co';
        const SUPABASE_KEY = 'sb_publishable_IBUA2iCD_p1b3rmTuC7zGg_Lk-ViIaA';
        const res = await fetch(`${SUPABASE_URL}/rest/v1/bank_contacts?id=neq.0`, {
          method: 'DELETE',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Prefer': 'return=representation',
          }
        });
        if (res.ok) {
          const rows = await res.json();
          if (Array.isArray(rows)) deleted = rows.length;
        }
      } catch (_) {}
    }
    this.contacts = [];
    this.saveState();
    this.notifySubscribers();
    return deleted;
  }

  /** Fill in c.bank_name from the registry wherever it's missing so UI badges
   *  show real names instead of "BANK #96431". */
  private backfillContactBankNames(list: BankContact[]): BankContact[] {
    const banks = getAllSystemBanks();
    list.forEach(c => {
      const anyC = c as any;
      if (!anyC.bank_name || !String(anyC.bank_name).trim()) {
        const b = banks.find(x => x.id === c.bank_id);
        if (b) anyC.bank_name = b.name;
      }
    });
    return list;
  }

  public async pushContactsToCloud(contactList: BankContact[]): Promise<{ count: number; error?: string }> {
    if (!contactList || contactList.length === 0) return { count: 0 };
    const SUPABASE_URL = 'https://qjcuzydfxbdhepcumale.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_IBUA2iCD_p1b3rmTuC7zGg_Lk-ViIaA';

    try {
      // 1. Fetch existing contacts to match IDs by name + bank_id (paginated — ALL rows)
      const existingRows = await fetchAllRows('bank_contacts', 'id, name, bank_id').catch(() => []);
      const existingMap = new Map<string, number>();
      if (Array.isArray(existingRows)) {
        existingRows.forEach((r: any) => {
          if (r.name && r.id) {
            existingMap.set(`${String(r.name).trim().toLowerCase()}___${r.bank_id}`, Number(r.id));
          }
        });
      }

      const rows = contactList.map((c, idx) => {
        const key = `${String(c.name).trim().toLowerCase()}___${c.bank_id}`;
        const finalId = existingMap.get(key) || c.id || (Date.now() + idx);
        c.id = finalId;
        // Resolve the bank NAME once here so the cloud row is self-describing
        // (cards never fall back to "BANK #id" on devices missing the registry).
        const bankName =
          (c as any).bank_name?.trim() ||
          getAllSystemBanks().find(b => b.id === c.bank_id)?.name ||
          '';
        return {
          id: finalId,
          bank_id: c.bank_id,
          bank_name: bankName,
          name: c.name || '',
          designation: c.designation || '',
          department: c.department || '',
          phone: c.phone || '',
          email: c.email || '',
          branch: c.branch || '',
          notes: c.notes || '',
          created_at: c.created_at || new Date().toISOString()
        };
      });

      // 2. Delete stale contacts from Supabase that were deleted from the sheet
      if (Array.isArray(existingRows)) {
        const activeIds = new Set(rows.map(r => r.id));
        const staleIds = existingRows.filter((r: any) => !activeIds.has(Number(r.id))).map((r: any) => r.id);
        if (staleIds.length > 0) {
          for (let i = 0; i < staleIds.length; i += 200) {
            await supabase.from('bank_contacts').delete().in('id', staleIds.slice(i, i + 200));
          }
        }
      }

      // 3. Upsert active contacts in 200-row batches (deduped first)
      const dedupedContacts = dedupeById(rows);
      for (let i = 0; i < dedupedContacts.length; i += 200) {
        const chunk = dedupedContacts.slice(i, i + 200);
        const { error } = await supabase.from('bank_contacts').upsert(chunk, { onConflict: 'id' });
        if (error && /bank_name/i.test(error.message || '')) {
          // Column not added yet (schema addition not run) - retry without it
          // so contact sync keeps working; names backfill from the registry.
          const fallback = chunk.map(({ bank_name: _drop, ...rest }) => rest);
          await supabase.from('bank_contacts').upsert(fallback, { onConflict: 'id' });
        }
      }

      return { count: dedupedContacts.length };
    } catch (err: any) {
      console.warn('pushContactsToCloud note:', err);
      return { count: 0, error: err?.message || String(err) };
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifySubscribers() {
    this.listeners.forEach(fn => {
      try { fn(); } catch (_) {}
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('recovery_data_synced'));
    }
  }

  private loadState() {
    // Purge any legacy sample/demo mock data or heavy cases JSON from localStorage
    localStorage.removeItem('recovery_cases');
    const dataVersion = localStorage.getItem('recovery_clean_data_version');
    if (dataVersion !== '6.0_no_local_cases') {
      localStorage.removeItem('recovery_remarks');
      localStorage.removeItem('recovery_checkins');
      localStorage.removeItem('recovery_collections');
      localStorage.removeItem('recovery_contacts');
      localStorage.setItem('recovery_clean_data_version', '6.0_no_local_cases');
    }

    // Cases are strictly memory + Supabase Cloud (never stored in limited 5MB localStorage)
    this.cases = [];

    const savedRemarks = localStorage.getItem('recovery_remarks');
    this.remarks = savedRemarks ? JSON.parse(savedRemarks) : [];

    const savedCheckIns = localStorage.getItem('recovery_checkins');
    this.checkIns = savedCheckIns ? JSON.parse(savedCheckIns) : [];

    const savedCollections = localStorage.getItem('recovery_collections');
    this.collections = savedCollections ? JSON.parse(savedCollections) : [];

    const savedContacts = localStorage.getItem('recovery_contacts');
    this.contacts = savedContacts ? JSON.parse(savedContacts) : [];
  }

  private saveState() {
    // Note: this.cases is NOT stored in localStorage to prevent 5MB browser quota errors!
    // Cases are safely and permanently stored in Supabase Cloud database and live in memory.
    try {
      localStorage.removeItem('recovery_cases');
    } catch (_) {}
    try {
      localStorage.setItem('recovery_remarks', JSON.stringify(this.remarks));
    } catch (_) {}
    try {
      localStorage.setItem('recovery_checkins', JSON.stringify(this.checkIns));
    } catch (_) {}
    try {
      localStorage.setItem('recovery_collections', JSON.stringify(this.collections));
    } catch (_) {}
    try {
      localStorage.setItem('recovery_contacts', JSON.stringify(this.contacts));
    } catch (_) {}
  }

  // ── Two-Way Cloud Synchronization with Supabase ───────────────────────────
  public async syncWithCloud(forcePush = false): Promise<{ success: boolean; count: number; error?: string }> {
    // Re-entrancy guard: return the in-flight sync instead of starting a second one
    if (this.syncInFlight) return this.syncInFlight;
    const job = this.doSyncWithCloud(forcePush).finally(() => {
      this.syncInFlight = null;
    });
    this.syncInFlight = job;
    return job;
  }

  private async doSyncWithCloud(forcePush = false): Promise<{ success: boolean; count: number; error?: string }> {
    try {
      // Offline-safety: replay any queued offline writes BEFORE pulling cloud
      // data, so queued edits are never overwritten by a stale pull.
      if (offlineQueue.getPending() > 0) {
        await offlineQueue.flush();
      }

      if (forcePush && this.cases.length > 0) {
        const pushRes = await this.pushCasesToCloud(this.cases);
        if (pushRes.error) {
          return { success: false, count: this.cases.length, error: `Push error: ${pushRes.error}` };
        }
      }

      // 1. Sync Cases from Supabase (paginated — loads ALL rows, not just the first 1000)
      let cloudCases: any[] = [];
      let casesErr: { message: string } | null = null;
      try {
        cloudCases = await fetchAllRows('cases', '*', 'created_at', true);
      } catch (e: any) {
        casesErr = { message: e?.message || String(e) };
      }
      if (casesErr) {
        console.warn('Supabase fetch cases note:', casesErr);
        if (this.cases.length > 0) {
          const pushRes = await this.pushCasesToCloud(this.cases);
          if (pushRes.error) {
            return { success: false, count: this.cases.length, error: `Fetch: ${casesErr.message}, Push: ${pushRes.error}` };
          }
        }
        return { success: false, count: this.cases.length, error: casesErr.message };
      }

      if (Array.isArray(cloudCases)) {
        if (cloudCases.length > 0) {
          const freshCases = cloudCases.map(row => mapCaseFromDb(row));
          const localMap = new Map(this.cases.map(c => [c.id, c]));
          const hasDiff = freshCases.length !== this.cases.length ||
            freshCases.some(fc => {
              const lc = localMap.get(fc.id);
              return !lc || lc.updated_at !== fc.updated_at || lc.agent_name !== fc.agent_name || lc.status !== fc.status;
            });
          if (hasDiff) {
            this.cases = freshCases;
            this.registerBanksFromCases();
            this.saveState();
            this.notifySubscribers();
          }
        } else if (this.cases.length > 0) {
          // If cloud is empty but local has cases (e.g. initial upload), push to cloud
          const pushRes = await this.pushCasesToCloud(this.cases);
          if (pushRes.error) {
            return { success: false, count: this.cases.length, error: `Cloud push error: ${pushRes.error}` };
          }
        }
      }

      // 2. Sync Remarks from Supabase (paginated)
      const cloudRemarks = await fetchAllRows('case_remarks').catch(() => []);
      if (Array.isArray(cloudRemarks) && cloudRemarks.length > 0) {
        this.remarks = cloudRemarks.map((r: any) => ({
          id: Number(r.id),
          case_file_id: Number(r.case_file_id || r.case_id),
          user_id: Number(r.user_id),
          contact_status: r.contact_status || 'contacted',
          promised_amount: r.promised_amount ? Number(r.promised_amount) : undefined,
          promise_date: r.promise_date || undefined,
          remarks: r.remarks || '',
          created_at: r.created_at || new Date().toISOString()
        }));
        this.saveState();
      }

      // 3. Sync CheckIns from Supabase (paginated)
      const cloudCheckins = await fetchAllRows('check_ins').catch(() => []);
      if (Array.isArray(cloudCheckins) && cloudCheckins.length > 0) {
        this.checkIns = cloudCheckins.map((ci: any) => ({
          id: Number(ci.id),
          case_file_id: Number(ci.case_file_id || ci.case_id),
          agent_id: Number(ci.agent_id),
          address_type: ci.address_type || 'present',
          latitude: Number(ci.latitude),
          longitude: Number(ci.longitude),
          accuracy: ci.accuracy ? Number(ci.accuracy) : undefined,
          notes: ci.notes || '',
          visited_at: ci.visited_at || new Date().toISOString()
        }));
        this.saveState();
      }

      // 4. Sync Collections from Supabase (paginated) — keep verification fields!
      const cloudCols = await fetchAllRows('collections').catch(() => []);
      if (Array.isArray(cloudCols) && cloudCols.length > 0) {
        this.collections = cloudCols.map((col: any) => ({
          id: Number(col.id),
          case_file_id: Number(col.case_file_id || col.case_id),
          agent_id: Number(col.agent_id),
          amount: Number(col.amount),
          payment_method: col.payment_method || 'cash',
          receipt_number: col.receipt_number || '',
          collected_at: col.collected_at || new Date().toISOString(),
          // Verification state (approved/rejected) must survive refreshes:
          status: col.status || undefined,
          rejection_reason: col.rejection_reason || undefined,
          verified_at: col.verified_at || undefined,
          verified_by: col.verified_by || undefined,
          notes: col.notes || undefined,
          photo_url: col.photo_url || undefined,
        }));
        this.saveState();
      }

      // 5. Sync Contacts from Supabase (with full REST fallback & auto-push)
      await this.syncContacts();

      // 6. Sync Templates from Supabase → localStorage (cloud is source of truth)
      try {
        const cloudTemplates = await fetchAllRows('file_templates').catch(() => []);
        if (Array.isArray(cloudTemplates)) {
          const remoteCustom: Record<string, any> = {};
          let remoteHiddenPrebuilts: string[] = [];
          let registryChanged = false;

          cloudTemplates.forEach((t: any) => {
            try {
              if (t.template_key === BRANDING_CLOUD_KEY) {
                // Shared branding (logo + titles): apply so every device shows
                // the same login/header branding the admin saved.
                applyCloudBranding(t.definition);
                return;
              }
              if (t.template_key === '__powerbi__') {
                // Shared Power BI embed URL: notify the Power BI page so every
                // device shows the same dashboard link.
                try {
                  const def = typeof t.definition === 'string' ? JSON.parse(t.definition) : t.definition;
                  const url = def?.url || '';
                  const prev = localStorage.getItem('recoverypro_powerbi_embed_url');
                  if (url !== (prev || '')) {
                    if (url) localStorage.setItem('recoverypro_powerbi_embed_url', url);
                    else localStorage.removeItem('recoverypro_powerbi_embed_url');
                    window.dispatchEvent(new CustomEvent('powerbi-url-updated', { detail: url }));
                  }
                } catch (_) {}
                return;
              }
              if (t.template_key === 'agent_monthly_targets') {
                // Shared agent monthly collection targets: notify the analytics
                // page so every device computes the same target progress.
                try {
                  const def = typeof t.definition === 'string' ? JSON.parse(t.definition) : t.definition;
                  const targets = def?.targets || {};
                  const prev = localStorage.getItem('recoverypro_agent_monthly_targets');
                  const same = JSON.stringify(prev ? JSON.parse(prev) : {}) === JSON.stringify(targets);
                  if (!same) {
                    localStorage.setItem('recoverypro_agent_monthly_targets', JSON.stringify(targets));
                    window.dispatchEvent(new CustomEvent('agent-targets-updated', { detail: targets }));
                  }
                } catch (_) {}
                return;
              }
              if (t.template_key === REGISTERED_BANKS_CLOUD_KEY) {
                // Shared bank registry: merge remote banks so this device resolves
                // the same bank names to the same ids (Bank Contacts filter fix)
                if (applyCloudRegisteredBanks(t.definition)) {
                  registryChanged = true;
                }
                return;
              }
              if (t.template_key === '__hidden_prebuilts__') {
                // Special entry: list of built-in template keys hidden by user
                const val = typeof t.definition === 'string' ? JSON.parse(t.definition) : t.definition;
                remoteHiddenPrebuilts = Array.isArray(val) ? val : (val?.keys || []);
              } else {
                const def = typeof t.definition === 'string' ? JSON.parse(t.definition) : t.definition;
                remoteCustom[t.template_key] = def;
              }
            } catch (_) {}
          });

          // REPLACE local custom templates with cloud (cloud is source of truth — deletions propagate)
          if (Object.keys(remoteCustom).length > 0) {
            localStorage.setItem('recoverypro_custom_templates', JSON.stringify(remoteCustom));
          } else {
            localStorage.removeItem('recoverypro_custom_templates');
          }

          // Sync hidden prebuilts (built-in deletions) across devices
          if (remoteHiddenPrebuilts.length > 0) {
            localStorage.setItem('recoverypro_hidden_prebuilts', JSON.stringify(remoteHiddenPrebuilts));
          } else {
            localStorage.removeItem('recoverypro_hidden_prebuilts');
          }

          // Notify AFTER all registry/template merges so the UI reloads with
          // fresh bank data (otherwise the Bank Contacts filter shows stale banks)
          if (registryChanged) {
            this.registerBanksFromCases(); // re-register in case ids shifted
          }
          this.notifySubscribers(); // Trigger ExcelImporter to reload
        }
      } catch (_) {}

      return { success: true, count: this.cases.length };
    } catch (err: any) {
      console.warn('Cloud sync error:', err);
      return { success: false, count: this.cases.length, error: err?.message || String(err) };
    }
  }

  // Push a single custom template (or all) to Supabase file_templates table
  public async pushTemplateToCloud(templateKey: string, templateDef: any): Promise<{ error?: string }> {
    const result = await offlineQueue.run({
      kind: 'upsert', table: 'file_templates',
      rows: [{ template_key: templateKey, definition: templateDef, updated_at: new Date().toISOString() }],
      onConflict: 'template_key'
    });
    return result.error ? { error: result.error } : {};
  }

  // Push ALL custom templates currently saved in localStorage to Supabase
  public async pushAllTemplatesToCloud(): Promise<{ count: number; error?: string }> {
    try {
      const saved = localStorage.getItem('recoverypro_custom_templates');
      if (!saved) return { count: 0 };
      const customTemplates: Record<string, any> = JSON.parse(saved);
      const rows = Object.entries(customTemplates).map(([key, def]) => ({
        template_key: key,
        definition: def,
        updated_at: new Date().toISOString()
      }));
      if (rows.length === 0) return { count: 0 };
      const result = await offlineQueue.run({
        kind: 'upsert', table: 'file_templates', rows, onConflict: 'template_key'
      });
      if (result.error) return { count: 0, error: result.error };
      return { count: rows.length };
    } catch (err: any) {
      return { count: 0, error: err?.message || String(err) };
    }
  }

  public async pushCasesToCloud(caseList: CaseFile[]): Promise<{ count: number; error?: string }> {
    if (!caseList || caseList.length === 0) return { count: 0 };
    try {
      // 1. Fetch existing case ids mapped by file_number to preserve exact id keys (paginated)
      let existingMap = new Map<string, number>();
      try {
        const existingRows = await fetchAllRows('cases', 'id, file_number').catch(() => []);
        if (Array.isArray(existingRows)) {
          existingRows.forEach((r: any) => {
            if (r.file_number && r.id) existingMap.set(String(r.file_number).trim(), Number(r.id));
          });
        }
      } catch (_) {}

      // Assign persistent IDs so cases_pkey never conflicts
      const dbRows = dedupeById(caseList.map((c, idx) => {
        const existingId = existingMap.get(String(c.file_number).trim());
        const finalId = existingId || c.id || (Date.now() + idx);
        c.id = finalId;
        return mapCaseToDb(c);
      }));

      // 200-row batches: 25-row batches × 1500 files = 60 sequential requests,
      // which is slow enough that the next poll/focus/realtime sync would overlap
      // and abort the in-flight one. Larger batches finish well inside one window.
      for (let i = 0; i < dbRows.length; i += 200) {
        const chunk = dbRows.slice(i, i + 200);
        const { error } = await supabase.from('cases').upsert(chunk, { onConflict: 'id' });
        if (error) {
          console.error('Error upserting chunk on id:', error);
          // Fallback to file_number
          const { error: err2 } = await supabase.from('cases').upsert(chunk, { onConflict: 'file_number' });
          if (err2) {
            return { count: 0, error: error.message || (error as any).details || JSON.stringify(error) };
          }
        }
      }
      this.saveState();
      return { count: dbRows.length };
    } catch (err: any) {
      console.error('Pushing cases to cloud exception:', err);
      return { count: 0, error: err?.message || String(err) };
    }
  }

  // Strictly push a new list of cases to Supabase, deleting any old cases that are no longer present
  public async pushAllCasesToCloudStrict(caseList: CaseFile[]): Promise<{ count: number; error?: string }> {
    if (!caseList || caseList.length === 0) return { count: 0 };
    try {
      let existingRows: any[] = [];
      try {
        // Paginated: must see ALL existing rows, otherwise files past #1000
        // get treated as "new" and can duplicate or collide
        existingRows = await fetchAllRows('cases', 'id, file_number').catch(() => []);
      } catch (_) {}

      const existingMap = new Map<string, number>();
      existingRows.forEach((r: any) => {
        if (r.file_number && r.id) existingMap.set(String(r.file_number).trim().toLowerCase(), Number(r.id));
      });

      // 1. Delete obsolete cases from cloud that are no longer in this sheet
      const activeFileNos = new Set(caseList.map(c => String(c.file_number || '').trim().toLowerCase()));
      const staleIds = existingRows
        .filter((r: any) => !activeFileNos.has(String(r.file_number || '').trim().toLowerCase()))
        .map((r: any) => r.id);

      if (staleIds.length > 0) {
        for (let i = 0; i < staleIds.length; i += 50) {
          const chunk = staleIds.slice(i, i + 50);
          await supabase.from('cases').delete().in('id', chunk);
        }
      }

      // 2. Prepare DB rows (deduped — duplicate ids abort the entire upsert batch)
      const dbRows = dedupeById(caseList.map((c, idx) => {
        const existingId = existingMap.get(String(c.file_number).trim().toLowerCase());
        const finalId = existingId || c.id || (Date.now() + idx);
        c.id = finalId;
        return mapCaseToDb(c);
      }));

      // 3. Upsert active cases in 200-row batches (see pushCasesToCloud note)
      let upsertError: string | null = null;
      for (let i = 0; i < dbRows.length; i += 200) {
        const chunk = dbRows.slice(i, i + 200);
        const { error } = await supabase.from('cases').upsert(chunk, { onConflict: 'id' });
        if (error) {
          console.error('Error upserting chunk on id, falling back to file_number:', error);
          const { error: err2 } = await supabase.from('cases').upsert(chunk, { onConflict: 'file_number' });
          if (err2) {
            // Record the error but keep pushing the remaining chunks so one bad
            // batch no longer kills the whole sync at file ~1000.
            upsertError = err2.message || JSON.stringify(err2);
          }
        }
      }

      this.saveState();
      return upsertError ? { count: dbRows.length, error: upsertError } : { count: dbRows.length };
    } catch (err: any) {
      console.error('pushAllCasesToCloudStrict exception:', err);
      return { count: 0, error: err?.message || String(err) };
    }
  }

  public getBanks(): Bank[] {
    return getAllSystemBanks();
  }

  public getProducts(): Product[] {
    return getAllSystemProducts();
  }

  public getContacts(_user?: User): BankContact[] {
    const banks = getAllSystemBanks();
    return this.contacts.map(c => ({
      ...c,
      bank: banks.find(b => b.id === c.bank_id) || INITIAL_BANKS.find(b => b.id === c.bank_id)
    }));
  }

  public getMissingCollectorContacts(user?: User): { collectorName: string; bankId: number; bankName: string; caseCount: number }[] {
    const contacts = this.getContacts();
    const contactNames = new Set(contacts.map(c => c.name.toLowerCase().trim()));

    const map = new Map<string, { collectorName: string; bankId: number; bankName: string; caseCount: number }>();
    
    // If agent, check their allocated cases; otherwise check all cases
    const targetCases = user && user.role === 'agent' ? this.getCases(user) : this.cases;

    targetCases.forEach(c => {
      const enriched = enrichCase(c);
      const collector = enriched.collector_name?.trim();
      if (collector && collector.length > 1 && collector.toLowerCase() !== 'unassigned' && collector.toLowerCase() !== 'n/a') {
        if (!contactNames.has(collector.toLowerCase())) {
          const key = `${collector.toLowerCase()}___${enriched.bank_id}`;
          const bankName = enriched.bank?.name || 'Bank';
          const existing = map.get(key);
          if (existing) {
            existing.caseCount += 1;
          } else {
            map.set(key, {
              collectorName: collector,
              bankId: enriched.bank_id,
              bankName,
              caseCount: 1,
            });
          }
        }
      }
    });

    return Array.from(map.values());
  }

  public addContact(contact: Omit<BankContact, 'id'>): BankContact {
    const newContact: BankContact = {
      ...contact,
      id: Date.now()
    };
    this.contacts.unshift(newContact);
    this.saveState();
    this.notifySubscribers();

    // Cloud sync (offline-safe: queued and replayed when internet returns)
    const row = {
      id: newContact.id,
      bank_id: newContact.bank_id,
      bank_name: (newContact as any).bank_name || this.getBanks().find(b => b.id === newContact.bank_id)?.name || '',
      name: newContact.name || '',
      designation: newContact.designation || '',
      department: newContact.department || '',
      phone: newContact.phone || '',
      email: newContact.email || '',
      branch: newContact.branch || '',
      notes: newContact.notes || '',
      created_at: new Date().toISOString()
    };
    offlineQueue.runBackground({ kind: 'insert', table: 'bank_contacts', row });

    return newContact;
  }

  public updateContact(id: number, contact: Partial<BankContact>) {
    const existing = this.contacts.find(c => c.id === id);
    if (existing) {
      Object.assign(existing, contact);
      this.saveState();
      this.notifySubscribers();

      offlineQueue.runBackground({ kind: 'update', table: 'bank_contacts', row: contact, matchCol: 'id', matchVal: id });
    }
  }

  public deleteContact(id: number) {
    this.contacts = this.contacts.filter(c => c.id !== id);
    this.saveState();
    this.notifySubscribers();

    offlineQueue.runBackground({ kind: 'delete', table: 'bank_contacts', matchCol: 'id', matchVals: [id] });
  }

  public getCases(user: User): CaseFile[] {
    let list = [...this.cases];
    if (user.role === 'manager') {
      list = list.filter(c => c.assigned_manager_id === user.id);
    } else if (user.role === 'agent') {
      const uName = (user.name || '').trim().toLowerCase();
      const uEmp = (user.employee_id || '').trim().toLowerCase();
      const uEmail = (user.email || '').trim().toLowerCase();

      list = list.filter(c => {
        // 1. Direct ID match
        if (c.assigned_agent_id === user.id) return true;

        // 2. Name or employee_id string match on agent_name or extra_attributes
        const rawAgent = (
          c.agent_name || 
          c.extra_attributes?.AGENT_NAME || 
          c.extra_attributes?.AGENT || 
          c.extra_attributes?.FIELD_AGENT || 
          ''
        ).trim().toLowerCase();

        if (rawAgent && (
          rawAgent === uName || 
          (uEmp && rawAgent === uEmp) || 
          (uEmail && (rawAgent === uEmail || uEmail.startsWith(rawAgent))) ||
          uName.includes(rawAgent) ||
          rawAgent.includes(uName)
        )) {
          return true;
        }

        return false;
      });
    }

    return list.map(c => enrichCase(c));
  }

  public getCaseById(id: number | string): CaseFile | undefined {
    const target = Number(id);
    const item = this.cases.find(c => Number(c.id) === target || String(c.id) === String(id));
    if (!item) return undefined;
    return enrichCase(item);
  }

  // ── Google Sheets full-replace sync ─────────────────────────────────
  public async replaceAllCasesFromSheet(caseDataList: Record<string, any>[]) {
    // Re-entrancy guard: if a sheet replace is already running (a 1500-row
    // replace outlives the sync interval), join it instead of starting a
    // second concurrent replace that would collide on freshly-minted ids.
    if (this.sheetReplaceInFlight) return this.sheetReplaceInFlight;
    const job = this.doReplaceAllCasesFromSheet(caseDataList).finally(() => {
      this.sheetReplaceInFlight = null;
    });
    this.sheetReplaceInFlight = job;
    return job;
  }

  private async doReplaceAllCasesFromSheet(caseDataList: Record<string, any>[]) {
    if (caseDataList.length === 0) {
      this.cases = [];
      this.saveState();
      this.notifySubscribers();
      // Also wipe from Supabase so cloud sync doesn't restore old data
      try {
        await supabase.from('cases').delete().neq('id', 0);
      } catch (_) {}
      return;
    }

    const banks = getAllSystemBanks();
    const products = getAllSystemProducts();
    const now = new Date().toISOString();

    // Dedupe incoming sheet rows by FILE_NO (case-insensitive, last one wins).
    // Duplicate file numbers in the sheet would otherwise produce rows that
    // collide on id during upsert and abort the whole sync with
    // "cannot affect row a second time".
    const seenFileNos = new Set<string>();
    caseDataList = caseDataList.filter((data) => {
      const key = String(data.file_number || '').trim().toLowerCase();
      if (!key) return true;
      if (seenFileNos.has(key)) return false;
      seenFileNos.add(key);
      return true;
    });

    let registeredUsers: User[] = [];
    try {
      const saved = localStorage.getItem('recovery_all_users');
      if (saved) registeredUsers = JSON.parse(saved);
    } catch (_) {}

    const newCases: CaseFile[] = caseDataList.map((data, idx) => {
      // Resolve bank
      let bankId = 1;
      if (data.bank_name) {
        const bName = String(data.bank_name).trim().toLowerCase();
        const bank = banks.find(b => b.name.toLowerCase() === bName || b.code.toLowerCase() === bName);
        if (bank) bankId = bank.id;
        else {
          // Auto-create bank id from name hash
          let hash = 0;
          for (let i = 0; i < bName.length; i++) hash = ((hash << 5) - hash) + bName.charCodeAt(i);
          bankId = Math.abs(hash % 100000) + 100;
        }
      }

      // Resolve product
      let productId = 1;
      if (data.product_name) {
        const pName = String(data.product_name).trim().toLowerCase();
        const prod = products.find(p => p.bank_id === bankId && p.name.toLowerCase() === pName);
        if (prod) productId = prod.id;
        else {
          let hash = 0;
          const combined = `${bankId}_${pName}`;
          for (let i = 0; i < combined.length; i++) hash = ((hash << 5) - hash) + combined.charCodeAt(i);
          productId = Math.abs(hash % 100000) + 100;
        }
      }

      // Try to reuse existing case id by file number to preserve visit/remark references
      const existingCase = this.cases.find(c =>
        c.file_number.trim().toLowerCase() === String(data.file_number || '').trim().toLowerCase()
      );

      // Agent resolution: Obey Google Sheet directly! If AGENT_NAME in sheet is blank, unassign the agent!
      const rawAgentName = data.agent_name !== undefined ? String(data.agent_name).trim() : String(existingCase?.agent_name || '').trim();
      let matchedAgentId: number | null = null;
      if (rawAgentName) {
        const lowerAgent = rawAgentName.toLowerCase();
        const matchedUser = registeredUsers.find(u =>
          u.name.trim().toLowerCase() === lowerAgent ||
          (u.employee_id && u.employee_id.trim().toLowerCase() === lowerAgent) ||
          (u.email && u.email.trim().toLowerCase().includes(lowerAgent))
        );
        if (matchedUser) matchedAgentId = matchedUser.id;
        else if (existingCase?.assigned_agent_id && existingCase.agent_name?.trim().toLowerCase() === lowerAgent) {
          matchedAgentId = existingCase.assigned_agent_id;
        }
      } else {
        matchedAgentId = null;
      }

      const collectorName = data.collector_name !== undefined ? String(data.collector_name).trim() : (existingCase?.collector_name || '');
      const allocationDate = data.allocation_date !== undefined ? (data.allocation_date || null) : (existingCase?.allocation_date || null);
      const expiryDate = data.expiry_date !== undefined ? (data.expiry_date || null) : (existingCase?.expiry_date || null);

      return {
        id: existingCase?.id ?? (Date.now() + idx),
        file_number: String(data.file_number || `GS-${idx + 1}`).trim(),
        bank_id: bankId,
        product_id: productId,
        account_number: data.account_number !== undefined ? data.account_number : (existingCase?.account_number || ''),
        customer_name: String(data.customer_name || existingCase?.customer_name || 'Unknown').trim(),
        customer_phone: data.customer_phone !== undefined ? data.customer_phone : (existingCase?.customer_phone || ''),
        customer_secondary_phone: data.customer_secondary_phone !== undefined ? data.customer_secondary_phone : (existingCase?.customer_secondary_phone || ''),
        customer_address_present: data.customer_address_present !== undefined ? data.customer_address_present : (existingCase?.customer_address_present || ''),
        customer_address_permanent: data.customer_address_permanent !== undefined ? data.customer_address_permanent : (existingCase?.customer_address_permanent || ''),
        present_address_visited: existingCase?.present_address_visited ?? false,
        permanent_address_visited: existingCase?.permanent_address_visited ?? false,
        outstanding_amount: Number(data.outstanding_amount) || 0,
        overdue_amount: Number(data.overdue_amount) || 0,
        minimum_payment: data.minimum_payment ? Number(data.minimum_payment) : null,
        status: (data.status as any) || existingCase?.status || 'new',
        legal_status: data.file_status || data.legal_status || existingCase?.legal_status || 'Normal Recovery',
        availability_status: existingCase?.availability_status || null,
        agent_name: rawAgentName,
        collector_name: collectorName,
        assigned_agent_id: matchedAgentId,
        assigned_manager_id: existingCase?.assigned_manager_id ?? null,
        allocation_date: allocationDate,
        expiry_date: expiryDate,
        last_visit_at: existingCase?.last_visit_at || null,
        total_collected_amount: existingCase?.total_collected_amount ?? 0,
        extra_attributes: { 
          ...(existingCase?.extra_attributes || {}), 
          ...(data.extra_attributes || {}), 
          AGENT_NAME: rawAgentName, 
          COLLECTOR_NAME: collectorName,
          FILE_STATUS: data.file_status !== undefined ? data.file_status : (existingCase?.extra_attributes?.FILE_STATUS || ''),
          STATUS: data.status !== undefined ? data.status : (existingCase?.status || 'new'),
        },
        bank_name: data.bank_name !== undefined ? data.bank_name : existingCase?.bank_name,
        product_name: data.product_name !== undefined ? data.product_name : existingCase?.product_name,
        branch_name: data.branch_name !== undefined ? data.branch_name : existingCase?.branch_name,
        area: data.area !== undefined ? data.area : existingCase?.area,
        lap_status: data.lap_status !== undefined ? data.lap_status : existingCase?.lap_status,
        created_at: existingCase?.created_at || now,
        updated_at: now,
      };
    });

    this.cases = newCases;
    this.saveState();
    this.notifySubscribers();

    // Push immediately to Supabase Cloud so all devices and users receive the exact data
    await this.pushAllCasesToCloudStrict(newCases);
  }

  // ── Google Sheets full-replace sync for Bank Contacts ───────────────
  public async replaceAllContactsFromSheet(contactDataList: Record<string, any>[]) {
    // Share the same guard as the cases replace — the sheet sync runs both
    // back to back, and concurrent contact replaces collide the same way.
    if (this.sheetReplaceInFlight) return this.sheetReplaceInFlight;
    const job = this.doReplaceAllContactsFromSheet(contactDataList).finally(() => {
      this.sheetReplaceInFlight = null;
    });
    this.sheetReplaceInFlight = job;
    return job;
  }

  private async doReplaceAllContactsFromSheet(contactDataList: Record<string, any>[]) {
    const banks = getAllSystemBanks();
    const now = new Date().toISOString();

    const newContacts: BankContact[] = contactDataList.map((data, idx) => {
      // Resolve bank
      let bankId = 1;
      if (data.bank_name) {
        const bName = String(data.bank_name).trim().toLowerCase();
        const bKey = normalizeBankKey(bName);
        const bank = banks.find(b => normalizeBankKey(b.name) === bKey || b.code.toLowerCase() === bName);
        if (bank) {
          bankId = bank.id;
        } else {
          const partialBank = banks.find(b => bKey.includes(normalizeBankKey(b.name)) || normalizeBankKey(b.name).includes(bKey));
          if (partialBank) {
            bankId = partialBank.id;
          } else {
            // Unknown bank from the sheet: register it (deterministic id, stored
            // in the registry) so it appears in the Bank Contacts filter and on
            // contact cards instead of silently matching nothing.
            bankId = ensureBankRegistered(String(data.bank_name).trim());
          }
        }
      }

      // Try to reuse existing contact id by matching name and (bank_id or phone)
      const existing = this.contacts.find(c =>
        c.name.trim().toLowerCase() === String(data.name || '').trim().toLowerCase() &&
        (c.bank_id === bankId || (data.phone && c.phone === data.phone))
      );

      return {
        id: existing?.id ?? (Date.now() + idx),
        bank_id: bankId,
        bank_name: data.bank_name ? String(data.bank_name).trim() : banks.find(b => b.id === bankId)?.name || '',
        name: String(data.name || '').trim(),
        designation: data.designation || 'Bank Recovery Officer / Collector',
        department: data.department || 'Special Asset Management',
        phone: data.phone || '',
        email: data.email || '',
        branch: data.branch || 'Principal Branch',
        notes: data.notes || '',
        created_at: existing?.created_at || now,
      };
    });

    this.contacts = newContacts;
    this.saveState();
    this.notifySubscribers();

    // Push immediately to Supabase Cloud so all devices and users receive the exact data
    await this.pushContactsToCloud(newContacts);
  }

  public reassignCase(caseId: number, agentId: number) {
    const item = this.cases.find(c => c.id === caseId);
    if (item) {
      item.assigned_agent_id = agentId;
      item.status = 'in_progress';
      this.saveState();
      this.notifySubscribers();
      offlineQueue.runBackground({ kind: 'update', table: 'cases', row: { assigned_agent_id: agentId, status: 'in_progress' }, matchCol: 'id', matchVal: caseId });
    }
  }

  public updateCase(caseId: number, updates: Partial<CaseFile>) {
    const item = this.cases.find(c => c.id === caseId);
    if (item) {
      Object.assign(item, updates);
      if (updates.extra_attributes) {
        item.extra_attributes = {
          ...(item.extra_attributes || {}),
          ...updates.extra_attributes
        };
      }
      item.updated_at = new Date().toISOString();
      this.saveState();
      this.notifySubscribers();

      // ── Sync back to Supabase ───────────────────────────────────
      const dbPayload: any = {
        customer_phone: item.customer_phone,
        customer_secondary_phone: item.customer_secondary_phone,
        customer_address_present: item.customer_address_present,
        customer_address_permanent: item.customer_address_permanent,
        extra_attributes: item.extra_attributes,
        updated_at: item.updated_at
      };
      offlineQueue.runBackground({ kind: 'update', table: 'cases', row: dbPayload, matchCol: 'id', matchVal: caseId });

    }
  }

  public addCheckIn(checkIn: Omit<CheckIn, 'id'>): CheckIn {
    const newCi: CheckIn = {
      ...checkIn,
      id: Date.now(),
    };
    this.checkIns.unshift(newCi);

    const item = this.cases.find(c => c.id === checkIn.case_file_id);
    if (item) {
      if (checkIn.address_type === 'present') item.present_address_visited = true;
      if (checkIn.address_type === 'permanent') item.permanent_address_visited = true;
      item.status = 'visited';
    }

    this.saveState();
    this.notifySubscribers();
    offlineQueue.runBackground({ kind: 'insert', table: 'check_ins', row: newCi });
    if (item) {
      offlineQueue.runBackground({
        kind: 'update', table: 'cases',
        row: {
          present_address_visited: item.present_address_visited,
          permanent_address_visited: item.permanent_address_visited,
          status: 'visited'
        },
        matchCol: 'id', matchVal: item.id
      });
    }

    return newCi;
  }

  public getCheckInsByCase(caseId: number): CheckIn[] {
    return this.checkIns.filter(c => c.case_file_id === caseId);
  }

  public addRemark(remark: Omit<CaseRemark, 'id'>): CaseRemark {
    const newR: CaseRemark = {
      ...remark,
      id: Date.now(),
    };
    this.remarks.unshift(newR);

    const item = this.cases.find(c => c.id === remark.case_file_id);
    if (item && remark.promised_amount && remark.promise_date) {
      item.status = 'in_progress';
    }

    this.saveState();
    this.notifySubscribers();
    offlineQueue.runBackground({ kind: 'insert', table: 'case_remarks', row: newR });

    return newR;
  }

  public getRemarksByCase(caseId: number): CaseRemark[] {
    return this.remarks.filter(r => r.case_file_id === caseId).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public addCollection(collection: Omit<Collection, 'id'>): Collection {
    const newCol: Collection = {
      ...collection,
      id: Date.now(),
    };
    this.collections.unshift(newCol);

    const item = this.cases.find(c => c.id === collection.case_file_id);
    if (item) {
      item.total_collected_amount = (item.total_collected_amount || 0) + collection.amount;
      if (item.total_collected_amount >= item.outstanding_amount) {
        item.status = 'settled';
      }
    }

    this.saveState();
    this.notifySubscribers();
    offlineQueue.runBackground({ kind: 'insert', table: 'collections', row: newCol });
    if (item) {
      offlineQueue.runBackground({
        kind: 'update', table: 'cases',
        row: { total_collected_amount: item.total_collected_amount, status: item.status },
        matchCol: 'id', matchVal: item.id
      });
    }

    return newCol;
  }

  public getCollectionsByCase(caseId: number): Collection[] {
    return this.collections.filter(c => c.case_file_id === caseId).sort((a, b) => new Date(b.collected_at).getTime() - new Date(a.collected_at).getTime());
  }

  public getAllCollections(): Collection[] {
    return [...this.collections].sort((a, b) => new Date(b.collected_at).getTime() - new Date(a.collected_at).getTime());
  }

  public verifyCollection(collectionId: number, status: 'approved' | 'rejected', reason?: string, verifierName?: string): Collection | null {
    const col = this.collections.find(c => c.id === collectionId);
    if (!col) return null;

    col.status = status;
    col.rejection_reason = reason || undefined;
    col.verified_at = new Date().toISOString();
    col.verified_by = verifierName || 'Admin';

    // If rejected, subtract from case total_collected_amount
    const cItem = this.cases.find(c => c.id === col.case_file_id);
    if (cItem) {
      if (status === 'rejected') {
        cItem.total_collected_amount = Math.max(0, (cItem.total_collected_amount || 0) - col.amount);
        if (cItem.total_collected_amount < cItem.outstanding_amount && cItem.status === 'settled') {
          cItem.status = 'in_progress';
        }
      } else if (status === 'approved') {
        if ((cItem.total_collected_amount || 0) >= cItem.outstanding_amount) {
          cItem.status = 'settled';
        }
      }
    }

    this.saveState();
    this.notifySubscribers();
    offlineQueue.runBackground({
      kind: 'update', table: 'collections',
      row: {
        status: col.status,
        rejection_reason: col.rejection_reason,
        verified_at: col.verified_at,
        verified_by: col.verified_by
      },
      matchCol: 'id', matchVal: col.id
    });
    if (cItem) {
      offlineQueue.runBackground({
        kind: 'update', table: 'cases',
        row: { total_collected_amount: cItem.total_collected_amount, status: cItem.status },
        matchCol: 'id', matchVal: cItem.id
      });
    }

    return col;
  }

  public deleteCollection(collectionId: number): boolean {
    const idx = this.collections.findIndex(c => c.id === collectionId);
    if (idx === -1) return false;
    const removed = this.collections.splice(idx, 1)[0];

    // Re-adjust case collected amount
    const cItem = this.cases.find(c => c.id === removed.case_file_id);
    if (cItem && removed.status !== 'rejected') {
      cItem.total_collected_amount = Math.max(0, (cItem.total_collected_amount || 0) - removed.amount);
      if (cItem.total_collected_amount < cItem.outstanding_amount && cItem.status === 'settled') {
        cItem.status = 'in_progress';
      }
    }

    this.saveState();
    this.notifySubscribers();
    offlineQueue.runBackground({ kind: 'delete', table: 'collections', matchCol: 'id', matchVals: [collectionId] });
    if (cItem) {
      offlineQueue.runBackground({
        kind: 'update', table: 'cases',
        row: { total_collected_amount: cItem.total_collected_amount, status: cItem.status },
        matchCol: 'id', matchVal: cItem.id
      });
    }

    return true;
  }

  public deleteRemark(remarkId: number): boolean {
    const idx = this.remarks.findIndex(r => r.id === remarkId);
    if (idx === -1) return false;
    this.remarks.splice(idx, 1);
    this.saveState();
    this.notifySubscribers();
    offlineQueue.runBackground({ kind: 'delete', table: 'case_remarks', matchCol: 'id', matchVals: [remarkId] });
    return true;
  }

  // TODAY'S PROMISE TO PAY ALERTS
  public getTodayPtpAlerts(user: User): PtpAlertItem[] {
    const userCases = this.getCases(user).filter(c => !['settled', 'closed'].includes(c.status));
    const todayStr = new Date().toISOString().split('T')[0];

    const results: PtpAlertItem[] = [];
    userCases.forEach(c => {
      const caseRemarks = this.remarks.filter(r => r.case_file_id === c.id && r.promise_date);
      if (caseRemarks.length > 0) {
        const latestPtp = caseRemarks[0];
        if (latestPtp.promise_date === todayStr) {
          results.push({
            caseItem: c,
            remark: latestPtp,
            promisedAmount: latestPtp.promised_amount || c.overdue_amount,
            promiseDate: latestPtp.promise_date,
            isOverdue: false,
            daysDiff: 0
          });
        }
      }
    });
    return results;
  }

  // MISSED / OVERDUE PROMISE TO PAY ALERTS
  public getMissedPaymentAlerts(user: User): PtpAlertItem[] {
    const userCases = this.getCases(user).filter(c => !['settled', 'closed'].includes(c.status));
    const todayStr = new Date().toISOString().split('T')[0];
    const todayDate = new Date(todayStr);

    const results: PtpAlertItem[] = [];
    userCases.forEach(c => {
      const caseRemarks = this.remarks.filter(r => r.case_file_id === c.id && r.promise_date);
      if (caseRemarks.length > 0) {
        const latestPtp = caseRemarks[0];
        if (latestPtp.promise_date && latestPtp.promise_date < todayStr) {
          const ptpDate = new Date(latestPtp.promise_date);
          const daysOverdue = Math.max(1, Math.floor((todayDate.getTime() - ptpDate.getTime()) / (1000 * 60 * 60 * 24)));

          results.push({
            caseItem: c,
            remark: latestPtp,
            promisedAmount: latestPtp.promised_amount || c.overdue_amount,
            promiseDate: latestPtp.promise_date,
            isOverdue: true,
            daysDiff: daysOverdue
          });
        }
      }
    });
    return results;
  }

  public getDashboardMetrics(user: User) {
    const cases = this.getCases(user);
    const totalFiles = cases.length;
    // "Active" = anything not explicitly closed out. Bank classifications
    // (STD, SMA, SS, DF, BL, Write-off, 12m+) are all live recovery statuses.
    const NOT_ACTIVE = new Set(['settled', 'closed', 'expired']);
    const activeFiles = cases.filter(c => !NOT_ACTIVE.has(String(c.status || '').toLowerCase().trim())).length;
    const settled = cases.filter(c => c.status === 'settled').length;
    
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    const expiringSoon = cases.filter(c => {
      if (!c.expiry_date || ['settled', 'closed'].includes(c.status)) return false;
      const exp = new Date(c.expiry_date);
      return exp >= now && exp <= thirtyDaysFromNow;
    }).length;

    const expired = cases.filter(c => {
      if (!c.expiry_date || ['settled', 'closed'].includes(c.status)) return false;
      const exp = new Date(c.expiry_date);
      return exp < now;
    }).length;

    const totalOutstanding = cases.reduce((acc, c) => acc + (c.outstanding_amount || 0), 0);
    
    // For agent role: compute collected cash specifically from this agent's collections and their assigned files
    let totalCollected = 0;
    if (user.role === 'agent') {
      const agentCols = this.collections.filter(col => col.agent_id === user.id);
      const agentColsTotal = agentCols.reduce((sum, col) => sum + (Number(col.amount) || 0), 0);
      const casesCollectedTotal = cases.reduce((acc, c) => acc + (c.total_collected_amount || 0), 0);
      totalCollected = Math.max(agentColsTotal, casesCollectedTotal);
    } else {
      totalCollected = cases.reduce((acc, c) => acc + (c.total_collected_amount || 0), 0);
    }

    const todayPtps = this.getTodayPtpAlerts(user);
    const missedPtps = this.getMissedPaymentAlerts(user);

    const bankBreakdown: Record<string, { count: number; outstanding: number }> = {};
    cases.forEach(c => {
      // Group by the REAL bank name from the sheet (BANK_NAME column), not the
      // bank_id lookup — every imported file shares the same default bank_id,
      // which collapsed all banks into "Other".
      const bank = (
        c.bank_name?.trim() ||
        c.extra_attributes?.BANK_NAME?.trim() ||
        c.bank?.name ||
        'Other'
      );
      // Split each bank into its products (Credit Card, Loan, Write-off…)
      // so "DBBL Credit Card" and "DBBL Loan" show as separate lines.
      const fileType = String(
        c.extra_attributes?.FILE_TYPE ||
        c.extra_attributes?.file_type ||
        c.product_name ||
        ''
      ).trim();
      const bankName = fileType && fileType.toUpperCase() !== 'N/A'
        ? `${bank} – ${fileType}`
        : bank;
      if (!bankBreakdown[bankName]) {
        bankBreakdown[bankName] = { count: 0, outstanding: 0 };
      }
      bankBreakdown[bankName].count += 1;
      bankBreakdown[bankName].outstanding += (c.outstanding_amount || 0);
    });

    return {
      summary: {
        total_files: totalFiles,
        active_files: activeFiles,
        expiring_soon_count: expiringSoon,
        expired_count: expired,
        settled_count: settled,
        total_outstanding: totalOutstanding,
        total_collected: totalCollected,
        online_agents_count: 5,
        total_agents_count: 5,
        today_ptp_count: todayPtps.length,
        missed_ptp_count: missedPtps.length,
      },
      todayPtps,
      missedPtps,
      charts: {
        files_by_bank: {
          labels: Object.keys(bankBreakdown),
          counts: Object.values(bankBreakdown).map(b => b.count),
          outstandings: Object.values(bankBreakdown).map(b => b.outstanding)
        }
      }
    };
  }

  public deleteCase(id: number) {
    const toDelete = this.cases.find(c => c.id === id);
    const fileNum = toDelete?.file_number;

    this.cases = this.cases.filter(c => c.id !== id);
    this.remarks = this.remarks.filter(r => r.case_file_id !== id);
    this.checkIns = this.checkIns.filter(ci => ci.case_file_id !== id);
    this.collections = this.collections.filter(col => col.case_file_id !== id);
    this.saveState();
    this.notifySubscribers();

    if (fileNum) {
      offlineQueue.runBackground({ kind: 'delete', table: 'cases', matchCol: 'file_number', matchVals: [fileNum] });
    }
  }

  public deleteCases(ids: number[]) {
    const idSet = new Set(ids);
    const fileNumbers = this.cases.filter(c => idSet.has(c.id)).map(c => c.file_number);

    this.cases = this.cases.filter(c => !idSet.has(c.id));
    this.remarks = this.remarks.filter(r => !idSet.has(r.case_file_id));
    this.checkIns = this.checkIns.filter(ci => !idSet.has(ci.case_file_id));
    this.collections = this.collections.filter(col => !idSet.has(col.case_file_id));
    this.saveState();
    this.notifySubscribers();

    if (fileNumbers.length > 0) {
      offlineQueue.runBackground({ kind: 'delete', table: 'cases', matchCol: 'file_number', matchVals: fileNumbers });
    }
  }

  // Detect agents mentioned in uploaded files whose user accounts are not created yet
  public getUnregisteredAgents(existingUsers: User[] = []): { name: string; fileCount: number; sampleFiles: string[] }[] {
    const agentMap = new Map<string, { name: string; fileCount: number; sampleFiles: string[] }>();
    
    // Normalize existing user names and employee IDs
    const normalizedUsers = existingUsers.map(u => ({
      name: u.name.trim().toLowerCase(),
      empId: (u.employee_id || '').trim().toLowerCase(),
      email: (u.email || '').trim().toLowerCase(),
    }));

    this.cases.forEach(c => {
      const rawName = (c.agent_name || c.extra_attributes?.['AGENT_NAME'] || c.extra_attributes?.['AGENT'] || '').trim();
      if (!rawName) return;

      const lowerName = rawName.toLowerCase();
      const isRegistered = normalizedUsers.some(u => 
        u.name === lowerName || 
        (u.empId && u.empId === lowerName) ||
        u.email.includes(lowerName)
      );

      if (!isRegistered) {
        if (!agentMap.has(lowerName)) {
          agentMap.set(lowerName, {
            name: rawName,
            fileCount: 0,
            sampleFiles: []
          });
        }
        const record = agentMap.get(lowerName)!;
        record.fileCount += 1;
        if (record.sampleFiles.length < 3) {
          record.sampleFiles.push(c.file_number);
        }
      }
    });

    return Array.from(agentMap.values());
  }

  public importCases(newCases: Partial<CaseFile>[]): number {
    let imported = 0;
    
    // Try to get registered users for automatic agent_id matching
    let registeredUsers: User[] = [];
    try {
      const saved = localStorage.getItem('recovery_all_users');
      if (saved) registeredUsers = JSON.parse(saved);
    } catch (_) {}

    const casesToSync: CaseFile[] = [];

    newCases.forEach(item => {
      const existing = this.cases.find(c => c.file_number === item.file_number);
      const agentName = item.agent_name || item.extra_attributes?.['AGENT_NAME'] || item.extra_attributes?.['AGENT'] || '';
      
      // Auto-match assigned_agent_id if user exists
      let matchedAgentId: number | null | undefined = item.assigned_agent_id;
      if (!matchedAgentId && agentName) {
        const found = registeredUsers.find(u => 
          u.name.trim().toLowerCase() === agentName.trim().toLowerCase() ||
          (u.employee_id && u.employee_id.trim().toLowerCase() === agentName.trim().toLowerCase())
        );
        if (found) matchedAgentId = found.id;
      }

      if (existing) {
        Object.assign(existing, item, { 
          agent_name: agentName || existing.agent_name,
          assigned_agent_id: matchedAgentId || existing.assigned_agent_id,
          updated_at: new Date().toISOString() 
        });
        casesToSync.push(existing);
      } else {
        const fullCase: CaseFile = enrichCase({
          id: Date.now() + Math.floor(Math.random() * 10000),
          file_number: item.file_number || `FILE-${Date.now()}`,
          bank_id: item.bank_id || 1,
          product_id: item.product_id || 1,
          account_number: item.account_number || '',
          customer_name: item.customer_name || 'Customer Name',
          customer_phone: item.customer_phone || '',
          customer_secondary_phone: item.customer_secondary_phone || '',
          customer_address_present: item.customer_address_present || '',
          customer_address_permanent: item.customer_address_permanent || '',
          present_address_visited: false,
          permanent_address_visited: false,
          outstanding_amount: Number(item.outstanding_amount) || 0,
          overdue_amount: Number(item.overdue_amount) || 0,
          minimum_payment: item.minimum_payment,
          status: 'new',
          assigned_agent_id: matchedAgentId,
          agent_name: agentName,
          total_collected_amount: 0,
          allocation_date: item.allocation_date || new Date().toISOString().split('T')[0],
          expiry_date: item.expiry_date || new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0],
          extra_attributes: item.extra_attributes || {}
        });
        this.cases.push(fullCase);
        casesToSync.push(fullCase);
      }
      imported++;
    });

    this.saveState();
    this.notifySubscribers();

    // Asynchronously push all imported cases to Supabase Cloud
    this.pushCasesToCloud(casesToSync);

    return imported;
  }

  public clearAllCases() {
    this.cases = [];
    this.remarks = [];
    this.checkIns = [];
    this.collections = [];
    this.saveState();
    this.notifySubscribers();

    offlineQueue.runBackground({ kind: 'deleteAll', table: 'cases' });
    offlineQueue.runBackground({ kind: 'deleteAll', table: 'case_remarks' });
    offlineQueue.runBackground({ kind: 'deleteAll', table: 'check_ins' });
    offlineQueue.runBackground({ kind: 'deleteAll', table: 'collections' });
  }

  public clearAllContacts() {
    this.contacts = [];
    this.saveState();
    this.notifySubscribers();
    try {
      offlineQueue.runBackground({ kind: 'deleteAll', table: 'bank_contacts' });
    } catch (_) {}
  }
}

export const dataService = new DataService();