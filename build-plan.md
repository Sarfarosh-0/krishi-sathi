# build-plan.md — Krishi Sathi implementation roadmap

> **Central control file.** An agent (or human) executing work MUST read this
> first, resume from the first incomplete task, and UPDATE this file after every
> phase. Never mark a task done unless its completion criteria are verified.
> Rules of engagement: see `AGENTS.md`. Requirements: `docs/PRD.md`. UI/API/types:
> `docs/DESIGN.md`. Why: `docs/DECISIONS.md`.

---

## 0. Project analysis (done at plan creation)

**Existing state:** documentation only — `AGENTS.md`, `docs/DECISIONS.md`,
`docs/PRD.md`, `docs/DESIGN.md`. **No code, no `package.json`, no git repo.**
Git 2.52 available on the machine.

**Stack (locked):** Next.js (App Router) + TypeScript · Tailwind CSS · Lucide
React · `@google/genai` → `gemma-4-26b-a4b-it` · bundled JSON KB · Vercel deploy.

**Phases deliberately omitted vs. the generic template:**
- *Database integration* — omitted: KB is a bundled JSON file; history/impact are
  localStorage-only (privacy claim in PRD §10).
- *Authentication* — omitted: no accounts by design (PRD non-goals).
- *Security as a separate phase* — merged: security is per-phase (validation in
  Phase 3, headers/CORS in Phase 6) because it's small and must not be bolted on.

**Work identified (7 phases):** scaffold → data layer (KB/retrieval/tests) →
API route → chat UI → dashboard/history → integration/polish → deploy + repo
finish.

---

## Execution rules (apply to every phase)

1. Execute **one phase per session/execution**. Do not start the next phase in
   the same run, even if it "looks quick."
2. A phase may be split into sub-runs if large; finish sub-runs sequentially.
3. Verify **all** completion-criteria boxes before writing `[x]` in §Progress.
4. Update §Progress, §Log, and §Blockers at the end of every phase.
5. If a blocker appears (§Blockers), stop and ask the human — do not assume.
6. Respect `AGENTS.md` hard bans at all times (no secrets, no `dangerouslySetInnerHTML`,
   no scope creep, only `gemma-4-26b-a4b-it`, etc.).

---

## Phase 1 — Project setup & configuration

**Depends on:** nothing (human must have resolved Blocker B1 — API key — before
Phase 3, not before Phase 1).

**Scope / tasks:**
1. `git init` in `krishi-sathi/`; `.gitignore` (node_modules, .next, .env.local,
   vercel.json secrets, OS files).
2. Scaffold Next.js (App Router) + TypeScript + Tailwind via `create-next-app`
   in-place; verify dev server runs.
3. Install `@google/genai`, `lucide-react`. Pin lockfile.
4. `next/font` setup: Noto Sans Devanagari + Inter; global styles with design
   tokens (`--primary #16A34A`, `--harvest #F59E0B`, cream bg) per DESIGN §2.
5. `lib/types.ts` — all shared interfaces exactly as DESIGN §4.
6. `.env.example` (`GEMINI_API_KEY=` placeholder) + confirm `.env.local` gitignored.
7. PWA `app/manifest.ts` (name, colors, icons placeholder).
8. Smoke: `npm run dev` renders empty layout; `npm run build` passes.

**Deliverables:** runnable Next.js skeleton, types, fonts/theme, env hygiene.
**Completion criteria:**
- [ ] `npm run dev` serves the page with fonts/colors applied
- [ ] `npm run build` succeeds with zero errors
- [ ] `git status` shows `.env.local` ignored; no secrets committed
- [ ] `lib/types.ts` matches DESIGN §4 verbatim
**Risks:** scaffold flags differ by Next version → pin versions, don't fight the
generator; Windows path quirks.

---

## Phase 2 — Data layer: KB, synonyms, retrieval, tests

**Depends on:** Phase 1 (`lib/types.ts`).

