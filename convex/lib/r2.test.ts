// @vitest-environment edge-runtime
import { afterEach, describe, expect, it, vi } from "vitest";

import { r2Env } from "../../src/lib/env";
import { deleteR2, getR2, putR2 } from "./r2";
import { mockR2 } from "./r2.testing";

const ref = {
  accountId: "a".repeat(32),
  bucket: "luma-test",
  key: "quality/12345678-1234-1234-1234-123456789abc",
};
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("R2 configuration and private transport", () => {
  it("keeps an unconfigured clone off but rejects invalid enabled settings", () => {
    expect(r2Env().writes).toBe("off");
    vi.stubEnv("R2_ENABLED", "yes");
    expect(r2Env().writes).toBe("invalid");
    mockR2();
    expect(r2Env().writes).toBe("on");
    vi.stubEnv("R2_ENABLED", "false");
    expect(r2Env().writes).toBe("off");
    expect(r2Env().config).not.toBeNull();
    vi.stubEnv("R2_ACCOUNT_ID", "https://attacker.test");
    expect(r2Env().config).toBeNull();
  });
  it("does not send secrets to redirected or arbitrary storage addresses", async () => {
    const provider = mockR2();
    await expect(
      putR2(
        { ...ref, key: "../another-object" },
        new ArrayBuffer(12),
        "image/png",
      ),
    ).rejects.toThrow("STORAGE_UNAVAILABLE");
    expect(provider.fetcher).not.toHaveBeenCalled();
    await putR2(ref, new ArrayBuffer(12), "image/png");
    expect(provider.fetcher).toHaveBeenCalledWith(
      expect.any(Request),
      expect.objectContaining({
        redirect: "error",
        signal: expect.any(AbortSignal),
      }),
    );
  });
  it("treats missing objects as missing and rejects oversized or truncated responses", async () => {
    const provider = mockR2();
    expect(await getR2(ref, 12, "test-hash")).toBeNull();
    provider.fetcher.mockResolvedValueOnce(new Response(new Uint8Array(13)));
    await expect(getR2(ref, 12, "test-hash")).rejects.toThrow(
      "STORAGE_UNAVAILABLE",
    );
    provider.fetcher.mockResolvedValueOnce(new Response(new Uint8Array(11)));
    await expect(getR2(ref, 12, "test-hash")).rejects.toThrow(
      "STORAGE_UNAVAILABLE",
    );
  });
  it("sanitizes network/provider errors and retries deletion only through the durable job", async () => {
    const provider = mockR2();
    provider.fetcher.mockRejectedValueOnce(
      new Error("SECRET provider diagnostic"),
    );
    await expect(putR2(ref, new ArrayBuffer(12), "image/png")).rejects.toThrow(
      "STORAGE_UNAVAILABLE",
    );
    expect(provider.fetcher).toHaveBeenCalledTimes(1);
    provider.fetcher.mockResolvedValueOnce(
      new Response("SECRET", { status: 503 }),
    );
    await expect(deleteR2(ref)).rejects.toThrow("STORAGE_UNAVAILABLE");
    provider.fetcher.mockResolvedValueOnce(new Response(null, { status: 404 }));
    await expect(deleteR2(ref)).resolves.toBeUndefined();
  });
});
