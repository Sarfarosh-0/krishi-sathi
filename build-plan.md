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
1. `app/api/ask/route.ts` on the Node runtime. **Do not export the `runtime`
   segment config** — `cacheComponents` is enabled and Next 16 rejects it with a
   hard build error (Node is the default; Edge is deprecated).
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
   `maxOutputTokens` 2048, 55 s in-route deadline + `maxDuration = 60`.
   **Verified constraints:** this model rejects `config.systemInstruction` (so the
   rules go in `contents`), and `thinkingConfig.thinkingBudget` is unsupported.
   Thinking tokens are charged to `maxOutputTokens`. Retry up to 4 attempts, but
   only while no `token` has been streamed and the deadline still allows it (the
   model returns fast 5xx intermittently — reproducible with the plain SDK, so not
   a bundling issue).
   > *Update 2026-10-16:* thinking is **not** uncappable —
   > `thinkingLevel: "minimal"` **is** accepted (LOW/MEDIUM/HIGH and
   > `thinkingBudget` return 400). The route now sets it, taking a real answer
   > from **15–33 s** to **~3–5 s** with citations and the refusal intact
   > (DESIGN §5).
8. NDJSON response assembly per DESIGN §5: `sources` → `token`* → `done`
   (sources **first**, so the snippet-fallback card has content if the model
   fails; localized advisory in `done`); upstream failure → single
   `error:"upstream"` line; pre-stream failures stay plain JSON (400/403/405/429).
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
- [x] Ask → streamed answer with sources + advisory renders on desktop AND phone-width
- [x] Chip #8 (out-of-KB) shows amber refusal card without any API call
- [x] Language toggle swaps UI + future replies; past messages keep their language
- [x] TTS reads a Hindi answer aloud; mic fallback hides gracefully in unsupported browsers
- [x] No `dangerouslySetInnerHTML` anywhere (grep-verified)
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
- [x] Counters increment correctly (incl. refusal case) and survive refresh
- [x] History cap enforced; clear-all works; no crash with localStorage blocked
- [x] No network calls added by this phase
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
- [x] All PRD "Must" FRs demonstrably pass (FR1–FR14 exercised E2E in Chrome, desktop + 390 px)
- [x] Failure drills (no key, bad key, offline, 429) all show friendly Hindi UI
- [x] `npm audit` no high/critical; no console secrets; grep clean — `npm audit --omit=dev` = **0**; full audit = 5 high, all one **dev-only** transitive `braces` chain with no patched version (recorded as B6); secret/debug/`dangerouslySetInnerHTML` greps clean
**Risks:** CSP too strict breaks fonts/TTS → test before locking headers.

---

## Phase 7 — Deploy, repo finish, submission readiness

**Depends on:** Phase 6 + human blocker B2 (Vercel + GitHub accounts ready).

**Scope / tasks:**
1. GitHub repo push (README first: project name, **model `gemma-4-26b-a4b-it`
   named**, integration pointer to `route.ts`, env setup, sample-KB disclaimer,
   screenshots).
   > *Resolved 2026-10-16:* `README.md` was rewritten as a professional project
   > README (correct stack: Inter + Noto Sans Devanagari, not Geist) and an MIT
   > `LICENSE` was added.
   > *New gate:* work through `pre-production-checklist.md` (created 2026-10-16).
   > In-repo blockers (B1 error boundary, B2 landmark + contrast, B5 Node pin,
   > S9/S10 headers) are **done**; deploy-dependent items (B3 Vercel env,
   > B4 HTTPS/HSTS on the live URL, B6 function duration, B7 monitoring,
   > B8 post-deploy smoke) remain open.
