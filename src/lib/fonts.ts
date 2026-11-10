import {
  Noto_Sans,
  Noto_Sans_Arabic,
  Noto_Sans_Bengali,
  Noto_Sans_Gujarati,
  Noto_Sans_Gurmukhi,
  Noto_Sans_JP,
  Noto_Sans_Kannada,
  Noto_Sans_KR,
  Noto_Sans_Malayalam,
  Noto_Sans_Mono,
  Noto_Sans_Oriya,
  Noto_Sans_SC,
  Noto_Sans_Sinhala,
  Noto_Sans_Tamil,
  Noto_Sans_Telugu,
  Noto_Sans_Thai,
  Plus_Jakarta_Sans,
} from "next/font/google";

import type { Locale } from "@/i18n/locales";

/**
 * Noto supplies body copy and all script fallbacks; Plus Jakarta Sans supplies Latin UI/display type.
 *
 * Noto is the only widely available family with full, visually consistent
 * coverage of every script we ship, so the wordmark and the UI never fall back
 * to a mismatched system font when a user switches language.
 *
 * `Noto_Sans` covers Latin, Cyrillic, Greek, Vietnamese and Devanagari. Scripts
 * outside that set get a sibling Noto face, all exposing the SAME CSS variable
 * (`--font-noto-script`) — only one is ever attached to `<html>`, so the font
 * stack in `globals.css` stays a single, stable declaration.
 *
 * Every call below must pass a literal object: `next/font` reads these at build
 * time and rejects spreads or computed values.
 */

export const fontDisplay = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
  preload: false,
  // Explicit empty fallbacks also stop Turbopack from inserting Arial before
  // the script face. Shared CSS places system fallbacks after all web fonts.
  fallback: [],
  adjustFontFallback: false,
});

export const fontSans = Noto_Sans({
  variable: "--font-noto-sans",
  subsets: ["latin", "latin-ext", "devanagari"],
  display: "swap",
  preload: true,
  fallback: [],
  adjustFontFallback: false,
});

export const fontMono = Noto_Sans_Mono({
  variable: "--font-noto-mono",
  subsets: ["latin", "latin-ext"],
  display: "swap",
  preload: false,
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
});

/*
 * Script faces. `preload: false` on purpose — a face only downloads for the
 * locales that actually need it, and only for the glyphs rendered.
 */

const notoBengali = Noto_Sans_Bengali({
  variable: "--font-noto-script",
  subsets: ["bengali"],
  display: "swap",
  preload: false,
});

const notoTamil = Noto_Sans_Tamil({
  variable: "--font-noto-script",
  subsets: ["tamil"],
  display: "swap",
  preload: false,
});

const notoTelugu = Noto_Sans_Telugu({
  variable: "--font-noto-script",
  subsets: ["telugu"],
  display: "swap",
  preload: false,
});

const notoKannada = Noto_Sans_Kannada({
  variable: "--font-noto-script",
  subsets: ["kannada"],
  display: "swap",
  preload: false,
});

const notoMalayalam = Noto_Sans_Malayalam({
  variable: "--font-noto-script",
  subsets: ["malayalam"],
  display: "swap",
  preload: false,
});

const notoGujarati = Noto_Sans_Gujarati({
  variable: "--font-noto-script",
  subsets: ["gujarati"],
  display: "swap",
  preload: false,
});

const notoGurmukhi = Noto_Sans_Gurmukhi({
  variable: "--font-noto-script",
  subsets: ["gurmukhi"],
  display: "swap",
  preload: false,
});

const notoArabic = Noto_Sans_Arabic({
  variable: "--font-noto-script",
  subsets: ["arabic"],
  display: "swap",
  preload: false,
});

const notoSinhala = Noto_Sans_Sinhala({
  variable: "--font-noto-script",
  subsets: ["sinhala"],
  display: "swap",
  preload: false,
});

const notoThai = Noto_Sans_Thai({
  variable: "--font-noto-script",
  subsets: ["thai"],
  display: "swap",
  preload: false,
});

const notoOdia = Noto_Sans_Oriya({
  variable: "--font-noto-script",
  subsets: ["oriya"],
  display: "swap",
  preload: false,
});

const notoJapanese = Noto_Sans_JP({
  variable: "--font-noto-script",
  display: "swap",
  preload: false,
});

const notoKorean = Noto_Sans_KR({
  variable: "--font-noto-script",
  display: "swap",
  preload: false,
});

const notoChinese = Noto_Sans_SC({
  variable: "--font-noto-script",
  display: "swap",
  preload: false,
});

/**
 * Locales absent from this map are covered by `fontSans` itself
 * (Latin, Cyrillic and Devanagari scripts).
 */
const scriptFontByLocale: Partial<Record<Locale, { variable: string }>> = {
  bn: notoBengali,
  as: notoBengali,
  si: notoSinhala,
  th: notoThai,
  or: notoOdia,
  ja: notoJapanese,
  ko: notoKorean,
  zh: notoChinese,
  ta: notoTamil,
  te: notoTelugu,
  kn: notoKannada,
  ml: notoMalayalam,
  gu: notoGujarati,
  pa: notoGurmukhi,
  ur: notoArabic,
  ar: notoArabic,
};

/** Class names to put on `<html>` for a given locale. */
export function fontClassName(locale: Locale): string {
  return [
    fontDisplay.variable,
    fontSans.variable,
    fontMono.variable,
    scriptFontByLocale[locale]?.variable,
    "antialiased",
  ]
    .filter(Boolean)
    .join(" ");
}
