"use client";

import { useEffect, useRef } from "react";
import { TriangleAlert } from "lucide-react";
import type { Lang } from "@/lib/types";
import type { UIStrings } from "@/lib/ui-strings";

interface ConfirmDialogProps {
  /** Current UI language (chrome copy + label language). */
  lang: Lang;
  strings: UIStrings;
  /** Short question shown as the dialog heading. */
  title: string;
  /** Plain-language explanation of what will happen. */
  description: string;
  /** The exact item being acted on, echoed back so the user sees what they chose. */
  detail?: string;
  /** Label for the destructive action (e.g. "Delete"). */
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const TITLE_ID = "confirm-dialog-title";
const DESC_ID = "confirm-dialog-desc";

/**
 * Destructive-action confirmation (FR12, DESIGN §7). A modal `alertdialog`
 * layered above the dashboard: it names what will be removed, offers explicit
 * Cancel / Delete actions, and only calls `onConfirm` when Delete is pressed —
 * Esc, the backdrop, and Cancel all close it without deleting anything.
 *
 * a11y: role=alertdialog + aria-modal, focus moves to the panel on open (so a
 * screen reader announces the title + description), Tab is trapped, and the
 * background is hidden via aria-hidden on the dashboard panel.
 *
 * Persistence is best-effort (see `useLocalStorage`): a blocked localStorage
 * write still updates in-memory state, so `onConfirm` never has to surface an
 * error and the dialog can always close.
 */
export default function ConfirmDialog({
  lang,
  strings,
  title,
  description,
  detail,
  confirmLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus the dialog itself first so the title/description are announced.
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  // Esc cancels; Tab cycles inside the dialog (a11y only — no setState here).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== "Tab") {
        return;
      }
      const panel = panelRef.current;
      if (!panel) {
        return;
      }
      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusables.length === 0) {
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !panel.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/50 sm:items-center sm:p-4"
      onClick={(event) => {
        // Don't let the click reach the dashboard overlay behind (which closes
        // the whole dashboard) — cancelling must keep the dashboard open.
        event.stopPropagation();
        onCancel();
      }}
    >
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        aria-describedby={DESC_ID}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md rounded-t-card bg-surface p-4 shadow-card outline-none sm:rounded-card"
      >
        <div className="flex items-start gap-3">
          <TriangleAlert
            className="mt-0.5 size-5 shrink-0 text-harvest"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <h3 id={TITLE_ID} lang={lang} className="text-base font-bold text-ink">
              {title}
            </h3>
            <p id={DESC_ID} lang={lang} className="mt-1 text-sm text-muted">
              {description}
            </p>
          </div>
        </div>

        {detail && (
          <p
            lang={lang}
            className="mt-3 rounded-button border border-black/10 bg-cream px-3 py-2 text-sm font-medium text-ink"
          >
            {detail}
          </p>
        )}

        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            lang={lang}
            onClick={onCancel}
            className="min-h-11 rounded-button border border-black/15 px-4 text-sm font-semibold text-ink hover:bg-cream"
          >
            {strings.cancel}
          </button>
          <button
            type="button"
            lang={lang}
            onClick={onConfirm}
            className="min-h-11 rounded-button bg-danger px-4 text-sm font-semibold text-surface hover:bg-danger/90"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
