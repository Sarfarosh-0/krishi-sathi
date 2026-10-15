"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { Lang } from "../types";

const STORAGE_KEY = "ks:lang";
const listeners = new Set<() => void>();

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

/** Read the persisted language, defaulting to Hindi (localStorage may throw). */
function readStored(): Lang {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "hi" || stored === "en") {
      return stored;
    }
  } catch {
    /* private mode / blocked — fall through to the default */
  }
  return "hi";
}

/**
 * UI language with an SSR-safe localStorage mirror (DESIGN §6). Hindi is the
 * default; localStorage is treated as an external store, so the value only
 * applies on the client (no hydration mismatch, no setState-in-effect).
 */
export function useLang(): [Lang, (next: Lang) => void] {
  const lang = useSyncExternalStore(subscribe, readStored, () => "hi" as Lang);

  // Keep the document language in step with the UI language (external DOM write).
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore write failures */
    }
    listeners.forEach((listener) => listener());
  }, []);

  return [lang, setLang];
}
