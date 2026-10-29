import {
  closeSync,
  constants,
  fstatSync,
  openSync,
  readFileSync,
} from "node:fs";

/** Check and read the same private file; never reopen its checked path. */
export function readPrivateAcceptanceFile(filePath: string): string {
  const descriptor = openSync(
    filePath,
    constants.O_RDONLY | constants.O_NOFOLLOW,
  );
  try {
    const metadata = fstatSync(descriptor);
    if (!metadata.isFile() || (metadata.mode & 0o077) !== 0)
      throw new Error(
        "Private acceptance files require restricted permissions.",
      );
    return readFileSync(descriptor, "utf8");
  } finally {
    closeSync(descriptor);
  }
}
