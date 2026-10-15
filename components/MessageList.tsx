"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/lib/chat";
import type { Lang } from "@/lib/types";
import type { UIStrings } from "@/lib/ui-strings";
import MessageBubble from "./MessageBubble";

interface MessageListProps {
  messages: ChatMessage[];
  /** Current UI language, for the empty-state copy. */
  lang: Lang;
  strings: UIStrings;
  loading: boolean;
  speechSupported: boolean | null;
  speakingKey: string | null;
  onToggleSpeak: (key: string, text: string, lang: Lang) => void;
  onRetry: (message: ChatMessage) => void;
}

/** Scroll container. Pins to the bottom while streaming unless the user scrolled up. */
export default function MessageList({
  messages,
  lang,
  strings,
  loading,
  speechSupported,
  speakingKey,
  onToggleSpeak,
  onRetry,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) {
      return;
    }
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  useEffect(() => {
    const el = containerRef.current;
    if (el && stickRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      aria-live="polite"
      aria-busy={loading}
      className="min-h-0 flex-1 overflow-y-auto"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-4">
        {messages.length === 0 ? (
          <div className="rounded-card bg-surface p-5 text-center shadow-card">
            <p lang={lang} className="text-lg font-semibold text-ink">
              {strings.emptyTitle}
            </p>
            <p lang={lang} className="mt-1 text-sm text-muted">
              {strings.emptyHint}
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              strings={strings}
              speechSupported={speechSupported}
              speaking={speakingKey === message.id}
              onToggleSpeak={onToggleSpeak}
              onRetry={() => onRetry(message)}
            />
          ))
        )}
      </div>
    </div>
  );
}
