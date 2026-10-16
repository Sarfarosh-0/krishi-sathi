# Pre-Production Readiness Checklist — Krishi Sathi (कृषि साथी)

> **Purpose:** a practical, application-specific pre-production audit for this
> repository. It is meant to be worked top-to-bottom before a public deployment
> and to produce an **evidence-based go/no-go decision**.
>
> **Scope of this audit:** analysis only. No application code or configuration
> was changed while producing this document.
>
> **Audit date:** 2026-10-16 · **Auditor:** AI agent (OpenCode) ·
> **Repository:** `github.com/Sarfarosh-0/krishi-sathi` · **Commit:** `afcd3a6`
>
> **Status update (2026-10-16):** a follow-up fix pass closed the in-repo
> blockers B1, B2 and B5, the header items S9/S10, and (later) the request-size
> guard S4, reduced-motion U7 and the iOS install meta U12. The *Status* and
> *Evidence* fields below reflect the post-fix state; resolved rows say so
> explicitly.

---

## 0. How to use this checklist

**Status legend**

| Status | Meaning |
|---|---|
| ✅ Passed | Requirement is met **and** there is evidence in the *Evidence or Notes* field. |
| ❌ Failed | A verified defect or a missing control. |
| 🟡 In Progress | Partially addressed; work remains. |
| ⬜ Not Started | Not yet evaluated or implemented (unverified). |
| ➖ Not Applicable | Irrelevance has been established and stated. |

**Priority legend:** `Critical` (blocks deploy) · `High` · `Medium` · `Low`.

**Rules applied to this audit**

- Nothing is marked ✅ without a supporting artifact (a command result, an HTTP
  header, a DOM/Lighthouse measurement, or a specific code reference).
- Items are marked ➖ only with a stated reason.
- Verified defects (❌) are separated from **potential risks** and **unverified
  requirements** (⬜).
