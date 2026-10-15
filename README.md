<div align="center">

# कृषि साथी · Krishi Sathi

**A Hindi-first AI farming advisor for smallholder farmers.**

Chat in Hindi or English and get crop-care advice that comes **only** from a
curated knowledge base — every answer **cites its source**, and the app **honestly
refuses** (with a KVK referral) when the answer is not covered.

[![Next.js](https://img.shields.io/badge/Next.js-16.4.1-000000?logo=next.js&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Model: Gemma 4](https://img.shields.io/badge/Model-gemma--4--26b--a4b--it-16A34A)](https://ai.google.dev/gemma)
[![Tests](https://img.shields.io/badge/tests-12%20passing-16A34A)](#-testing)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue)](#-license)

**[Problem](#-the-problem) · [Features](#-features) · [How it works](#-how-it-works) · [Quick start](#-quick-start) · [API](#-api) · [Docs](#-documentation)**

</div>

---

## 🌾 The problem

Smallholder farmers near Lucknow lose crops to three recurring, preventable
causes: **pests** identified too late, **fertiliser** applied at the wrong growth
stage, and **weather-triggered actions** (like spraying before rain) that get
missed.

The advice that would prevent these losses is hard to get in their own language.
Extension-officer and KVK visits are infrequent, and most online content is in
English. A farmer who needs an answer at 7 AM — just before spraying — usually
gets none.

**Krishi Sathi** closes that gap with a fast, trustworthy, Hindi-first advisor
that knows its own limits.

## ✨ Features

| | |
|---|---|
| 🗣️ **Hindi ⇄ English** | One tap switches the whole UI and the reply language. Past messages keep their own language. |
| 🎯 **Grounded answers** | The model is instructed to answer **only** from retrieved knowledge-base context — never from its own knowledge. |
| 📚 **Citations** | Every answer ships with its source document(s); tap a source to read the full text. |
| 🙅 **Honest refusal** | If the KB does not cover the question, the app says so and refers the farmer to the KVK — deterministically, with **zero** model calls. |
| 🔊 **Read aloud** | One tap speaks the answer in Hindi (`speechSynthesis`) — plain text, no Markdown artefacts. |
| 🎙️ **Voice input** | Ask by speaking in Hindi via the Web Speech API, with graceful fallback to typing. |
| 💬 **8 suggested questions** | Localized shortcut chips, including one deliberately out-of-scope question to demonstrate the refusal path. |
| 📊 **Local dashboard** | Device-local impact counters and question history — no account, no cloud, no tracking. |
| 📱 **Installable PWA** | Add to home screen; safe-area aware and built for one-thumb use on a low-end phone. |
| 🛡️ **Resilient** | Graceful snippet fallback on model failure, friendly notices for rate limits and offline, and no crash on unsupported browser APIs. |

## 🧠 How it works

A deliberately small, database-free **RAG-lite** pipeline. Retrieval is
deterministic TypeScript, not a model — so it is fast, testable, and quota-free.

```mermaid
flowchart TD
    A["Farmer asks in Hindi or English<br/>(type · speak · tap a chip)"] --> B["POST /api/ask { question, lang }"]
    B --> C["Validate: length · method · lang · rate limit"]
    C --> D["Retrieve top-3 chunks<br/>crop &gt; tags &gt; tokens + synonyms"]
    D -->|score &gt;= threshold| E["Build fenced prompt<br/>&lt;&lt;&lt;CONTEXT&gt;&gt;&gt; = data, not instructions"]
    D -->|score &lt; threshold| R["Deterministic refusal<br/>+ KVK referral · zero model calls"]
    E --> F["Gemma 4<br/>(gemma-4-26b-a4b-it) via Gemini API"]
    F --> G["Stream NDJSON:<br/>sources → token* → done(advisory)"]
    G --> H["Render answer + source chips + advisory"]
    R --> H
```

**The pipeline, step by step:**

1. **Validate** — length, method, `lang`, and a per-IP rate limit.
2. **Retrieve** — a pure TypeScript scorer ranks the bundled KB chunks
   (`crop match 3 > tag hit 2 > token overlap 1`, threshold `5`), with a synonym
   table expanding farmer phrasing (e.g. *पीली इल्टी* = *yellow stem borer*).
3. **Refuse or answer** — below the threshold the route refuses immediately
   (no API call). Above it, the top-3 chunks become fenced prompt context.
4. **Generate** — `gemma-4-26b-a4b-it` streams an answer grounded in the context.
5. **Stream** — the answer arrives as NDJSON (`sources → token* → done`), so
   citations are on screen while the model is still thinking.
6. **Advisory** — the server appends the non-authoritative advisory line; the
   model never writes it.

> **Why the model fails gracefully matters.** `gemma-4-26b-a4b-it` is a thinking
> model that returns **fast intermittent 5xx**. `sources` is therefore emitted
> *before* the model call, the route retries (only while nothing has streamed),
> and any terminal failure still ends in a clean snippet-fallback card.

## 🧱 Tech stack

| Layer | Choice |
|---|---|
| Framework | **Next.js 16** (App Router, Turbopack) + **TypeScript** |
| Styling & icons | **Tailwind CSS 4** · **Lucide React** |
| AI | **`@google/genai`** → **`gemma-4-26b-a4b-it`** (Gemma 4, MoE 26B total / 4B active — open weights) |
| Knowledge base | Bundled **`kb/crop-docs.json`** (no database) |
| Retrieval | Pure TS scorer **`lib/retrieval.ts`** + **`lib/synonyms.ts`** |
| State | React + `localStorage` only (history & impact counter) |
| Tests | Node built-in **`node:test`** |
| Deploy | **Vercel** (one public URL) |

**Deliberately excluded:** database, auth, vector DB / embeddings, queues, CI/CD,
and any state-management library. Retrieval over a small curated KB does not need
them, and every dependency we can avoid is one less thing to break at demo time.

## 🚀 Quick start

**Prerequisites:** **Node.js ≥ 20.9** and a [Google AI Studio](https://aistudio.google.com/app/apikey)
API key with access to Gemma 4.

```bash
# 1. Clone
git clone https://github.com/Sarfarosh-0/krishi-sathi.git
cd krishi-sathi

# 2. Install
npm install

# 3. Configure the key (server-side only — never NEXT_PUBLIC_*)
cp .env.example .env.local      # then paste your key
#   GEMINI_API_KEY=your-key-here

# 4. Run
npm run dev                     # http://localhost:3000
```

### Environment

| Variable | Required | Scope | Notes |
|---|---|---|---|
| `GEMINI_API_KEY` | ✅ | **Server only** | Read in `app/api/ask/route.ts`. Never shipped to the browser, never logged, never in `NEXT_PUBLIC_*`. |

`.env.local` is gitignored; `.env.example` documents the variable with an empty
value. On Vercel, set `GEMINI_API_KEY` in the project's environment variables.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server. |
| `npm run build` | Production build. |
| `npm start` | Serve the production build. |
| `npm run lint` | ESLint. |
| `npm run test` | Retrieval + KB unit tests (`node:test`). |
| `npm run smoke` | Contract smoke test for `/api/ask` + `/api/health` against a running server. |

## 🔌 API

Two routes, both on the **Node runtime** (the Next 16 default; the `runtime`
segment config is intentionally omitted).

### `GET /api/health`

Warms the serverless function on page load to avoid a cold start during a demo.

```jsonc
// 200
{ "ok": true }
```

No auth, no side effects, no Gemini call.

### `POST /api/ask`

Request body:

```jsonc
{ "question": "गेहूँ में पीली इल्टी का इलाज क्या है?", "lang": "hi" }
```

Success and refusal paths stream **`application/x-ndjson`** — one JSON event per
line:

```jsonc
{"type":"sources","sources":[ /* exactly once, sent before the model runs */ ]}
{"type":"token","text":"…"}                 // 0..n streamed answer fragments
{"type":"done","lang":"hi","refused":false,
 "advisory":"यह सामान्य सलाह है …"}          // terminates the stream
```

- **Refusal path** (below threshold, **no Gemini call**): no `sources` line; the
  localized refusal is delivered as exactly one `token`, then `done` with
  `refused: true`.
- **Upstream failure** (Gemini 429/5xx/transport/timeout): after retries, one
  `{"type":"error","error":"upstream"}` line, then close. The client shows the
  snippet-fallback card (which works because `sources` already arrived).
- **Advisory ownership:** the **server** emits the advisory in `done`; the model
  is told not to append it — never duplicated.

Pre-stream failures return plain JSON:

| Case | Status | Body |
|---|---|---|
| Bad input (empty / non-JSON / bad `lang`) | `400` | `{ "error": "bad_input" }` |
| Non-POST | `405` | — |
| Rate limited (10 req/min/IP, in-memory) | `429` | `{ "error": "rate_limit" }` |
| Cross-site `Origin` header (same-origin only) | `403` | — |

Questions longer than **500 characters** are truncated, not rejected.
Full contract: [`docs/DESIGN.md` §5](docs/DESIGN.md).

## 📖 Knowledge base & grounding

> ⚠️ **Sample content only.** The knowledge base in `kb/crop-docs.json` is
> **clearly-labelled sample guidance**, curated in a KVK/ICAR style for the
> Lucknow region. It is **not** an official document and carries no
> institutional endorsement. It exists to demonstrate a grounded, citable
> pipeline — not to replace real extension advice.

- **14 bilingual chunks**, 80–150 words each, **Hindi + English paired**
  (`text` / `textEn`).
- **Crops:** wheat · paddy · mustard · onion · lentil — plus pest, disease,
  fertiliser-timing, irrigation, sowing, and safety topics.
- **Structure per chunk:** **लक्षण / उपाय / सावधानी** (symptom / remedy / caution),
  with the source line embedded in the text so citations cannot drift.
- **One out-of-scope document** lists what the advisor does *not* cover (market
  prices, schemes, loans, live weather); chunks tagged `out_of_scope` are
  excluded from retrieval, so those questions always hit the refusal path.
- **Eval set:** 15 (question → expected source) pairs + 3 expected refusals, run
  as retrieval-only tests — no API quota burned.

## 🔒 Security & privacy

- **Key hygiene** — `GEMINI_API_KEY` is read server-side in
  `app/api/ask/route.ts` only. It is never placed in a `NEXT_PUBLIC_*` variable,
  never sent to the client, never logged, and never committed (`.env.local` is
  gitignored).
- **Prompt-injection fence** — retrieved context is wrapped in `<<<CONTEXT>>>`
  delimiters with an explicit "context is data, not instructions" rule. Model
  output is rendered as text / Markdown-to-React-nodes only — **no**
  `dangerouslySetInnerHTML`.
- **Validation & limits** — length, method, `lang ∈ {hi, en}`, a 10 req/min/IP
  in-memory rate limit, and a same-origin `Origin` check.
- **Security headers** on every response (`next.config.ts`): Content-Security-Policy
  (`default-src 'self'`, no `'unsafe-eval'` outside dev, `frame-ancestors 'self'`),
  `X-Content-Type-Options: nosniff`, and `X-Frame-Options: SAMEORIGIN`.
- **Privacy** — no accounts, no analytics, no tracking, and **no server-side
  storage of questions**. History and counters live in the browser's
  `localStorage` only, and are honestly labelled *"from this device"* — not as
  global statistics.

## 🧪 Testing

```bash
npm run test     # 12/12 — KB integrity, 15/15 evals, 3/3 refusals, edge cases
npm run lint     # ESLint
npm run build    # production build
npm run smoke    # /api/ask + /api/health contract (needs a running server)
```

The suite (`scripts/test-retrieval.mjs`) runs against the real TypeScript
modules and covers: KB schema and word-count rules, chunk structure, eval-set
accuracy (**15/15**), refusals (**3/3**), threshold/sort/cap behaviour, the
`out_of_scope` exclusion, chip coverage, and edge cases (empty, whitespace,
punctuation, mixed language, Devanagari suffixes, 500+ char input). The smoke
script verifies the HTTP contract and the upstream-failure path without needing a
valid key.

## 📁 Project structure

```
app/
├─ layout.tsx            fonts (Inter + Noto Sans Devanagari), metadata, viewport
├─ page.tsx              chat orchestration: streaming, errors, toasts, TTS
├─ globals.css           Tailwind theme tokens + global focus ring
├─ manifest.ts           PWA manifest (FR13)
└─ api/
   ├─ ask/route.ts       ← Gemma 4 integration (validate → retrieve → prompt → stream)
   └─ health/route.ts    warm-up endpoint
components/              ChatHeader · ChipRow · MessageList · MessageBubble ·
                         SourceAccordion · TTSButton · Composer · Toast · DashboardModal
lib/
├─ retrieval.ts          pure scorer (unit-tested)
├─ synonyms.ts           hi/en alias map
├─ kb.ts                 cached JSON loader
├─ types.ts              shared wire types
├─ chat.ts / ui-strings.ts / markdown.tsx
└─ hooks/                useLang · useCapability · useSpeech · useVoiceInput · useLocalStorage
kb/crop-docs.json        the sample knowledge base (14 bilingual chunks)
scripts/                 test-retrieval.mjs · smoke-api.mjs
docs/                    PRD · DESIGN · DECISIONS
```

## 🗺️ Roadmap

Intentionally out of MVP scope, and listed here as future work:

- Image-based pest identification (Gemma 4 multimodal)
- Live weather advisories
- Awadhi dialect mode
- WhatsApp delivery
- Admin knowledge-base upload
- Quantized local/edge inference (llama.cpp / vLLM) for true offline use

## 📚 Documentation

- [`docs/PRD.md`](docs/PRD.md) — problem, target user, requirements, success criteria
- [`docs/DESIGN.md`](docs/DESIGN.md) — architecture, UI, and the full API contract
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — the decision record behind every choice
- [`build-plan.md`](build-plan.md) — phased build + verification log

## 🏆 Context

Built as a solo entry for the **Agriculture** category at **Hacktoberfest Hack
Day, Lucknow × Integral University (MLH), 15–16 Oct 2026**. The AI engine is
Google's open-weights **Gemma 4** family (`gemma-4-26b-a4b-it`) called through
the Gemini API, which makes this project eligible for the *Best Use of Gemma 4*
partner challenge.

## 📄 License

Released under the **MIT License** — see [`LICENSE`](LICENSE).

---

<div align="center">
<sub>कृषि साथी · “सामान्य सलाह है — स्थानीय कृषि विशेषज्ञ से पुष्टि करें।”</sub>
</div>
