"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { getChunks } from "@/lib/kb";
import type { HistoryEntry, ImpactStats, Lang } from "@/lib/types";
import type { UIStrings } from "@/lib/ui-strings";

interface DashboardModalProps {
  /** Current UI language (chrome copy + label language). */
  lang: Lang;
  strings: UIStrings;
  impact: ImpactStats;
  history: HistoryEntry[];
  onClose: () => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
  onReopen: (entry: HistoryEntry) => void;
}

type Tab = "impact" | "history";

const TITLE_ID = "dashboard-title";
const TAB_ID: Record<Tab, string> = {
  impact: "dashboard-tab-impact",
  history: "dashboard-tab-history",
};

/** "12 Oct"-style day label in the UI language. */
function formatDay(ts: number, lang: Lang): string {
  try {
    return new Intl.DateTimeFormat(lang === "hi" ? "hi-IN" : "en-IN", {
      day: "2-digit",
      month: "short",
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toLocaleDateString();
  }
}

/**
 * Device-local dashboard (FR12, DESIGN §1.3): an impact tab (counters + KB
 * coverage, honestly labelled "from this device") and a history tab (cap 50,
 * per-item delete, clear-all, click-to-reopen). Zero network calls.
 *
 * a11y: role=dialog + aria-modal, Esc closes, backdrop click closes, focus
 * moves in on open and back to the trigger on close, Tab is trapped, and the
 * page behind is frozen.
 */
export default function DashboardModal({
  lang,
  strings,
  impact,
  history,
  onClose,
  onDelete,
  onClearAll,
  onReopen,
}: DashboardModalProps) {
  const [tab, setTab] = useState<Tab>("impact");
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Focus moves into the dialog as soon as it opens.
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  // Esc closes; Tab cycles inside the dialog (no setState here — a11y only).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
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
  }, [onClose]);

  // Stop the page behind the modal from scrolling.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // KB coverage comes from the bundled JSON (AGENTS #19) — no fetch, no state.
  const chunks = getChunks();
  const crops = new Set<string>();
  for (const chunk of chunks) {
    for (const name of chunk.crop) {
      crops.add(name);
    }
  }
  const coverage = [
    `${crops.size} ${strings.kbCropsUnit}`,
    `${chunks.length} ${strings.kbDocsUnit}`,
    `2 ${strings.kbLangsUnit}`, // every chunk ships Hindi + English text
  ].join(" · ");

  const stats = [
    { label: strings.askedLabel, value: impact.asked },
    { label: strings.answeredLabel, value: impact.answered },
    { label: strings.refusedLabel, value: impact.refused },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-card bg-surface shadow-card sm:rounded-card"
      >
        <div className="flex items-center gap-2 border-b border-black/5 px-4 py-3">
          <h2 id={TITLE_ID} lang={lang} className="min-w-0 flex-1 truncate text-lg font-bold text-ink">
            {strings.dashboard}
          </h2>
          <button
            ref={closeRef}
            type="button"
            lang={lang}
            onClick={onClose}
            aria-label={strings.close}
            className="flex size-10 shrink-0 items-center justify-center rounded-button text-muted hover:bg-cream focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div role="tablist" aria-label={strings.dashboard} className="flex border-b border-black/5 px-2">
          {(["impact", "history"] as const).map((id) => {
            const selected = tab === id;
            return (
              <button
                key={id}
                id={TAB_ID[id]}
                role="tab"
                type="button"
                lang={lang}
                aria-selected={selected}
                aria-controls={`${TAB_ID[id]}-panel`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setTab(id)}
                className={`min-h-11 flex-1 border-b-2 px-2 text-sm font-semibold transition-colors ${
                  selected
                    ? "border-primary text-primary"
                    : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {id === "impact" ? strings.tabImpact : strings.tabHistory}
              </button>
            );
          })}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {tab === "impact" ? (
            <section
              id={`${TAB_ID.impact}-panel`}
              role="tabpanel"
              aria-labelledby={TAB_ID.impact}
              className="space-y-4"
            >
              <dl className="grid grid-cols-3 gap-2">
                {stats.map((stat) => (
                  <div key={stat.label} className="rounded-card bg-cream p-3 text-center">
                    <dt lang={lang} className="text-xs text-muted">
                      {stat.label}
                    </dt>
                    <dd className="mt-1 text-2xl font-bold text-primary">{stat.value}</dd>
                  </div>
                ))}
              </dl>

              {impact.lastTs !== null && (
                <p lang={lang} className="text-xs text-muted">
                  {strings.lastAskedLabel}: {formatDay(impact.lastTs, lang)}
                </p>
              )}

              <div className="rounded-card border border-primary/20 bg-primary/5 p-3">
                <p lang={lang} className="text-sm font-semibold text-ink">
                  {strings.kbCoverageHeading}
                </p>
                <p lang={lang} className="mt-0.5 text-sm text-ink/80">
                  {coverage}
                </p>
              </div>

              <p lang={lang} className="text-xs text-muted">
                {strings.deviceOnlyNote}
              </p>
            </section>
          ) : (
            <section
              id={`${TAB_ID.history}-panel`}
              role="tabpanel"
              aria-labelledby={TAB_ID.history}
              className="space-y-3"
            >
              {history.length === 0 ? (
                <p lang={lang} className="py-6 text-center text-sm text-muted">
                  {strings.historyEmpty}
                </p>
              ) : (
                <ul className="space-y-2">
                  {history.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex items-stretch gap-1 rounded-card border border-black/10 bg-cream"
                    >
                      <button
                        type="button"
                        lang={lang}
                        onClick={() => onReopen(entry)}
                        aria-label={`${strings.reopen}: ${entry.q}`}
                        className="flex min-h-12 min-w-0 flex-1 flex-col justify-center rounded-l-card px-3 py-2 text-left hover:bg-primary/5"
                      >
                        <span className="text-xs text-muted">{formatDay(entry.ts, lang)}</span>
                        <span className="truncate text-sm font-medium text-ink">{entry.q}</span>
                      </button>
                      <button
                        type="button"
                        lang={lang}
                        onClick={() => onDelete(entry.id)}
                        aria-label={`${strings.deleteEntry}: ${entry.q}`}
                        className="flex w-11 shrink-0 items-center justify-center rounded-r-card text-muted hover:bg-danger/10 hover:text-danger"
                      >
                        <X className="size-4" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {history.length > 0 && (
                <button
                  type="button"
                  lang={lang}
                  onClick={onClearAll}
                  className="min-h-11 w-full rounded-button border border-danger/40 px-3 text-sm font-semibold text-danger hover:bg-danger/10"
                >
                  {strings.clearAll}
                </button>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
