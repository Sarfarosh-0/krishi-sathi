import type { NextConfig } from "next";

// Basic Content Security Policy (PRD §10, DECISIONS §7). A nonce/hash policy
// would require every page to be dynamically rendered (Next.js CSP guide),
// which we deliberately avoid for this statically-optimized MVP — so this uses
// the documented "without nonces" shape: 'unsafe-inline' for Next's own
// bootstrap script and inline styles. 'unsafe-eval' is added in development
// only, where React needs it for its error overlay.
const isDev = process.env.NODE_ENV === "development";

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // Same-origin framing only: blocks cross-site clickjacking (paired with the
  // X-Frame-Options header below) while still allowing the app's own
  // mobile-width test harness to embed it.
  "frame-ancestors 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Two years of HTTPS-only, once the browser has seen the site over TLS.
  // Browsers ignore HSTS over plain HTTP, so local `next start` is unaffected.
  // No includeSubDomains: the app may sit on a shared *.vercel.app domain.
  { key: "Strict-Transport-Security", value: "max-age=63072000" },
  // Send the full URL only to same-origin destinations.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Deny unused powerful features. microphone=(self) is REQUIRED: voice input
  // uses the Web Speech API, which needs microphone access on this origin.
  {
    key: "Permissions-Policy",
    value: "camera=(), geolocation=(), payment=(), usb=(), microphone=(self)",
  },
];

const nextConfig: NextConfig = {
  // Don't advertise the framework/version in responses.
  poweredByHeader: false,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Security headers on every response (pages, API routes and /public files).
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
