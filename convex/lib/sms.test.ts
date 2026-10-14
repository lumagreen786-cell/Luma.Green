import { describe, expect, it } from "vitest";

import {
  codeDelivery,
  isOsDigitalAccepted,
  msg91OtpRequest,
  osDigitalOtpRequest,
} from "./sms";

describe("codeDelivery", () => {
  it("sends through MSG91 when both keys are set", () => {
    expect(
      codeDelivery({
        MSG91_AUTH_KEY: " key ",
        MSG91_OTP_TEMPLATE_ID: "tpl",
        AUTH_DEV_MODE: "true",
      }),
    ).toEqual({ kind: "msg91", authKey: "key", templateId: "tpl" });
  });

  it("ignores the legacy dev flag and never logs codes", () => {
    expect(codeDelivery({ AUTH_DEV_MODE: "true" })).toEqual({ kind: "off" });
    expect(
      codeDelivery({ MSG91_AUTH_KEY: "key", AUTH_DEV_MODE: "true" }),
    ).toEqual({ kind: "off" });
  });

  it("is off otherwise — production without MSG91 never logs codes", () => {
    expect(codeDelivery({})).toEqual({ kind: "off" });
    expect(codeDelivery({ AUTH_DEV_MODE: "1" })).toEqual({ kind: "off" });
    expect(codeDelivery({ MSG91_AUTH_KEY: "key" })).toEqual({ kind: "off" });
  });
});

describe("msg91OtpRequest", () => {
  it("posts our code to the OTP API without the plus sign", () => {
    const { url, init } = msg91OtpRequest({
      phone: "+919876543210",
      code: "123456",
      authKey: "secret-key",
      templateId: "tpl-1",
    });
    const parsed = new URL(url);

    expect(parsed.origin + parsed.pathname).toBe(
      "https://control.msg91.com/api/v5/otp",
    );
    expect(parsed.searchParams.get("mobile")).toBe("919876543210");
    expect(parsed.searchParams.get("otp")).toBe("123456");
    expect(parsed.searchParams.get("template_id")).toBe("tpl-1");
    expect(parsed.searchParams.get("otp_expiry")).toBe("5");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ authkey: "secret-key" });
    // The key travels in a header, never in the URL.
    expect(url).not.toContain("secret-key");
  });
});

const osEnv = {
  OSDIGITAL_API_KEY: "test-secret",
  OSDIGITAL_SENDER_ID: "ENVRIN",
  OSDIGITAL_ENTITY_ID: "1234567890123456789",
  OSDIGITAL_TEMPLATE_ID: "9876543210123456789",
  OSDIGITAL_OTP_MESSAGE:
    "Your OTP is {#var#} to Verify Your ENVIRON INDIA account. Please do not share with anyone.",
};

it("uses the approved template and sends secrets only in the JSON body", () => {
  const delivery = codeDelivery(osEnv);
  expect(delivery.kind).toBe("osdigital");
  if (delivery.kind !== "osdigital") throw new Error("Expected OS Digital");
  const request = osDigitalOtpRequest(delivery, "+919876543210", "123456");
  expect(request.url).toBe("https://www.bulksmsindia.app/V2/http-api-post.php");
  expect(request.init.redirect).toBe("error");
  expect(JSON.parse(request.init.body as string)).toEqual({
    apikey: "test-secret",
    senderid: "ENVRIN",
    peid: osEnv.OSDIGITAL_ENTITY_ID,
    templateid: osEnv.OSDIGITAL_TEMPLATE_ID,
    number: "919876543210",
    format: "json",
    message:
      "Your OTP is 123456 to Verify Your ENVIRON INDIA account. Please do not share with anyone.",
  });
  expect(() =>
    osDigitalOtpRequest(delivery, "+919876543210,919876543211", "123456"),
  ).toThrow();
});

it("fails closed for partial settings even when dev or another provider is available", () => {
  expect(
    codeDelivery({
      OSDIGITAL_API_KEY: "key",
      AUTH_DEV_MODE: "true",
      MSG91_AUTH_KEY: "key",
      MSG91_OTP_TEMPLATE_ID: "template",
    }),
  ).toEqual({ kind: "off" });
  expect(
    codeDelivery({ ...osEnv, OSDIGITAL_OTP_MESSAGE: "No code placeholder" }),
  ).toEqual({ kind: "off" });
});

it("requires exactly one accepted recipient matching the requested phone", () => {
  const row = { id: "32-1", mobile: "919876543210", status: "SUBMITTED" };
  expect(
    isOsDigitalAccepted({ status: "OK", data: [row] }, "+919876543210"),
  ).toBe(true);
  for (const result of [
    null,
    {},
    { status: "OSD10" },
    { status: "OK", data: [] },
    { status: "OK", data: [row, row] },
    { status: "OK", data: [{ ...row, mobile: "919876543211" }] },
    { status: "OK", data: [{ ...row, status: "FAILED" }] },
  ]) {
    expect(isOsDigitalAccepted(result, "+919876543210")).toBe(false);
  }
});
