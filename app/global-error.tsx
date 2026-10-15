"use client";

/**
 * Last-resort boundary for errors thrown by the root layout itself (B1). It
 * replaces the root layout, so it must render its own <html>/<body>. Kept
 * dependency-free and hook-free so it can never fail in the same way.
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="hi">
      <body className="flex min-h-dvh flex-col items-center justify-center gap-2 bg-cream px-4 text-center">
        <h1 className="text-xl font-bold text-ink">कुछ गड़बड़ हो गई</h1>
        <p lang="en" className="text-sm text-muted">
          Something went wrong. Please try again.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-3 min-h-10 rounded-button bg-primary px-4 py-2 text-sm font-semibold text-surface"
        >
          फिर कोशिश करें
        </button>
      </body>
    </html>
  );
}
