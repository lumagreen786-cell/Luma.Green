import { expect, test } from "@playwright/test";

// Assert actual rendered web fonts, including Latin and both RTL locales.
const scriptFaces = {
  en: "Geist",
  kn: "Noto Sans Kannada",
  ur: "Noto Sans Arabic",
  as: "Noto Sans Bengali",
  or: "Noto Sans Oriya",
  si: "Noto Sans Sinhala",
  th: "Noto Sans Thai",
  ja: "Noto Sans JP",
  ko: "Noto Sans KR",
  zh: "Noto Sans SC",
  ar: "Noto Sans Arabic",
  ta: "Noto Sans Tamil",
  ml: "Noto Sans Malayalam",
};

for (const [locale, family] of Object.entries(scriptFaces)) {
  test(`${locale} loads its script face for the public heading`, async ({
    page,
  }) => {
    await page.goto(`/${locale}/how-it-works`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const fonts = await page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts]
        .filter((font) => font.status === "loaded")
        .map((font) => font.family.replaceAll('"', ""));
    });
    expect(fonts).toContain(family);
    // A body paragraph can load the face while the heading still falls back.
    // Ask Chromium which font actually painted the heading's glyphs.
    const session = await page.context().newCDPSession(page);
    await session.send("DOM.enable");
    await session.send("CSS.enable");
    const { root } = await session.send("DOM.getDocument");
    const { nodeId } = await session.send("DOM.querySelector", {
      nodeId: root.nodeId,
      selector: "h1",
    });
    const rendered = await session.send("CSS.getPlatformFontsForNode", {
      nodeId,
    });
    // CJK variable files expose "Thin" in their internal family metadata,
    // even when the rendered variation is Medium. Both are supplied web fonts.
    expect(
      rendered.fonts.some(
        (font) =>
          font.isCustomFont &&
          font.glyphCount > 0 &&
          (font.familyName === family || font.familyName === `${family} Thin`),
      ),
    ).toBe(true);
    await session.detach();
  });
}
