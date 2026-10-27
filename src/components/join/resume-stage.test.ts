import { expect, it } from "vitest";

import { resumeStage } from "./resume-stage";

it("resumes the first incomplete group and keeps a complete draft on its last group", () => {
  const groups = [["name"], ["address"], ["hours"]];
  expect(resumeStage(groups, [{ path: ["address"] }])).toBe(1);
  expect(resumeStage(groups, [{ path: ["name"] }, { path: ["hours"] }])).toBe(
    0,
  );
  expect(resumeStage(groups, [])).toBe(2);
  expect(resumeStage(groups, [{ path: ["unknown"] }])).toBe(0);
});
