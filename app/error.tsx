"use client";

import { RotateCcw } from "lucide-react";

/**
 * Root error boundary (pre-production-checklist B1). Next renders this instead
 * of its default error screen when a client render throws, so a failure stays
 * on-brand, keeps both languages, and offers a recovery action.
 *
 * Must be a Client Component (Next 16 App Router): `reset` re-renders the
 * failed segment. The `error` prop is intentionally not shown to the user — it
 * is untrusted and may leak internals.
 */
export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-2 px-4 py-16 text-center">
      <h1 lang="hi" className="text-xl font-bold text-ink">
        कुछ गड़बड़ हो गई
      </h1>
      <p lang="en" className="text-sm text-muted">
        Something went wrong. Please try again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-button bg-primary px-4 py-2 text-sm font-semibold text-surface transition-colors hover:bg-primary-dark"
      >
        <RotateCcw className="size-4" aria-hidden="true" />
        <span lang="hi">फिर कोशिश करें</span>
      </button>
    </main>
  );
}