- Commands and results used as evidence are listed in [Appendix A](#appendix-a--evidence-collected).

---

## 1. Application profile (verified)

| Aspect | Value (verified from source/config) |
|---|---|
| Type | Hindi-first single-page web app + 2 serverless API routes |
| Framework | Next.js **16.4.1** (App Router, Turbopack, `cacheComponents`, `partialPrefetching`) |
| Runtime | Node.js (Next 16 default; `runtime` segment config intentionally omitted) |
| Language/UI | TypeScript 5 (strict) · React 19.3 · Tailwind CSS 4 · Lucide React |
| AI | `@google/genai` 2.30 → **`gemma-4-26b-a4b-it`** (Gemini API) |
| Data | Bundled `kb/crop-docs.json` (14 chunks, hi+en). **No database.** |
| State | Browser `localStorage` only (`ks:lang`, `ks:history:v1`, `ks:impact:v1`) |
| Auth | **None** (no accounts, no sessions, no user data on the server) |
| Routes | `POST /api/ask` (NDJSON stream), `GET /api/health` (warm-up) |
| Rate limiting | In-memory, 10 req/min per IP (best-effort, per instance) |
| Deploy target | Vercel (declared; **not yet deployed** — no `vercel.json`, no env set) |
| Node requirement | `next` declares `engines.node >= 20.9.0`; **repo does not pin a version** |

> This profile drives which items are applicable. Sections that assume a
> database, user accounts, sessions, or file uploads are marked ➖ with reasons.

---

## 2. Security

### S1 — Secret key handling (server-only)
- [ ] **Requirement:** `GEMINI_API_KEY` is read only in `app/api/ask/route.ts` via `process.env`, never exposed to the client, never committed, never logged.
- **Risk:** Key leakage → quota theft, billing abuse, and loss of the "Best Use of Gemma 4" eligibility if the key were shipped in the client bundle.
- **Verification:** `grep -rn "GEMINI_API_KEY" app lib components`; `grep -rn "NEXT_PUBLIC_" app lib components`; `git check-ignore .env.local`; inspect served HTML/JS for the key.
- **Priority:** Critical
- **Status:** ✅ Passed
- **Evidence or Notes:** Only two references exist, both in `route.ts` (line 353 read, line 355 error log). `NEXT_PUBLIC_` grep = 0 matches. `.env.local` is gitignored (`.gitignore:40`). `.env.example` committed with an empty value. Served HTML checked — no key material.

### S2 — No client-side or dependency-embedded secrets
- [ ] **Requirement:** No secret, token, or credential is embedded in client code, `public/`, or committed files.
- **Risk:** Public exposure of credentials (OWASP A02/A05).
- **Verification:** `git grep -nE "AIza[0-9A-Za-z_-]{20,}|sk-[A-Za-z0-9]{20,}"`; review `public/` assets; `grep -rn "dangerouslySetInnerHTML"`.
- **Priority:** Critical
- **Status:** ✅ Passed
- **Evidence or Notes:** No API-key-shaped strings found; `dangerouslySetInnerHTML` grep = 0 in app code. `public/` contains only icons. (Full-repo secret scan not run — see S15.)

### S3 — Input validation on the API
- [ ] **Requirement:** `POST /api/ask` validates method, JSON parseability, `question` type, `lang ∈ {hi,en}`, and truncates questions > 500 chars (never rejects them).
- **Risk:** Malformed input causing 500s, type confusion, or unbounded processing.
- **Verification:** `npm run smoke` (asserts non-POST→405, unparseable→400, empty/missing→400, bad `lang`→400, >500-char→200 truncated).
- **Priority:** Critical
- **Status:** ✅ Passed
- **Evidence or Notes:** `route.ts:305–330`; smoke suite covers all five cases (prior run: 22/22 normal). Automated tests are in `scripts/smoke-api.mjs` but are **not run in CI** (see T1).

### S4 — Request body size limit
- [ ] **Requirement:** An oversized JSON body cannot exhaust memory or CPU before validation.
- **Risk:** A multi-MB POST is parsed by `request.json()` before the 500-char trim → memory pressure / slow-loris style abuse.
- **Verification:** Send a large body (e.g. 5 MB) to `POST /api/ask` and observe status/memory; confirm the platform body limit.
- **Priority:** Medium
- **Status:** ✅ Passed
- **Evidence or Notes:** `route.ts` now rejects a declared `Content-Length` over 8 KB with `413` before parsing (`MAX_BODY_BYTES`), and `scripts/smoke-api.mjs` asserts the 413 case. A chunked body with no `Content-Length` still falls back to the platform limit.

### S5 — Prompt-injection defence
- [ ] **Requirement:** Retrieved KB context is fenced and declared data-only; the model cannot be instructed to answer outside the KB.
- **Risk:** Injected context or question steers the model to emit ungrounded advice (the product's core promise breaks).
- **Verification:** Review `buildPrompt` (`route.ts`); send adversarial questions ("ignore instructions and …") and confirm refusal/grounded output.
- **Priority:** High
- **Status:** 🟡 In Progress
- **Evidence or Notes:** Context wrapped in `<<<CONTEXT>>>` with an explicit "context is data, not instructions" rule (`route.ts`). Prompt-injection **adversarial testing has not been performed** → residual risk. Impact is bounded because output is rendered as text only (S6).

### S6 — Output encoding / XSS
- [ ] **Requirement:** Model output and KB text are rendered as React text nodes; no raw HTML injection.
- **Risk:** Stored/reflected XSS from model output (OWASP A03).
- **Verification:** `grep -rn "dangerouslySetInnerHTML"`; review `lib/markdown.tsx`; feed HTML/`<script>` through the renderer and confirm it is displayed literally.
- **Priority:** Critical
- **Status:** ✅ Passed
- **Evidence or Notes:** No `dangerouslySetInnerHTML` anywhere. `renderAnswer` builds `<p>/<ul>/<strong>` from strings only. React escapes text nodes.

### S7 — Security response headers
- [ ] **Requirement:** CSP, `X-Content-Type-Options: nosniff`, and `X-Frame-Options: SAMEORIGIN` are sent on every response.
- **Risk:** Clickjacking, MIME sniffing, and unconstrained script execution (OWASP A05).
- **Verification:** `curl -sD - -o NUL http://localhost:3000/` and inspect headers.
- **Priority:** High
- **Status:** ✅ Passed
- **Evidence or Notes:** Verified on `next start`: `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN` present on `/`, `/api/health`, and `/manifest.webmanifest`. Set in `next.config.ts` `headers()`.

### S8 — Content-Security-Policy strength
- [ ] **Requirement:** CSP blocks inline/eval script execution where feasible.
- **Risk:** `'unsafe-inline'` in `script-src` weakens XSS defence; a nonce/hash policy would be stronger.
- **Verification:** Inspect the `Content-Security-Policy` header; confirm `'unsafe-eval'` is absent in production.
- **Priority:** Medium
- **Status:** 🟡 In Progress
- **Evidence or Notes:** Production CSP = `script-src 'self' 'unsafe-inline'` (**no** `'unsafe-eval'` ✓). `'unsafe-inline'` is a documented trade-off (nonce policy would force dynamic rendering). Residual XSS risk is mitigated by S6. *Accepted risk — revisit if the app ever renders third-party content.*

### S9 — Strict-Transport-Security (HSTS)
- [ ] **Requirement:** Responses enforce HTTPS via `Strict-Transport-Security`.
- **Risk:** SSL-strip / downgrade attacks on first visit; cookie-less app but still a hardening gap (OWASP A02).
- **Verification:** `curl -sD -` and look for `strict-transport-security`.
- **Priority:** High
- **Status:** ✅ Passed (header set; live-URL check pending)
- **Evidence or Notes:** `Strict-Transport-Security: max-age=63072000` added in `next.config.ts` and **confirmed on `next start`** (2026-10-16). No `includeSubDomains` (the app may sit on a shared `*.vercel.app` domain). Still to confirm on the deployed HTTPS URL (B4/D3).

### S10 — Additional hardening headers
- [ ] **Requirement:** `Referrer-Policy`, `Permissions-Policy`, and removal of `X-Powered-By`.
- **Risk:** Framework/version disclosure and unnecessary browser feature exposure (OWASP A05).
- **Verification:** `curl -sD -`; check for `referrer-policy`, `permissions-policy`, `x-powered-by`.
- **Priority:** Medium
- **Status:** ✅ Passed
- **Evidence or Notes:** Added `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), geolocation=(), payment=(), usb=(), microphone=(self)` (microphone is **allowed** so Web Speech voice input keeps working), and `poweredByHeader: false`. Confirmed on `next start` (2026-10-16): both headers present, `X-Powered-By` **absent**.

### S11 — Origin / CORS protection
- [ ] **Requirement:** `POST /api/ask` rejects cross-site requests via an `Origin` check (same-origin only).
- **Risk:** Another site drives the endpoint (quota abuse); CSRF-style calls (OWASP A01/A05).
- **Verification:** Review `isSameOrigin()`; `curl -X POST -H "Origin: https://evil.example"` → expect 403.
- **Priority:** High
- **Status:** ✅ Passed
- **Evidence or Notes:** `route.ts:308–310` returns 403 for cross-origin `Origin`. **Not covered by an automated test** (`smoke-api.mjs` omits the 403 case) → add coverage (T4).

### S12 — Rate limiting & abuse prevention
- [ ] **Requirement:** 10 requests/min/IP, enforced server-side, returning `429 {error:"rate_limit"}`.
- **Risk:** Quota exhaustion and cost abuse.
- **Verification:** `npm run smoke` (burst test); manual burst on a running server.
- **Priority:** High
- **Status:** ✅ Passed (with known limitation)
- **Evidence or Notes:** `route.ts:64–79`; verified 429 on the 11th request (curl burst) and in the browser. **Limitation:** in-memory and **per serverless instance** — not global. Under concurrent Vercel instances the effective limit multiplies (see S13).

### S13 — Rate-limit key integrity & distributed bypass
- [ ] **Requirement:** The limiter key cannot be trivially spoofed, and behaviour is correct behind the production proxy.
- **Risk:** `clientIp()` trusts `x-forwarded-for` first value; if not behind a trusted proxy this is client-controllable → per-request key rotation bypasses the limit. Locally all non-forwarded clients share the `"unknown"` bucket.
- **Verification:** On Vercel, confirm `x-forwarded-for` is platform-set (not client-controlled); test spoofed `x-forwarded-for` values against the deployed endpoint; document the multi-instance limitation.
- **Priority:** High
- **Status:** ⬜ Not Started
- **Evidence or Notes:** `clientIp()` = `x-forwarded-for[0]` else `x-real-ip` else `"unknown"` (`route.ts:81–87`). *Potential risk — must be validated on the deployment platform.*

### S14 — Dependency vulnerabilities
- [ ] **Requirement:** No high/critical vulnerabilities in production dependencies.
- **Risk:** Exploitable transitive packages (OWASP A06).
- **Verification:** `npm audit --omit=dev` (production) and `npm audit` (all).
- **Priority:** High
- **Status:** ❌ Failed (production clean; dev-only advisory has no patch)
- **Evidence or Notes:** `npm audit --omit=dev` = **0 vulnerabilities**. Full `npm audit` = **5 high, 0 critical**, all one dev-only chain `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces` (GHSA-vfj7-8cjw-p6xm, "Patched versions: None"). Not shipped to production; the only npm "fix" is a breaking downgrade. *Accepted risk — record and re-check when a patched `braces` is published.*

### S15 — Dependency & secret scanning in the pipeline
- [ ] **Requirement:** Automated dependency and secret scanning on every change.
- **Risk:** A new vulnerable dependency or a committed secret goes unnoticed (OWASP A06/A02).
- **Verification:** Presence of Dependabot/`npm audit` in CI and a secret scanner (e.g. gitleaks).
- **Priority:** Medium
- **Status:** ⬜ Not Started
- **Evidence or Notes:** No `.github/` directory exists → no Dependabot, no CI, no secret scanning. Manual grep was used for this audit only.

### S16 — Server-side logging does not leak sensitive data
- [ ] **Requirement:** Logs never contain the prompt, the answer, the key, or PII.
- **Risk:** Sensitive data in Vercel logs (OWASP A09).
- **Verification:** Review all `console.*` in `app/`; inspect runtime logs during a request.
- **Priority:** High
- **Status:** ✅ Passed
- **Evidence or Notes:** Only two server logs: `route.ts:265` logs `{attempt, status}` only; `route.ts:355` logs a static "key not set" message. No prompt/answer/key. No client-side `console.*` in app code.

### S17 — SSRF / outbound-request safety
- [ ] **Requirement:** No user-controlled URL is fetched server-side.
- **Risk:** SSRF (OWASP A10).
- **Verification:** Review all `fetch`/SDK calls; confirm the only outbound host is the Gemini API.
- **Priority:** Medium
- **Status:** ➖ Not Applicable
- **Evidence or Notes:** The only server-side outbound call is `@google/genai` to the fixed Gemini endpoint. No user input influences the URL. Client `fetch` targets same-origin routes only.

### S18 — Authentication / authorization / session management
- [ ] **Requirement:** Access control and session handling are correct.
- **Risk:** Broken access control (OWASP A01/A07).
- **Verification:** N/A — determine whether any protected resource or user identity exists.
- **Priority:** Low
- **Status:** ➖ Not Applicable
- **Evidence or Notes:** The app has **no accounts, no login, no sessions, no protected resources, and no per-user server state**. All persistence is device-local. Irrelevance established from `package.json`, routes, and `docs/DECISIONS.md` §5.

### S19 — File upload safety
- [ ] **Requirement:** Uploaded files are validated and stored safely.
- **Risk:** Malicious upload / path traversal.
- **Verification:** N/A — confirm no upload feature exists.
- **Priority:** Low
- **Status:** ➖ Not Applicable
- **Evidence or Notes:** No upload UI, no multipart handling, no filesystem writes. `docs/PRD.md` lists image upload as an explicit non-goal.

### S20 — Privacy controls
- [ ] **Requirement:** No analytics, tracking, or server-side storage of user questions.
- **Risk:** Breach of the stated privacy claim (PRD §10) and user trust.
- **Verification:** `grep -rn "analytics|gtag|segment|posthog"`; review routes for any persistence; confirm no third-party scripts.
- **Priority:** High
- **Status:** ✅ Passed
- **Evidence or Notes:** No analytics dependencies or scripts. No database and no server-side persistence of questions (`route.ts` is stateless). History/counters live in `localStorage` and are labelled "from this device".

---

## 3. Edge cases and error handling

### E1 — Empty / whitespace-only input
- [ ] **Requirement:** Empty input cannot be submitted; the API rejects it with 400.
- **Risk:** Wasted calls, confusing empty answers.
- **Verification:** `smoke-api.mjs` (empty question → 400); UI send button disabled on empty.
- **Priority:** High
- **Status:** ✅ Passed
- **Evidence or Notes:** `Composer.tsx:32` disables send; `route.ts:328` rejects. Smoke suite asserts 400 `bad_input`.

### E2 — Over-long input
- [ ] **Requirement:** Questions > 500 chars are truncated, not rejected; the textarea is capped.
- **Risk:** Prompt-size/quota abuse, upstream errors.
- **Verification:** `smoke-api.mjs` (>500-char → 200 + `done`); `Composer` `maxLength=500`.
- **Priority:** Medium
- **Status:** ✅ Passed
- **Evidence or Notes:** `route.ts:327` `slice(0,500)`; `Composer.tsx:86` `maxLength={500}`; smoke test asserts truncation.

### E3 — Malformed / unexpected request bodies
- [ ] **Requirement:** Non-JSON or wrong-shape bodies return 400, never 500.
- **Risk:** Unhandled exceptions (OWASP A03/A04).
- **Verification:** `smoke-api.mjs` (unparseable JSON → 400; missing `question` → 400).
- **Priority:** High
- **Status:** ✅ Passed
- **Evidence or Notes:** `route.ts:316–326` try/catch + shape check. Smoke suite covers both.

### E4 — Out-of-scope question (deterministic refusal)
- [ ] **Requirement:** Below-threshold questions refuse with the server refusal text + referral, with **zero** model calls.
- **Risk:** Ungrounded answers; quota waste; the product's honesty promise breaks.
- **Verification:** `smoke-api.mjs` (refusal: one token = server text, no `sources`, `refused:true`, sub-2s).
- **Priority:** Critical
- **Status:** ✅ Passed
- **Evidence or Notes:** `route.ts:336–341`; `lib/retrieval.ts` threshold `5`; `out_of_scope` chunk excluded from candidates. Verified zero-call via sub-2s latency and absence of `sources`.

### E5 — Model / network failure (upstream)
- [ ] **Requirement:** On Gemini 429/5xx/timeout the client shows a friendly snippet-fallback card + retry, never a crash.
- **Risk:** Blank screen or raw error during a demo or for a real farmer.
- **Verification:** Failure drills (no key, bad key, real 5xx) + `smoke-api.mjs` upstream mode.
- **Priority:** Critical
- **Status:** ✅ Passed
- **Evidence or Notes:** `sources` is emitted **before** the model call, so the fallback card always has content; the route retries only while nothing has streamed. Drills verified: bad key → one attempt (`status:400`), no-key → `sources`+`error` in 158 ms, all render the friendly amber card with 3 snippets + retry and no technical wording.

### E6 — Offline / network drop
- [ ] **Requirement:** A failed fetch shows the offline toast and a recoverable card.
- **Risk:** Silent failure / stuck spinner.
- **Verification:** Patch `fetch` to reject (or go offline) and confirm the red toast + fallback card + retry.
- **Priority:** High
- **Status:** ✅ Passed
- **Evidence or Notes:** `page.tsx:286–289` → `offlineToast` (danger) + `upstream` card. Verified via fetch-rejection drill (red toast, `lang="hi"`, retry present).

### E7 — Rate limit (429)
- [ ] **Requirement:** A 429 shows the amber rate-limit toast, not a generic error.
- **Risk:** Farmer sees an unexplained failure.
- **Verification:** Prime the per-IP window and submit; assert `role="status"` amber toast.
- **Priority:** Medium
- **Status:** ✅ Passed
- **Evidence or Notes:** `page.tsx:219–221`. Verified against a real 429: toast `role="status"`, `lang="hi"`, `bg-harvest` (#F59E0B), text "थोड़ा रुकिए, फिर कोशिश करें।"

### E8 — Stream ends without a terminator
- [ ] **Requirement:** A stream that ends without `done`/`error` is treated as `upstream`.
- **Risk:** Hanging "thinking" bubble; inconsistent state.
- **Verification:** Review `page.tsx:270–273`; simulate a truncated stream.
- **Priority:** Medium
- **Status:** ✅ Passed
- **Evidence or Notes:** `terminated` flag logic in `page.tsx:236–273`; `lib/types.ts` documents the contract. (Simulated-truncation test not automated.)

### E9 — Duplicate submissions / concurrent requests
- [ ] **Requirement:** The UI cannot start a second request while one is in flight; the server still rate-limits.
- **Risk:** Duplicate answers, double quota spend, race conditions.
- **Verification:** Review `send()` guard + disabled controls; double-click a chip.
- **Priority:** Medium
- **Status:** ✅ Passed
- **Evidence or Notes:** `page.tsx:112` early-returns if `abortRef.current` is set; composer/chips disabled while `loading`; server limiter is the backstop.

### E10 — Stop / cancel mid-stream
- [ ] **Requirement:** Pressing stop aborts the request, keeps partial text, drops an empty placeholder, and stops server-side token spend.
- **Risk:** Orphaned streams, wasted quota, phantom empty bubbles.
- **Verification:** Press stop during streaming; observe `AbortController` abort and `status:"stopped"`.
- **Priority:** Medium
- **Status:** ✅ Passed
- **Evidence or Notes:** `page.tsx:274–289` + `route.ts` checks `signal.aborted` to stop paying for tokens. (Manually verified in Phase 4; not automated.)

### E11 — Unsupported browser APIs
- [ ] **Requirement:** TTS/voice controls hide (with a hint) when `speechSynthesis`/`webkitSpeechRecognition` are absent; never crash.
- **Risk:** Runtime error on older/limited browsers.
- **Verification:** Delete both globals and re-render; confirm controls vanish + hints show.
- **Priority:** Medium
- **Status:** ✅ Passed
- **Evidence or Notes:** `useCapability` gates both; `TTSButton`/`Composer` render hints when `supported === false`. Verified in Phase 4 by removing the globals.

### E12 — Corrupt / unavailable localStorage
- [ ] **Requirement:** Blocked or corrupt storage never crashes the app.
- **Risk:** White screen in Safari private mode or with tampered storage.
- **Verification:** Replace `window.localStorage` with a throwing getter; write invalid JSON into `ks:history:v1`.
- **Priority:** Medium
- **Status:** ✅ Passed
- **Evidence or Notes:** `useLocalStorage.ts` wraps read **and** write in try/catch and falls back to an in-memory value; corrupt JSON → default. Verified in Phase 5 (throwing getter → dashboard still renders 0/0/0).

### E13 — Client-side stream parsing robustness
- [ ] **Requirement:** Unknown/partial NDJSON lines are ignored; a valid terminator is required.
- **Risk:** A malformed line corrupting the transcript.
- **Verification:** Review `parseEvent` + buffering; feed garbage lines.
- **Priority:** Low
- **Status:** ✅ Passed
- **Evidence or Notes:** `parseEvent` returns `null` on non-objects (`page.tsx:37–44`); newline buffering handles chunk boundaries and a trailing tail.

### E14 — Unhandled client render errors
- [ ] **Requirement:** A React error boundary renders a friendly fallback instead of Next's default error screen.
- **Risk:** Any unexpected render error shows a bare "Application error" (or a dev overlay in development) to a farmer.
- **Verification:** Check for `app/error.tsx` / `app/global-error.tsx`; throw inside a component and observe.
- **Priority:** High
- **Status:** ✅ Passed
- **Evidence or Notes:** Added `app/error.tsx` (Client Component boundary with `reset`, bilingual, on-brand) and `app/global-error.tsx` (renders its own `<html>/<body>`). Both compile into the build. Not force-rendered in this audit (there is no throw route) — a forced-throw drill remains a nice-to-have under §11.

### E15 — Unknown route / 404
- [ ] **Requirement:** A user-friendly, on-brand 404 page.
- **Risk:** Generic Next 404 breaks the experience.
- **Verification:** Visit `/does-not-exist`; check for a custom page.
- **Priority:** Low
- **Status:** ✅ Passed
- **Evidence or Notes:** Added `app/not-found.tsx`. Verified in-browser (2026-10-16): `/does-not-exist` → 404 with the branded page ("404 · यह पेज नहीं मिला · This page could not be found · चैट पर वापस जाएँ") and a `<main>` landmark.

---

## 4. Application reliability and data integrity

### R1 — API contract integrity (NDJSON)
- [ ] **Requirement:** Exactly one terminating line (`done` XOR `error`); `sources` precedes `done`; advisory appears exactly once.
- **Risk:** Client state desync; duplicated disclaimers.
- **Verification:** `npm run smoke` (terminator count, sources-before-done, advisory count).
- **Priority:** Critical
- **Status:** ✅ Passed
- **Evidence or Notes:** Smoke suite asserts exactly-one terminator, `sources` before `done`, and `advisory` count == 1 (prior run 22/22 normal, 17/17 upstream).

### R2 — Advisory ownership (server-authored)
- [ ] **Requirement:** The advisory line is emitted by the server, never generated by the model, never duplicated.
- **Risk:** Missing/duplicated legal-style disclaimer (PRD FR7).
- **Verification:** `smoke-api.mjs` advisory-count check; inspect `done` events.
- **Priority:** High
- **Status:** ✅ Passed
- **Evidence or Notes:** Emitted in `done` (`route.ts:288`); prompt instructs the model not to append it; verified exactly once.

### R3 — Citations are grounded
- [ ] **Requirement:** The model cites at least one retrieved chunk id in a successful answer.
- **Risk:** Ungrounded answer presented as sourced.
- **Verification:** `smoke-api.mjs` ("model cited a retrieved chunk id").
- **Priority:** High
- **Status:** ✅ Passed
- **Evidence or Notes:** Asserted in the smoke suite on the success path (observed `[wheat_pest_yellow_stem_borer]`).

### R4 — Client/Server type contract
- [ ] **Requirement:** A single shared type module defines the wire contract; client and server cannot drift.
- **Risk:** Runtime mismatches from duplicated interfaces.
- **Verification:** Confirm both sides import from `lib/types.ts`.
- **Priority:** Medium
- **Status:** ✅ Passed
- **Evidence or Notes:** `route.ts` and `page.tsx` both import `StreamEvent`/`AskRequest`/`AskErrorBody`/`KBSource` from `@/lib/types`. `tsc` runs in `next build` (strict).

### R5 — History/source data consistency
- [ ] **Requirement:** Reopened history entries rebuild their sources from the bundled KB without a network call.
- **Risk:** A KB id removed later silently drops sources on reopen → answer shows citations that no longer resolve.
- **Verification:** Review `sourcesFromIds`; remove/rename a chunk id in a copy and reopen an entry.
- **Priority:** Low
- **Status:** 🟡 In Progress
- **Evidence or Notes:** `sourcesFromIds` (`lib/chat.ts:68`) `flatMap`s and **silently skips** ids not found. Correct today (KB is bundled and versioned with the app), but there is no guard/telemetry if a chunk disappears. *Low risk.*

### R6 — Client state consistency during failures
- [ ] **Requirement:** Counters/history stay consistent across success, refusal, upstream, and stop.
- **Risk:** Inflated/incorrect "impact" numbers (honesty claim).
- **Verification:** Review counter transitions; drive each terminal state.
- **Priority:** Medium
- **Status:** ✅ Passed
- **Evidence or Notes:** `asked` on send; `answered` only on a non-empty `done`; `refused` on the refusal path only (`page.tsx:169–194`). Verified in Phase 5 (chip #8 → asked 2 / answered 1 / refused 1).

### R7 — Health check / warm-up
- [ ] **Requirement:** `GET /api/health` returns `200 {ok:true}`, is side-effect free, and invokes the function (not statically cached).
- **Risk:** Cold start during a demo; a "warm-up" that does nothing.
- **Verification:** `curl` the endpoint; confirm it is dynamic (uses `connection()`).
- **Priority:** Medium
- **Status:** ✅ Passed
- **Evidence or Notes:** `app/api/health/route.ts` uses `await connection()` so it is not prerendered; returns `{ok:true}`; no Gemini call. Warm-up is fired on page load (`page.tsx:69–71`).

### R8 — Error handling coverage on the server
- [ ] **Requirement:** Every failure path returns a defined status/event; no unhandled rejection surfaces a raw 500.
- **Risk:** Opaque 500s; leaked stack traces.
- **Verification:** Review `route.ts` error handling; fuzz with bad input; check responses for stack traces.
- **Priority:** High
- **Status:** 🟡 In Progress
- **Evidence or Notes:** Validation, rate-limit, refusal, and upstream paths are all handled. **No test targets a forced 500 inside the stream `start()`** (e.g. a throw before any `send`), so a rare unhandled error path is unverified.

### R9 — Logging, monitoring, and alerting
- [ ] **Requirement:** Errors and availability are observable; someone is alerted when the app breaks.
- **Risk:** Outages or quota exhaustion go unnoticed (OWASP A09).
- **Verification:** Confirm an error-reporting/monitoring tool and an alerting rule exist.
- **Priority:** High
- **Status:** ❌ Failed
- **Evidence or Notes:** **No monitoring/error tracking/alerting** (no Sentry or equivalent dependency; no external logger). Only `console.error` → Vercel logs, which are not alerted on. No correlation/request IDs.

### R10 — Backup / recovery of persisted data
- [ ] **Requirement:** Persisted data has a backup/restore path.
- **Risk:** Data loss.
- **Verification:** N/A — determine whether any server-side data exists.
- **Priority:** Low
- **Status:** ➖ Not Applicable
- **Evidence or Notes:** No server-side persistence. User data lives only in the browser's `localStorage`; the app never stores questions (PRD §10). There is nothing to back up.

### R11 — Database constraints / transactions / migrations
- [ ] **Requirement:** Schema constraints, transactions, and migrations are safe.
- **Risk:** Data corruption.
- **Verification:** N/A — confirm no database.
- **Priority:** Low
- **Status:** ➖ Not Applicable
- **Evidence or Notes:** No database; the KB is a bundled JSON file validated by unit tests (schema, word counts, structure).

---

## 5. Performance and scalability

### P1 — Front-end load performance (Core Web Vitals)
- [ ] **Requirement:** LCP/CLS/INP within "good" thresholds on a mid-range phone.
- **Risk:** Slow first paint on the target low-end device.
- **Verification:** Lighthouse (mobile) / PageSpeed on the deployed URL; measure on a throttled connection.
- **Priority:** High
- **Status:** ⬜ Not Started
- **Evidence or Notes:** The available Lighthouse run returned Accessibility/Best-Practices/SEO only — **no Performance score was captured**, so load performance is **unverified**. The page is a static shell (`x-nextjs-prerender: 1`) with two preloaded fonts, which is a good starting point, but this must be measured.

### P2 — Fonts & first paint
- [ ] **Requirement:** Fonts do not block render; no layout shift.
- **Risk:** FOUT/CLS, slow text paint.
- **Verification:** Inspect `<link rel="preload" as="font">`; confirm `display:"swap"`.
- **Priority:** Medium
- **Status:** ✅ Passed
- **Evidence or Notes:** Inter + Noto Sans Devanagari preloaded (verified in response `link` headers); both use `display:"swap"` (`app/layout.tsx`).

### P3 — Serverless latency & function duration
- [ ] **Requirement:** Answers complete within the platform's function limit; the in-route deadline ends cleanly.
- **Risk:** Platform kill mid-stream → broken UI.
- **Verification:** Confirm `maxDuration` is honored on the plan; measure p95 latency.
- **Priority:** High
- **Status:** 🟡 In Progress
- **Evidence or Notes:** `maxDuration = 60`, 55 s in-route deadline, ≤4 retries (`route.ts:15–24`). With `thinkingLevel: "minimal"` (verified 2026-10-16) answers measured **~3–5 s** instead of the 15–33 s full-thinking path, so the 60 s ceiling is no longer a practical risk. **Unverified:** the exact plan limit (see D4).

### P4 — Cold start
- [ ] **Requirement:** The first real request does not pay a full cold start.
- **Risk:** Slow first answer during a demo.
- **Verification:** Measure a cold request on the deployed URL after idle.
- **Priority:** Medium
- **Status:** 🟡 In Progress
- **Evidence or Notes:** Health warm-up on page load is implemented, but a warm instance is not guaranteed between requests. **Verify on the deployment.**

### P5 — Caching correctness
- [ ] **Requirement:** Static shell caching does not serve stale or incorrect content.
- **Risk:** Returning users get a stale shell after a deploy.
- **Verification:** Inspect `Cache-Control`/`x-nextjs-cache`; confirm per-deploy cache keys on Vercel.
- **Priority:** Low
- **Status:** ⬜ Not Started
- **Evidence or Notes:** `/` returns `Cache-Control: s-maxage=31536000` with `x-nextjs-cache: HIT` and `x-nextjs-stale-time: 300`. Next/Vercel normally key the CDN cache per deployment; **verify** this holds for the production alias.

### P6 — Payload sizes / large answers
- [ ] **Requirement:** Long answers stream without freezing the UI; responses stay bounded.
- **Risk:** Janky rendering; memory pressure on low-end phones.
- **Verification:** Measure a long answer; confirm `maxOutputTokens` bound (2048).
- **Priority:** Medium
- **Status:** ✅ Passed
- **Evidence or Notes:** `maxOutputTokens: 2048`; with `thinkingLevel: "minimal"` the answer uses ~120 tokens, so the cap is never the binding limit; streaming with incremental render; `whitespace-pre-wrap` lists. Long-answer UI behaviour observed in Phase 4. (No dedicated stress test.)

### P7 — Concurrency / multi-instance behaviour
- [ ] **Requirement:** Concurrent users do not corrupt state; limits behave predictably at scale.
- **Risk:** Per-instance rate limit and in-memory maps behave differently under load.
- **Verification:** Load test the deployed endpoint; review limiter memory bounds.
- **Priority:** Medium
- **Status:** ⬜ Not Started
- **Evidence or Notes:** No load/concurrency test exists. Limiter memory is bounded by `MAX_TRACKED_IPS = 5000` with lazy cleanup (`route.ts:26,68–75`) — sound, but **not load-tested**.

### P8 — Retrieval performance
- [ ] **Requirement:** Retrieval is fast and scales with KB size.
- **Risk:** Slow first token as the KB grows.
- **Verification:** Time `retrieve()` over the KB; review complexity.
- **Priority:** Low
- **Status:** ✅ Passed
- **Evidence or Notes:** Deterministic scorer with cached per-chunk haystacks (`lib/retrieval.ts`); test suite runs in < 1 s total. 14 chunks today — trivially fast. Revisit only if the KB grows large.

---

## 6. User experience and accessibility

### U1 — Accessibility audit score
- [ ] **Requirement:** No automated accessibility violations (WCAG 2.2 AA baseline).
- **Risk:** Screen-reader/keyboard users blocked.
- **Verification:** Lighthouse/Axe run (this audit) + manual keyboard pass.
- **Priority:** High
- **Status:** ✅ Passed
- **Evidence or Notes:** Lighthouse **Accessibility = 1.0**, zero failures, re-run 2026-10-16 after the landmark + contrast fixes (was 0.94 with `color-contrast` + `landmark-one-main`). Best Practices 1.0, SEO 1.0.

### U2 — Color contrast
- [ ] **Requirement:** Text meets WCAG AA contrast (≥ 4.5:1 normal, ≥ 3:1 large).
- **Risk:** Low-vision users cannot read muted/hint text.
- **Verification:** Lighthouse `color-contrast`; measure specific pairs.
- **Priority:** High
- **Status:** ✅ Passed
- **Evidence or Notes:** Fixed by darkening tokens: `--primary` green-600→green-700 (`#15803D`), `--muted` stone-500→stone-600 (`#57534E`), header-gradient amber stop amber-500→amber-700 (`--harvest-dark` `#B45309`), and removing `opacity-90` from the header tagline. A hand-rolled in-page contrast walker (parses gradient stops, composites translucent layers) now reports **0 failing nodes** — previously: chips 3.08:1, active language toggle 3.30:1, header title 2.15:1, tagline 1.99:1. Lighthouse `color-contrast` passes.

### U3 — Landmarks & heading structure
- [ ] **Requirement:** The page has a `<main>` landmark and a logical heading outline.
- **Risk:** Screen-reader users cannot jump to main content.
- **Verification:** Lighthouse `landmark-one-main`; DOM probe for `main`.
- **Priority:** High
- **Status:** ✅ Passed
- **Evidence or Notes:** A `<main>` now wraps the transcript + composer (`app/page.tsx`); DOM probe `hasMain = true`; Lighthouse `landmark-one-main` passes. One `<h1>` ("कृषि साथी") remains, so the heading outline is unchanged.

### U4 — Labels, roles, and live regions
- [ ] **Requirement:** Icon buttons have labels; dynamic content is announced.
- **Risk:** Unlabeled controls; silent updates.
- **Verification:** Lighthouse a11y checks; inspect `aria-label`, `role="status"`, `aria-live`, `aria-busy`.
- **Priority:** High
- **Status:** ✅ Passed
- **Evidence or Notes:** All icon buttons carry `aria-label` (send/stop/mic/dashboard/close/delete/source). Message list is `aria-live="polite"` + `aria-busy`; toasts use `role="status"`. Lighthouse did not flag any label/role issue.

### U5 — Keyboard navigation & focus management
- [ ] **Requirement:** All flows are keyboard-operable; focus is trapped in the dialog and returned on close.
- **Risk:** Keyboard users trapped or lost.
- **Verification:** Tab/Shift+Tab/Esc through the app and the dashboard modal.
- **Priority:** High
- **Status:** ✅ Passed
- **Evidence or Notes:** `DashboardModal` implements `role="dialog"`+`aria-modal`, Tab trap, Esc, backdrop close, scroll lock, and focus return (`page.tsx:313–316`). Visible focus ring is global (`app/globals.css`). Verified in Phase 5/6 (focus returned to the exact trigger).

### U6 — Language attributes
- [ ] **Requirement:** `lang` is correct on the document and on every text node, including past messages.
- **Risk:** Wrong pronunciation for screen readers / TTS.
- **Verification:** Inspect `<html lang>` and per-message `lang`; toggle hi/en.
- **Priority:** High
- **Status:** ✅ Passed
- **Evidence or Notes:** `useLang` syncs `document.documentElement.lang`; every message/advisory/toast carries its own `lang`; verified htmlLang `hi` and per-node langs in Phase 6.

### U7 — Reduced motion
- [ ] **Requirement:** Animations respect `prefers-reduced-motion`.
- **Risk:** Discomfort for motion-sensitive users (WCAG 2.3).
- **Verification:** `grep` for `prefers-reduced-motion`; enable the OS setting.
- **Priority:** Medium
- **Status:** ✅ Passed
- **Evidence or Notes:** `app/globals.css` now collapses animation/transition durations under `@media (prefers-reduced-motion: reduce)`, so the thinking spinner and the streaming caret stop animating for users who request less motion.

### U8 — Responsive layout & safe areas
- [ ] **Requirement:** Usable at 390 px with no horizontal overflow; notches respected.
- **Risk:** Broken layout on the target phone.
- **Verification:** 390 px viewport check; `viewport-fit=cover`; `env(safe-area-inset-*)`.
- **Priority:** High
- **Status:** ✅ Passed
- **Evidence or Notes:** Verified at 390 px (no horizontal overflow; composer pinned; header 69 px). `viewport = width=device-width, initial-scale=1, viewport-fit=cover`; composer/modal use safe-area padding.

### U9 — Browser/device support floor
- [ ] **Requirement:** The app works on the supported browser floor.
- **Risk:** Blank app on an older phone.
- **Verification:** Test Chrome/Edge 111+, Safari 16.4+, Firefox 128+ (Tailwind 4 / Next 16 floor).
- **Priority:** Medium
- **Status:** ⬜ Not Started
- **Evidence or Notes:** Floor documented in `build-plan.md` Phase 7 as an accepted decision; **not yet verified on real devices** (the demo phone check is pending).

### U10 — Loading, empty, and error states
- [ ] **Requirement:** Clear states for loading, empty transcript, empty history, and failures.
- **Risk:** UI looks frozen or broken.
- **Verification:** Observe "thinking" row, streaming caret, empty-state card, empty-history copy, and the failure cards.
- **Priority:** Medium
- **Status:** ✅ Passed
- **Evidence or Notes:** "सोच रहा हूँ…" row + streaming caret; empty-transcript card; empty-history copy; amber refusal/upstream cards; red offline toast.

### U11 — Form validation & predictable behaviour
- [ ] **Requirement:** Validation is inline and consistent; Enter sends, Shift+Enter newlines, IME respected.
- **Risk:** Accidental submits while typing Hindi.
- **Verification:** Type Hindi with an IME; test Enter/Shift+Enter.
- **Priority:** Medium
- **Status:** ✅ Passed
- **Evidence or Notes:** `Composer.handleKeyDown` ignores `isComposing`; send disabled when empty/loading. Verified in Phase 4.

### U12 — PWA installability
- [ ] **Requirement:** The app is installable with a correct manifest and icons.
- **Risk:** "Add to home screen" fails or looks broken.
- **Verification:** Check `/manifest.webmanifest` (200), icons 192/512 + maskable, and installability criteria.
- **Priority:** Medium
- **Status:** ✅ Passed
- **Evidence or Notes:** Manifest returns 200 with id/scope/display/orientation/theme; PNG icons 192/512 + maskable 512 present (regenerated from `public/Logo.png` by `scripts/generate-icons.mjs`, 2026-10-16); icons return 200. iOS meta added via `appleWebApp` in `app/layout.tsx` (`apple-mobile-web-app-capable`). **Remaining gap:** no service worker → no offline caching (installability on Chrome/Android is unaffected).

---

## 7. Deployment and operations

### D1 — Production environment variables
- [ ] **Requirement:** `GEMINI_API_KEY` is set for Production **and** Preview on the host.
- **Risk:** The deployed app 500s or serves the fallback card on every question.
- **Verification:** Vercel → Project → Settings → Environment Variables; then ask a question on the deployed URL.
- **Priority:** Critical
- **Status:** ⬜ Not Started
- **Evidence or Notes:** Deployment has not happened. `.env.example` documents the variable; the key exists only locally in `.env.local`.

### D2 — Build validation
- [ ] **Requirement:** A clean production build succeeds.
- **Risk:** Broken deploy.
- **Verification:** `npm run build`.
- **Priority:** Critical
- **Status:** ✅ Passed
- **Evidence or Notes:** `next build` (Turbopack) compiled successfully; TypeScript passed; routes `/`, `/_not-found`, `/api/ask`, `/api/health`, `/apple-icon.png`, `/manifest.webmanifest`.

### D3 — HTTPS & transport security
- [ ] **Requirement:** The site is served over HTTPS and enforces it.
- **Risk:** Insecure transport (OWASP A02).
- **Verification:** Load the deployed URL over HTTPS; confirm HSTS (see S9).
- **Priority:** Critical
- **Status:** ⬜ Not Started
- **Evidence or Notes:** Local `next start` is HTTP only; HTTPS is provided by the host. Must confirm on the deployed URL, including whether HSTS is emitted (S9).

### D4 — Runtime version pinning
- [ ] **Requirement:** The Node version is pinned for local and CI/host parity.
- **Risk:** Local Node 24 vs host Node version → subtle runtime differences; Next requires `>= 20.9.0`.
- **Verification:** Check `package.json` `engines`, `.nvmrc`, and the Vercel project Node setting.
- **Priority:** High
- **Status:** ✅ Passed
- **Evidence or Notes:** `package.json` now declares `engines.node ">=20.9.0"` and `.nvmrc` pins `22` (2026-10-16). Local Node v24.16.0 satisfies the range; run `nvm use` for exact parity, and set the host to the `.nvmrc` value at deploy.

### D5 — Function duration/plan compatibility
- [ ] **Requirement:** The host allows the 60 s function duration the route requires.
- **Risk:** Answers (15–33 s + retries) killed mid-stream on a plan with a shorter limit.
- **Verification:** Confirm the Vercel plan's max function duration; observe a slow answer end cleanly.
- **Priority:** High
- **Status:** ⬜ Not Started
- **Evidence or Notes:** `maxDuration = 60` (`route.ts:15`). Depends on the chosen plan (Hobby allows up to 60 s for Node functions, but this is **unverified** for this project).

### D6 — Rollback procedure
- [ ] **Requirement:** A documented, tested rollback path exists.
- **Risk:** A bad deploy stays live.
- **Verification:** Confirm Vercel instant-rollback is available and documented.
- **Priority:** High
- **Status:** ⬜ Not Started
- **Evidence or Notes:** No rollback runbook. Vercel supports promoting a previous deployment; document it.

### D7 — Deployment verification (post-deploy smoke)
- [ ] **Requirement:** A documented post-deploy check list is run against the live URL.
- **Risk:** Silent production-only failures (env, headers, latency).
- **Verification:** Run `npm run smoke` (with `SMOKE_BASE_URL` pointed at the deploy) plus a manual phone pass.
- **Priority:** Critical
- **Status:** ⬜ Not Started
- **Evidence or Notes:** `scripts/smoke-api.mjs` supports `SMOKE_BASE_URL`, so it can target production; the runbook itself is not written.

### D8 — CI/CD pipeline
- [ ] **Requirement:** Lint, tests, and build run automatically on every push.
- **Risk:** Regressions reach production (OWASP A04/A08).
- **Verification:** Presence of a CI workflow.
- **Priority:** Medium
- **Status:** ❌ Failed
- **Evidence or Notes:** **No `.github/` directory** → no CI. Lint/test/build are run manually (as in this audit).

### D9 — Secret rotation plan
- [ ] **Requirement:** A documented process to rotate `GEMINI_API_KEY` if exposed.
- **Risk:** A leaked key stays valid.
- **Verification:** Confirm a documented rotation step and where the key is stored.
- **Priority:** Medium
- **Status:** ⬜ Not Started
- **Evidence or Notes:** No runbook. Rotation is a Google AI Studio action + a Vercel env update + redeploy.

### D10 — Config/infra files present and correct
- [ ] **Requirement:** Deployment config matches the app (headers, regions, caching).
- **Risk:** Misconfiguration between environments.
- **Verification:** Review `next.config.ts` and any `vercel.json`.
- **Priority:** Low
- **Status:** ✅ Passed (with note)
- **Evidence or Notes:** Security headers are centralized in `next.config.ts` `headers()` and apply to all routes; there is **no `vercel.json`** (not required — Next config is sufficient).

---

## 8. Testing and documentation

### T1 — Unit / retrieval tests
- [ ] **Requirement:** Retrieval and KB integrity are covered by automated tests.
- **Risk:** Silent retrieval regressions.
- **Verification:** `npm run test`.
- **Priority:** High
- **Status:** ✅ Passed
- **Evidence or Notes:** **12/12 passing** (`node:test`): KB schema/word counts, chunk structure, 15/15 evals, 3/3 refusals, threshold/sort/cap, `out_of_scope` exclusion, chip coverage, edge cases.

### T2 — API contract tests
- [ ] **Requirement:** The HTTP contract and failure paths are covered.
- **Risk:** Contract drift between client and server.
- **Verification:** `npm run smoke` against a running server.
- **Priority:** High
- **Status:** ✅ Passed (with gaps)
- **Evidence or Notes:** `scripts/smoke-api.mjs` covers health, 405, 400s, truncation, refusal (hi/en), upstream mode, no-leak, and rate-limit 429. **Gaps:** no automated test for the **403 cross-origin** case (S11) or a forced mid-stream 500 (R8).

### T3 — End-to-end tests
- [ ] **Requirement:** Key user journeys are automated end-to-end.
- **Risk:** Integration regressions missed by unit tests.
- **Verification:** Presence of a Playwright/Cypress suite.
- **Priority:** Medium
- **Status:** ❌ Failed
- **Evidence or Notes:** No E2E framework. All E2E verification to date has been **manual browser checks** recorded in `build-plan.md`.

### T4 — Security testing
- [ ] **Requirement:** Automated security testing (DAST/scanning) and prompt-injection tests exist.
- **Risk:** Unknown vulnerabilities (OWASP A03/A05/A06).
- **Verification:** Run a DAST scan (e.g. OWASP ZAP baseline) and a prompt-injection test set.
- **Priority:** Medium
- **Status:** ⬜ Not Started
- **Evidence or Notes:** None performed. Prompt-injection adversarial testing is also outstanding (S5).

### T5 — Accessibility regression tests
- [ ] **Requirement:** Accessibility is checked automatically (axe/Lighthouse) in the pipeline.
- **Risk:** a11y regressions (U1–U3) recur.
- **Verification:** Add an axe/Lighthouse CI check.
- **Priority:** Medium
- **Status:** ⬜ Not Started
- **Evidence or Notes:** One manual Lighthouse run was done for this audit (a11y 0.94); it is not automated and no baseline is enforced.

### T6 — Performance/load testing
- [ ] **Requirement:** Performance and concurrency are measured.
- **Risk:** Unknown bottlenecks (P1/P7).
- **Verification:** Lighthouse mobile + a load test on the deployed endpoint.
- **Priority:** Medium
- **Status:** ⬜ Not Started
- **Evidence or Notes:** No performance score captured and no load test run.

### T7 — Documentation completeness
- [ ] **Requirement:** README, PRD, DESIGN, DECISIONS, and a deploy runbook exist and match the code.
- **Risk:** Onboarding/ops friction; docs drift from reality.
- **Verification:** Review `README.md`, `docs/*`, `build-plan.md`.
- **Priority:** Medium
- **Status:** ✅ Passed (with gap)
- **Evidence or Notes:** README (accurate, model named, integration pointer), `docs/PRD.md`, `docs/DESIGN.md`, `docs/DECISIONS.md`, `build-plan.md`, `LICENSE` all present and current. **Gap:** no operational runbook (deploy/rollback/rotation) — see D6/D7/D9.

### T8 — Dependency maintenance
- [ ] **Requirement:** Dependencies are current and a maintenance process exists.
- **Risk:** Bit-rot and latent vulnerabilities (OWASP A06).
- **Verification:** `npm outdated`; confirm Dependabot/renovate.
- **Priority:** Low
- **Status:** ⬜ Not Started
- **Evidence or Notes:** Minimal runtime deps (5) and a committed lockfile, but no automated update process (see S15/D8).

### T9 — License & attribution
- [ ] **Requirement:** A license exists and third-party attribution is correct.
- **Risk:** Legal/eligibility issues.
- **Verification:** Confirm `LICENSE` and dependency licenses.
- **Priority:** Low
- **Status:** ✅ Passed
- **Evidence or Notes:** `LICENSE` (MIT) present; README names the model and the Gemma 4 partner-challenge context. (No third-party notice file — acceptable for this dependency set.)

---

## 9. Overall readiness summary

| # | Area | Items | Passed | Failed | In Progress | Not Started | N/A |
|---|---|---:|---:|---:|---:|---:|---:|
| 2 | Security | 20 | 12 | 1 | 2 | 2 | 3 |
| 3 | Edge cases & error handling | 15 | 15 | 0 | 0 | 0 | 0 |
| 4 | Reliability & data integrity | 11 | 6 | 1 | 2 | 0 | 2 |
| 5 | Performance & scalability | 8 | 3 | 0 | 2 | 3 | 0 |
| 6 | UX & accessibility | 12 | 12 | 0 | 0 | 0 | 0 |
| 7 | Deployment & operations | 10 | 3 | 1 | 0 | 6 | 0 |
| 8 | Testing & documentation | 9 | 4 | 1 | 0 | 4 | 0 |
| | **Total** | **85** | **55** | **4** | **6** | **15** | **5** |

**Interpretation (updated 2026-10-16):** the product logic **and** the previously
failing hardening items are now verified — grounded/refusal pipeline, streaming
contract, secret handling, input validation, failure drills, error boundaries,
`<main>` landmark + contrast (Lighthouse a11y **1.0**), the new security headers
and the Node pin all pass. What remains is almost entirely **deploy-dependent**
(host env, HTTPS/HSTS on the live URL, function duration) plus **operational
visibility** (monitoring/alerting). The only non-deploy `Failed` items are the
deliberately out-of-scope CI/CD (D8) and the accepted dev-only `braces` advisory
(S14).

---

## 10. Critical blockers (must be resolved before go-live)

| ID | Blocker | Why it blocks | Ref | Status |
|---|---|---|---|---|
| **B1** | No custom error boundary (`app/error.tsx` / `global-error.tsx`) | Any unexpected render error shows a bare error screen to a farmer. | E14 | ✅ resolved 2026-10-16 — both boundaries added |
| **B2** | Missing `<main>` landmark + color-contrast failures | Verified WCAG failures; blocks an accessibility baseline. | U1, U2, U3 | ✅ resolved 2026-10-16 — `<main>` added, tokens darkened, Lighthouse a11y **1.0** |
| **B3** | `GEMINI_API_KEY` not set in the host (prod + preview) | The deployed app would fall back on every question. | D1 | ⬜ open — needs Vercel |
| **B4** | HTTPS + HSTS not verified on the deployed URL | Transport security unproven. | S9, D3 | 🟡 partial — HSTS header now sent locally; live-URL check pending |
| **B5** | No runtime (Node) version pin | Local Node 24 vs host; reproducibility risk. | D4 | ✅ resolved 2026-10-16 — `engines` + `.nvmrc` 22 |
| **B6** | Function duration/plan compatibility unverified (needs 60 s) | Slow answers could be killed mid-stream. | P3, D5 | ⬜ open — needs Vercel plan |
| **B7** | No monitoring/alerting | Outages and quota exhaustion are invisible. | R9 | ⬜ open — needs a service/account |
| **B8** | No post-deploy verification runbook executed | Production-only failures (env, headers, latency) go unnoticed. | D7 | ⬜ open — needs a deploy |

> None of these are product-logic defects. **B1, B2 and B5 are now closed**; the
> five that remain (B3, B4, B6, B7, B8) all require the deployment to exist or a
> monitoring account, so they cannot be resolved from the repo alone.

---

## 11. Unresolved risks & accepted risks

**Unresolved (need a decision or a test)**

- **S13** — Rate-limit key trust (`x-forwarded-for`) and per-instance (non-global) limiting. *Verify on the platform.*
- **S8** — CSP `'unsafe-inline'` for scripts. *Accepted for the MVP; revisit if third-party content is ever added.*
- **P1 / P7 / T6** — Performance and concurrency unmeasured.
- **E14** — The error boundaries are implemented and compiled but were not force-rendered (there is no throw route); run a forced-throw drill.
- **S5 / T4** — Prompt-injection and DAST testing not performed.
- **R5** — History source rebuild silently drops unknown KB ids.
- **Gemini availability** — `gemma-4-26b-a4b-it` returns fast intermittent 5xx (observed live repeatedly). Mitigated by retries + snippet fallback; **not eliminated**. Re-check quota/tier before a live demo.

**Accepted risks (documented, not blocking)**

- **S14** — 5 high dev-only `braces` advisories with no patched version; production audit is clean (0).
- **S8** — `'unsafe-inline'` CSP (see above).
- **D8** — No CI/CD: deliberately out of scope (`AGENTS.md` #11 bans CI/CD for this hackathon MVP); lint/test/build/smoke are run manually (as in this audit).

---

## 12. Final go/no-go deployment decision

> **Decision: NO-GO (hold) — deploy-dependent only.**
>
> **Rationale (updated 2026-10-16):** the in-repo gating items are **closed** —
> error boundaries exist, the `<main>` landmark and contrast failures are fixed
> (Lighthouse Accessibility **1.0**), HSTS/`Referrer-Policy`/`Permissions-Policy`
> are sent and `X-Powered-By` is gone, and the Node runtime is pinned. The
> application logic was already verified (grounded answers, deterministic refusal
> with zero model calls, graceful upstream/offline/429 handling, server-only
> secrets, green lint/test/build/smoke).
>
> The release is still **NO-GO** only because the remaining blockers are
> **unverifiable without a deployment or a monitoring account**: B3 (host env
> var), B4 (HTTPS/HSTS on the live URL), B6 (60 s function duration), B7
> (monitoring/alerting) and B8 (post-deploy smoke).
>
> **Conditions to flip to GO:** deploy, then resolve **B3–B8** (§10); re-run
> `npm run lint && npm run test && npm run build`; execute the post-deploy smoke
> (`SMOKE_BASE_URL=<deploy> npm run smoke`) plus a real-phone pass; record the
> results in the *Evidence or Notes* fields above.
>
> **Fastest path to GO:** deploy (B3/B4/B6/B8 verified in one pass on the live
> URL), then add basic error reporting/alerting (B7) before announcing the URL.

---

## Appendix A — Evidence collected

| Check | Command / method | Result |
|---|---|---|
| Unit/retrieval tests | `npm run test` | **12/12 passing** (re-run 2026-10-16) |
| API contract smoke | `npm run smoke` | **23/23 passing** (2026-10-16; 1 real Gemini call, 33.6 s) |
| Lint | `npm run lint` | Clean (no output) |
| Production build | `npm run build` | Compiled successfully; TS passed; 6 routes |
| Prod dependency audit | `npm audit --omit=dev` | **0 vulnerabilities** |
| Full dependency audit | `npm audit` | 5 high, 0 critical (dev-only `braces` chain, no patch) |
| Response headers (before) | `curl -sD - -o NUL http://localhost:3000/` | CSP, `nosniff`, `SAMEORIGIN` present; **no HSTS / Referrer-Policy / Permissions-Policy**; `X-Powered-By: Next.js` present |
| Response headers (after) | `curl -sD -` (2026-10-16) | **+ `Strict-Transport-Security: max-age=63072000`, `Referrer-Policy`, `Permissions-Policy`; `X-Powered-By` gone** |
| Custom 404 | `curl -sD -` + `browser.evaluate` on `/does-not-exist` | `404` + branded page, `hasMain=true` |
| Manifest | `curl` `/manifest.webmanifest` | `200`, `application/manifest+json` |
| Accessibility / best practices / SEO (before) | Lighthouse (Chrome, prod build) | a11y **0.94**, best-practices **1.0**, SEO **1.0**; failures: `color-contrast`, `landmark-one-main` |
| Accessibility / best practices / SEO (after) | Lighthouse (2026-10-16) | a11y **1.0**, best-practices **1.0**, SEO **1.0**; **zero failures** |
| Contrast walker | in-page `browser.evaluate` (parses gradient stops, composites layers) | before: 12 failing nodes; after: **0** |
| DOM/landmark probe | `browser.evaluate` | before `hasMain=false`; after `hasMain=true`, `h1Count=1`, `htmlLang=hi` |
| Failure drills | browser + curl (no-key / bad-key / offline / 429) | All show friendly Hindi UI; no technical leakage |
| Secret/XSS greps | `grep` for `GEMINI_API_KEY`, `NEXT_PUBLIC_`, `dangerouslySetInnerHTML`, `AIza…` | No matches in app code |
| CI presence | directory listing | No `.github/` directory (deliberate — `AGENTS.md` #11) |
| Node pin | `package.json` / `.nvmrc` | before: none; after: `engines.node ">=20.9.0"` + `.nvmrc` 22 |

**Scope note:** the audit itself changed no code. The follow-up fix pass
(2026-10-16) changed only the app/config listed in the items above — error/404
pages, design tokens, `next.config.ts` headers, `package.json` engines and
`.nvmrc` — and did not touch the API, retrieval, KB, or prompt. Performance
score, load testing, DAST and prompt-injection testing were **not** performed and
remain ⬜ Not Started.
