# DESIGN.md — Krishi Sathi (कृषि साथी)

**Visual & technical design companion to `docs/PRD.md`.**
Style decision: **clean agritech-minimal** — high-contrast cards, agri-green
primary, big tap targets, no blur/transparency (readable outdoors, fast on
low-end phones). A single **green→amber gradient** is used on the header/hero
only for demo flair; surfaces stay solid.

---

## 1. Wireframes

### 1.1 Chat screen (desktop ≥ 768px, centered column max-w-3xl)

```
┌──────────────────────────────────────────────────────────────┐
│ ▓▓ HEADER (green→amber gradient) ▓▓                          │
│  🌱 कृषि साथी        [हिं | EN]      [dashboard icon]        │
│  छोटे किसानों के लिए AI सलाहकार                             │
├──────────────────────────────────────────────────────────────┤
│ ┌ CHIPS (horizontally scrollable) ────────────────────────┐  │
│ │ [गेहूँ: पीली इल्टी] [सरसों: खाद] [धान: सिंचाई] [＋4]    │  │
│ └─────────────────────────────────────────────────────────┘  │
│                                                              │
│   ┌ user bubble (right, green) ─┐                            │
│   │ गेहूँ में पीली इल्टी का इलाज? │                           │
│   └─────────────────────────────┘                            │
│   ┌ assistant bubble (left, white card, shadow) ──────────┐  │
│   │ **लक्षण:** … **उपाय:** … **सावधानी:** …               │  │
│   │ यह सामान्य सलाह है — स्थानीय कृषि विशेषज्ञ से पुष्टि…  │  │
│   │ [📎 wheat_pest_yellow_stem_borer] [🔊 सुनें]          │  │
│   │ ▸ (expanded) full source text…                        │  │
│   └───────────────────────────────────────────────────────┘  │
│                                                              │
│ ┌ COMPOSER (sticky bottom) ───────────────────────────────┐  │
│ │ [🎤] [ अपना सवाल लिखें…                    ] [➤ भेजें ]  │  │
│ └─────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### 1.2 Refusal card (out-of-KB, e.g. chip #8)

```
┌─ assistant card (amber border, cream bg) ───────────────────┐
│ ⚠️ मुझे इस सवाल का जवाब अपनी जानकारी में नहीं मिला।        │
│ कृषि विज्ञान केंद्र (KVK) या स्थानीय कृषि विभाग से        │
│ संपर्क करें।                                                │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 Dashboard modal (two tabs)

```
┌─ कृषि साथी · डैशबोर्ड (modal, max-w-lg) ────────────────────┐
│ [ इस डिवाइस का प्रभाव ]   [ इतिहास ]                       │
│                                                              │
│  सवाल पूछे: 12      जवाब मिले: 9      नहीं मिला: 3          │
│  ─────────────────────────────────────────                   │
│  ज्ञान कक्षा: 5 फसलें · 14 दस्तावेज़ · 2 भाषाएँ             │
│  (सभी आँकड़े इसी डिवाइस से — कोई डेटा बाहर नहीं जाता)       │
│                                                              │
│  इतिहास:                                                     │
│  ┌ 12 Oct · गेहूँ में पीली इल्टी…            [✖] ┐          │
│  ┌ 12 Oct · सरसों में खाद कब…                [✖] ┐          │
│                                          [सब हटाएँ]         │
└──────────────────────────────────────────────────────────────┘
```

### 1.4 Mobile (< 768px)
Same single column at full width; chips scroll; composer fixed to bottom with
`env(safe-area-inset-bottom)`; header compresses to title + toggle icon.

---

## 2. Design tokens (Tailwind theme)

### Color

| Token | Hex | Use |
|---|---|---|
| `--primary` | `#16A34A` (green-600) | buttons, user bubble, links |
| `--primary-dark` | `#15803D` | hover/pressed |
| `--soil` | `#8B5A2B` | secondary accents, icons |
| `--harvest` | `#F59E0B` (amber-500) | refusal card, highlights |
| `--cream` | `#FAF7F2` | page background |
| `--surface` | `#FFFFFF` | cards, assistant bubble |
| `--ink` | `#1C1917` (stone-900) | body text (max contrast) |
| `--muted` | `#78716C` (stone-500) | timestamps, meta |
| `--danger` | `#DC2626` | network toast only (never refusal) |
| header gradient | `linear-gradient(90deg,#16A34A,#F59E0B)` | **header only** |

