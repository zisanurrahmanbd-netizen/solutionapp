import { supabase } from '../lib/supabase';
import { fetchAllRows } from './dataService';
import { offlineQueue } from './offlineQueue';

// ═══════════════════════════════════════════════════════════════════════
// HR & Operations modules — backed by a single flexible `hr_records` table
// (type + JSONB data) so the whole workspace ships with one new table.
// ═══════════════════════════════════════════════════════════════════════

export type HrRecordType =
  | 'employee'
  | 'attendance'
  | 'payroll'
  | 'leave'
  | 'candidate'
  | 'inventory'
  | 'growth_goal';

export interface HrRecord {
  id: number;
  type: HrRecordType;
  data: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

// ── In-memory cache + subscription (same pattern as dataService) ──
let cache: HrRecord[] = [];
let loaded = false;
let loadPromise: Promise<HrRecord[]> | null = null;
const listeners = new Set<() => void>();
let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;

function notify(): void {
  listeners.forEach(fn => {
    try { fn(); } catch (_) {}
  });
}

export const hrService = {
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    void hrService.ensureLoaded();
    hrService.ensureRealtime();
    return () => listeners.delete(fn);
  },

  async ensureLoaded(): Promise<HrRecord[]> {
    if (loaded) return cache;
    if (loadPromise) return loadPromise;
    loadPromise = (async () => {
      try {
        const rows = await fetchAllRows<HrRecord>('hr_records', '*', 'id', false);
        cache = rows;
        loaded = true;
        notify();
      } catch (e) {
        console.warn('hr_records load failed (run supabase_schema_additions.sql):', e);
      } finally {
        loadPromise = null;
      }
      return cache;
    })();
    return loadPromise;
  },

  ensureRealtime(): void {
    if (realtimeChannel || !supabase) return;
    try {
      realtimeChannel = supabase
        .channel('hr_records_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'hr_records' }, () => {
          loaded = false;
          void hrService.ensureLoaded();
        })
        .subscribe();
    } catch (_) {}
  },

  getAll(): HrRecord[] {
    return cache;
  },

  byType(type: HrRecordType): HrRecord[] {
    return cache.filter(r => r.type === type);
  },

  async upsert(type: HrRecordType, data: Record<string, any>, id?: number): Promise<void> {
    const payload: any = { type, data, updated_at: new Date().toISOString() };
    if (id) payload.id = id;
    else payload.id = Date.now() + Math.floor(Math.random() * 1000);
    // Optimistic local update
    const idx = id ? cache.findIndex(r => r.id === id) : -1;
    if (idx >= 0) cache[idx] = { ...cache[idx], data, type };
    else cache = [{ ...payload, created_at: new Date().toISOString() } as HrRecord, ...cache];
    notify();
    // Offline-safe: queue the write when there's no internet, replay on reconnect
    const result = await offlineQueue.run({ kind: 'upsert', table: 'hr_records', rows: [payload] });
    if (result.error) throw new Error(result.error);
  },

  async remove(id: number): Promise<void> {
    cache = cache.filter(r => r.id !== id);
    notify();
    const result = await offlineQueue.run({ kind: 'delete', table: 'hr_records', matchCol: 'id', matchVals: [id] });
    if (result.error) throw new Error(result.error);
  },

  // ── Convenience accessors ────────────────────────────────────────────
  employees(): HrRecord[] {
    return this.byType('employee');
  },
  attendance(): HrRecord[] {
    return this.byType('attendance');
  },
  payroll(): HrRecord[] {
    return this.byType('payroll');
  },
  leaves(): HrRecord[] {
    return this.byType('leave');
  },
  candidates(): HrRecord[] {
    return this.byType('candidate');
  },
  inventory(): HrRecord[] {
    return this.byType('inventory');
  },
  goals(): HrRecord[] {
    return this.byType('growth_goal');
  },
};

// ═══════════════════════════════════════════════════════════════════════
// Agent location trail (24/7 tracking history)
// ═══════════════════════════════════════════════════════════════════════

export interface LocationPing {
  id: number;
  user_id: number;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  speed?: number | null;
  pinged_at: string;
}

export const trackingService = {
  /** Record a GPS ping. Called automatically by the background pinger. */
  async recordPing(
    userId: number,
    lat: number,
    lng: number,
    accuracy?: number | null,
    speed?: number | null
  ): Promise<void> {
    try {
      await supabase.from('location_pings').insert({
        user_id: userId,
        latitude: lat,
        longitude: lng,
        accuracy: accuracy ?? null,
        speed: speed ?? null,
        pinged_at: new Date().toISOString(),
      });
    } catch (_) {
      // Table may not exist yet — non-fatal
    }
  },

  /** Fetch today's trail for one agent (or all agents when userId omitted). */
  async fetchPings(userId?: number, sinceIso?: string): Promise<LocationPing[]> {
    let query = supabase
      .from('location_pings')
      .select('*')
      .order('pinged_at', { ascending: true });
    if (userId) query = query.eq('user_id', userId);
    if (sinceIso) query = query.gte('pinged_at', sinceIso);
    else {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      query = query.gte('pinged_at', start.toISOString());
    }
    const { data, error } = await query;
    if (error) return [];
    return (data || []) as LocationPing[];
  },
};

// ═══════════════════════════════════════════════════════════════════════
// 24/7 Background Location Pinger — keeps GPS live even when tab is idle.
// - High-accuracy watch while tab visible
// - Low-power interval ping every 2 min when hidden
// - Writes last location to users table + full trail to location_pings
// ═══════════════════════════════════════════════════════════════════════

let pingerStarted = false;
let lastPingAt = 0;

export function startBackgroundPinger(
  userId: number,
  onLocation: (lat: number, lng: number) => void
): () => void {
  if (pingerStarted) return () => {};
  pingerStarted = true;

  const push = (lat: number, lng: number, accuracy?: number | null, speed?: number | null) => {
    const now = Date.now();
    if (now - lastPingAt < 30000) return; // throttle: max 1 write / 30s
    lastPingAt = now;
    onLocation(lat, lng);
    void trackingService.recordPing(userId, lat, lng, accuracy, speed);
  };

  const pingOnce = (highAccuracy: boolean) => {
    if (!('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      pos => push(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, pos.coords.speed),
      () => {},
      { enableHighAccuracy: highAccuracy, timeout: 15000, maximumAge: 60000 }
    );
  };

  // Immediate ping
  pingOnce(true);

  // Visible tab: watchPosition for continuous movement
  let watchId: number | null = null;
  if ('geolocation' in navigator) {
    watchId = navigator.geolocation.watchPosition(
      pos => push(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, pos.coords.speed),
      () => {},
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 }
    );
  }

  // Hidden tab / 24-7: interval fallback every 2 minutes
  const interval = setInterval(() => {
    if (document.visibilityState === 'visible' && watchId !== null) return;
    pingOnce(false);
  }, 120000);

  return () => {
    if (watchId !== null && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(watchId);
    }
    clearInterval(interval);
    pingerStarted = false;
  };
}
