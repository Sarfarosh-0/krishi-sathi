# AGENTS.md — Rules for AI agents working on this repo

**Project:** Krishi Sathi (कृषि साथी) — Hindi-first AI farming advisor.
**Context:** Hackathon MVP (10 build hours). Small, working, deployed beats big,
broken, or clever. Judges score: problem scope · solution · technical
implementation · open-source AI use · completeness.

**Read before changing anything:** `docs/DECISIONS.md` (what we locked and why),
`docs/PRD.md` (requirements), `docs/DESIGN.md` (UI, types, API contract).

---

## NEVER (hard bans — violations break the submission or security)

### Secrets & security
1. **Never** hardcode or commit `GEMINI_API_KEY` (or any key). Server-side only via
   `process.env.GEMINI_API_KEY`. Never expose it to the client — **never** put it
   in a `NEXT_PUBLIC_*` var, prop, response body, log, or error message.
2. **Never** use `dangerouslySetInnerHTML` for model output or KB text. Render as
   text/Markdown-to-React-nodes only. Model output is untrusted input.
3. **Never** store user questions/answers server-side, add analytics, or add any
   tracking. History/impact live in `localStorage` only (privacy claim in PRD).
4. **Never** log full prompts/responses or the API key in `console.log` in
   committed code.
5. **Never** skip rate limiting, input validation, or the origin/CORS check when
   touching `app/api/ask/route.ts`.
6. **Never** add `eval`, `new Function`, dynamic `require`, or server-side
   filesystem reads from user input.

### Hallucination & grounding (the product's core promise)
7. **Never** let the model answer from its own knowledge: the prompt must keep
   the "answer ONLY from context" rule and the `<<<CONTEXT>>>` fence intact.
   Do not "simplify" the prompt in ways that weaken refusal or citation rules.
8. **Never** invent KB content, crops, dosages, chemicals, or advisory lines that
   are not in `kb/crop-docs.json`. KB text is human-curated sample guidance —
   agents may format it, never author agronomic facts.
9. **Never** remove or soften: the source-citation requirement, the refusal path
   (threshold → no API call), the advisory disclaimer line, or the out-of-KB
   referral script. These are explicit problem-statement requirements.
10. **Never** silently catch an error and return a fabricated success. On failure
    use the documented fallback (`error: "upstream"` + snippet fallback).

### Scope & overengineering (10-hr budget)
11. **Never** add a database, auth/accounts, vector DB, embeddings, Redis, queues,
    CI/CD, monorepo tooling, or state libraries (Redux/Zustand). They are
    explicitly out of scope in `docs/DECISIONS.md`.
12. **Never** add a dependency that a ≤80-line local module can replace. Prefer
    `@google/genai` + Tailwind + Lucide + React. Justify any new package in the PR.
13. **Never** build stretch features (image upload, live weather, Awadhi mode,
    WhatsApp, admin panel, dark mode, seasonal banner, crop dropdown) before the
    "Must" FRs are done, deployed, and smoke-tested on a phone.
14. **Never** refactor working code "for cleanliness" during the hackathon window.
    Small, boring, shipped > elegant, unfinished.
15. **Never** invent event rules, judging criteria, deadlines, or partner-challenge
    requirements. If it isn't in `docs/` or the official links, ask the human.
16. **Never** promise features in README/PRD/deck that code does not implement.
    Docs and code must match at all times.

### Models & API
17. **Use only `gemma-4-26b-a4b-it`** via `@google/genai` on the Gemini API. Do not
    swap to Gemini proprietary models (`gemini-*`) — that voids the *Best Use of
    Gemma 4* partner challenge. README must keep naming the model.
18. **Never** call the Gemini API from the client bundle. API calls happen only in
    `app/api/ask/route.ts` (Node runtime, not edge).
19. **Never** fetch KB or synonyms from the network at runtime — they are bundled
    JSON/TS.

## ALWAYS (required on every change)

1. Keep `lang` handling correct: Hindi default, English optional, both in UI and
   answers; text nodes carry proper `lang` attributes.
2. Keep the advisory disclaimer on every answer and the amber (never red) refusal
   styling.
3. Handle the documented edge cases: empty input, >500-char truncation, rate
   limit 429, Gemini timeout/429/5xx, offline, unsupported `speechSynthesis` /
   `webkitSpeechRecognition` (hide controls, never crash).
4. Run `npm run test` (retrieval unit tests) and `npm run build` before declaring
   a task done.
5. Update `docs/PRD.md` / `docs/DESIGN.md` in the same change if behavior,
   types, or the API contract change.
6. Keep `runtime = "nodejs"` exported on the API route.
7. Use the shared types in `lib/types.ts` on both client and server — do not
   duplicate interfaces.
8. Write plain, readable code with brief comments; ES6+, semantic HTML,
   Tailwind classes per `docs/DESIGN.md` tokens. No inline style objects,
   no CSS-in-JS.
9. Commits: never commit `.env.local`, `node_modules`, or build output. Keep the
   lockfile updated.

## Definition of done (per task)

- [ ] Implements only what the linked FR requires; no extra features
- [ ] Handles at least one failure path explicitly
- [ ] No secrets, no `dangerouslySetInnerHTML`, no new deps without justification
- [ ] Retrieval tests + `next build` pass
- [ ] Docs updated if behavior changed
- [ ] Works on a mobile viewport

## When unsure

Stop and ask the human. Do not guess event rules, agronomic facts, deadlines, or
"improve" the scope silently. This is a judged submission — predictability beats
creativity here.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
