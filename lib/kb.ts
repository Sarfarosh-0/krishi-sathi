import type { KBChunk } from "./types";
import kbFile from "../kb/crop-docs.json";

export interface KBMeta {
  name: string;
  region: string;
  note: string;
}

interface KBFile {
  meta: KBMeta;
  chunks: KBChunk[];
}

// JSON values widen on import (`season` arrives as `string`), so the bundled
// file is mapped onto the shared types through one explicit cast.
const file = kbFile as unknown as KBFile;

// Module-scope cache: the KB is bundled JSON (AGENTS #19) — no network call and
// no filesystem read, so parsing happens once per serverless instance.
let chunks: readonly KBChunk[] | null = null;

/** All chunks, including the scope-documentation chunk. */
export function getChunks(): readonly KBChunk[] {
  if (chunks === null) {
    chunks = file.chunks;
  }
  return chunks;
}

/** Chunk metadata — used for the device-local KB coverage stats (DESIGN §1.3). */
export function getMeta(): KBMeta {
  return file.meta;
}
