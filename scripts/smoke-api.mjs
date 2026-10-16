/**
 * Phase 3 smoke test for the /api/ask + /api/health contract (DESIGN §5).
 *
 * Point it at a running server (default http://localhost:3000):
 *   npm run dev                                   # in one shell
 *   node scripts/smoke-api.mjs                    # in another
 *
 * Upstream-failure drill (no real Gemini call, no key needed):
 *   $env:GEMINI_API_KEY="invalid"; npx next dev --port 3001
 *   $env:SMOKE_BASE_URL="http://localhost:3001"; $env:SMOKE_BROKEN_KEY="1"
 *   node scripts/smoke-api.mjs
 *
 * Costs at most one real Gemini call (the success path). Every other check is
 * either rejected before any upstream call or is a deterministic refusal.
 * Prints no key material.
 */
const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const BROKEN_KEY = process.env.SMOKE_BROKEN_KEY === "1";

// The server-owned strings from DESIGN §5. Asserted verbatim: they must never
// come from the model, and must never be duplicated.
const REFUSAL = {
  hi: "मुझे इस सवाल का जवाब अपनी जानकारी में नहीं मिला। कृषि विज्ञान केंद्र (KVK) या स्थानीय कृषि विभाग से संपर्क करें।",
  en: "I could not find an answer to this question in my knowledge base. Please contact your local Krishi Vigyan Kendra (KVK) or agriculture department.",
};
const ADVISORY = {
  hi: "यह सामान्य सलाह है — स्थानीय कृषि विशेषज्ञ से पुष्टि करें।",
  en: "This is general advice — please confirm with a local agriculture expert.",
};

const REFUSAL_Q = "मछली पालन की लागत कितनी होती है?"; // evals r01
const ANSWER_Q = "गेहूँ में पीली इल्टी का इलाज क्या है और खाद कब डालें?"; // evals e01 + e04
const LONG_Q = "मछली पालन की लागत कितनी होती है?".repeat(30); // > 500 chars

let passed = 0;
let failed = 0;
let skipped = 0;

function check(name, ok, detail = "") {
  if (ok) {
    passed += 1;
    console.log(`PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${name}${detail ? `  →  ${detail}` : ""}`);
  }
}

function skip(name, detail = "") {
  skipped += 1;
  console.log(`SKIP  ${name}${detail ? `  →  ${detail}` : ""}`);
}

/** POST /api/ask and collect NDJSON events as they stream in. */
async function ask(question, lang = "hi") {
  const started = Date.now();
  const res = await fetch(`${BASE}/api/ask`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question, lang }),
  });
  const contentType = res.headers.get("content-type") ?? "";

  if (!res.body || !contentType.includes("x-ndjson")) {
    return { res, contentType, events: null, raw: await res.text(), ms: Date.now() - started, firstMs: null };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const events = [];
  let raw = "";
  let buffer = "";
  let firstMs = null;

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    raw += chunk;
    buffer += chunk;
    let nl = buffer.indexOf("\n");
    while (nl !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) {
        if (firstMs === null) firstMs = Date.now() - started;
        events.push(JSON.parse(line));
      }
      nl = buffer.indexOf("\n");
    }
  }

  return { res, contentType, events, raw, ms: Date.now() - started, firstMs };
}

const types = (events) => (events ?? []).map((e) => e.type);

// --------------------------------------------------------------------- health

const health = await fetch(`${BASE}/api/health`);
const healthBody = await health.json().catch(() => null);
check(
  "GET /api/health → 200 { ok: true }",
  health.status === 200 && healthBody?.ok === true,
  `status=${health.status} body=${JSON.stringify(healthBody)}`
);

// ------------------------------------------------------- pre-stream rejections

const getAsk = await fetch(`${BASE}/api/ask`);
check("non-POST (GET) → 405", getAsk.status === 405, `status=${getAsk.status}`);

const badJson = await fetch(`${BASE}/api/ask`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: "{not json",
});
const badJsonBody = await badJson.json().catch(() => null);
check(
  "unparseable JSON → 400 bad_input",
  badJson.status === 400 && badJsonBody?.error === "bad_input",
  `status=${badJson.status} body=${JSON.stringify(badJsonBody)}`
);

