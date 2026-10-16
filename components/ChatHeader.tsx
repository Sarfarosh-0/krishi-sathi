"use client";

import type { RefObject } from "react";
import Image from "next/image";
import { LayoutDashboard } from "lucide-react";
import type { Lang } from "@/lib/types";
import type { UIStrings } from "@/lib/ui-strings";

interface ChatHeaderProps {
  lang: Lang;
  strings: UIStrings;
  onLangChange: (lang: Lang) => void;
  /** Opens the device-local dashboard modal (FR12). */
  onOpenDashboard: () => void;
  /** Focus returns here when the modal closes (a11y). */
  dashboardButtonRef?: RefObject<HTMLButtonElement | null>;
}

/** Gradient header: brand logo, title, language toggle, dashboard button. */
export default function ChatHeader({
  lang,
  strings,
  onLangChange,
  onOpenDashboard,
  dashboardButtonRef,
}: ChatHeaderProps) {
  return (
    <header className="header-gradient text-surface shadow-card">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-2 px-4 py-3">
        {/* Brand mark — the provided logo on its own plate, clipped to a circle
            so the near-white background reads as an app-icon badge on the
            gradient. `alt=""`: decorative, the h1 carries the name. */}
        <Image
          src="/Logo.png"
          alt=""
          width={36}
          height={36}
          priority
          className="size-9 shrink-0 rounded-full bg-surface"
        />
        <div className="min-w-0 flex-1">
          <h1 lang="hi" className="truncate text-xl leading-tight font-bold">
            कृषि साथी
          </h1>
          {/* No opacity: white at full strength keeps ≥4.5:1 over the amber end. */}
          <p lang={lang} className="truncate text-sm">
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

        {/* Opens the device-local dashboard + history modal (FR12). */}
        <button
          ref={dashboardButtonRef}
          type="button"
          lang={lang}
          onClick={onOpenDashboard}
          aria-haspopup="dialog"
          aria-label={strings.dashboard}
          className="flex size-11 shrink-0 items-center justify-center rounded-button text-surface transition-colors hover:bg-black/15"
        >
          <LayoutDashboard className="size-5" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
