"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * SSR-safe, versioned localStorage-backed state (DESIGN §6, Phase 5).
 *
 * Built on React's external-store pattern — the same shape as `useLang` — so
 * the value defaults on the server and during the first hydration pass, and no
 * `setState` ever runs inside an effect (banned by React 19's
 * `react-hooks/set-state-in-effect` rule).
 *
 * localStorage is best-effort: Safari private mode and locked-down browsers
 * throw on BOTH read and write, so every access is wrapped in try/catch and can
 * never crash the app. Successful reads are cached (raw string → parsed value)
 * so `getSnapshot` stays referentially stable, which `useSyncExternalStore`
 * requires (an uncached object snapshot would loop forever).
 */

const listeners = new Set<() => void>();

/** In-module subscription + the `storage` event for cross-tab updates. */
function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

interface Snapshot {
  /** The raw string the parsed value was derived from (null = nothing stored). */
  raw: string | null;
  value: unknown;
}

const cache = new Map<string, Snapshot>();

/** Read one key; a blocked/failed read behaves like "nothing stored". */
function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Cached parse: the same raw string always yields the same reference. */
function readSnapshot<T>(key: string, fallback: T): T {
  const raw = readRaw(key);
  const cached = cache.get(key);
  if (cached && cached.raw === raw) {
    return cached.value as T;
  }

  let value: T = fallback;
  if (raw !== null) {
    try {
      value = JSON.parse(raw) as T;
    } catch {
      value = fallback; // corrupt entry — fall back rather than crash
    }
  }
  cache.set(key, { raw, value });
  return value;
}

/**
 * Read/write a JSON value under `key`. Returns `fallback` on the server, during
 * the first hydration pass, and whenever storage is unavailable. A write that
 * fails is still applied in memory for the session (pinned against the raw
 * string still on disk), so the UI keeps working without persisting.
 */
export function useLocalStorage<T>(
  key: string,
  fallback: T
): [T, (next: T | ((current: T) => T)) => void] {
  const getSnapshot = useCallback(() => readSnapshot(key, fallback), [key, fallback]);
  const getServerSnapshot = useCallback(() => fallback, [fallback]);
  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setValue = useCallback(
    (next: T | ((current: T) => T)) => {
      const current = readSnapshot(key, fallback);
      const resolved =
        typeof next === "function" ? (next as (current: T) => T)(current) : next;

      try {
        const raw = JSON.stringify(resolved);
        window.localStorage.setItem(key, raw);
        cache.set(key, { raw, value: resolved });
      } catch {
        // Storage blocked or full: keep the value in memory by pinning it to
        // whichever raw string is actually on disk, so the snapshot stays
        // stable and the session keeps working.
        cache.set(key, { raw: readRaw(key), value: resolved });
      }

      listeners.forEach((listener) => listener());
    },
    [key, fallback]
  );

  return [value, setValue];
}