async function expectBadInput(label, payload) {
  const res = await fetch(`${BASE}/api/ask`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => null);
  check(label, res.status === 400 && body?.error === "bad_input", `status=${res.status} body=${JSON.stringify(body)}`);
}

await expectBadInput("empty question → 400 bad_input", { question: "   ", lang: "hi" });
await expectBadInput("missing question → 400 bad_input", { lang: "hi" });
await expectBadInput("bad lang → 400 bad_input", { question: "गेहूँ में खाद कब डालें?", lang: "fr" });

// Oversized body is rejected before parsing (route MAX_BODY_BYTES = 8 KB).
const oversized = await fetch(`${BASE}/api/ask`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ question: "a".repeat(9000), lang: "hi" }),
});
check(
  "oversized body → 413 bad_input",
  oversized.status === 413,
  `status=${oversized.status}`
);

// ------------------------------------------------------------- refusal paths

const longRes = await ask(LONG_Q, "hi");
check(
  ">500-char question is truncated, not rejected",
  longRes.res.status === 200 && types(longRes.events).includes("done"),
  `status=${longRes.res.status} events=${types(longRes.events).join(",")}`
);

const refusalHi = await ask(REFUSAL_Q, "hi");
const refusalEvents = refusalHi.events ?? [];
const refusalToken = refusalEvents.find((e) => e.type === "token");
const refusalDone = refusalEvents.find((e) => e.type === "done");

check(
  "refusal: streams one token line with the server refusal text",
  refusalToken?.text === REFUSAL.hi,
  `token=${JSON.stringify(refusalToken?.text)?.slice(0, 40)}`
);
check(
  "refusal: no sources line",
  !types(refusalEvents).includes("sources"),
  `events=${types(refusalEvents).join(",")}`
);
check(
  "refusal: done { refused: true } + localized advisory",
  refusalDone?.refused === true && refusalDone?.advisory === ADVISORY.hi && refusalDone?.lang === "hi",
  `done=${JSON.stringify(refusalDone)}`
);
// A real Gemini round trip measures 15-33s. A sub-2s refusal proves the
// threshold check short-circuited before any upstream call.
check(
  "refusal: made zero Gemini calls (sub-2s, no upstream latency)",
  refusalHi.ms < 2000,
  `took ${refusalHi.ms}ms`
);

const refusalEn = await ask(REFUSAL_Q, "en");
const refusalEnDone = (refusalEn.events ?? []).find((e) => e.type === "done");
check(
  "refusal: lang=en returns the English refusal + advisory",
  refusalEnDone?.refused === true && refusalEnDone?.advisory === ADVISORY.en && refusalEn?.events?.some((e) => e.type === "token" && e.text === REFUSAL.en),
  `done=${JSON.stringify(refusalEnDone)}`
);

// ------------------------------------------------------------ success / upstream

