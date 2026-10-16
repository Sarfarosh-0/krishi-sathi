import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
import test from "node:test";

// Let node:test import the real TypeScript modules (see scripts/ts-resolve.mjs)
// instead of duplicating the scorer in JavaScript.
register("./ts-resolve.mjs", import.meta.url);

const { DEFAULT_LIMIT, RETRIEVAL_THRESHOLD, expandQuery, retrieve } = await import(
  "../lib/retrieval.ts"
);

const readJson = (relativePath) =>
  JSON.parse(readFileSync(new URL(relativePath, import.meta.url), "utf8"));

const kb = readJson("../kb/crop-docs.json");
const evals = readJson("../evals/evals.json");
const chunks = kb.chunks;

/** Chunk id retrieval puts first, or undefined when it refuses. */
const topId = (question) => retrieve(question, chunks)[0]?.chunk.id;

// ---------------------------------------------------------------- KB integrity

test("KB: at least 12 chunks, each with complete bilingual metadata", () => {
  assert.ok(chunks.length >= 12, `expected >= 12 chunks, found ${chunks.length}`);

  const ids = new Set();
  for (const chunk of chunks) {
    assert.ok(chunk.id, "every chunk needs an id");
    assert.ok(!ids.has(chunk.id), `duplicate chunk id: ${chunk.id}`);
    ids.add(chunk.id);

    assert.ok(chunk.title && chunk.titleEn, `${chunk.id}: needs Hindi + English title`);
    assert.ok(chunk.text && chunk.textEn, `${chunk.id}: needs Hindi + English text`);
    assert.ok(Array.isArray(chunk.crop), `${chunk.id}: crop must be an array`);
    assert.ok(Array.isArray(chunk.tags) && chunk.tags.length > 0, `${chunk.id}: needs tags`);
    assert.ok(
      ["rabi", "kharif", "zaid", "any"].includes(chunk.season),
      `${chunk.id}: unexpected season "${chunk.season}"`
    );
    assert.ok(chunk.source, `${chunk.id}: needs a source line`);
    assert.equal(typeof chunk.priority, "number", `${chunk.id}: priority must be a number`);
  }
});

test("KB: every chunk is 80-150 words in both languages (PRD §7)", () => {
  const countWords = (value) => value.trim().split(/\s+/).length;
  const flagged = [];
  for (const chunk of chunks) {
    const hi = countWords(chunk.text);
    const en = countWords(chunk.textEn);
    if (hi < 80 || hi > 150 || en < 80 || en > 150) {
      flagged.push(`${chunk.id}: hi=${hi}, en=${en}`);
    }
  }
  assert.deepEqual(flagged, [], `chunks outside the 80-150 word range:\n${flagged.join("\n")}`);
});

test("KB: every answerable chunk follows लक्षण / उपाय / सावधानी and embeds its source", () => {
  for (const chunk of chunks) {
    if (chunk.tags.includes("out_of_scope")) {
      continue; // scope-documentation chunk, not an advisory chunk
    }
    for (const heading of ["लक्षण", "उपाय", "सावधानी"]) {
      assert.ok(chunk.text.includes(heading), `${chunk.id}: Hindi text missing "${heading}"`);
    }
    for (const heading of ["Symptoms", "Remedy", "Caution"]) {
      assert.ok(chunk.textEn.includes(heading), `${chunk.id}: English text missing "${heading}"`);
    }
    // The source is embedded in the text so citations cannot drift (DECISIONS §4).
    assert.ok(chunk.text.includes("स्रोत:"), `${chunk.id}: Hindi text missing "स्रोत:" line`);
    assert.ok(chunk.textEn.includes("Source:"), `${chunk.id}: English text missing "Source:" line`);
  }
});

// -------------------------------------------------------------- eval coverage

test(`retrieval: >= 80% of ${evals.cases.length} eval questions hit the expected chunk`, () => {
  const failures = [];
  for (const evalCase of evals.cases) {
    const got = topId(evalCase.q);
    if (got !== evalCase.expect) {
      failures.push(
        `${evalCase.id} "${evalCase.q}" -> ${got ?? "(refused)"}, expected ${evalCase.expect}`
      );
    }
  }

  const passed = evals.cases.length - failures.length;
  const needed = Math.ceil(evals.cases.length * 0.8);
  console.log(
    `\n  Retrieval eval: ${passed}/${evals.cases.length} questions matched their expected chunk.` +
      (failures.length > 0 ? `\n  Misses:\n   - ${failures.join("\n   - ")}\n` : "\n")
  );

  assert.ok(
    passed >= needed,
    `only ${passed}/${evals.cases.length} eval cases passed (need >= ${needed}):\n${failures.join("\n")}`
  );
});

