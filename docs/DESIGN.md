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
app/layout.tsx                  fonts, metadata, viewport (safe-area), manifest link
app/page.tsx                    (client) composition + streaming orchestration
├─ ChatHeader                   title, gradient bg, lang toggle, dashboard btn
├─ ChipRow                      8 chips, scrollable
├─ MessageList                  scroll container (aria-live, bottom-pinned)
│  └─ MessageBubble             user | answer | refusal | upstream | stopped
│     ├─ SourceAccordion        expandable source text (Lucide ChevronDown)
│     ├─ TTSButton              🔊 सुनें / रोकें (speechSynthesis)
│     └─ (thinking row / streaming caret)
├─ Composer                     Mic button, textarea, Send ⇄ Stop
├─ Toast                        offline / rate-limit notices (role="status")
└─ DashboardModal               ⏳ Phase 5 — not built yet (header button is a stub)

lib/
├─ retrieval.ts                 scoring (pure, unit-tested)
├─ synonyms.ts                  hi/en alias map
├─ kb.ts                        JSON loader + module-scope cache
├─ types.ts                     shared types (below) — the wire contract
├─ chat.ts                      client-only chat model (ChatMessage, MessageStatus)
├─ markdown.tsx                 renderAnswer (Markdown→React nodes) + toSpeechText
├─ ui-strings.ts                UIStrings / UI_STRINGS (hi+en) + the 8 CHIPS
└─ hooks/
   ├─ useLang.ts                lang + localStorage mirror (key `ks:lang`)
   ├─ useCapability.ts          SSR-safe capability probe: null → client boolean
   ├─ useSpeech.ts              speechSynthesis wrapper (FR8)
   ├─ useVoiceInput.ts          webkitSpeechRecognition wrapper (FR9)
   └─ useLocalStorage.ts        ⏳ Phase 5 — history/impact persistence
```

`SpeechRecognition`/`speechSynthesis` are accessed via capability checks
(`useCapability`) — controls are hidden (not disabled) when unsupported, and
never render on the server or during the first hydration pass (`supported` is
`null`), so there is no hydration mismatch and no crash where the API is
missing.

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

Two routes, both on the Node runtime — the Next 16 default. The `runtime` segment
config is deliberately **not** exported: `cacheComponents` is enabled in
`next.config.ts` and Next 16 rejects it at build time (the Edge runtime is
deprecated anyway).

### `GET /api/health`

Warms the serverless function on page load (cold-start mitigation, PRD §9).
Response: `200 { "ok": true }`. No auth, no side effects, no Gemini call.

### `POST /api/ask`

**Streaming (NDJSON).** Success and refusal paths stream
`application/x-ndjson`, one JSON event per line, in this order:

```
{"type":"sources","sources":[…]}                   ← exactly once, first (before the model runs)
{"type":"token","text":"गेहूँ में पीली इल्टी…"}   ← 0..n lines (streamed from Gemma)
{"type":"done","lang":"hi","refused":false,
 "advisory":"यह सामान्य सलाह है…"}                 ← terminates stream
