import type { MetadataRoute } from "next";

/**
 * PWA manifest (FR13). Placeholder icon until Phase 6 finalizes assets.
 * Colours mirror the design tokens in docs/DESIGN.md §2.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "कृषि साथी — Krishi Sathi",
    short_name: "कृषि साथी",
    description:
      "Hindi-first farming advisor: answers from a curated crop-guidance knowledge base, with sources.",
    start_url: "/",
    display: "standalone",
    background_color: "#FAF7F2",
    theme_color: "#16A34A",
    lang: "hi",
    dir: "ltr",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
