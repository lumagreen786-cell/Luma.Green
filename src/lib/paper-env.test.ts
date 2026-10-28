import { afterEach, expect, it, vi } from "vitest";

import { paperTranscriptionEnv } from "./env";
afterEach(() => vi.unstubAllEnvs());
it("requires separate explicit activation and budget without inheriting photo allowance", () => {
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  vi.stubEnv("OPENROUTER_MODEL", "approved/model");
  vi.stubEnv("PAPER_TRANSCRIPTION_ENABLED", "false");
  vi.stubEnv("PAPER_TRANSCRIPTION_DAILY_LIMIT", "10");
  expect(paperTranscriptionEnv()).toBeUndefined();
  vi.stubEnv("PAPER_TRANSCRIPTION_ENABLED", "true");
  for (const cap of ["", "0", "101", "1.5", "wrong"]) {
    vi.stubEnv("PAPER_TRANSCRIPTION_DAILY_LIMIT", cap);
    expect(paperTranscriptionEnv()).toBeUndefined();
  }
  vi.stubEnv("PAPER_TRANSCRIPTION_DAILY_LIMIT", "2");
  expect(paperTranscriptionEnv()).toMatchObject({
    dailyLimit: 2,
    model: "approved/model",
  });
});
