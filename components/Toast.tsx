"use client";

import { AlertTriangle, WifiOff } from "lucide-react";

interface ToastProps {
  message: string;
  tone: "amber" | "danger";
}

/**
 * Transient notice (DESIGN §7): amber for the rate limit, red (network) only
 * for offline. The refusal card is always amber and never routed through here.
 */
export default function Toast({ message, tone }: ToastProps) {
  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4"
    >
      <p
        className={`flex items-center gap-2 rounded-card px-4 py-2.5 text-sm font-medium shadow-card ${
          tone === "danger" ? "bg-danger text-surface" : "bg-harvest text-ink"
        }`}
      >
        {tone === "danger" ? (
          <WifiOff className="size-4 shrink-0" aria-hidden="true" />
        ) : (
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
        )}
        <span>{message}</span>
      </p>
    </div>
  );
}
