import React, { useEffect, useRef } from 'react';

interface AccessibleModalProps {
  /** Shown in the dialog heading; also used as the accessible name. */
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Tailwind max-width class for the panel, e.g. 'max-w-lg'. */
  panelClassName?: string;
  /** Optional icon for the title row. */
  titleIcon?: React.ReactNode;
  titleClassName?: string;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Dialog with the keyboard/AT behaviours WCAG 2.2 expects:
 * role=dialog + aria-modal, focus moved into the panel on open,
 * Tab trapped inside, Escape closes, focus restored to the opener.
 */
export const AccessibleModal: React.FC<AccessibleModalProps> = ({
  title,
  onClose,
  children,
  panelClassName = 'max-w-lg',
  titleIcon,
  titleClassName = 'font-bold text-sm text-slate-900 dark:text-white',
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useRef(`modal-title-${Math.random().toString(36).slice(2, 9)}`).current;

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;

    // Move focus into the dialog on open.
    const panel = panelRef.current;
    const firstFocus =
      panel?.querySelector<HTMLElement>('[data-autofocus]') ||
      panel?.querySelector<HTMLElement>(FOCUSABLE);
    firstFocus?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;

      // Trap Tab inside the panel.
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)
      ).filter(el => el.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement;

      if (e.shiftKey && (active === first || !panelRef.current.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      // Restore focus to the element that opened the dialog.
      opener?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] w-screen h-screen flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full ${panelClassName}`}
      >
        <div className="flex items-center justify-between p-4 pb-0 sm:p-6 sm:pb-0">
          <h4 id={titleId} className={`${titleClassName} flex items-center gap-1.5`}>
            {titleIcon}
            {title}
          </h4>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-2 -m-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            ✕
          </button>
        </div>
        <div className="p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );
};
