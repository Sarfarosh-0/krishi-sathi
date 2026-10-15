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
