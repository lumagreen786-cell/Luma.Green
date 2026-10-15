import { APIError } from "better-auth/api";
import { z } from "zod";

import { turnstileEnv } from "../../src/lib/env";

const resultSchema = z.object({
  success: z.boolean(),
  hostname: z.string().optional(),
  action: z.string().optional(),
});

/** Called by the real HTTP auth handler, including direct Convex requests. */
export async function verifyBotToken(token: string | null | undefined) {
  const config = turnstileEnv();
  if (config.kind === "off") return;
  if (config.kind === "invalid") throw unavailable();
  if (!token || token.length > 2048) throw rejected();

  let result: z.infer<typeof resultSchema>;
  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: config.secret, response: token }),
        redirect: "error",
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!response.ok) throw new Error("Verification unavailable");
    result = resultSchema.parse(await response.json());
  } catch {
    // Never include provider output, tokens, credentials, or personal data.
    throw unavailable();
  }
  if (
    !result.success ||
    result.action !== "otp_send" ||
    !result.hostname ||
    !config.hostnames.includes(result.hostname)
  ) {
    throw rejected();
  }
}

function unavailable() {
  return new APIError("SERVICE_UNAVAILABLE", {
    code: "BOT_CHECK_UNAVAILABLE",
    message: "Verification unavailable. Please try again.",
  });
}
function rejected() {
  return new APIError("FORBIDDEN", {
    code: "BOT_CHECK_FAILED",
    message: "Verification failed. Please try again.",
  });
}