2. Vercel import → set `GEMINI_API_KEY` env var (production + preview) → deploy.
3. Phone smoke test on the public URL: ask, refusal chip, TTS, mic, dashboard,
   rate-limit behavior; warm-up call verified.
   > *Browser floor check:* Next 16 + Tailwind 4 need Chrome/Edge 111+ ·
   > Safari 16.4+ · Firefox 128+ (all March 2023+). Accepting this was a human
   > decision (2026-10-15) — verify on the real demo phone here. If it
   > misrenders, the fallback is the bundled Tailwind v3 downgrade guide.
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
| 2 Data layer (KB/retrieval/tests) | ✅ done | 2026-10-15 | 14 bilingual chunks (all 5 crops + neem-safety + pre-rain + out-of-scope) — every chunk 80–150 words in both languages, `लक्षण/उपाय/सावधानी` structure, source line embedded in the text; `lib/synonyms.ts` (36 groups incl. Roman transliterations); `lib/kb.ts` module-scope-cached JSON loader; `lib/retrieval.ts` pure scorer (crop 3 > tag 2 > token 1, threshold 5); `npm run test` = `node --test`; **11/11 tests, 15/15 evals, 3/3 refusals**; build + lint green; bundled-KB import proven (prerender executed `getChunks()` → 14) |
| 3 Backend `/api/ask` | ✅ done | 2026-10-15 | `app/api/ask/route.ts` (NDJSON `sources` → `token`* → `done`) + `app/api/health/route.ts` (200, made dynamic with `connection()` so it really warms the function, never calls Gemini); POST-only + 400/403/405/429; same-origin check; 10 req/min/IP in-memory limiter; retrieval-gated refusal that provably makes **zero Gemini calls**; prompt keeps the `<<<CONTEXT>>>` fence with rules in `contents` (the model **rejects** `systemInstruction`); `maxOutputTokens` 2048 + 55 s in-route deadline + `maxDuration = 60`; retry ≤4 attempts only while nothing has been streamed; `scripts/smoke-api.mjs` = **22/22 normal**, **17/17 upstream drill**; retrieval 11/11; lint + build green |
| 4 Chat UI | ✅ done | 2026-10-15 | `app/page.tsx` orchestrates the stream (NDJSON `sources`→`token`*→`done`, `AbortController` stop, 429/offline toasts, `error`/truncated stream → upstream card + retry, `/api/health` warm-up); components `ChatHeader` (gradient + हिं\|EN toggle + disabled dashboard stub), `ChipRow` (8 chips), `MessageList` (`aria-live`, bottom-pinned), `MessageBubble` (user/answer/refusal/upstream/stopped + "सोच रहा हूँ…" thinking row), `SourceAccordion` (one open at a time), `TTSButton`, `Composer` (mic, send ⇄ stop, IME-aware Enter), `Toast`; client-only `lib/chat.ts` so DESIGN §4 wire types stay byte-identical, `lib/ui-strings.ts` (26 strings × hi/en + the 8 chips), `lib/markdown.tsx` (`renderAnswer` → React text nodes only; `toSpeechText` for read-aloud), hooks `useLang` (`ks:lang`) / `useCapability` / `useSpeech` / `useVoiceInput`. **Verified in Chrome:** desktop + 390 px phone-width streamed answer with 3 sources and the advisory exactly once (16.1–17.6 s); chip #8 → amber refusal card with **zero** API calls; the EN toggle swaps UI + chips while past messages keep their own `lang`; chip #8 in EN returns the English refusal + English advisory; TTS speaks `hi-IN` plain text (no `*` / `**` / `[source_id]`); deleting `speechSynthesis` + `SpeechRecognition` and re-rendering hides the mic + listen controls with their hints and never crashes; grep clean. 12/12 tests (added the chip-coverage test), lint + `next build` green |
| 5 Dashboard & history | ✅ done | 2026-10-15 | `lib/hooks/useLocalStorage.ts` (SSR-safe `useSyncExternalStore` store, versioned `ks:history:v1` / `ks:impact:v1`, try/catch + in-memory fallback); `components/DashboardModal.tsx` (two tabs, counters, KB coverage `5 फसलें · 14 दस्तावेज़ · 2 भाषाएँ` from bundled `lib/kb.ts`, history cap 50 / ✖ / सब हटाएँ / click-to-reopen, role=dialog + Esc + backdrop + focus return + Tab trap + scroll lock); `ChatHeader` button un-disabled; counters + history wired into `send()` incl. the refusal path; client-only helpers in `lib/chat.ts`; 16 new UI strings × hi/en (removed dead `dashboardSoon`). **Verified in Chrome (390 px iframe + desktop):** asked/answered/refused 0/0/0 → chip #1 gave 1/1/0 (20.5 s) → chip #8 gave **2/1/1** with `refused:true`, `sources:[]`; survived a refresh (2/1/1 + "पिछला सवाल: 15 अक्टू॰"); seeded 50 + 1 refusal kept **50** with the oldest dropped; per-item ✖ 50→49; "सब हटाएँ" → `[]` + empty state; click-to-reopen restored the Q&A with 3 KB sources and **zero** `/api/ask` calls; `window.localStorage` replaced with a throwing getter → dashboard still rendered 0/0/0 with no console error; modal at 390×844 = 390 wide, no horizontal overflow. grep: only `/api/ask` + `/api/health`; lint + 12/12 tests + `next build` green |
| 6 Integration & polish | ✅ done | 2026-10-15 | E2E pass of FR1–FR14 in Chrome (desktop + 390 px iframe); security headers in `next.config.ts` (CSP without nonces, `nosniff`, `X-Frame-Options: SAMEORIGIN`) verified on `next start`; a11y pass (one global `:focus-visible` ring, `lang` on toasts, `aria-label` on source accordions); `npm audit --omit=dev` = **0** (full = 5 high, one dev-only `braces` chain, no patch — B6); PWA manifest finalised (SVG + 192/512 + maskable 512 + `app/apple-icon.png`); dead code removed (`getMeta`, `scoreChunk`); missing-key path now emits `sources` before `error` (FR10). **Failure drills:** no-key + bad-key → friendly amber snippet card (3 sources + retry, no technical wording), offline → red toast, 429 → amber toast from a **real** 429. **12/12 tests, lint + `next build` green** |
| — Hardening (pre-deploy) | ✅ done | 2026-10-16 | `pre-production-checklist.md` (85-item evidence-based audit + go/no-go) written, then the in-repo gating items closed: error/global-error/not-found pages; `<main>` landmark + contrast pass (`--primary` green-600→green-700, `--muted` stone-500→stone-600, header amber stop amber-500→amber-700) taking **Lighthouse a11y 0.94 → 1.0**; HSTS + `Referrer-Policy` + `Permissions-Policy` (`microphone=(self)`) + `poweredByHeader:false`; Node pin (`engines` + `.nvmrc` 22). **12/12 tests, 23/23 smoke, lint + build green.** Deploy-dependent items (B3/B4/B6/B7/B8) remain in Phase 7 |
| — Perf + retrieval hardening | ✅ done | 2026-10-16 | (a) `thinkingLevel: "minimal"` caps thinking → answers **~3–5 s** (was 15–33 s); (b) rate-limit key prefers Vercel's proxy-proof `x-vercel-forwarded-for`; (c) icons regenerated from `public/Logo.png` + iOS install meta + reduced-motion; (d) synonym table broadened (Roman-Hindi + spelling variants: `khaad`, `gehoon`, `dhaan`, `rai`, `gerua`, `बुआई`, …); (e) **pre-scoring non-goal guard** (`isOutOfScope`) so price/scheme/loan/weather questions refuse instead of leaking an answer; evals now **38 hits + 8 refusals**. **13/13 tests, lint + build green** |
| — Answer skeleton loader | ✅ done | 2026-10-16 | `components/AnswerSkeleton.tsx` (three `animate-pulse` bars on the `muted` token; decorative, with the localized "सोच रहा हूँ…" as `sr-only` status) replaces the spinner in `MessageBubble` while `status === "streaming" && text === ""`; the streaming answer carries the same `min-h-[4.5rem]` reserve so the skeleton→first-token swap does not shift layout. **Verified in a live browser with a mocked NDJSON stream:** skeleton 190 px (3 pulses) → one-word answer 190 px (1 caret pulse, no shift); rejection → upstream card + retry, 0 pulses; chip #8 → amber refusal + advisory, 0 pulses. **13/13 tests, lint + build green** |
| 7 Deploy & repo finish | ⬜ not started | — | needs B2 |

