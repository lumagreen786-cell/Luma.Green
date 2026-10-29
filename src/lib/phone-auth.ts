import { type CodeErrorKey, codeErrorKey } from "@/components/auth/errors";
import { authClient } from "@/lib/auth-client";

import { requestBotToken } from "./turnstile";

export type SendCodeErrorKey = "sendFailed" | "sendRateLimited";
export type VerifyPhoneResult =
  | { kind: "authenticated" }
  | { kind: "second-factor" }
  | { kind: "error"; error: CodeErrorKey };

/** A lost connection must leave the form ready for another attempt. */
export async function requestPhoneCode(
  phone: string,
  isCurrent: () => boolean = () => true,
): Promise<SendCodeErrorKey | null> {
  try {
    if (!isCurrent()) return "sendFailed";
    const token = await requestBotToken();
    if (!isCurrent()) return "sendFailed";
    const { error } = await authClient.phoneNumber.sendOtp({
      phoneNumber: phone,
      ...(token && {
        fetchOptions: { headers: { "x-captcha-response": token } },
      }),
    });
    if (!error) return null;
    return error.status === 429 ? "sendRateLimited" : "sendFailed";
  } catch {
    return "sendFailed";
  }
}

export async function verifyPhoneCode(
  phone: string,
  code: string,
): Promise<VerifyPhoneResult> {
  try {
    const { data, error } = await authClient.phoneNumber.verify({
      phoneNumber: phone,
      code,
    });
    if (error) return { kind: "error", error: codeErrorKey(error) };
    if ("twoFactorRedirect" in data && data.twoFactorRedirect === true) {
      return { kind: "second-factor" };
    }
    return "token" in data && typeof data.token === "string" && data.token
      ? { kind: "authenticated" }
      : { kind: "error", error: "errorGeneric" };
  } catch {
    return { kind: "error", error: "errorGeneric" };
  }
}
