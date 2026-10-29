import type * as NodeFs from "node:fs";
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

const race = vi.hoisted(() => ({ file: "", swapAfterMetadata: false }));
vi.mock("node:fs", async (original) => {
  const fs = await original<typeof NodeFs>();
  return {
    ...fs,
    readFileSync(file: string | number) {
      // Replace the path at the actual read boundary, using only synthetic files.
      if (
        race.swapAfterMetadata &&
        (typeof file === "number" || file === race.file)
      ) {
        race.swapAfterMetadata = false;
        fs.renameSync(race.file, `${race.file}.original`);
        fs.writeFileSync(race.file, "synthetic replacement", { mode: 0o600 });
      }
      return fs.readFileSync(file, "utf8");
    },
  };
});

import { readPrivateAcceptanceFile } from "../../scripts/local-acceptance/private-file";

const scratch: string[] = [];
afterEach(() => {
  race.file = "";
  race.swapAfterMetadata = false;
  for (const directory of scratch.splice(0))
    rmSync(directory, { recursive: true, force: true });
});
function fixture() {
  const directory = mkdtempSync(path.join(tmpdir(), "luma-private-file-test-"));
  scratch.push(directory);
  const file = path.join(directory, "session.json");
  writeFileSync(file, "synthetic original", { mode: 0o600 });
  return { directory, file };
}

describe("private local acceptance files", () => {
  it("reads owner-only regular files and rejects group/public access", () => {
    const { file } = fixture();
    expect(readPrivateAcceptanceFile(file)).toBe("synthetic original");
    chmodSync(file, 0o644);
    expect(() => readPrivateAcceptanceFile(file)).toThrow(
      "restricted permissions",
    );
  });
  it("reads the checked file even when its path is replaced after metadata validation", () => {
    const { file } = fixture();
    race.file = file;
    race.swapAfterMetadata = true;
    expect(readPrivateAcceptanceFile(file)).toBe("synthetic original");
    expect(readFileSync(file, "utf8")).toBe("synthetic replacement");
  });
  it("rejects symlink targets instead of following a different private file", () => {
    const { directory, file } = fixture();
    const link = path.join(directory, "linked.json");
    symlinkSync(file, link);
    expect(() => readPrivateAcceptanceFile(link)).toThrow();
  });
});
