"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Lang } from "../types";
import { useCapability } from "./useCapability";

/**
 * Minimal shape of the Web Speech recognition API. `SpeechRecognition` itself
 * is not in TypeScript's DOM lib, so we model only what we use (no `any`).
 */
interface RecognitionAlternative {
  transcript: string;
}
interface RecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: RecognitionAlternative;
}
interface RecognitionResultList {
  readonly length: number;
  [index: number]: RecognitionResult;
}
interface RecognitionEvent {
  results: RecognitionResultList;
}
interface RecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}
type RecognitionCtor = new () => RecognitionInstance;

const VOICE_TAG: Record<Lang, string> = { hi: "hi-IN", en: "en-IN" };

function recognitionCtor(): RecognitionCtor | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  const host = window as Window & {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return host.SpeechRecognition ?? host.webkitSpeechRecognition;
}

/**
 * `webkitSpeechRecognition` voice input (FR9). Capability-gated (null until the
 * client knows), interim results are surfaced to the caller, and the Composer
 * hides the control when unsupported — never crashes.
 */
export function useVoiceInput(onTranscript: (text: string) => void, lang: Lang) {
  const supported = useCapability(() => recognitionCtor() !== undefined);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<RecognitionInstance | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  const langRef = useRef(lang);

  // Keep the latest callback/language without re-creating the recognizer.
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
    langRef.current = lang;
  });

  useEffect(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) {
      return;
    }

    const recognition = new Ctor();
    recognition.lang = VOICE_TAG[langRef.current];
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i += 1) {
        transcript += event.results[i][0].transcript;
      }
      onTranscriptRef.current(transcript.trim());
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.abort();
      } catch {
        /* already stopped */
      }
      recognitionRef.current = null;
    };
  }, []);

  const start = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      return;
    }
    try {
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, []);

  const stop = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      return;
    }
    try {
      recognition.stop();
    } catch {
      /* already stopped */
    }
    setListening(false);
  }, []);

  return { supported, listening, start, stop };
}
