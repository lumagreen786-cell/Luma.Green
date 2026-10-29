import { afterEach, expect, it, vi } from "vitest";

import { paperAssistanceEnv } from "./env";
afterEach(() => vi.unstubAllEnvs());
it("requires its own enabled flag, explicit bounded budget and approved model settings", () => {
  vi.stubEnv("OPENROUTER_API_KEY", "fake-key");
  vi.stubEnv("OPENROUTER_MODEL", "approved/model");
  vi.stubEnv("PAPER_TRANSCRIPTION_ENABLED", "true");
  vi.stubEnv("PAPER_TRANSCRIPTION_DAILY_LIMIT", "100");
  vi.stubEnv("PAPER_ASSISTANCE_ENABLED", "false");
  expect(paperAssistanceEnv()).toBeUndefined();
  vi.stubEnv("PAPER_ASSISTANCE_ENABLED", "true");
  for (const budget of ["", "0", "101", "1.5", "NaN"]) {
    vi.stubEnv("PAPER_ASSISTANCE_DAILY_LIMIT", budget);
    expect(paperAssistanceEnv()).toBeUndefined();
  }
  vi.stubEnv("PAPER_ASSISTANCE_DAILY_LIMIT", "2");
  expect(paperAssistanceEnv()).toMatchObject({
    dailyLimit: 2,
    model: "approved/model",
  });
  vi.stubEnv("OPENROUTER_API_KEY", "");
  expect(paperAssistanceEnv()).toBeUndefined();
});
