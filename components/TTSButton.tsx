"use client";

import { Volume2, VolumeX } from "lucide-react";
import type { Lang } from "@/lib/types";
import type { UIStrings } from "@/lib/ui-strings";

interface TTSButtonProps {
  supported: boolean | null;
  speaking: boolean;
  lang: Lang;
  strings: UIStrings;
  onToggle: () => void;
}

/**
 * "सुनें / Listen" toggle (FR8). Hidden (with a hint) when the browser has no
 * speechSynthesis — capability check only, never an assumption.
 */
export default function TTSButton({
  supported,
  speaking,
  lang,
  strings,
  onToggle,
}: TTSButtonProps) {
  if (!supported) {
    // Unsupported (or not yet known on the server): render no button. The
    // "read-aloud isn't available" notice is shown once, by MessageList.
    return null;
  }

  return (
    <button
      type="button"
      lang={lang}
      aria-pressed={speaking}
      onClick={onToggle}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-button border border-primary/30 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10"
    >
      {speaking ? (
        <VolumeX className="size-4" aria-hidden="true" />
      ) : (
        <Volume2 className="size-4" aria-hidden="true" />
      )}
      {speaking ? strings.ttsStop : strings.listen}
    </button>
  );
}
