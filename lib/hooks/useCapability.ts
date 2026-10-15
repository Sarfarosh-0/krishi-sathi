"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * Browser capability probe. Evaluating `window` during render would break SSR
 * and hydration, so this reports `null` on the server (and during the first
 * hydration pass) and the real boolean once the client takes over. No effect
 * and no `setState`, so capability detection stays render-safe.
 */
export function useCapability(check: () => boolean): boolean | null {
  return useSyncExternalStore(
    subscribe,
    () => (typeof window === "undefined" ? false : check()),
    () => null
  );
}
