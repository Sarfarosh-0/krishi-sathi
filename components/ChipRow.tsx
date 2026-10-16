"use client";

import type { Lang } from "@/lib/types";
import { CHIPS } from "@/lib/ui-strings";

interface ChipRowProps {
  lang: Lang;
  label: string;
  /** Dimmed (not hidden) while an answer is streaming (DESIGN §7). */
  disabled: boolean;
  onPick: (question: string) => void;
}

/** Horizontally scrollable row of the 8 suggested questions (FR3). */
export default function ChipRow({ lang, label, disabled, onPick }: ChipRowProps) {
  return (
    <nav aria-label={label} className="border-b border-black/5 bg-surface">
      <ul className="mx-auto flex w-full max-w-3xl gap-2 overflow-x-auto px-4 py-2.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {CHIPS.map((chip) => {
          // A chip with no localised question can never answer anything, so
          // skip it instead of rendering a dead control or sending an empty
          // request (send() also guards against empty input).
          const question = chip[lang].question.trim();
          if (!question) {
            return null;
          }
          return (
            <li key={chip.id} className="shrink-0">
              <button
                type="button"
                lang={lang}
                disabled={disabled}
                onClick={() => onPick(question)}
                className="min-h-10 rounded-full border border-primary/30 bg-cream px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
              >
                {chip[lang].label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
