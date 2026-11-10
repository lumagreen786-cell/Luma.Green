import { createHash } from "node:crypto";
import {
  closeSync,
  constants,
  fstatSync,
  openSync,
  readFileSync,
  readSync,
  realpathSync,
} from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";

import { z } from "zod";

const kinds = ["baseline", "monitoring", "claim_rights", "verification_report"];
const reference = z.string().trim().min(1).max(160);
const snapshotSchema = z.object({
  schemaVersion: z.literal(1),
  purpose: z.literal("internal_carbon_review"),
  evidenceStatus: z.literal("reported_unverified"),
  projectId: reference,
  method: reference.optional(),
  industry: reference.optional(),
  revision: z.number().int().positive(),
  references: z.array(z.object({ kind: reference, reference })).max(40),
});
const packageSchema = z.strictObject({
  snapshot: reference,
  baseline: reference,
  monitoring: reference,
  claim_rights: reference,
  verification_report: reference,
});
const maxDocumentBytes = 32 * 1024 * 1024;

function readPrivateFile(root, name) {
  if (path.isAbsolute(name)) throw new Error("Expected a relative file name.");
  const file = realpathSync(path.resolve(root, name));
  const fromRoot = path.relative(root, file);
  if (
    fromRoot === ".." ||
    path.isAbsolute(fromRoot) ||
    fromRoot.startsWith(`..${path.sep}`)
  ) {
    throw new Error("File is outside the private directory.");
  }
  const fd = openSync(
    file,
    // Open read-only and reject a replaced symlink. Nonblocking avoids a FIFO
    // wait if another local process replaces the file before open.
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  );
  try {
    const info = fstatSync(fd);
    if (!info.isFile() || info.size === 0 || info.size > maxDocumentBytes) {
      throw new Error("Expected a nonempty file of up to 32 MiB.");
    }
    const bytes = Buffer.alloc(info.size + 1);
    let offset = 0;
    while (offset < bytes.length) {
      const count = readSync(fd, bytes, offset, bytes.length - offset, null);
      if (count === 0) break;
      offset += count;
    }
    if (offset !== info.size || fstatSync(fd).mtimeMs !== info.mtimeMs) {
      throw new Error("File changed during the integrity check.");
    }
    return bytes.subarray(0, offset);
  } finally {
    closeSync(fd);
  }
}

function integrity(bytes) {
  return {
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

function readEvidencePackage(directory, source, expectedMethod) {
  const paths = packageSchema.parse(source);
  const root = realpathSync(directory);
  const snapshotBytes = readPrivateFile(root, paths.snapshot);
  const snapshot = snapshotSchema.parse(
    JSON.parse(snapshotBytes.toString("utf8")),
  );
  if (expectedMethod !== undefined && snapshot.method !== expectedMethod) {
    throw new Error(
      "The reviewed project method does not match the pilot program.",
    );
  }
  return { paths, root, snapshot, snapshotBytes };
}

function fingerprintEvidencePackage({ paths, root, snapshot, snapshotBytes }) {
  const documents = kinds.map((kind) => {
    const references = snapshot.references.filter(
      (entry) => entry.kind === kind,
    );
    if (references.length !== 1)
      throw new Error("Expected one reference per required kind.");
    return { kind, ...integrity(readPrivateFile(root, paths[kind])) };
  });
  return {
    schemaVersion: 1,
    purpose: "local_evidence_integrity",
    evidenceStatus: "reported_unverified",
    projectId: snapshot.projectId,
    revision: snapshot.revision,
    snapshot: integrity(snapshotBytes),
    documents,
  };
}

/** Fingerprint a private review package without copying its files or names. */
export function buildEvidenceManifest(directory, source, expectedMethod) {
  return fingerprintEvidencePackage(
    readEvidencePackage(directory, source, expectedMethod),
  );
}

export function buildFilingEvidenceManifest(
  directory,
  source,
  method,
  industry,
) {
  const evidence = readEvidencePackage(directory, source, method);
  const assignedIndustry = evidence.snapshot.industry;
  if (assignedIndustry !== undefined && assignedIndustry !== industry) {
    throw new Error(
      "The reviewed project industry does not match the pilot program.",
    );
  }
  return {
    manifest: fingerprintEvidencePackage(evidence),
    workspaceIndustryStatus:
      assignedIndustry === undefined ? "unassigned" : "matched",
  };
}

export function verifyEvidenceManifest(directory, source, manifest) {
  return isDeepStrictEqual(buildEvidenceManifest(directory, source), manifest);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const [operation, directory, indexPath, manifestPath] =
      process.argv.slice(2);
    if (
      !directory ||
      !indexPath ||
      !(
        (operation === "build" && process.argv.length === 5) ||
        (operation === "verify" && manifestPath && process.argv.length === 6)
      )
    )
      throw new Error("Invalid command.");
    const source = JSON.parse(readFileSync(indexPath, "utf8"));
    if (operation === "build") {
      const result = buildEvidenceManifest(directory, source);
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      const matches = verifyEvidenceManifest(directory, source, manifest);
      process.stdout.write(
        matches
          ? "Files match the supplied manifest.\n"
          : "File integrity mismatch.\n",
      );
      if (!matches) process.exitCode = 1;
    }
  } catch {
    process.stderr.write(
      "Could not read or validate the private evidence package.\n",
    );
    process.exitCode = 2;
  }
}
