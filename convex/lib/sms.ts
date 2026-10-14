/** Optional SMS delivery configuration. Incomplete credentials fail closed. */

export interface SmsEnv {
  OSDIGITAL_API_KEY?: string;
  OSDIGITAL_SENDER_ID?: string;
  OSDIGITAL_ENTITY_ID?: string;
  OSDIGITAL_TEMPLATE_ID?: string;
  OSDIGITAL_OTP_MESSAGE?: string;
  MSG91_AUTH_KEY?: string;
  MSG91_OTP_TEMPLATE_ID?: string;
  AUTH_DEV_MODE?: string;
}

export type CodeDelivery =
  | {
      kind: "osdigital";
      apiKey: string;
      senderId: string;
      entityId: string;
      templateId: string;
      message: string;
    }
  | { kind: "msg91"; authKey: string; templateId: string }
  | { kind: "off" };

export function codeDelivery(env: SmsEnv): CodeDelivery {
  // Partial OS Digital configuration must never fall back to a different provider.
  if (
    [
      env.OSDIGITAL_API_KEY,
      env.OSDIGITAL_SENDER_ID,
      env.OSDIGITAL_ENTITY_ID,
      env.OSDIGITAL_TEMPLATE_ID,
      env.OSDIGITAL_OTP_MESSAGE,
    ].some((value) => value?.trim())
  ) {
    const apiKey = env.OSDIGITAL_API_KEY?.trim();
    const senderId = env.OSDIGITAL_SENDER_ID?.trim();
    const entityId = env.OSDIGITAL_ENTITY_ID?.trim();
    const templateId = env.OSDIGITAL_TEMPLATE_ID?.trim();
    const message = env.OSDIGITAL_OTP_MESSAGE;
    if (!apiKey || !senderId || !entityId || !templateId || !message) {
      return { kind: "off" };
    }
    if (
      !/^[A-Z]{6}$/.test(senderId) ||
      !/^\d+$/.test(entityId) ||
      !/^\d+$/.test(templateId) ||
      message.split("{#var#}").length !== 2 ||
      message.length > 1000
    )
      return { kind: "off" };
    return {
      kind: "osdigital",
      apiKey,
      senderId,
      entityId,
      templateId,
      message,
    };
  }
  const authKey = env.MSG91_AUTH_KEY?.trim();
  const templateId = env.MSG91_OTP_TEMPLATE_ID?.trim();
  return authKey && templateId
    ? { kind: "msg91", authKey, templateId }
    : { kind: "off" };
}

/** Minutes a code stays valid — matches `expiresIn` in convex/auth.ts. */
export const CODE_TTL_MINUTES = 5;

/**
 * MSG91's OTP API with our own code (Better Auth generates and checks it).
 * Docs: https://docs.msg91.com/otp/sendotp — verify the fields again when the
 * DLT templates are approved.
 */
export function msg91OtpRequest(input: {
  phone: string;
  code: string;
  authKey: string;
  templateId: string;
}): { url: string; init: RequestInit } {
  const url = new URL("https://control.msg91.com/api/v5/otp");
  url.searchParams.set("template_id", input.templateId);
  url.searchParams.set("mobile", input.phone.replace("+", ""));
  url.searchParams.set("otp", input.code);
  url.searchParams.set("otp_expiry", String(CODE_TTL_MINUTES));
  return {
    url: url.href,
    init: {
      method: "POST",
      headers: { authkey: input.authKey, accept: "application/json" },
    },
  };
}

/** JSON POST keeps the key and OTP out of request URLs. */
export function osDigitalOtpRequest(
  delivery: Extract<CodeDelivery, { kind: "osdigital" }>,
  phone: string,
  code: string,
): { url: string; init: RequestInit } {
  if (!/^\+91[6-9]\d{9}$/.test(phone) || !/^\d{6}$/.test(code)) {
    throw new Error("Invalid SMS recipient or code.");
  }
  return {
    url: "https://www.bulksmsindia.app/V2/http-api-post.php",
    init: {
      method: "POST",
      redirect: "error",
      headers: {
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        apikey: delivery.apiKey,
        senderid: delivery.senderId,
        peid: delivery.entityId,
        templateid: delivery.templateId,
        number: phone.slice(1),
        message: delivery.message.replace("{#var#}", () => code),
        format: "json",
      }),
    },
  };
}

/** Provider acceptance is not proof of handset delivery. */
export function isOsDigitalAccepted(result: unknown, phone: string): boolean {
  if (
    !result ||
    typeof result !== "object" ||
    !("status" in result) ||
    result.status !== "OK" ||
    !("data" in result) ||
    !Array.isArray(result.data) ||
    result.data.length !== 1
  )
    return false;
  const item: unknown = result.data[0];
  return Boolean(
    item &&
    typeof item === "object" &&
    "status" in item &&
    item.status === "SUBMITTED" &&
    "mobile" in item &&
    (item.mobile === phone.slice(1) || item.mobile === phone.slice(3)) &&
    "id" in item &&
    typeof item.id === "string" &&
    item.id.length > 0,
  );
}
