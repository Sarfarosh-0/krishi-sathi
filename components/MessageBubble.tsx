"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import type { ChatMessage } from "@/lib/chat";
import { renderAnswer, toSpeechText } from "@/lib/markdown";
import type { Lang } from "@/lib/types";
import { UI_STRINGS, type UIStrings } from "@/lib/ui-strings";
import AnswerSkeleton from "./AnswerSkeleton";
import SourceAccordion from "./SourceAccordion";
import TTSButton from "./TTSButton";

interface MessageBubbleProps {
  message: ChatMessage;
  /** Strings for the *current UI* language (labels/buttons). */
  strings: UIStrings;
  speechSupported: boolean | null;
  speaking: boolean;
  onToggleSpeak: (key: string, text: string, lang: Lang) => void;
  onRetry: () => void;
}

/**
 * One chat turn. User bubbles are green/right; assistant cards are white, or
 * amber/cream for refusals and upstream fallbacks (never red — AGENTS #2).
 * Every answer's text node carries its own `lang`, so past messages keep the
 * language they were asked in (DESIGN §7).
 */
export default function MessageBubble({
  message,
  strings,
  speechSupported,
  speaking,
  onToggleSpeak,
  onRetry,
}: MessageBubbleProps) {
  // Content notes follow the message language; chrome follows the UI language.
  const contentStrings = UI_STRINGS[message.lang];

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <p
          lang={message.lang}
          aria-label={strings.userLabel}
          className="max-w-[85%] rounded-bubble rounded-br-none bg-primary px-4 py-2.5 text-surface shadow-card"
        >
          {message.text}
        </p>
      </div>
    );
  }

  const streaming = message.status === "streaming";
  const amber = message.status === "refused" || message.status === "upstream";
  const answered = message.status === "done" || message.status === "refused";

  return (
    <div className="flex justify-start">
      <article
        aria-label={strings.assistantLabel}
        className={`max-w-[92%] rounded-bubble rounded-bl-none p-4 shadow-card ${
          amber ? "border-2 border-harvest bg-cream" : "bg-surface"
        }`}
      >
        {/* Refusal: amber warning glyph above the server refusal text. */}
        {message.status === "refused" && (
          <AlertTriangle className="mb-1 size-5 text-harvest" aria-hidden="true" />
        )}

        {/* Upstream: friendly fallback note; the retrieved snippets sit below. */}
        {message.status === "upstream" && (
          <p lang={message.lang} className="flex items-start gap-2 font-medium text-ink">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-harvest" aria-hidden="true" />
            <span>{contentStrings.upstreamNote}</span>
          </p>
        )}

        {/* Skeleton while the first token is in flight (~3-5 s), then live tokens.
            The streaming answer keeps the skeleton's `min-h-[4.5rem]` reserve, so
            the swap from skeleton to text causes no layout shift. */}
        {streaming && message.text.length === 0 ? (
          <AnswerSkeleton label={contentStrings.thinking} lang={message.lang} />
        ) : (
          message.text.length > 0 && (
            <div
              lang={message.lang}
              className={`answer-text text-ink ${streaming ? "min-h-[4.5rem]" : ""}`}
            >
              {renderAnswer(message.text)}
              {streaming && (
                <span
                  className="ml-0.5 inline-block h-4 w-1 animate-pulse bg-primary align-middle"
                  aria-hidden="true"
                />
              )}
            </div>
          )
        )}

        {message.status === "stopped" && (
          <p lang={message.lang} className="mt-2 text-xs text-muted">
            {contentStrings.stopped}
          </p>
        )}

        {/* Server-sent sources, rendered as soon as they arrive (before tokens). */}
        <SourceAccordion sources={message.sources} lang={message.lang} strings={strings} />

        {/* Server-owned advisory from `done` — rendered exactly once. */}
        {message.advisory && answered && (
          <p
            lang={message.lang}
            className="mt-3 border-t border-black/10 pt-2 text-xs text-muted"
          >
            {message.advisory}
          </p>
        )}

        {((message.text.length > 0 && !streaming) || message.status === "upstream") && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {message.text.length > 0 && !streaming && (
              <TTSButton
                supported={speechSupported}
                speaking={speaking}
                lang={message.lang}
                strings={strings}
                onToggle={() =>
                  onToggleSpeak(message.id, toSpeechText(message.text), message.lang)
                }
              />
            )}
            {message.status === "upstream" && (
              <button
                type="button"
                lang={message.lang}
                onClick={onRetry}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-button border border-harvest px-3 py-1.5 text-sm font-medium text-ink hover:bg-harvest/10"
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                {strings.retry}
              </button>
            )}
          </div>
        )}
      </article>
    </div>
  );
}