Legend: ⬜ not started · 🔄 in progress · ✅ done (criteria verified) · ⛔ blocked

## Log

- 2026-10-15 · Phase 1 · Scaffolded Next.js 16.4.1 (App Router, TS, Tailwind 4, Turbopack) in place, installed `@google/genai` 2.30.0 + `lucide-react` 1.57.0, wired Inter + Noto Sans Devanagari and the DESIGN §2 design tokens, added `.env.example`, `app/manifest.ts` and the DESIGN §4 shared types · Learned: Next 16 removed `next lint` (ESLint CLI now; `next build` no longer lints) and the scaffold's `.env*` ignore rule also swallowed the required `.env.example`, so a `!.env.example` exception was needed.
- 2026-10-15 · Phase 2 · Authored the 14-chunk sample KB (human-approved: clearly-labelled KVK-style sample guidance, no brand names or invented dosages), `lib/synonyms.ts`, cached `lib/kb.ts`, pure `lib/retrieval.ts`, `evals/evals.json` and the `node:test` retrieval suite; tuned weights/threshold until 15/15 evals and 3/3 refusals passed · Learned: (1) Node 24 strips TS types natively but its ESM resolver still rejects extensionless imports, so `node --test` runs the real `.ts` modules via a ~20-line resolve hook — no new dependency, app code stays idiomatic; (2) `लक्षण / उपाय / सावधानी` appear in *every* chunk, so those labels (and general question words) must be filtered from the expanded token set or every score inflates; (3) the `out_of_scope` chunk must be excluded from retrieval candidates, otherwise "मछली पालन की लागत" would be *answered* from the referral doc instead of hitting the refusal path.
- 2026-10-15 · Phase 3 · Built the NDJSON backend (`app/api/ask/route.ts` + `app/api/health/route.ts`) with validation/rate-limit/same-origin guards, retrieval-gated refusal and `scripts/smoke-api.mjs`; verified **22/22 normal + 17/17 upstream drill**, retrieval 11/11, lint + build green · Learned: (1) the pinned model **rejects `config.systemInstruction`** (500/503), so the system rules must live in `contents` — a "nicety" many SDK examples assume; (2) it is a **thinking model** whose `thinkingConfig.thinkingBudget` is **unsupported** ("Thinking budget is not supported for this model"), so real answers take **15–33 s** (605–1446 thinking tokens) and thinking is charged to `maxOutputTokens` — hence task 7's "~15 s timeout" became a 55 s deadline + `maxDuration = 60`, and a too-small token cap silently returns an *empty* answer; (3) with `cacheComponents` enabled, Next 16 **rejects the `runtime` segment config** outright (build error) — Node is the default and Edge is deprecated, so the export is simply omitted and AGENTS #6 was corrected; (4) `sources` must be emitted **before** the model call, otherwise DESIGN §5's snippet-fallback card has nothing to show when the model fails; (5) the API returns **fast intermittent 5xx** — reproduced with the plain SDK *outside* Next, so it is vendor-side, not bundling; because failures cost ~1 s the route retries up to 4 times, while permanent 4xx must **not** be retried (one 400 would otherwise burn all 4 attempts).
- 2026-10-15 · Phase 4 · Built the chat UI (composition + NDJSON streaming, language toggle, sources accordion, TTS/voice with capability gating, refusal/upstream/offline cards) and documented it in DESIGN §3/§5/§6/§7; added a chip-coverage test to the retrieval suite; verified all five completion criteria in a real Chrome (desktop + 390 px iframe, plus a capability-deleted fallback run) · Learned: (1) React 19's `react-hooks/set-state-in-effect` rule rejects the usual `useState` + `useEffect` capability probe, so both capability detection and the persisted language use `useSyncExternalStore` — the value is `null` on the server and the first paint (nothing renders) and a real boolean after, which also kills any hydration mismatch; (2) because the model thinks for 15–33 s, an empty assistant bubble needs its own "सोच रहा हूँ…" state or the UI looks frozen — and emitting `sources` first means the accordion can already be on screen while it thinks; (3) TTS must speak **plain** text: the raw Markdown (`* `, `**`) and the inline `[source_id]` citation are audible junk, so `toSpeechText` strips them before `speak()`; (4) headless Chrome reports `speechSynthesis`/`SpeechRecognition` as supported, so the graceful-hide path was proven by deleting both globals and forcing a re-render (buttons vanish, hints appear, no crash); (5) the intermittent model 5xx was observed live during verification (4 attempts all 500 → clean snippet-fallback card; the retry then answered in 16.1 s), so the fallback + retry path is exercised, not theoretical.
- 2026-10-15 · Phase 5 · Built the client-only dashboard/history (FR12) and documented it in DESIGN §1.3/§3/§5/§6/§7 + DECISIONS §6; verified all three completion criteria in Chrome (390 px iframe + desktop) · Learned: (1) `useSyncExternalStore` needs a **referentially stable** `getSnapshot`, so `useLocalStorage` parses through a module-level `raw → value` cache — without it React loops on the new object every render; pinning a *failed* write to the raw string still on disk keeps the same-tab UI live when Safari-private-mode storage throws on both read and write; (2) storing the server advisory **verbatim inside** `HistoryEntry.answer` is what lets a replayed answer keep its disclaimer without editing the frozen `lib/types.ts` or re-authoring a server string client-side (DESIGN §5 forbids duplication); (3) a plain `element.click()` inside `browser.evaluate` reads the DOM in the *same* tick, so React has not flushed yet — the clear-all "still 49 rows" was a probe artefact, not a bug (a second read showed 0 rows + the empty state); (4) the header dashboard button's refs made the a11y "focus moves in and returns" test cheap to prove — Esc restored focus to the exact button that opened the modal; (5) screenshots need a visible desktop window, which this environment lacks, so the evidence is DOM/a11y-snapshot based.
- 2026-10-15 · Phase 6 · Hardened and polished: security headers (`next.config.ts`), a11y pass, PWA manifest + generated icons, dead-code removal, the missing-key `sources`-before-`error` fix, and the E2E + failure-drill verification (PRD §10 + FR10/FR13, DESIGN §5/§A11y updated to match) · Learned: (1) a CSP **without nonces** keeps every page statically optimized (`'unsafe-inline'` for Next's bootstrap + inline styles, `'unsafe-eval'` in dev only) — the Next.js guide's nonce variant forces dynamic rendering for no MVP benefit; (2) `X-Frame-Options: SAMEORIGIN` + `frame-ancestors 'self'` beat DENY/none because the 390 px mobile-width check embeds the app in a **same-origin iframe**; (3) the limiter is keyed on `x-forwarded-for`/`x-real-ip` (fallback `"unknown"`), so a browser (no forwarded header) and a curl burst that *sets* one land in **different buckets** — to see the real client 429 the browser's own bucket must be primed (10 cheap invalid POSTs, which are counted before parsing, then the click is the first 429); a plain `element.click()` fires the app handler but React flushes asynchronously, so the toast must be read after a `setTimeout` tick, not in the same tick; (4) PowerShell's `$env:VAR=""` **deletes** the variable (so Next refilled it from `.env.local` and the "no-key" drill silently answered for real) — an explicitly empty key needs a Node-spawned child (`process.env.VAR=''`), which then proves the missing-key path in 158 ms with zero model calls; (5) the pinned model's intermittent 5xx (B5) appeared live again (attempt 1/2 = 500, attempt 3 = transport); and (6) the dev-only transitive `braces` advisory (CVE-2026-93687) has **no patched version** — the only npm "fix" is a nonsense `eslint-config-next` downgrade, so production is proven clean via `npm audit --omit=dev` (0) and the dev advisory is recorded (B6) rather than force-downgraded.
- 2026-10-16 · Production-readiness hardening (pre-Phase 7) · Wrote
  `pre-production-checklist.md` (85-item evidence-based audit + go/no-go), then
  closed the in-repo gating items: (1) `app/error.tsx` + `app/global-error.tsx` +
  branded `app/not-found.tsx` (B1/E15); (2) `<main>` landmark around transcript +
  composer and a contrast pass — `--primary` green-600→green-700, `--muted`
  stone-500→stone-600, header-gradient amber stop amber-500→amber-700
  (`--harvest-dark`) — taking **Lighthouse Accessibility 0.94 → 1.0** with zero
  failures (was `color-contrast` + `landmark-one-main`); (3)
  `Strict-Transport-Security`, `Referrer-Policy`, `Permissions-Policy` (with
  `microphone=(self)` so voice input keeps working) and `poweredByHeader:false`;
  (4) Node pin (`engines.node ">=20.9.0"` + `.nvmrc` 22). Verified: lint clean,
  **12/12 tests**, `next build` green, **23/23 smoke**, headers confirmed on
  `next start`, custom 404 + `<main>` confirmed in-browser · Learned: (1)
  axe/Lighthouse surfaces only rule ids through the harness, so the exact failing
  nodes came from a hand-rolled in-page contrast walker that parses
  `background-image` gradient stops and composites translucent layers — that is
  what exposed the header's amber end (2.15:1) and the active language toggle
  (3.3:1); (2) `Permissions-Policy` must allow `microphone=(self)`, or a
  `camera=()…`-style lockdown would silently break the Web Speech voice input;
  (3) green-600 fails AA both as text on cream (3.08:1) and as a bubble behind
  white text (3.30:1), so one token change to green-700 fixes both.
- 2026-10-16 · Perf + retrieval hardening · Capped thinking with
  `thinkingLevel: "minimal"` (verified live: first token 3.8 s, total 5.2 s,
  citations + off-KB refusal intact), hardened the rate-limit key to prefer
  Vercel's platform-set `x-vercel-forwarded-for`, broadened the synonym table
  (Roman-Hindi + spelling variants), and added a **pre-scoring non-goal guard**
  (`isOutOfScope` in `lib/retrieval.ts`) so a market-price / scheme / loan /
  weather question that also contains an in-KB topic word ("खाद की कीमत") refuses
  instead of leaking fertiliser advice · Learned: (1) `thinkingBudget` and the
  LOW/MEDIUM/HIGH levels are rejected, but `thinkingLevel: "minimal"` **is**
  accepted — the one value that skips thinking; (2) a naive out-of-scope check on
  the bare word "rate" would break the in-KB "seed rate" / "बीज दर" topic, so that
  phrase is scrubbed before the check; (3) adding the Roman alias `khaad` without
  the guard would have *widened* the existing price-question leak, so the guard
  and the alias ship together; (4) the separate "out-of-KB crop + in-KB topic"
  case ("टमाटर में खाद कब डालें" → fertiliser advice) needs crop gating and is
  recorded as open rather than silently fixed.
- 2026-10-16 · Answer skeleton loader · Replaced the single-line thinking
  spinner with an `AnswerSkeleton` (three pulsing bars) shown while the first
  answer token is in flight; the localized "सोच रहा हूँ…" cue moved to `sr-only`
  so the loading state is still announced. The streaming answer reuses the
  skeleton's `min-h-[4.5rem]` reserve, so the swap causes no layout shift ·
  Learned: (1) a multi-line skeleton would normally *introduce* the very layout
  shift it is meant to smooth (a 190 px placeholder collapsing to a ~27 px first
  line), so the reserve has to be shared by both states — measured 190 → 190 px
  with a one-word answer; (2) the skeleton is only ever replaced by a terminal
  state (done/refused/upstream/stopped), so a failure can never leave it on
  screen; (3) `animate-pulse` + the `muted` token keep it on-theme with no new
  dependency, and the existing global `prefers-reduced-motion` rule still stills
  it.

## Blockers

| ID | Blocker | Impact | Status |
|---|---|---|---|
| B1 | Google AI Studio API key not yet confirmed available | Blocks Phase 3 local test & Phase 7 deploy | ✅ resolved — human added `GEMINI_API_KEY` to `.env.local` (2026-10-15) and the route was verified against the live API; Phase 7 still needs it added in the Vercel dashboard |
| B2 | GitHub + Vercel accounts not confirmed | Blocks Phase 7 | ⬜ open — GitHub confirmed (origin → `github.com/Sarfarosh-0/krishi-sathi.git`); Vercel deploy deliberately deferred by human to Phase 7 |
| B3 | Final project name still placeholder ("Krishi Sathi") | Blocks Phase 7 README/deploy naming | ✅ resolved — human locked "Krishi Sathi (कृषि साथी)" (2026-10-15) |
| B4 | MVP deadline 12 PM confirmed by human, exact date assumed day-2 of event | Timeline only | ✅ resolved (human confirmed 10 hrs) |
| B5 | `gemma-4-26b-a4b-it` returns **fast 5xx intermittently** (observed as bad as 5 of 6 calls failing; reproduced with the plain SDK *outside* Next, so it is vendor-side, not our code) | A demo answer can fall back to the `error:"upstream"` + sources-fallback card; the model is pinned by AGENTS #17 and cannot be swapped | ⚠️ mitigated — the route retries ≤4 attempts while nothing has been streamed (failures cost ~1 s) and every path still ends cleanly. Seen live again in Phase 4 (4 attempts all 500 → snippet-fallback card, then the retry answered in 16.1 s). Worth re-checking the key's quota/tier (and the model's status) before the live demo |
| B6 | Dev-only transitive `braces` advisory (CVE-2026-93687, via `eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `braces`); npm reports **"Patched versions: None"** | `npm audit` (full) shows 5 high; **not** a shipping risk — `npm audit --omit=dev` = **0** and it is lint-time only | ✅ accepted — no version bump fixes it (latest `braces` 3.0.3 *is* the flagged one; npm's only "fix" is a nonsense `eslint-config-next@14` downgrade); recorded, not force-downgraded |