Rules: no `backdrop-filter`, no translucent surfaces, body text ≥ 4.5:1 contrast,
refusal = amber/cream (**never red**).

### Typography

- **Devanagari:** `Noto Sans Devanagari` (Google Fonts, `next/font`).
- **Latin:** `Inter`.
- Base 16px; answers 17px; line-height 1.6 (Hindi needs air).
- `lang` attribute set correctly per text block for correct font shaping.

### Shape & spacing

- Radius: cards/chips `12px`, buttons `10px`, bubbles `16px` (one corner squared).
- Shadow: `0 1px 3px rgb(0 0 0 / 0.08), 0 4px 12px rgb(0 0 0 / 0.05)` — subtle.
- 8px spacing grid; tap targets ≥ 48×48px (farmers, outdoors, one thumb).

---

## 3. Component tree

```
app/layout.tsx                  fonts, metadata, PWA manifest link
app/page.tsx                    (client) composition + orchestration
├─ ChatHeader                   title, gradient bg, lang toggle, dashboard btn
├─ ChipRow                      8 chips, scrollable
├─ MessageList                  scroll container
│  └─ MessageBubble             user | assistant | refusal variants
│     ├─ SourceAccordion        expandable source text (Lucide ChevronDown)
│     ├─ TTSButton              🔊 सुनें / रोकें (speechSynthesis)
│     └─ (streaming caret)
├─ Composer                     VoiceButton (Mic), textarea, SendButton
├─ DashboardModal               tabs: ImpactPanel | HistoryPanel
└─ Toast                        offline / rate-limit notices

lib/
├─ retrieval.ts                 scoring (pure, unit-tested)
├─ synonyms.ts                  hi/en alias map
├─ kb.ts                        JSON loader + module-scope cache
├─ types.ts                     shared types (below)
└─ hooks/useLocalStorage.ts     SSR-safe try/catch persistence
```

`SpeechRecognition`/`speechSynthesis` accessed via capability checks — controls
hidden (not disabled) when unsupported.

---

## 4. Shared TypeScript types (`lib/types.ts`)

```ts
export type Lang = "hi" | "en";

export interface AskRequest { question: string; lang: Lang; }

// Non-streaming JSON body — used only for failures detected before streaming
// starts (400 bad input, 405 method, 429 rate limit).
export interface AskErrorBody {
  error: "rate_limit" | "bad_input";
}

// Streaming protocol: POST /api/ask responds with application/x-ndjson.
// Exactly one `done` OR one `error` line terminates the stream; the client
// must tolerate a stream ending without either (treat as "upstream").
export type StreamEvent =
  | { type: "token"; text: string }        // incremental answer text (**bold** / - bullets)
  | { type: "sources"; sources: KBSource[] }
  | { type: "done"; lang: Lang; refused: boolean; advisory: string }
  | { type: "error"; error: "upstream" };

export interface KBSource { id: string; title: string; text: string; }

export interface KBChunk {
  id: string; title: string; titleEn: string;
  crop: string[]; season: "rabi" | "kharif" | "zaid" | "any";
  tags: string[]; text: string; textEn: string;
  source: string; priority: number;
}

export interface HistoryEntry {
  id: string; q: string; answer: string;
  sources: string[]; lang: Lang; ts: number; refused: boolean;
}

export interface ImpactStats {
  asked: number; answered: number; refused: number; lastTs: number | null;
}
```

---

## 5. API contract

Two routes, both Node runtime (`export const runtime = "nodejs"`).

### `GET /api/health`

Warms the serverless function on page load (cold-start mitigation, PRD §9).
Response: `200 { "ok": true }`. No auth, no side effects, no Gemini call.

### `POST /api/ask`

**Streaming (NDJSON).** Success and refusal paths stream
`application/x-ndjson`, one JSON event per line, in this order:

```
{"type":"token","text":"गेहूँ में पीली इल्टी…"}   ← 0..n lines (streamed from Gemma)
{"type":"sources","sources":[…]}                   ← exactly once, before done
{"type":"done","lang":"hi","refused":false,
 "advisory":"यह सामान्य सलाह है…"}                 ← terminates stream
```

- **Refusal (below threshold, no Gemini call):** zero `token` lines; single
  `sources` line is omitted (`sources: []`); `done` has `refused: true` and the
  localized refusal message is delivered as one `token` line before `done`.
- **Advisory ownership:** the **server** emits the advisory (localized per
  `lang`) as part of `done`; the prompt instructs the model **not** to append it
  — never duplicated.