if (BROKEN_KEY) {
  const broken = await ask(ANSWER_Q, "hi");
  const errorEvent = (broken.events ?? []).find((e) => e.type === "error");
  check(
    "upstream drill (invalid key): one error line, error=upstream",
    broken.res.status === 200 && errorEvent?.error === "upstream",
    `status=${broken.res.status} events=${types(broken.events).join(",")}`
  );
  check(
    "upstream drill: Gemini error is never surfaced verbatim",
    !/API key|API_KEY|invalid|permission|quota/i.test(broken.raw),
    "raw body leaked upstream wording"
  );
  check(
    "upstream drill: refusals still work with a broken key (zero-call proof)",
    (await ask(REFUSAL_Q, "hi")).events?.some((e) => e.type === "token" && e.text === REFUSAL.hi) === true
  );
} else {
  const answer = await ask(ANSWER_Q, "hi");
  const events = answer.events ?? [];
  const kinds = types(events);
  const sourcesEvent = events.find((e) => e.type === "sources");
  const doneEvent = events.find((e) => e.type === "done");

  check("success: content-type is application/x-ndjson", answer.contentType.includes("x-ndjson"), answer.contentType);

  // DESIGN §5: exactly one terminating line may end the stream.
  const terminators = kinds.filter((t) => t === "done" || t === "error").length;
  check(
    "stream: exactly one terminating line (done XOR error)",
    terminators === 1,
    `terminators=${terminators} kinds=${kinds.join(",")}`
  );

  // The pinned model returns fast 5xx a lot — reproducible with the plain SDK
  // outside this app. When every retry failed, the contract still requires:
  // sources delivered before the failure, and exactly one error line.
  const outage = !doneEvent && kinds.includes("error");
  if (outage) {
    check(
      "upstream outage: sources delivered before the failure, exactly one error line",
      sourcesEvent?.sources?.length >= 1 && kinds.filter((t) => t === "error").length === 1,
      kinds.join(",")
    );
    skip("success-path assertions", "vendor 5xx on all attempts — re-run to exercise");
  } else {
    const tokenCount = kinds.filter((t) => t === "token").length;
    const advisoryCount = (
      answer.raw.match(new RegExp(ADVISORY.hi.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []
    ).length;

    check("success: ≥1 token line", tokenCount >= 1, `tokens=${tokenCount}`);
    check(
      "success: sources line carries 1-3 KB sources with id/title/text",
      sourcesEvent?.sources?.length >= 1 &&
        sourcesEvent.sources.length <= 3 &&
        sourcesEvent.sources.every((s) => s.id && s.title && s.text),
      `sources=${sourcesEvent?.sources?.map((s) => s.id).join("|")}`
    );
    check(
      "success: done { refused: false } + localized advisory",
      doneEvent?.refused === false && doneEvent?.advisory === ADVISORY.hi && doneEvent?.lang === "hi",
      `done=${JSON.stringify(doneEvent)?.slice(0, 80)}`
    );
    check("success: sources precedes done", kinds.lastIndexOf("sources") < kinds.lastIndexOf("done"), kinds.join(","));
    check("success: no error line", !kinds.includes("error"), kinds.join(","));
    check("success: advisory appears exactly once (not duplicated by the model)", advisoryCount === 1, `count=${advisoryCount}`);

    // Join the tokens first: a chunk id can straddle two token events.
    const answerText = events
      .filter((e) => e.type === "token")
      .map((e) => e.text)
      .join("");
    check(
      "success: model cited a retrieved chunk id",
      sourcesEvent?.sources?.some((s) => answerText.includes(s.id)),
      `text=${JSON.stringify(answerText).slice(0, 120)}`
    );
    console.log(`      (answer latency: first event ${answer.firstMs}ms, total ${answer.ms}ms)`);
  }
}

// ------------------------------------------------------------------- no leaks

const leakProbe = await ask(REFUSAL_Q, "hi");
check(
  "no response leaks key material or env names",
  !/AIza|GEMINI_API_KEY|api[_-]?key/i.test(leakProbe.raw + (healthBody ? JSON.stringify(healthBody) : "")),
  "found key-ish string in a response body"
);

// --------------------------------------------------------------- rate limit

// Must run last: once the per-IP window fills up, every later call is a 429.
let limited = null;
let attempts = 0;
while (limited === null && attempts < 14) {
  attempts += 1;
  const res = await fetch(`${BASE}/api/ask`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question: REFUSAL_Q, lang: "hi" }),
  });
  if (res.status === 429) {
    limited = { status: res.status, body: await res.json().catch(() => null) };
  }
}
check(
  "rate limit: burst hits 429 { error: rate_limit }",
  limited?.status === 429 && limited?.body?.error === "rate_limit",
  `attempts=${attempts} status=${limited?.status} body=${JSON.stringify(limited?.body)}`
);

// --------------------------------------------------------------------- summary

console.log(
  `\n${passed} passed, ${failed} failed, ${skipped} skipped  (mode: ${
    BROKEN_KEY ? "upstream drill" : "normal"
  }, base: ${BASE})`
);
process.exit(failed === 0 ? 0 : 1);
