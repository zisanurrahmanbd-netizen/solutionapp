import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/cn';
import { CheckCircle2, XCircle, Info, Undo2, X } from 'lucide-react';

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastOptions {
  kind?: ToastKind;
  /** Show an Undo button; onUndo runs within the timeout window. */
  onUndo?: () => void;
  /** Milliseconds before auto-dismiss. Default 5000; ignored when sticky. */
  durationMs?: number;
  /** Stay until manually dismissed (errors). */
  sticky?: boolean;
}

interface ToastItem extends Required<Pick<ToastOptions, 'kind'>> {
  id: number;
  message: string;
  onUndo?: () => void;
  durationMs: number;
  sticky: boolean;
  leaving: boolean;
}

interface ToastContextValue {
  showToast: (message: string, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_ICONS: Record<ToastKind, React.ReactNode> = {
  success: <CheckCircle2 className="w-4 h-4 text-primary-500 shrink-0" aria-hidden="true" />,
  error: <XCircle className="w-4 h-4 text-danger-500 shrink-0" aria-hidden="true" />,
  info: <Info className="w-4 h-4 text-accent-500 shrink-0" aria-hidden="true" />,
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idCounter = useRef(0);

  const dismiss = useCallback((id: number) => {
    // Animate out, then remove.
    setToasts(prev => prev.map(t => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 200);
  }, []);

  const showToast = useCallback((message: string, options: ToastOptions = {}) => {
    const id = ++idCounter.current;
    const toast: ToastItem = {
      id,
      message,
      kind: options.kind ?? 'info',
      onUndo: options.onUndo,
      durationMs: options.durationMs ?? 5000,
      sticky: options.sticky ?? false,
      leaving: false,
    };
    setToasts(prev => [...prev.slice(-3), toast]); // max 4 visible
    if (!toast.sticky) {
      setTimeout(() => dismiss(id), toast.durationMs);
    }
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Screen-reader announcements */}
      <div role="status" aria-live="polite" className="sr-only">
        {toasts.filter(t => !t.leaving).map(t => t.message).join('. ')}
      </div>

      {/* Visual toasts */}
      <div className="fixed bottom-4 right-4 z-[120] flex flex-col gap-2 w-[calc(100vw-2rem)] max-w-sm pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : undefined}
            className={cn(
              'pointer-events-auto flex items-center gap-2.5 p-3.5 rounded-2xl shadow-lg border animate-toast-in',
              'bg-neutral-900/95 dark:bg-neutral-900 text-white border-neutral-700/60 backdrop-blur',
              t.leaving && 'opacity-0 translate-y-2 transition-all duration-200'
            )}
          >
            {TOAST_ICONS[t.kind]}
            <p className="text-xs font-bold flex-1 leading-snug">{t.message}</p>
            {t.onUndo && !t.leaving && (
              <button
                type="button"
                onClick={() => { t.onUndo?.(); dismiss(t.id); }}
                className="flex items-center gap-1 px-2.5 py-1.5 min-h-[32px] rounded-lg bg-white/10 hover:bg-white/20 text-2xs font-black uppercase tracking-wide text-primary-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              >
                <Undo2 className="w-3.5 h-3.5" aria-hidden="true" />
                Undo
              </button>
            )}
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="p-1.5 -m-1 rounded-lg text-neutral-400 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
