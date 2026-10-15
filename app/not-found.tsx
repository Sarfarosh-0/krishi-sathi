import Link from "next/link";

/**
 * Branded 404 (pre-production-checklist E15), replacing Next's default page.
 * A Server Component — no interactivity, so it costs nothing.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-2 px-4 py-16 text-center">
      <p className="text-5xl font-bold text-primary">404</p>
      <h1 lang="hi" className="text-xl font-bold text-ink">
        यह पेज नहीं मिला
      </h1>
      <p lang="en" className="text-sm text-muted">
        This page could not be found.
      </p>
      <Link
        href="/"
        className="mt-3 inline-flex min-h-10 items-center rounded-button bg-primary px-4 py-2 text-sm font-semibold text-surface transition-colors hover:bg-primary-dark"
      >
        <span lang="hi">चैट पर वापस जाएँ</span>
      </Link>
    </main>
  );
}
