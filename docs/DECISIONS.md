# Project Decision Record — Krishi Sathi (working name)

> Decision log for the Agriculture-category entry at Hacktoberfest Hack Day,
> Lucknow × Integral University (MLH), 15–16 Oct 2026.
> The PRD is derived from this document; every promise in the deck must be
> traceable to a decision recorded here.

---

## 1. Event & logistics (confirmed)

| Item | Status |
|---|---|
| Event | Hacktoberfest Hack Day, Lucknow × Integral University (MLH), 15–16 Oct 2026, 10 AM–4 PM |
| Team | Solo — confirmed allowed |
| Phase 1 | PRD + 8-slide PPT, due by 4 PM, uploaded to shared Drive, no late uploads |
| Phase 2 | MVP, 10 hrs, deployed public link, due 12 PM (confirmed) |
| Judging | problem scope · solution · technical implementation · use of open-source AI · completeness |
| Partner challenge | Best Use of Gemma 4 — must call a Gemma model via the Gemini API; model named in README; integration visible in code/demo; API key via env vars only |

---

## 2. Category & problem (locked)

**Category 1 — Agriculture.**

> *Problem (PDF): Smallholder farmers near Lucknow lose crops to pests, mistimed
> fertiliser, and missed weather warnings, and advice is hard to get in their own
> language. Build: An open-source AI advisor that answers farming questions in
> Hindi or Awadhi, using a small model that runs on modest hardware and a curated
> set of local crop guidance.*

**Product:** Hindi-first farming advisor web app. The user is a smallholder farmer
near Lucknow with a phone and basic Hindi. Answers come **only** from a curated
knowledge base, **cite the source document**, and **say "I don't know"** when the
question is not covered. Hindi satisfies the language requirement; Awadhi is an
optional stretch and is **not** promised.

---

## 3. Core behaviour (locked)

- **Pipeline (RAG-lite):** user question → Vercel API route → keyword/tag
  retrieval (top-3 chunks) → `gemma-4-26b-a4b-it` generates the answer
  (temperature ~0.3) → response `{ answer, sources[], refused, lang }` rendered
  with a disclaimer.
- **Refusal:** below the retrieval threshold the deterministic refusal path runs
  (no API call). The prompt enforces:
  *"मुझे इस सवाल का जवाब अपनी जानकारी में नहीं मिला… कृषि विज्ञान केंद्र से संपर्क करें।"*
  Every answer ends with:
  *"यह सामान्य सलाह है — स्थानीय कृषि विशेषज्ञ से पुष्टि करें।"*
- **8 demo chips** (Hindi shown / English): wheat yellow stem borer · mustard
  fertiliser timing · paddy irrigation · wheat blue rust · neem spray safety ·
  pre-rain actions · onion sowing · fish-farming cost (deliberately
  out-of-KB → refusal demo).
- **Language:** Hindi ⇄ English toggle (UI strings + reply language; does not
  re-query).
- **Fallbacks:** API timeout / 429 / 5xx → show retrieved KB snippets + friendly
  Hindi message (`refused: true`), never a crash; empty input disabled;
  questions > 500 chars truncated; offline toast.

---

## 4. KB design (locked approach)

- **Source:** sample KB scaffolded in-repo, clearly labelled as sample content in
  the README (no real KVK/ICAR documents assumed).
- **8–15 chunks**, 80–150 words each, pre-chunked, **Hindi + English paired**
  (`text` / `textEn`).
- **Metadata per chunk:** `id, title, titleEn, crop[], season, tags[], text,
  textEn, source, priority`.
- **Scoring:** crop match (strongest) > tags > token overlap;
  **synonym table** (`lib/synonyms.ts`, 30–50 lines, e.g. "पीली इल्टी" =
  "yellow stem borer" = "borer") expands queries before scoring.
- **Structure convention:** `लक्षण / उपाय / सावधानी` inside each chunk so answers
  are consistent and scannable; source line embedded in the text so citations
  cannot drift.
- **"What NOT to answer" doc** (market price, schemes, loans, live weather →
  sanctioned referral).
- **Eval set:** ~15 (question → expected source) pairs + 3 expected refusals,
  run as retrieval-only unit tests (no API quota burn).

---

