/**
 * Phase 1 smoke screen.
 *
 * Purpose: prove that fonts, colour tokens and language attributes are wired
 * up correctly (build-plan.md Phase 1, task 8). The real chat UI — header,
 * chips, message list, composer — is built in Phase 4 (docs/DESIGN.md §3).
 */
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-4 py-10">
      <section className="header-gradient rounded-card p-6 text-surface shadow-card">
        <h1 lang="hi" className="text-2xl font-bold">
          कृषि साथी
        </h1>
        <p lang="hi">छोटे किसानों के लिए AI सलाहकार</p>
        <p lang="en" className="mt-2 text-sm">
          Hindi-first AI farming advisor for smallholder farmers near Lucknow
        </p>
      </section>

      <section className="rounded-card bg-surface p-6 shadow-card">
        <h2 lang="hi" className="text-lg font-semibold">
          सेटअप पूरा हुआ
        </h2>
        <p lang="en" className="mt-2 text-muted">
          Phase 1 (project setup) is complete. The knowledge base, the
          <span className="font-mono"> /api/ask </span>
          route and the chat interface arrive in later phases.
        </p>
      </section>

      {/* Colour tokens, rendered so the theme is visually verifiable. */}
      <ul className="flex flex-wrap gap-2 text-sm">
        <li className="rounded-card bg-primary px-3 py-2 text-surface">
          primary
        </li>
        <li className="rounded-card bg-harvest px-3 py-2 text-ink">harvest</li>
        <li className="rounded-card bg-soil px-3 py-2 text-surface">soil</li>
        <li className="rounded-card bg-cream px-3 py-2 text-ink">cream</li>
      </ul>
    </main>
  );
}
