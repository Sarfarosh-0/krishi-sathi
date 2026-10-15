import { getChunks } from "./kb";
import type { HistoryEntry, ImpactStats, KBSource, Lang } from "./types";

/**
 * Client-only chat model (Phase 4). This is UI state, not part of the wire
 * contract, so it lives beside — not inside — the shared API types in
 * `lib/types.ts` (DESIGN §4 is the contract; this file backs DESIGN §6 state).
 */
export type MessageStatus =
  | "streaming" // tokens still arriving
  | "done" // completed answer + advisory
  | "refused" // server refusal, no sources
  | "upstream" // model/network failed → snippet-fallback card
  | "stopped"; // user pressed stop mid-stream

export interface ChatMessage {
  /** Local id — React key, and the TTS/speech key. */
  id: string;
  role: "user" | "assistant";
  /** Language of THIS message: past messages keep their language on toggle. */
  lang: Lang;
  /** User question (assistant keeps it so "Try again" can re-send). */
  question: string;
  /** Streamed answer text (server tokens joined). */
  text: string;
  /** Retrieved KB snippets, rendered as soon as the `sources` event arrives. */
  sources: KBSource[];
  /** Server-owned advisory from `done`; null until the stream terminates. */
  advisory: string | null;
  status: MessageStatus;
}

/** Short, collision-resistant id (no crypto dependency needed on the client). */
export function newMessageId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// --------------------------------------------------- device-local persistence
// Keys are versioned (DESIGN §6): an old shape is ignored and starts from the
// default rather than being migrated. Values are JSON (see `useLocalStorage`).

export const HISTORY_KEY = "ks:history:v1";
export const IMPACT_KEY = "ks:impact:v1";

/** History keeps the newest 50 turns; older ones are dropped (FR12). */
export const HISTORY_LIMIT = 50;

/** Stable defaults, so `useLocalStorage` snapshots never churn. */
export const EMPTY_HISTORY: HistoryEntry[] = [];
export const EMPTY_IMPACT: ImpactStats = { asked: 0, answered: 0, refused: 0, lastTs: null };

/**
 * Store an answer together with the server's advisory line. History has no
 * advisory field of its own (lib/types.ts is the frozen contract) and the
 * client must not re-author server-owned strings (DESIGN §5), so the server
 * text is kept verbatim inside the entry's answer — a reopened entry still
 * shows its disclaimer, with no client-side duplication.
 */
export function answerWithAdvisory(answer: string, advisory: string | null): string {
  return advisory ? `${answer}\n\n${advisory}` : answer;
}

/**
 * Rebuild source snippets for a stored entry from the bundled KB (AGENTS #19).
 * History stores only source ids (`HistoryEntry.sources: string[]`), so a
 * reopened turn replays the exact cached chunk text — no network call.
 */
export function sourcesFromIds(ids: string[], lang: Lang): KBSource[] {
  const chunks = getChunks();
  return ids.flatMap((id) => {
    const chunk = chunks.find((candidate) => candidate.id === id);
    if (!chunk) {
      return [];
    }
    return [
      {
        id: chunk.id,
        title: lang === "en" ? chunk.titleEn : chunk.title,
        text: lang === "en" ? chunk.textEn : chunk.text,
      },
    ];
  });
}
