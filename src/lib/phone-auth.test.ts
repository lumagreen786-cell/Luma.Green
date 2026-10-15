import { beforeEach, describe, expect, it, vi } from "vitest";

import { requestPhoneCode, verifyPhoneCode } from "./phone-auth";

const calls = vi.hoisted(() => ({ sendOtp: vi.fn(), verify: vi.fn() }));
const bot = vi.hoisted(() => vi.fn());
vi.mock("./turnstile", () => ({ requestBotToken: bot }));
vi.mock("@/lib/auth-client", () => ({ authClient: { phoneNumber: calls } }));
beforeEach(() => vi.resetAllMocks());

describe("phone authentication failures", () => {
  it("adds a fresh proof to each send and never sends after bot-check failure", async () => {
    bot
      .mockResolvedValueOnce("proof-a")
      .mockResolvedValueOnce("proof-b")
      .mockRejectedValueOnce(new Error("blocked"));
    calls.sendOtp.mockResolvedValue({ error: null });
    expect(await requestPhoneCode("+919876543210")).toBeNull();
    expect(await requestPhoneCode("+919876543210")).toBeNull();
    expect(await requestPhoneCode("+919876543210")).toBe("sendFailed");
    expect(calls.sendOtp).toHaveBeenCalledTimes(2);
    expect(calls.sendOtp).toHaveBeenNthCalledWith(1, {
      phoneNumber: "+919876543210",
      fetchOptions: { headers: { "x-captcha-response": "proof-a" } },
    });
    expect(calls.sendOtp).toHaveBeenNthCalledWith(2, {
      phoneNumber: "+919876543210",
      fetchOptions: { headers: { "x-captcha-response": "proof-b" } },
    });
  });
  it("distinguishes an SMS quota from a provider or network failure", async () => {
    calls.sendOtp
      .mockResolvedValueOnce({ error: { status: 429 } })
      .mockResolvedValueOnce({ error: { status: 503 } })
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce({ error: null });
    expect(await requestPhoneCode("+919876543210")).toBe("sendRateLimited");
    expect(await requestPhoneCode("+919876543210")).toBe("sendFailed");
    expect(await requestPhoneCode("+919876543210")).toBe("sendFailed");
    expect(await requestPhoneCode("+919876543210")).toBeNull();
  });

  it("keeps verification retryable after a lost connection", async () => {
    calls.verify
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce({ error: { code: "OTP_EXPIRED" } })
      .mockResolvedValueOnce({ error: null, data: { token: "test-session" } });
    expect(await verifyPhoneCode("+919876543210", "123456")).toEqual({
      kind: "error",
      error: "errorGeneric",
    });
    expect(await verifyPhoneCode("+919876543210", "123456")).toEqual({
      kind: "error",
      error: "errorExpired",
    });
    expect(await verifyPhoneCode("+919876543210", "123456")).toEqual({
      kind: "authenticated",
    });
  });
  it("distinguishes an authenticator challenge from authentication and fails closed on a missing response", async () => {
    calls.verify
      .mockResolvedValueOnce({ error: null, data: { twoFactorRedirect: true } })
      .mockResolvedValueOnce({ error: null });
    expect(await verifyPhoneCode("+919876543210", "123456")).toEqual({
      kind: "second-factor",
    });
    expect(await verifyPhoneCode("+919876543210", "123456")).toEqual({
      kind: "error",
      error: "errorGeneric",
    });
  });
});
