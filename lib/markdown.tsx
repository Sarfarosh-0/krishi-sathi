import type { ReactNode } from "react";

/**
 * Minimal Markdown → React nodes renderer (FR14, "text nodes only").
 *
 * Supports exactly the two things the model is expected to emit: `**bold**`
 * and `- bullets`. Output is built from React text nodes — never raw HTML
 * injection (AGENTS #2; model output is untrusted input).
 *
 * Streaming-safe: an unclosed `**` simply renders as literal asterisks until
 * the closing pair arrives.
 */

const BULLET = /^\s*(?:[-*•]|\d+[.)])\s+/;

/** Split one line into text and `<strong>` nodes on `**...**`. */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /\*\*([^*]+)\*\*/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    nodes.push(<strong key={`${keyPrefix}-b${match.index}`}>{match[1]}</strong>);
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    nodes.push(text.slice(last));
  }
  return nodes;
}

/** Render answer text as paragraphs and bullet lists (no raw HTML). */
export function renderAnswer(text: string): ReactNode[] {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];

  const flushBullets = () => {
    if (bullets.length === 0) {
      return;
    }
    const items = bullets;
    const listKey = `ul-${blocks.length}`;
    blocks.push(
      <ul key={listKey} className="my-1 list-disc space-y-1 pl-5">
        {items.map((item, index) => (
          <li key={`${listKey}-${index}`}>{renderInline(item, `${listKey}-${index}`)}</li>
        ))}
      </ul>
    );
    bullets = [];
  };

  lines.forEach((line, index) => {
    if (BULLET.test(line)) {
      bullets.push(line.replace(BULLET, ""));
      return;
    }
    flushBullets();
    const trimmed = line.trim();
    if (trimmed) {
      blocks.push(
        <p key={`p-${index}`} className="whitespace-pre-wrap">
          {renderInline(trimmed, `p-${index}`)}
        </p>
      );
    }
  });
  flushBullets();

  return blocks;
}

/**
 * Spoken form of an answer for read-aloud (FR8). Markdown markers are not
 * meant to be heard: bullet markers and `**` are dropped, the inline
 * `[source_id]` citation is removed, and underscores become spaces so the
 * voice does not pause in the middle of a source id. Text only — no HTML.
 */
export function toSpeechText(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(BULLET, "").replace(/\*\*/g, ""))
    .join(" ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