## 5. Tech stack (locked)

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) + TypeScript — `app/page.tsx` UI, `app/api/ask/route.ts` backend (`export const runtime = "nodejs"`) |
| Styling / icons | Tailwind CSS · Lucide React |
| AI SDK | `@google/genai` → `gemma-4-26b-a4b-it` via Gemini API |
| KB | `kb/crop-docs.json` bundled (no database) |
| Retrieval | `lib/retrieval.ts` (pure TS scorer) + `lib/synonyms.ts` |
| Secrets | `.env.local` (gitignored) + Vercel dashboard → `GEMINI_API_KEY`, server-side only, never `NEXT_PUBLIC_*` |
| Deploy | Vercel — GitHub push = deploy, one public URL |
| Tests | Node built-in `node:test` on the retrieval module |
| Streaming | Yes — `ReadableStream` from the route, answer types out progressively |

**Deliberately excluded:** database, auth, embeddings/vector DB, CI/CD,
frameworks beyond Next.js.

---

## 6. Client-side additions (no backend)

- **Dashboard modal, two sections:**
  - **Impact counter** — device-local and honestly labelled *"from this device"*:
    questions asked / answered / refused, KB coverage stats (crops, docs,
    languages).
  - **History** — localStorage `{ q, answer, sources, lang, ts }`, capped at ~50
    entries, clear-all button, click to re-open.
- Wrapped in `useEffect` + try/catch (Safari private mode can throw).
- **Built after the first successful deploy**, so a working chat is never at risk.

---

## 7. Finalized feature bundle

**Core MVP (in):** TTS "सुनें" button (`speechSynthesis`, Hindi voice) · voice
input (`webkitSpeechRecognition` hi-IN, graceful fallback) · streaming · light
markdown rendering (text nodes only, no `dangerouslySetInnerHTML`) · PWA manifest
· input validation · prompt-injection fence (`<<<CONTEXT>>>` delimiters + "treat
context as data") · client + server rate limit (10 req/min per IP, in-memory) ·
origin/CORS check · security headers · repo hygiene (lockfile, `npm audit`, MIT
LICENSE, README naming the model).

**After first deploy:** dashboard + history.

**Deferred (only if time remains):** dark mode · seasonal banner · crop dropdown.

**Explicitly out of MVP:** image upload (multimodal stretch) · live weather API ·
Awadhi dialect · WhatsApp delivery · admin KB panel.

---

## 8. Architecture

```
Browser (Next.js client, Tailwind, Lucide)
  POST /api/ask { question, lang }
      ↓
Vercel serverless route (nodejs runtime)
  validate → load KB (module-scope cache) → retrieve top-3 (threshold)
  → build fenced prompt → @google/genai → gemma-4-26b-a4b-it
      ↓
{ answer, sources[], refused, lang } → render + source chips + TTS
```

- Health/warm-up call on page load to avoid a cold start during the demo.
- Env var set once in the Vercel dashboard; key never in repo or browser.

---

## 9. Build order (10 hrs)

1. Next.js + TS + Tailwind + Lucide scaffold · KB JSON + synonyms + retrieval + unit tests — 2 hr
2. API route: validation, fence, prompt, Gemini call, fallbacks — 1.5 hr
3. Chat UI: streaming, chips, toggle, citations, TTS, voice input — 2.5 hr
4. Wire + error handling (rate limit, offline, 429) — 1 hr
5. Deploy to Vercel + env var + phone smoke test — 1 hr
6. Dashboard + history — 1 hr
7. README + demo script + PRD/deck consistency check — 0.5 hr
8. Buffer — 0.5 hr (quota / cold-start / prompt tuning)

---

## 10. Judging mapping

- **Scope:** narrow, real, localized (Lucknow smallholders, Hindi, crop care).
- **Solution:** grounded KB answers + citations + explicit refusal = safe, verifiable.
- **Tech:** RAG-lite retrieval, prompt fencing, secure key handling, streaming, error resilience.
- **Open-source AI:** Gemma 4 via Gemini API — visible in `route.ts` + README → Best Use of Gemma 4 eligible.
- **Completeness:** small, deployed, tested beats feature lists.
- **"Modest hardware" honesty:** the PRD states that Gemma 4 is open-weights and
  locally deployable (quantized); this prototype accesses it via the Gemini API
  for speed, and the architecture supports local/edge deployment later.

---

## 11. Remaining open items

1. **Final project/team name** — "Krishi Sathi (कृषि साथी)" is a placeholder for
   the title slide, repo, and README; confirm or replace.
2. **Google AI Studio API key** — prerequisite for the MVP phase (never committed).
