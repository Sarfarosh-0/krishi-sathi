"use client";

import type { KeyboardEvent } from "react";
import { Mic, Send, Square } from "lucide-react";
import { useVoiceInput } from "@/lib/hooks/useVoiceInput";
import type { Lang } from "@/lib/types";
import type { UIStrings } from "@/lib/ui-strings";

interface ComposerProps {
  lang: Lang;
  strings: UIStrings;
  value: string;
  loading: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
}

const MAX_QUESTION_CHARS = 500;

/** Sticky-bottom composer: voice button, textarea (Enter to send), send/stop. */
export default function Composer({
  lang,
  strings,
  value,
  loading,
  onChange,
  onSubmit,
  onStop,
}: ComposerProps) {
  const voice = useVoiceInput(onChange, lang);
  const canSend = value.trim().length > 0 && !loading;

  const submit = () => {
    if (loading || voice.listening) {
      voice.stop();
    }
    if (canSend) {
      onSubmit();
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends; Shift+Enter adds a newline. Ignore IME composition (Hindi
    // typing) so an in-progress transliteration is not submitted early.
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="border-t border-black/5 bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto flex w-full max-w-3xl items-end gap-2 px-4 py-3">
        {voice.supported === true && (
          <button
            type="button"
            lang={lang}
            aria-label={voice.listening ? strings.micStop : strings.mic}
            aria-pressed={voice.listening}
            onClick={() => (voice.listening ? voice.stop() : voice.start())}
            disabled={loading}
            className={`flex size-12 shrink-0 items-center justify-center rounded-button border transition-colors disabled:opacity-50 ${
              voice.listening
                ? "border-danger bg-danger/10 text-danger"
                : "border-black/10 text-soil hover:bg-cream"
            }`}
          >
            <Mic className="size-5" aria-hidden="true" />
          </button>
        )}

        <textarea
          lang={lang}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          rows={1}
          maxLength={MAX_QUESTION_CHARS}
          placeholder={voice.listening ? strings.micListening : strings.placeholder}
          aria-label={strings.placeholder}
          className="min-h-12 flex-1 resize-none rounded-button border border-black/10 bg-cream px-3 py-3 text-ink placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
        />

        {loading ? (
          <button
            type="button"
            lang={lang}
            onClick={onStop}
            aria-label={strings.stop}
            className="flex size-12 shrink-0 items-center justify-center rounded-button bg-ink text-surface"
          >
            <Square className="size-5" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="submit"
            lang={lang}
            disabled={!canSend}
            aria-label={strings.send}
            className="flex size-12 shrink-0 items-center justify-center rounded-button bg-primary text-surface transition-colors hover:bg-primary-dark disabled:opacity-40"
          >
            <Send className="size-5" aria-hidden="true" />
          </button>
        )}
      </div>

      {voice.supported === false && (
        <p lang={lang} className="mx-auto w-full max-w-3xl px-4 pb-2 text-xs text-muted">
          {strings.micUnsupported}
        </p>
      )}
    </form>
  );
}
