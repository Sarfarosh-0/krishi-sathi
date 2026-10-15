import type { KBChunk } from "./types";
import { SYNONYM_MAP } from "./synonyms";

/**
 * Deterministic, quota-free retrieval (PRD §6: "retrieval is deterministic
 * code, not a model"). Pipeline: normalise → expand synonyms → score every
 * chunk (crop > tags > token overlap) → keep the best few above threshold.
 */

/** Below this score the caller must take the refusal path (no Gemini call). */
export const RETRIEVAL_THRESHOLD = 5;

/** Top-3 chunks per answer (PRD §6). */
export const DEFAULT_LIMIT = 3;

// Weights and caps from DECISIONS §4. Caps stop one long, wordy chunk from
// dominating purely because it shares more words with every query.
const WEIGHT_CROP = 3;
const WEIGHT_TAG = 2;
const WEIGHT_TOKEN = 1;
const MAX_TAG_HITS = 2;
const MAX_TOKEN_HITS = 4;

/** Chunks that document scope rather than answer a question (kb/crop-docs.json). */
const NON_ANSWERABLE_TAG = "out_of_scope";

/**
 * Words with no subject signal: Hindi/English question words, postpositions,
 * and the लक्षण / उपाय / सावधानी labels that appear in EVERY chunk. Filtering
 * them after expansion keeps structural boilerplate from inflating scores or
 * pushing an out-of-KB question over the threshold.
 */
const STOPWORDS = new Set<string>([
  // Hindi — question words, postpositions, auxiliaries
  "में", "मे", "मैं", "का", "की", "के", "को", "से", "पर", "और", "या", "एवं",
  "है", "हैं", "हूँ", "हो", "होता", "होती", "होते", "हुआ", "हुई", "हुए", "करें",
  "करना", "कर", "करता", "करती", "कैसे", "कैसा", "कैसी", "क्या", "कब", "कहाँ",
  "कहां", "क्यों", "कौन", "कितना", "कितनी", "कितने", "मुझे", "मेरे", "मेरा",
  "मेरी", "अपने", "अपना", "अपनी", "लिए", "वाला", "वाली", "वाले", "बहुत", "थोड़ा",
  "थोड़ी", "यह", "वह", "इस", "उस", "इन", "उन", "तो", "भी", "नहीं", "न", "गया",
  "गई", "गए", "रहा", "रही", "रहे", "देना", "दें", "डाल", "डालें", "डालना", "लगा",
  "लगी", "लगे", "लगता", "लगती", "दिखता", "दिखती", "दिखते", "जरूरी", "जरुरी",
  "चाहिए", "सकता", "सकती", "सकते", "अगर", "तब", "फिर", "साथ", "बाद", "बताएं",
  "बताइए", "बताओ", "जानकारी", "जानना", "मदद", "सलाह", "समस्या", "दिक्कत",
  // Hindi — generic nouns that appear across the whole KB
  "फसल", "फसलों", "खेत", "खेतों", "पौधा", "पौधे", "पौधों", "पत्ती", "पत्तियाँ",
  "पत्तियां", "पत्तियों", "जमीन", "मिट्टी", "अच्छा", "अच्छी", "ज्यादा", "ज़्यादा",
  "कम", "सबसे", "कोई", "कुछ", "सब",
  // Structural labels present in every chunk
  "लक्षण", "उपाय", "सावधानी", "स्रोत",
  // English — function words and question words
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being", "am",
  "do", "does", "did", "doing", "how", "what", "when", "where", "why", "which",
  "who", "whom", "whose", "i", "my", "me", "mine", "we", "our", "us", "you",
  "your", "yours", "it", "its", "this", "that", "these", "those", "and", "or",
  "but", "if", "then", "of", "in", "on", "at", "by", "for", "to", "from",
  "with", "about", "into", "over", "after", "before", "should", "can", "could",
  "will", "would", "shall", "may", "might", "must", "need", "needs", "get",
  "got", "give", "gives", "please", "tell", "help", "problem", "issues",
  "advice", "information", "source",
  // English — generic nouns/adjectives across the whole KB
  "crop", "crops", "field", "fields", "plant", "plants", "leaf", "leaves",
  "soil", "land", "good", "best", "bad", "more", "most", "less", "very",
  "much", "many", "some", "any", "all", "no", "not", "also", "only", "just",
  "now", "here", "there", "symptom", "symptoms", "remedy", "precaution",
  "precautions", "caution", "treatment", "control", "management",
]);

