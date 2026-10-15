"use client";

import { useCallback, useEffect, useState } from "react";
import type { Lang } from "../types";
import { useCapability } from "./useCapability";

const VOICE_TAG: Record<Lang, string> = { hi: "hi-IN", en: "en-IN" };

/**
 * `speechSynthesis` wrapper (FR8). Capability-gated via `useCapability` (null
 * until the client knows). Only one utterance plays at a time; starting a new
 * one cancels the old.
 */
export function useSpeech() {
  const supported = useCapability(() => "speechSynthesis" in window);
  const [speakingKey, setSpeakingKey] = useState<string | null>(null);

  // Stop any speech when the chat unmounts (no state write — effect-safe).
  useEffect(
    () => () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    },
    []
  );

  const stop = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingKey(null);
  }, []);

  const toggle = useCallback(
    (key: string, text: string, lang: Lang) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        return;
      }
      const synth = window.speechSynthesis;
      synth.cancel(); // one speaker at a time

      if (speakingKey === key) {
        setSpeakingKey(null);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = VOICE_TAG[lang];
      const clear = () => setSpeakingKey((current) => (current === key ? null : current));
      utterance.onend = clear;
      utterance.onerror = clear;

      setSpeakingKey(key);
      synth.speak(utterance);
    },
    [speakingKey]
  );

  return { supported, speakingKey, toggle, stop };
}
