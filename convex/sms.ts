import { v } from "convex/values";

import { internalAction } from "./_generated/server";
import { maskPhone } from "./lib/phone";
import {
  codeDelivery,
  isOsDigitalAccepted,
  msg91OtpRequest,
  osDigitalOtpRequest,
} from "./lib/sms";

/** Sends one sign-in code. Scheduled by `sendOTP` in convex/auth.ts. */
export const sendCode = internalAction({
  args: { phone: v.string(), code: v.string() },
  returns: v.null(),
  handler: async (_ctx, { phone, code }) => {
    const delivery = codeDelivery({
      OSDIGITAL_API_KEY: process.env.OSDIGITAL_API_KEY,
      OSDIGITAL_SENDER_ID: process.env.OSDIGITAL_SENDER_ID,
      OSDIGITAL_ENTITY_ID: process.env.OSDIGITAL_ENTITY_ID,
      OSDIGITAL_TEMPLATE_ID: process.env.OSDIGITAL_TEMPLATE_ID,
      OSDIGITAL_OTP_MESSAGE: process.env.OSDIGITAL_OTP_MESSAGE,
      MSG91_AUTH_KEY: process.env.MSG91_AUTH_KEY,
      MSG91_OTP_TEMPLATE_ID: process.env.MSG91_OTP_TEMPLATE_ID,
      AUTH_DEV_MODE: process.env.AUTH_DEV_MODE,
    });

    switch (delivery.kind) {
      case "osdigital": {
        const { url, init } = osDigitalOtpRequest(delivery, phone, code);
        // Do not expose transport errors: these can include request secrets.
        try {
          const response = await fetch(url, {
            ...init,
            signal: AbortSignal.timeout(8000),
          });
          if (
            !response.ok ||
            !isOsDigitalAccepted(await response.json(), phone)
          ) {
            throw new Error("Provider rejected SMS.");
          }
        } catch {
          throw new Error("OS Digital did not confirm SMS acceptance.");
        }
        return null;
      }
      case "msg91": {
        const { url, init } = msg91OtpRequest({
          phone,
          code,
          authKey: delivery.authKey,
          templateId: delivery.templateId,
        });
        // Bound provider latency. Never retry a timed-out send automatically:
        // it may already have reached the provider.
        const response = await fetch(url, {
          ...init,
          signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) {
          throw new Error(
            `MSG91 refused the code for ${maskPhone(phone)} (${String(response.status)}).`,
          );
        }
        const result: unknown = await response.json();
        if (
          !result ||
          typeof result !== "object" ||
          !("type" in result) ||
          result.type !== "success"
        ) {
          throw new Error(
            `MSG91 did not accept the code for ${maskPhone(phone)}.`,
          );
        }
        return null;
      }
      case "off": {
        throw new Error("SMS is not configured on this deployment.");
      }
    }
  },
});
