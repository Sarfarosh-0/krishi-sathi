"use client";

import type { Lang } from "@/lib/types";

interface AnswerSkeletonProps {
  /** Localized "thinking" text — announced to assistive tech, not shown. */
  label: string;
  lang: Lang;
}

/**
 * Loading placeholder for an answer that is still being generated (DESIGN §7).
 *
 * Three pulsing bars stand in for the answer copy so the bubble reads as
 * "being written" instead of sitting empty. The bars are decorative
 * (`aria-hidden`); the localized `label` is the screen-reader status. This
 * reuses Tailwind's `animate-pulse` and the theme's `muted` token — no new
 * dependency — and the global `prefers-reduced-motion` rule in `app/globals.css`
 * stops the pulse for users who ask for less motion.
 *
 * The wrapper reserves the same height as a streaming answer
 * (`min-h-[4.5rem]` in `MessageBubble`), so swapping in the first token does not
 * shift the layout. Bar widths are relative, so the skeleton scales with the
 * viewport.
 */
export default function AnswerSkeleton({ label, lang }: AnswerSkeletonProps) {
  return (
    <div className="min-h-[4.5rem]">
      <span lang={lang} className="sr-only">
        {label}
      </span>
      <div className="space-y-3" aria-hidden="true">
        <div className="h-3.5 w-full animate-pulse rounded-full bg-muted/30" />
        <div className="h-3.5 w-11/12 animate-pulse rounded-full bg-muted/30" />
        <div className="h-3.5 w-3/4 animate-pulse rounded-full bg-muted/30" />
      </div>
    </div>
  );
}