```

`sources` goes out **before** the model call on purpose: the pinned model fails
intermittently, and the snippet-fallback card below can only show something if
the sources already reached the client.

- **Refusal (below threshold, no Gemini call):** no `sources` line at all; the
  localized refusal message is delivered as **exactly one** `token` line, then
  `done` with `refused: true` and the localized advisory. No model-generated
  tokens, because no model call happens.
- **Advisory ownership:** the **server** emits the advisory (localized per
  `lang`) as part of `done`; the prompt instructs the model **not** to append it
  — never duplicated.
- **Upstream failure** (Gemini 429/5xx/transport/timeout): the route retries, but
  **only** while no `token` line has been sent, the error looks transient, and the
  55 s deadline still leaves room for another attempt. The pinned model returns
  fast 5xx often, so retries are cheap and materially improve reliability. If
  every attempt fails: one `{"type":"error","error":"upstream"}` line, then close.
  The client shows the snippet-fallback card — which works because `sources`
  already arrived.
- **Stream ends without `done`/`error`** (network drop): client treats as
  `upstream` error.
- Each line is a single `\n`-terminated JSON object; no other framing.

**Failures detected before streaming starts** return plain JSON:

| Case | Status | Body |
|---|---|---|
| Bad input (empty / non-JSON / missing `question` / bad `lang`) | 400 | `AskErrorBody` (`bad_input`) |
| Non-POST | 405 | `AskErrorBody`-shaped or empty |
| Rate limited (10 req/min/IP, in-memory, **best-effort per serverless instance** — not global) | 429 | `AskErrorBody` (`rate_limit`) |
| Cross-site `Origin` header (the route is same-origin only) | 403 | empty |

Questions longer than 500 characters are **truncated**, not rejected.

**Model constraints (verified against the live API — do not "fix" these):**

- `gemma-4-26b-a4b-it` **rejects `config.systemInstruction`** (500/503), so the
  system rules are folded into `contents`.
- It is a **thinking model** and `thinkingConfig.thinkingBudget` returns
  `400 "Thinking budget is not supported for this model."` — thinking cannot be
  capped, so a real answer takes **15–33 s** (605–1446 thinking tokens).
- Thinking tokens are charged to `maxOutputTokens`, so the cap must be generous
  (2048) or the answer comes back empty.
- The API returns **fast 5xx** intermittently (~1 s per failure, reproducible with
  the plain SDK outside Next, so it is not a bundling issue). Hence the retry
  loop and `export const maxDuration = 60`.

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

### Client UI strings (`lib/ui-strings.ts`, Phase 4)

The client owns only its own chrome copy and never duplicates the server strings
above. `lib/ui-strings.ts` is the source of truth; this table mirrors it.

| Key | hi | en |
|---|---|---|
| `tagline` | छोटे किसानों के लिए AI सलाहकार | AI advisor for smallholder farmers |
| `dashboard` | डैशबोर्ड | Dashboard |
| `dashboardSoon` | डैशबोर्ड जल्द आएगा | Dashboard coming soon |
| `langToggleLabel` | भाषा बदलें | Change language |
| `chipsLabel` | सुझाए गए सवाल | Suggested questions |
| `emptyTitle` | नमस्ते! मैं आपका कृषि सहायक हूँ। | Hello! I'm your farming assistant. |
| `emptyHint` | नीचे कोई सवाल चुनें या अपना सवाल लिखकर भेजें। | Pick a question below or type your own. |
| `placeholder` | अपना सवाल लिखें… | Type your question… |
| `send` | भेजें | Send |
| `stop` | रोकें | Stop |
| `listen` | सुनें | Listen |
| `ttsStop` | रोकें | Stop |
| `ttsUnsupported` | इस ब्राउज़र में आवाज़ में सुनना उपलब्ध नहीं है। | Read-aloud isn't available in this browser. |
| `mic` | आवाज़ से पूछें | Ask with your voice |
| `micStop` | सुनना बंद करें | Stop listening |
| `micListening` | सुन रहा हूँ… | Listening… |
| `micUnsupported` | इस ब्राउज़र में आवाज़ से पूछना उपलब्ध नहीं है — सवाल लिखें। | Voice input isn't available in this browser — please type. |
| `thinking` | सोच रहा हूँ… | Thinking… |
| `sourcesHeading` | स्रोत | Sources |
| `sourceExpand` | पूरा स्रोत देखें | Read full source |
| `sourceCollapse` | स्रोत बंद करें | Hide source |
| `userLabel` | आपका सवाल | Your question |
| `assistantLabel` | कृषि साथी का जवाब | Krishi Sathi's answer |
| `retry` | दोबारा कोशिश करें | Try again |
| `stopped` | जवाब रोक दिया गया। | Answer stopped. |

`upstreamNote`, `rateLimitToast`, and `offlineToast` are the doc/server strings
listed in the table above; the client renders their **server-sent** value.

### Suggested questions (`CHIPS`, FR3)

Eight chips drawn from `docs/DECISIONS.md` §3 — seven are answerable from the
KB; **#8 is deliberately out of scope** so the demo can show the deterministic
refusal path. Each chip carries a full localized `question` (the text actually
sent) in addition to the label below. `scripts/test-retrieval.mjs` asserts that
all seven answerable chips retrieve a chunk and that #8 does not.

| # | id | hi label | en label |
|---|---|---|---|
| 1 | `wheat-borer` | गेहूँ: पीली इल्टी | Wheat: yellow stem borer |
| 2 | `mustard-fertiliser` | सरसों: खाद | Mustard: fertiliser |
| 3 | `paddy-irrigation` | धान: सिंचाई | Paddy: irrigation |
| 4 | `wheat-rust` | गेहूँ: रतुआ | Wheat: rust |
| 5 | `neem-safety` | नीम: सुरक्षा | Neem: spray safety |
| 6 | `pre-rain` | बारिश से पहले | Before rain |
| 7 | `onion-sowing` | प्याज: बुवाई | Onion: sowing |
| 8 | `fish-cost` | मछली पालन: लागत | Fish farming: cost | ← out of KB → refusal |

---

## 6. State model

| State | Where | Notes |
|---|---|---|
| Messages (session) | React state (`useState`) | reset on refresh; `ChatMessage` in `lib/chat.ts` |
| Streaming partial | React state (per message) | tokens appended live; one `AbortController` for the active request |
| **Thinking state** | derived: `status === "streaming" && text === ""` | the assistant bubble shows a spinner + **"सोच रहा हूँ…"** from send until the first token arrives (the pinned model thinks for 15–33 s). The `sources` accordion can already be on screen while this is showing, which is the whole point of emitting `sources` first |
| Draft question | React state (`useState`) | cleared on send; truncated to 500 chars client-side as well |
| `lang` | `useSyncExternalStore` over localStorage `ks:lang` | Hindi default; the document `lang` mirrors it |
| Capability (TTS / voice) | `useSyncExternalStore` probe (`useCapability`) | `null` on the server and the first hydration pass, then a real boolean — no effect, no `setState` |
| Speaking message | React state (message id) | one utterance at a time; `null` = idle |
| Mic active | React state (`useVoiceInput`) | interim transcript is written into the textarea |
| Toast | React state + 6 s timer | rate-limit (amber) / offline (danger) only |
| History / impact | ⏳ localStorage (`ks:*` keys, Phase 5) | cap 50, try/catch, clear-all |
| KB, synonyms, rate-limit counters | server (module scope) | never sent to client except top-3 sources |

**No other state exists** — no global store, no server-side user data.

---

## 7. Interaction rules

- **Send → thinking → stream:** sending appends the user bubble and an empty
  assistant bubble that shows a spinner + "सोच रहा हूँ…". The `sources`
  accordion renders as soon as the `sources` event arrives — *before* any token.
  Tokens then append live with a pulsing caret. The list pins to the bottom
  while streaming unless the farmer scrolls up (within ~80 px).
- **Stop:** while a request is in flight the composer's send button becomes
  "रोकें"; it aborts via `AbortController`. A partial answer is kept and marked
  "जवाब रोक दिया गया।"; an empty placeholder is dropped. Chips are dimmed
  (disabled, not hidden) while loading, as is the textarea.
- **TTS:** `speechSynthesis` with `lang="hi-IN"` (or `en-IN`); the button toggles
  सुनें ⇄ रोकें; a new answer auto-cancels playback; hidden (with a hint) if
  unsupported. It speaks *plain* text — bullet markers, `**`, and the inline
  `[source_id]` citation are stripped (`toSpeechText`), so nothing
  unpronounceable is read aloud.
- **Voice input:** `webkitSpeechRecognition` `hi-IN`, interim results shown in
  the textarea; auto-submit off (the farmer confirms with ➤); hidden (with a
  hint) if unsupported.
- **Language toggle:** swaps UI strings + future reply language instantly
  (persisted to `ks:lang`); past messages keep their language (each stores its
  own `lang`), as do their source text and advisory. Chrome (labels, buttons,
  the "स्रोत / Sources" heading) follows the *current UI* language; message
  content follows the message's own language.
- **Source chips:** tap expands the full chunk inline (accordion), one open at a
  time; the heading shows only when the message has sources.
- **Refusal:** amber card (amber border, cream bg) + referral text, no `sources`
  line, no Gemini call; ⚠️ glyph above the text; never red.
- **Upstream:** snippet-fallback card (amber) + "दोबारा कोशिश करें" retry, which
  re-sends the original question.
- **Errors:** rate-limit (429) → amber toast "थोड़ा रुकिए…"; offline → red toast
  "कनेक्शन नहीं, दोबारा कोशिश करें"; a stream that ends without `done`/`error`
  is treated as upstream.
- **A11y:** labels on all icon buttons, focus rings, `aria-live="polite"` +
  `aria-busy` on the message list, correct `lang` on every text node, and Enter
  sends while Shift+Enter adds a newline (IME composition is ignored, so Hindi
  transliteration is not submitted early).

---

*Companions: `docs/PRD.md` (requirements), `docs/DECISIONS.md` (why).*
