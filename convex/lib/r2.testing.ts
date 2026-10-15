import { vi } from "vitest";

/** In-memory provider, never sends requests to Cloudflare. */
export function mockR2() {
  vi.stubEnv("R2_ENABLED", "true");
  vi.stubEnv("R2_ACCOUNT_ID", "a".repeat(32));
  vi.stubEnv("R2_BUCKET_NAME", "luma-test");
  vi.stubEnv("R2_ACCESS_KEY_ID", "test-access");
  vi.stubEnv("R2_SECRET_ACCESS_KEY", "test-secret");
  const objects = new Map<string, ArrayBuffer>();
  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    if (!(input instanceof Request)) throw new Error("Expected signed request");
    if (!input.headers.get("Authorization")?.startsWith("AWS4-HMAC-SHA256"))
      throw new Error("Unsigned request");
    const key = new URL(input.url).pathname;
    switch (input.method) {
      case "PUT": {
        objects.set(key, await input.arrayBuffer());
        return new Response(null, { status: 200 });
      }
      case "GET": {
        return objects.has(key)
          ? new Response(objects.get(key))
          : new Response(null, { status: 404 });
      }
      case "DELETE": {
        objects.delete(key);
        return new Response(null, { status: 204 });
      }
      default: {
        throw new Error("Unexpected R2 operation");
      }
    }
  });
  vi.stubGlobal("fetch", fetcher);
  return { objects, fetcher };
}