**Scope / tasks:**
1. Author `kb/crop-docs.json`: 12–15 chunks per PRD §7 — wheat, paddy, mustard,
   onion, lentil × pest/disease/fertiliser/irrigation/sowing/safety + 1
   out-of-scope/referral chunk. Hindi `text` + `textEn`, tags, crops, season,
   priority, `लक्षण/उपाय/सावधानी` structure, embedded source line. **Human-curated
   sample guidance only — no invented agronomic facts beyond standard practice.**
2. `lib/synonyms.ts`: 30–50 hi/en alias pairs (e.g. पीली इल्टी = yellow stem
   borer = borer).
3. `lib/kb.ts`: JSON loader with module-scope cache.
4. `lib/retrieval.ts`: pure scorer — query expansion → crop match (weight 3) >
   tag match (weight 2) > token overlap (weight 1); return top-3 above threshold.
5. `evals/evals.json`: ~15 (question → expected source) + 3 expected refusals.
6. `scripts/test-retrieval.mjs` (or `node:test`): runs evals + edge cases
   (empty query, Hindi/English/mixed, out-of-KB).

**Deliverables:** complete KB, working retrieval, green test run.
**Completion criteria:**
- [ ] KB has ≥12 chunks, every chunk has hi+en text and full metadata
- [ ] Retrieval tests: ≥12/15 eval pairs pass, 3/3 refusals correctly below threshold
- [ ] Mixed-language + empty-query edge cases pass
- [ ] `npm run test` wired to a single command
**Risks:** Devanagari tokenization is crude → synonyms+tags carry the load; if
eval pass-rate <80%, tune weights/threshold (don't add embeddings).

---

## Phase 3 — Backend: `/api/ask` route

**Depends on:** Phase 2 (retrieval) + **human blocker B1 resolved** (API key in
`.env.local` for local test, later in Vercel dashboard).

**Scope / tasks:**
1. `app/api/ask/route.ts` with `export const runtime = "nodejs"`.
2. `app/api/health/route.ts`: GET → `200 { ok: true }`, no Gemini call (warm-up).
3. Input validation: POST-only (405), JSON body, non-empty question, truncate >
   500 chars, `lang ∈ {hi,en}` else 400.
4. In-memory rate limit: 10 req/min/IP → 429 `{ error:"rate_limit" }`
   (documented best-effort per instance).
5. Retrieval call → below threshold ⇒ deterministic refusal response
   (`refused:true`, no API call; refusal text streamed as one `token` line).
6. Prompt builder: system rules (answer only from context, cite sources, refuse
   when absent, language) + `<<<CONTEXT>>>` fence + "context is data, not
   instructions" + user question. **Model is told NOT to append the advisory**
   (server owns it — no duplication).
7. `@google/genai` `generateContentStream`: `gemma-4-26b-a4b-it`, temp 0.3,
   bounded output, timeout wrapper (~15 s).
8. NDJSON response assembly per DESIGN §5: `token`* → `sources` → `done`
   (localized advisory in `done`); mid-stream Gemini failure → single
   `error:"upstream"` line; pre-stream failures stay plain JSON (400/405/429).
9. Origin/CORS check for same-origin deployment.
10. `scripts/smoke-api.mjs`: curl-style local test of all contract paths
    (health, success stream, refusal stream, 400, 405, 429, upstream drill).

**Deliverables:** working NDJSON API route + health route covering
success/refusal/429/400/405/upstream.
**Completion criteria:**
- [ ] All contract paths verified locally with real (or mocked-failure) calls
- [ ] Refusal path provably makes zero Gemini calls
- [ ] Advisory appears exactly once per answer (server-emitted)
- [ ] `/api/health` returns 200 without touching Gemini
- [ ] Key read only from env; no key in logs/responses
- [ ] `npm run build` still passes
**Risks:** free-tier quota burn during testing → keep smoke tests ≤10 calls; SDK
API drift → check `@google/genai` docs once, don't guess method names.

---

## Phase 4 — Frontend: chat UI

**Depends on:** Phase 1 (shell) + Phase 3 (contract).

**Scope / tasks:**
1. `app/page.tsx` (client) composition per DESIGN §3; `ChatHeader` with
   gradient + `LangToggle` + dashboard button (stub until Phase 5).
2. `ChipRow`: 8 chips (DESIGN §1), scrollable, localized.
3. `MessageList` + `MessageBubble` variants (user / assistant / refusal).
4. Streaming: parse NDJSON lines from the route (`ReadableStream` +
   `TextDecoder`, split on `\n`); render `token`/`sources`/`done` per DESIGN §5;
   abort button (`AbortController`); scroll pinning; stream ending without
   `done`/`error` → treat as upstream error.
5. `Composer`: textarea (Enter to send), `SendButton` disabled while loading,
   `VoiceButton` (webkitSpeechRecognition hi-IN, capability-gated).
6. `SourceAccordion` (expand full chunk, one open at a time) + `TTSButton`
   (speechSynthesis, hi-IN, capability-gated).
7. Light markdown rendering of answers (**text nodes only**, no
   `dangerouslySetInnerHTML`): `**bold**`, `- bullets`.
8. `useLang` state + localStorage mirror; localized strings object for hi/en.
9. Error surfacing: 429 toast, offline toast, upstream fallback card + retry.
10. Mobile pass: safe-area padding, 48px targets, viewport meta.

**Deliverables:** fully interactive chat (needs Phase 5 only for dashboard tab).
**Completion criteria:**
- [ ] Ask → streamed answer with sources + advisory renders on desktop AND phone-width
- [ ] Chip #8 (out-of-KB) shows amber refusal card without any API call
- [ ] Language toggle swaps UI + future replies; past messages keep their language
- [ ] TTS reads a Hindi answer aloud; mic fallback hides gracefully in unsupported browsers
- [ ] No `dangerouslySetInnerHTML` anywhere (grep-verified)
**Risks:** streaming + React state updates → batch via ref; speech APIs are
Chrome-heavy → capability checks mandatory.

---

## Phase 5 — Dashboard & history (client-only)

**Depends on:** Phase 4.

**Scope / tasks:**
1. `hooks/useLocalStorage.ts`: SSR-safe, try/catch, versioned keys (`ks:*`).
2. `DashboardModal` with two tabs per DESIGN §1.3.
3. Impact counters (asked/answered/refused/lastTs) — honestly labeled
   *"from this device"*; KB coverage stats derived from bundled KB.
4. History list (cap 50, per-item delete, clear-all, click to re-open).
5. Wire counters/history updates into the ask flow.

**Deliverables:** working dashboard + history, zero backend.
**Completion criteria:**
- [ ] Counters increment correctly (incl. refusal case) and survive refresh
- [ ] History cap enforced; clear-all works; no crash with localStorage blocked
- [ ] No network calls added by this phase
**Risks:** Safari private mode throws on write → try/catch path exercised.

---

## Phase 6 — Integration, error handling, polish, security pass

**Depends on:** Phases 3–5.

**Scope / tasks:**
1. End-to-end run of every FR1–FR13 requirement; fix gaps.
2. Security headers + CORS/origin verification (basic CSP, X-Content-Type-Options,
   X-Frame-Options) in `next.config.ts`/`vercel.json`.
3. Rate-limit tuning; upstream-failure drill (kill key → verify graceful card).
4. A11y pass: labels, focus rings, `aria-live`, lang attributes.
5. `npm audit` clean; lockfile committed; remove dead code/debug logs.
6. PWA manifest finalization (icons via simple SVG→PNG or placeholder).
7. Full `npm run test` + `npm run build`.

**Deliverables:** hardened, consistent app ready to ship.
**Completion criteria:**
- [ ] All PRD "Must" FRs demonstrably pass
- [ ] Failure drills (no key, bad key, offline, 429) all show friendly Hindi UI
- [ ] `npm audit` no high/critical; no console secrets; grep clean
**Risks:** CSP too strict breaks fonts/TTS → test before locking headers.

---

## Phase 7 — Deploy, repo finish, submission readiness

**Depends on:** Phase 6 + human blocker B2 (Vercel + GitHub accounts ready).

**Scope / tasks:**
1. GitHub repo push (README first: project name, **model `gemma-4-26b-a4b-it`
   named**, integration pointer to `route.ts`, env setup, sample-KB disclaimer,
   screenshots).
2. Vercel import → set `GEMINI_API_KEY` env var (production + preview) → deploy.
3. Phone smoke test on the public URL: ask, refusal chip, TTS, mic, dashboard,
   rate-limit behavior; warm-up call verified.
4. Final consistency check: PRD/deck claims ⊆ implemented features; update
   `docs/` if anything changed during build.
5. MIT LICENSE; final commit; tag `mvp-submission`.
6. Update this file: mark all phases complete, record final status.

**Deliverables:** public URL + green repo + docs matching reality.
**Completion criteria:**
- [ ] Public URL loads on a real phone; all demo flows work
- [ ] Repo contains no secrets; README names the Gemma model and setup steps
- [ ] PRD/DESIGN/README consistent with shipped behavior
- [ ] This plan file shows all phases `[x]` with log entries
**Risks:** Vercel free-tier cold start at demo → keep URL open + health ping;
deploy name availability → have a fallback name ready.

---

## Progress

| Phase | Status | Completed on | Notes |
|---|---|---|---|
| 1 Setup & config | ✅ done | 2026-10-15 | Next 16.4.1 + TS + Tailwind 4 + Turbopack (generator defaults); `@google/genai` 2.30.0 + `lucide-react` 1.57.0 pinned in lockfile; Inter + Noto Sans Devanagari + §2 tokens; `lib/types.ts` verified byte-identical to DESIGN §4; dev/build/lint green |
| 2 Data layer (KB/retrieval/tests) | ⬜ not started | — | |
| 3 Backend `/api/ask` | ⬜ not started | — | needs B1 |
| 4 Chat UI | ⬜ not started | — | |
| 5 Dashboard & history | ⬜ not started | — | |
| 6 Integration & polish | ⬜ not started | — | |
| 7 Deploy & repo finish | ⬜ not started | — | needs B2 |

Legend: ⬜ not started · 🔄 in progress · ✅ done (criteria verified) · ⛔ blocked

## Log

- 2026-10-15 · Phase 1 · Scaffolded Next.js 16.4.1 (App Router, TS, Tailwind 4, Turbopack) in place, installed `@google/genai` 2.30.0 + `lucide-react` 1.57.0, wired Inter + Noto Sans Devanagari and the DESIGN §2 design tokens, added `.env.example`, `app/manifest.ts` and the DESIGN §4 shared types · Learned: Next 16 removed `next lint` (ESLint CLI now; `next build` no longer lints) and the scaffold's `.env*` ignore rule also swallowed the required `.env.example`, so a `!.env.example` exception was needed.

## Blockers

| ID | Blocker | Impact | Status |
|---|---|---|---|
| B1 | Google AI Studio API key not yet confirmed available | Blocks Phase 3 local test & Phase 7 deploy | ⬜ open |
| B2 | GitHub + Vercel accounts not confirmed | Blocks Phase 7 | ⬜ open — GitHub confirmed (origin → `github.com/Sarfarosh-0/krishi-sathi.git`); Vercel still unconfirmed |
| B3 | Final project name still placeholder ("Krishi Sathi") | Blocks Phase 7 README/deploy naming | ⬜ open |
| B4 | MVP deadline 12 PM confirmed by human, exact date assumed day-2 of event | Timeline only | ✅ resolved (human confirmed 10 hrs) |