test("retrieval: results stay above threshold, sorted, and capped at the limit", () => {
  for (const evalCase of evals.cases) {
    const results = retrieve(evalCase.q, chunks);
    assert.ok(results.length >= 1, `${evalCase.id}: expected at least one chunk`);
    assert.ok(results.length <= DEFAULT_LIMIT, `${evalCase.id}: exceeded the source limit`);
    for (const result of results) {
      assert.ok(
        result.score >= RETRIEVAL_THRESHOLD,
        `${evalCase.id}: ${result.chunk.id} scored ${result.score}, below threshold`
      );
    }
    for (let i = 1; i < results.length; i += 1) {
      assert.ok(
        results[i - 1].score >= results[i].score,
        `${evalCase.id}: results are not sorted by score`
      );
    }
  }
});

// ------------------------------------------------------------------- refusals

test(`refusals: ${evals.refusals.length}/${evals.refusals.length} out-of-KB questions fall below the threshold`, () => {
  for (const refusal of evals.refusals) {
    const results = retrieve(refusal.q, chunks);
    const detail = results.map((r) => `${r.chunk.id}:${r.score}`).join(", ");
    assert.deepEqual(
      results,
      [],
      `${refusal.id} "${refusal.q}" should refuse, but returned ${detail}`
    );
  }
});

test("the out_of_scope chunk is never returned as a source", () => {
  const probes = [
    ...evals.cases.map((c) => c.q),
    ...evals.refusals.map((r) => r.q),
    "मंडी भाव क्या है",
    "आज मौसम कैसा रहेगा",
    "सरकारी योजना",
    "पशु का इलाज",
  ];
  for (const probe of probes) {
    for (const result of retrieve(probe, chunks)) {
      assert.notEqual(result.chunk.id, "scope_referral", `"${probe}" returned the scope chunk`);
    }
  }
});

// ---------------------------------------------------------------- edge cases

test("edge cases: empty, whitespace, punctuation and stopword-only queries refuse cleanly", () => {
  const empties = ["", "   ", "\n\t ", "?", "!!!", "।।", "क्या कब कैसे", "the a an", "-"];
  for (const query of empties) {
    assert.equal(expandQuery(query).size, 0, `"${query}" should expand to nothing`);
    assert.deepEqual(retrieve(query, chunks), [], `"${query}" should return no chunks`);
  }
});

test("edge cases: Hindi, English and mixed-language phrasing agree", () => {
  const groups = [
    ["गेहूँ में खाद कब डालें?", "wheat fertiliser timing"],
    ["धान में सिंचाई कब करें?", "paddy irrigation"],
    ["wheat me yellow stem borer ka ilaj", "गेहूँ में पीली इल्टी"],
    ["gehu me ilti", "गेहूँ की इल्टी"],
  ];

  for (const group of groups) {
    const ids = group.map(topId);
    assert.equal(
      new Set(ids).size,
      1,
      `expected one shared chunk for ${group.join(" | ")}, got ${ids.join(" | ")}`
    );
    assert.ok(ids[0], `no chunk found for ${group.join(" | ")}`);
  }
});

test("edge cases: Devanagari suffixes and paraphrases still match", () => {
  assert.equal(topId("गेहूँ में इल्टी लगी है"), "wheat_pest_yellow_stem_borer");
  assert.equal(topId("धान में पानी कब दें"), "paddy_irrigation_stages");
  assert.equal(topId("सरसों में चेपा लगा है"), "mustard_pest_aphid");
});

test("edge cases: a 500+ character question is handled without crashing", () => {
  const long = "गेहूँ में पीली इल्टी का इलाज क्या है ".repeat(20).trim();
  assert.ok(long.length > 500, "test query should exceed 500 characters");
  assert.equal(topId(long), "wheat_pest_yellow_stem_borer");
});

// ------------------------------------------------------- Phase 4 suggested chips

test("chips: the 7 answerable chips retrieve a chunk and chip #8 refuses", async () => {
  const { CHIPS } = await import("../lib/ui-strings.ts");
  assert.equal(CHIPS.length, 8, "there must be exactly 8 suggested chips (FR3)");

  for (const chip of CHIPS) {
    const expectRefusal = chip.id === "fish-cost"; // the deliberate out-of-KB chip
    for (const lang of ["hi", "en"]) {
      const results = retrieve(chip[lang].question, chunks);
      if (expectRefusal) {
        assert.deepEqual(
          results,
          [],
          `${chip.id} [${lang}] must refuse, got ${results.map((r) => r.chunk.id).join(",")}`
        );
      } else {
        assert.ok(
          results.length >= 1,
          `${chip.id} [${lang}] should retrieve at least one chunk`
        );
      }
    }
  }
});
