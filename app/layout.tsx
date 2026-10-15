import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Devanagari } from "next/font/google";
import "./globals.css";

// Hindi-first: Latin (Inter) + Devanagari (Noto Sans Devanagari) per DESIGN §2.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const notoSansDevanagari = Noto_Sans_Devanagari({
  variable: "--font-noto-devanagari",
  subsets: ["devanagari"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "कृषि साथी — Hindi-first farming advisor",
  description:
    "Smallholder farming questions answered in Hindi or English from a curated crop-guidance knowledge base, with sources and an honest refusal when the answer is not covered.",
};

// `viewport-fit=cover` lets the composer padding use env(safe-area-inset-*)
// on notched phones (DESIGN §1.4, §2).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#16A34A",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // lang="hi" is the default language for the app; individual blocks carry
    // their own lang attribute (AGENTS "Always" #1).
    <html
      lang="hi"
      className={`${inter.variable} ${notoSansDevanagari.variable} h-full`}
    >
      <body className="flex min-h-full flex-col antialiased">{children}</body>
    </html>
  );
}