- **Upstream failure mid-stream** (Gemini timeout/429/5xx after headers sent):
  one `{"type":"error","error":"upstream"}` line, then close. Client shows the
  snippet-fallback card from whatever `sources`/`token` lines arrived.
- **Stream ends without `done`/`error`** (network drop): client treats as
  `upstream` error.
- Each line is a single `\n`-terminated JSON object; no other framing.

**Failures detected before streaming starts** return plain JSON:

| Case | Status | Body |
|---|---|---|
| Bad input (empty / non-JSON / question > 500 chars untruncatable / bad `lang`) | 400 | `AskErrorBody` (`bad_input`) |
| Non-POST | 405 | `AskErrorBody`-shaped or empty |
| Rate limited (10 req/min/IP, in-memory, **best-effort per serverless instance** — not global) | 429 | `AskErrorBody` (`rate_limit`) |

Rules: client never sees Gemini errors verbatim (only `"upstream"`); the refusal
threshold check runs **before** any Gemini call; the scope-documentation chunk
(`out_of_scope` tag in `kb/crop-docs.json`) is excluded from retrieval
candidates, so the topics it lists — prices, schemes, loans, weather — always
fall to the deterministic refusal path instead of being answered; server-side
rate limiting is per-instance and approximate by design (no Redis — see
AGENTS #11); advisory text lives only in server code, never in the model prompt
output.

Localized server strings (`lang: "hi" | "en"`):

| String | hi | en |
|---|---|---|
| Refusal | मुझे इस सवाल का जवाब अपनी जानकारी में नहीं मिला। कृषि विज्ञान केंद्र (KVK) या स्थानीय कृषि विभाग से संपर्क करें। | I could not find an answer to this question in my knowledge base. Please contact your local Krishi Vigyan Kendra (KVK) or agriculture department. |
| Advisory | यह सामान्य सलाह है — स्थानीय कृषि विशेषज्ञ से पुष्टि करें। | This is general advice — please confirm with a local agriculture expert. |
| Upstream fallback note | जवाब तैयार नहीं हो सका। नीचे ज्ञान-कोश से मिली जानकारी दी गई है। | Could not generate an answer. Below is what I found in the knowledge base. |
| Rate-limit toast | थोड़ा रुकिए, फिर कोशिश करें। | Please wait a moment and try again. |
| Offline toast | कनेक्शन नहीं, दोबारा कोशिश करें। | No connection — please try again. |

Client-side UI strings (placeholder, send, chips, dashboard labels) live in the
localized strings object built in Phase 4 — same table format, hi + en.

---

## 6. State model

| State | Where | Notes |
|---|---|---|
| Messages (session) | React state (`useState`) | reset on refresh |
| Streaming partial | ref + state | appended tokens render live |
| `lang` | state (+ localStorage mirror) | persists across visits |
| History / impact | localStorage (`ks:*` keys) | cap 50, try/catch, clear-all |
| Loading / mic-active / TTS-playing | local component state | disable send while loading |
| KB, synonyms, rate-limit counters | server (module scope) | never sent to client except top-3 sources |

**No other state exists** — no global store, no server-side user data.

---

## 7. Interaction rules

- **Streaming:** tokens append to the active bubble; scroll pins to bottom;
  composer disabled until done; "रोकें" (stop) button aborts via `AbortController`.
- **Loading:** send button → spinner; chips dimmed (not hidden).
- **TTS:** `speechSynthesis` with `lang="hi-IN"` (or `en-IN`); button toggles
  सुनें ⇄ रोकें; auto-cancel on new answer; hidden if unsupported.
- **Voice input:** `webkitSpeechRecognition` `hi-IN`, interim results shown in
  textarea; auto-submit off (farmer confirms with ➤); hidden if unsupported.
- **Language toggle:** swaps UI strings + future reply language instantly;
  past messages keep their language (each stores its `lang`).
- **Source chips:** tap expands full chunk inline (accordion), one open at a time.
- **Refusal:** amber card + referral text; impact counter increments `refused`.
- **Errors:** rate-limit → amber toast "थोड़ा रुकिए…"; offline → red toast
  "कनेक्शन नहीं, दोबारा कोशिश करें"; upstream → snippet-fallback card + retry button.
- **A11y:** labels on all icon buttons, focus rings, `aria-live="polite"` on the
  message list, correct `lang` attributes, keyboard-submittable composer.

---

*Companions: `docs/PRD.md` (requirements), `docs/DECISIONS.md` (why).*
