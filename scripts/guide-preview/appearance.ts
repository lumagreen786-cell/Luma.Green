/** Preserve the early theme bootstrap when applying this build's locale font classes. */
export function fixtureFontClasses(
  fontClasses: string,
  isDark: boolean,
): string {
  const fonts = fontClasses
    .split(/\s+/u)
    .filter((name) => name && name !== "dark" && name !== "light");
  return [...fonts, ...(isDark ? ["dark"] : [])].join(" ");
}
