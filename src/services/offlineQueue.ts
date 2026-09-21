import { supabase } from '../lib/supabase';

// ═══════════════════════════════════════════════════════════════════════
// Offline-first write queue.
//
// When the device has no internet, every create/update/delete the user makes
// is saved locally (app state + this persistent queue). The moment the
// connection returns — or the app regains focus — queued operations are
// replayed to Supabase in order. Other devices receive everything via
// realtime as usual.
// ═══════════════════════════════════════════════════════════════════════

export type QueuedOp =
  | { kind: 'insert'; table: string; row: any }
  | { kind: 'update'; table: string; row: any; matchCol: string; matchVal: any }
  | { kind: 'upsert'; table: string; rows: any[]; onConflict?: string }
  | { kind: 'delete'; table: string; matchCol: string; matchVals: any[] }
  | { kind: 'deleteAll'; table: string };

const STORAGE_KEY = 'recoverycore_offline_queue_v1';
const MAX_OPS = 500;

type Listener = (state: { pending: number; online: boolean; syncing: boolean }) => void;

function loadQueue(): QueuedOp[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(-MAX_OPS) : [];
  } catch {
    return [];
  }
}

function saveQueue(q: QueuedOp[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(q.slice(-MAX_OPS)));
  } catch { /* storage full — drop oldest silently */ }
}

class OfflineQueue {
  private queue: QueuedOp[] = loadQueue();
  private listeners = new Set<Listener>();
  private flushing = false;
  private online = typeof navigator !== 'undefined' ? navigator.onLine : true;

  constructor() {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      this.online = true;
      this.notify();
      this.flush();
    });
    window.addEventListener('offline', () => {
      this.online = false;
      this.notify();
    });
    // Replay pending ops when the app regains focus or loads.
    window.addEventListener('focus', () => this.flush());
    if (this.online && this.queue.length > 0) {
      setTimeout(() => this.flush(), 3000);
    }
  }

  /** Run a Supabase write now if online; otherwise persist it for later. */
  async run(op: QueuedOp): Promise<{ queued: boolean; error?: string }> {
    if (!this.isOnline()) {
      this.enqueue(op);
      return { queued: true };
    }
    const err = await this.execute(op);
    if (err) {
      // Network-style failure → queue for retry. Real rejection (bad payload,
      // RLS violation) → report back to the caller.
      if (this.isNetworkError(err)) {
        this.enqueue(op);
        return { queued: true };
      }
      return { queued: false, error: err };
    }
    return { queued: false };
  }

  /** Fire-and-forget variant used by the hot paths (visits, remarks, collections). */
  runBackground(op: QueuedOp) {
    this.run(op).catch(() => {});
  }

  isOnline(): boolean {
    return this.online && typeof navigator !== 'undefined' && navigator.onLine;
  }

  getPending(): number {
    return this.queue.length;
  }

  isSyncing(): boolean {
    return this.flushing;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn({ pending: this.queue.length, online: this.isOnline(), syncing: this.flushing });
    return () => this.listeners.delete(fn);
  }

  /** Manually trigger a flush (e.g. from a "Sync now" button). */
  async flush(): Promise<number> {
    if (this.flushing || !this.isOnline() || this.queue.length === 0) return 0;
    this.flushing = true;
    this.notify();
    let done = 0;
    try {
      while (this.queue.length > 0 && this.isOnline()) {
        const op = this.queue[0];
        const err = await this.execute(op);
        if (err) {
          if (this.isNetworkError(err)) break; // connection dropped mid-flush → retry later
          // Permanent error (validation/RLS): drop the op so the queue can drain.
          console.warn('Offline queue: dropping op after permanent error:', err, op);
        }
        this.queue.shift();
        saveQueue(this.queue);
        done++;
      }
    } finally {
      this.flushing = false;
      this.notify();
    }
    return done;
  }

  private enqueue(op: QueuedOp) {
    this.queue.push(op);
    if (this.queue.length > MAX_OPS) this.queue.splice(0, this.queue.length - MAX_OPS);
    saveQueue(this.queue);
    this.notify();
  }

  private async execute(op: QueuedOp): Promise<string | null> {
    try {
      if (op.kind === 'insert') {
        const { error } = await supabase.from(op.table).insert([op.row]);
        return error?.message || null;
      }
      if (op.kind === 'update') {
        const { error } = await supabase.from(op.table).update(op.row).eq(op.matchCol, op.matchVal);
        return error?.message || null;
      }
      if (op.kind === 'upsert') {
        const { error } = await supabase.from(op.table).upsert(op.rows, op.onConflict ? { onConflict: op.onConflict } : undefined);
        return error?.message || null;
      }
      if (op.kind === 'delete') {
        const { error } = await supabase.from(op.table).delete().in(op.matchCol, op.matchVals);
        return error?.message || null;
      }
      if (op.kind === 'deleteAll') {
        const { error } = await supabase.from(op.table).delete().neq('id', 0);
        return error?.message || null;
      }
      return 'unknown op';
    } catch (e: any) {
      return e?.message || String(e);
    }
  }

  private isNetworkError(msg: string): boolean {
    const m = (msg || '').toLowerCase();
    return (
      m.includes('failed to fetch') ||
      m.includes('network') ||
      m.includes('timeout') ||
      m.includes('fetch failed') ||
      m.includes('load failed') ||
      m.includes('internet') ||
      m.includes('offline')
    );
  }

  private notify() {
    const state = { pending: this.queue.length, online: this.isOnline(), syncing: this.flushing };
    this.listeners.forEach(fn => {
      try { fn(state); } catch { /* ignore */ }
    });
  }
}

export const offlineQueue = new OfflineQueue();
