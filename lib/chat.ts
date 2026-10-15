import type { KBSource, Lang } from "./types";

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
