import React, { useEffect, useState } from 'react';
import { offlineQueue } from '../services/offlineQueue';
import { CloudOff, CloudUpload, Loader2, Wifi } from 'lucide-react';

interface QueueState {
  pending: number;
  online: boolean;
  syncing: boolean;
}

/**
 * Offline status banner.
 * - Offline: red bar "You're offline — changes are saved on this device and
 *   will sync automatically" (+ pending count).
 * - Online with pending ops: amber bar "Syncing N changes…" while flushing.
 * Hidden entirely when online and everything is synced.
 */
export const OfflineBanner: React.FC = () => {
  const [state, setState] = useState<QueueState>({ pending: 0, online: true, syncing: false });
  const [justReconnected, setJustReconnected] = useState(false);

  useEffect(() => {
    const unsub = offlineQueue.subscribe(setState);
    return unsub;
  }, []);

  useEffect(() => {
    if (state.online && state.pending === 0 && !state.syncing) {
      // show "back online" confirmation briefly after a reconnect
      if (justReconnected) {
        const t = setTimeout(() => setJustReconnected(false), 2500);
        return () => clearTimeout(t);
      }
    }
  }, [state, justReconnected]);

  // Track transitions to online to flash the confirmation
  const [wasOffline, setWasOffline] = useState(false);
  useEffect(() => {
    if (!state.online) setWasOffline(true);
    else if (wasOffline) {
      setJustReconnected(true);
      setWasOffline(false);
    }
  }, [state.online, wasOffline]);

  if (state.online && state.pending === 0 && !justReconnected) return null;

  const offline = !state.online;
  const syncing = state.syncing || (state.online && state.pending > 0);

  return (
    <div
      className={`sticky top-0 z-[60] w-full flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-semibold transition-colors ${
        offline
          ? 'bg-red-600 text-white'
          : syncing
            ? 'bg-amber-500 text-black'
            : 'bg-emerald-600 text-white'
      }`}
      role="status"
    >
      {offline ? (
        <>
          <CloudOff className="w-3.5 h-3.5" />
          <span>
            You're offline — data is saved on this device
            {state.pending > 0 && ` (${state.pending} change${state.pending > 1 ? 's' : ''} waiting)`}
            {' '}and will sync automatically when internet returns
          </span>
        </>
      ) : syncing ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Syncing {state.pending} pending change{state.pending > 1 ? 's' : ''}…</span>
        </>
      ) : (
        <>
          <Wifi className="w-3.5 h-3.5" />
          <span>Back online — all data synced</span>
        </>
      )}
      {!offline && state.pending > 0 && (
        <button
          onClick={() => offlineQueue.flush()}
          className="ml-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/10 hover:bg-black/20 font-bold"
          title="Sync now"
        >
          <CloudUpload className="w-3.5 h-3.5" />
          Sync now
        </button>
      )}
    </div>
  );
};