/**
 * Lower-case and reduce to letters/digits/spaces. Devanagari (U+0900–U+097F) is
 * kept explicitly rather than via \p{L}, because the project targets ES2017.
 */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u0964\u0965]/g, " ") // Devanagari danda (। ॥)
    .replace(/[^a-z0-9\u0900-\u097f\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Expand a question into the set of terms to score against. Single tokens are
 * matched directly; multi-word aliases ("पीली इल्टी", "yellow stem borer") are
 * found by substring, since whitespace tokenisation would split them.
 */
export function expandQuery(query: string): Set<string> {
  const normalised = normalise(query);
  const terms = new Set<string>();

  if (!normalised) {
    return terms;
  }

  for (const token of normalised.split(" ")) {
    if (token && !STOPWORDS.has(token)) {
      terms.add(token);
    }
  }

  // Substring match also absorbs Hindi suffixes (इल्टी / इल्टीयों).
  for (const [term, group] of SYNONYM_MAP) {
    if (!normalised.includes(term)) {
      continue;
    }
    for (const synonym of group) {
      if (!STOPWORDS.has(synonym)) {
        terms.add(synonym);
      }
    }
  }

  return terms;
}

/** Title + body + tags, normalised once per chunk and cached. */
const haystackCache = new Map<string, string>();

function haystackOf(chunk: KBChunk): string {
  const cached = haystackCache.get(chunk.id);
  if (cached !== undefined) {
    return cached;
  }
  const built = normalise(
    [
      chunk.title,
      chunk.titleEn,
      chunk.text,
      chunk.textEn,
      chunk.tags.join(" "),
      chunk.crop.join(" "),
    ].join(" ")
  );
  haystackCache.set(chunk.id, built);
  return built;
}

/** Score one chunk against pre-expanded query terms. */
export function scoreTerms(terms: ReadonlySet<string>, chunk: KBChunk): number {
  if (terms.size === 0) {
    return 0;
  }

  // 1. Crop match — the strongest signal.
  let score = chunk.crop.some((crop) => terms.has(crop)) ? WEIGHT_CROP : 0;

  // 2. Tag match.
  let tagHits = 0;
  for (const tag of chunk.tags) {
    if (tagHits >= MAX_TAG_HITS) {
      break;
    }
    if (terms.has(tag)) {
      tagHits += 1;
    }
  }
  score += tagHits * WEIGHT_TAG;

  // 3. Plain token overlap with the chunk text.
  const haystack = haystackOf(chunk);
  let tokenHits = 0;
  for (const term of terms) {
    if (tokenHits >= MAX_TOKEN_HITS) {
      break;
    }
    if (term.length > 1 && haystack.includes(term)) {
      tokenHits += 1;
    }
  }
  score += tokenHits * WEIGHT_TOKEN;

  return score;
}

/** Convenience wrapper for a single query/chunk pair (used by tests). */
export function scoreChunk(query: string, chunk: KBChunk): number {
  return scoreTerms(expandQuery(query), chunk);
}

export interface RetrievalResult {
  chunk: KBChunk;
  score: number;
}

/**
 * Best chunks for a question. Returns [] when nothing clears the threshold —
 * the caller must then refuse deterministically without calling the model.
 */
export function retrieve(
  query: string,
  chunks: readonly KBChunk[],
  limit: number = DEFAULT_LIMIT
): RetrievalResult[] {
  const terms = expandQuery(query);
  if (terms.size === 0) {
    return [];
  }

  return chunks
    .filter((chunk) => !chunk.tags.includes(NON_ANSWERABLE_TAG))
    .map((chunk) => ({ chunk, score: scoreTerms(terms, chunk) }))
    .filter((result) => result.score >= RETRIEVAL_THRESHOLD)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.chunk.priority - a.chunk.priority ||
        a.chunk.id.localeCompare(b.chunk.id)
    )
    .slice(0, limit);
}
