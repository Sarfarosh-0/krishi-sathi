"use client";

import { LayoutDashboard, Sprout } from "lucide-react";
import type { Lang } from "@/lib/types";
import type { UIStrings } from "@/lib/ui-strings";

interface ChatHeaderProps {
  lang: Lang;
  strings: UIStrings;
  onLangChange: (lang: Lang) => void;
}

/** Gradient header: title, language toggle, dashboard button (stub until Phase 5). */
export default function ChatHeader({ lang, strings, onLangChange }: ChatHeaderProps) {
  return (
    <header className="header-gradient text-surface shadow-card">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-2 px-4 py-3">
        <Sprout className="size-7 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h1 lang="hi" className="truncate text-xl leading-tight font-bold">
            कृषि साथी
          </h1>
          <p lang={lang} className="truncate text-sm opacity-90">
            {strings.tagline}
          </p>
        </div>

        {/* हिं | EN toggle — swaps UI strings and future reply language (FR2). */}
        <div
          role="group"
          aria-label={strings.langToggleLabel}
          className="flex shrink-0 items-center rounded-button bg-black/15 p-0.5"
        >
          {(["hi", "en"] as const).map((option) => (
            <button
              key={option}
              type="button"
              lang={option}
              aria-pressed={lang === option}
              onClick={() => onLangChange(option)}
              className={`min-h-9 rounded-[8px] px-3 text-sm font-semibold transition-colors ${
                lang === option ? "bg-surface text-primary" : "text-surface hover:bg-black/10"
              }`}
            >
              {option === "hi" ? "हिं" : "EN"}
            </button>
          ))}
        </div>

        {/* Stub: Phase 5 wires the modal and removes `disabled`. */}
        <button
          type="button"
          disabled
          aria-label={`${strings.dashboard} — ${strings.dashboardSoon}`}
          title={strings.dashboardSoon}
          className="flex size-11 shrink-0 items-center justify-center rounded-button text-surface opacity-70"
        >
          <LayoutDashboard className="size-5" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
