import type { MetadataRoute } from "next";

/**
 * PWA manifest (FR13). Colours mirror the design tokens in docs/DESIGN.md §2.
 * Icons: the scalable SVG plus raster 192/512 PNGs (Chrome's installability
 * requirement) and a maskable 512 for Android adaptive icons. iOS uses the
 * `app/apple-icon.png` file convention.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "कृषि साथी — Krishi Sathi",
    short_name: "कृषि साथी",
    description:
      "Hindi-first farming advisor: answers from a curated crop-guidance knowledge base, with sources.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FAF7F2",
    theme_color: "#16A34A",
    lang: "hi",
    dir: "ltr",
    categories: ["agriculture", "education"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
