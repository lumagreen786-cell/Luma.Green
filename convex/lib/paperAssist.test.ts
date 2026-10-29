import { expect, it } from "vitest";

import { assistInput, assistText } from "./paperAssist";
it("accepts only supported modes/locales and bounded plain text", () => {
  expect(assistInput("summary", "kn")).toEqual({
    mode: "summary",
    targetLocale: "kn",
  });
  expect(() => assistInput("advice", "en")).toThrow();
  expect(() => assistInput("translation", "xx")).toThrow();
  expect(assistText("<script>do not execute</script>")).toContain("<script>");
  expect(() => assistText("a".repeat(12_001))).toThrow();
  expect(() => assistText("अ".repeat(9000))).toThrow();
});
