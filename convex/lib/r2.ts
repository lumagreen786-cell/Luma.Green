import { AwsClient } from "aws4fetch";
import { ConvexError } from "convex/values";

import { r2Env } from "../../src/lib/env";
import { QUALITY_MAX_BYTES } from "./qualityContent";

export interface R2Reference {
  accountId: string;
  bucket: string;
  key: string;
}

/** Signed server requests only. Never return provider credentials or URLs. */
async function request(
  ref: R2Reference,
  method: "PUT" | "GET" | "DELETE",
  bytes?: ArrayBuffer,
  contentType?: string,
  sha256?: string,
) {
  const { config } = r2Env();
  if (
    config?.accountId !== ref.accountId ||
    config.bucket !== ref.bucket ||
    !/^(?:quality|household|application)\/[a-f0-9-]{36}$/.test(ref.key)
  )
    throw new ConvexError("STORAGE_UNAVAILABLE");
  try {
    const client = new AwsClient({
      ...config,
      service: "s3",
      region: "auto",
      retries: 0,
    });
    const signed = await client.sign(
      `https://${config.accountId}.r2.cloudflarestorage.com/${config.bucket}/${ref.key}`,
      {
        method,
        ...(bytes && { body: bytes }),
        headers: {
          ...(contentType && { "Content-Type": contentType }),
          ...(sha256 && { "X-Amz-Content-Sha256": sha256 }),
        },
      },
    );
    return await fetch(signed, {
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new ConvexError("STORAGE_UNAVAILABLE");
  }
}
export async function putR2(
  ref: R2Reference,
  bytes: ArrayBuffer,
  contentType: string,
  sha256?: string,
) {
  const response = await request(ref, "PUT", bytes, contentType, sha256);
  if (!response.ok) throw new ConvexError("STORAGE_UNAVAILABLE");
}
export async function deleteR2(ref: R2Reference) {
  const response = await request(ref, "DELETE");
  if (!response.ok && response.status !== 404)
    throw new ConvexError("STORAGE_UNAVAILABLE");
}
export async function getR2(
  ref: R2Reference,
  expectedSize: number,
  sha256: string,
  maxBytes = QUALITY_MAX_BYTES,
): Promise<Blob | null> {
  if (
    !Number.isSafeInteger(expectedSize) ||
    expectedSize < 0 ||
    expectedSize > maxBytes
  )
    throw new ConvexError("STORAGE_UNAVAILABLE");
  const response = await request(ref, "GET");
  if (response.status === 404) return null;
  if (!response.ok || !response.body)
    throw new ConvexError("STORAGE_UNAVAILABLE");
  const reader = response.body.getReader();
  const bytes = new Uint8Array(expectedSize);
  let size = 0;
  try {
    while (size <= expectedSize) {
      const part = await reader.read();
      if (part.done) break;
      const next = size + part.value.byteLength;
      if (next > expectedSize) throw new Error("Size mismatch");
      bytes.set(part.value, size);
      size = next;
    }
    if (size !== expectedSize) throw new Error("Size mismatch");
    const hash = [
      ...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    ]
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("");
    if (hash !== sha256) throw new Error("Checksum mismatch");
    return new Blob([bytes]);
  } catch {
    try {
      await reader.cancel();
    } catch {
      /* Preserve the sanitized read failure if cancellation also fails. */
    }
    throw new ConvexError("STORAGE_UNAVAILABLE");
  } finally {
    reader.releaseLock();
  }
}
