import type { ErrorEvent } from "@sentry/nextjs";
import { afterEach, describe, expect, it, vi } from "vitest";

const config = vi.hoisted(() => ({
  NEXT_PUBLIC_TELEMETRY_ENABLED: false,
  NEXT_PUBLIC_SENTRY_DSN: "",
}));
const sdk = vi.hoisted(() => ({ init: vi.fn(), captureRequestError: vi.fn() }));
vi.mock("@/lib/env", () => ({ clientEnv: config }));
vi.mock("@sentry/nextjs", () => sdk);

import { onRequestError, register } from "@/instrumentation";
import {
  isMonitoringEnabled,
  monitoringOptions,
  scrubMonitoringEvent,
} from "@/lib/monitoring";
import { monitoringErrorCopy } from "@/lib/monitoring-copy";

const request = {
  path: "/admin?token=secret",
  method: "POST",
  headers: { authorization: "secret" },
};
const context = {
  routerKind: "App Router",
  routePath: "/admin",
  routeType: "render",
  revalidateReason: undefined,
} as const;

afterEach(() => {
  config.NEXT_PUBLIC_TELEMETRY_ENABLED = false;
  config.NEXT_PUBLIC_SENTRY_DSN = "";
  vi.clearAllMocks();
});

describe("optional error monitoring", () => {
  it("uses the same disabled and scrubbed configuration from the project-root entry", async () => {
    config.NEXT_PUBLIC_SENTRY_DSN = "https://public@example.com/1";
    vi.resetModules();
    await import("../../instrumentation-client");
    expect(sdk.init).not.toHaveBeenCalled();
    config.NEXT_PUBLIC_TELEMETRY_ENABLED = true;
    vi.resetModules();
    await import("../../instrumentation-client");
    await vi.waitFor(() => {
      expect(sdk.init).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: true,
          tracesSampleRate: 0,
          beforeSend: expect.any(Function),
        }),
      );
    });
  });

  it("keeps the browser SDK inactive until both settings are present", async () => {
    vi.resetModules();
    await import("@/instrumentation-client");
    expect(sdk.init).not.toHaveBeenCalled();
    config.NEXT_PUBLIC_TELEMETRY_ENABLED = true;
    config.NEXT_PUBLIC_SENTRY_DSN = "https://public@example.com/1";
    vi.resetModules();
    await import("@/instrumentation-client");
    await vi.waitFor(() => {
      expect(sdk.init).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: true,
          beforeSend: expect.any(Function),
        }),
      );
    });
  });

  it("does not initialize or capture with missing configuration or a disabled switch", async () => {
    await register();
    await onRequestError(new Error("secret"), request, context);
    config.NEXT_PUBLIC_SENTRY_DSN = "https://public@example.com/1";
    await register();
    expect(isMonitoringEnabled()).toBe(false);
    config.NEXT_PUBLIC_SENTRY_DSN = " ";
    config.NEXT_PUBLIC_TELEMETRY_ENABLED = true;
    await register();
    expect(sdk.init).not.toHaveBeenCalled();
    expect(sdk.captureRequestError).not.toHaveBeenCalled();
  });

  it("initializes and captures request errors when the operator enables a configured DSN", async () => {
    config.NEXT_PUBLIC_TELEMETRY_ENABLED = true;
    config.NEXT_PUBLIC_SENTRY_DSN = "https://public@example.com/1";
    await register();
    const error = new Error("private details");
    await onRequestError(error, request, context);
    expect(sdk.init).toHaveBeenCalledWith(
      expect.objectContaining({
        sendDefaultPii: false,
        tracesSampleRate: 0,
        profilesSampleRate: 0,
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 0,
        enableLogs: false,
        beforeSend: scrubMonitoringEvent,
      }),
    );
    expect(sdk.captureRequestError).toHaveBeenCalledWith(
      error,
      request,
      context,
    );
  });

  it("removes private content from every event surface while keeping code locations", () => {
    const event: ErrorEvent = {
      type: undefined,
      event_id: "event1",
      message: "secret phone",
      user: { email: "secret@example.com", ip_address: "[synthetic-ip]" },
      request: {
        url: "https://example.com/customer/secret?token=secret",
        data: "secret",
        headers: { cookie: "secret" },
      },
      breadcrumbs: [{ message: "secret", data: { body: "secret" } }],
      extra: { secret: "secret" },
      contexts: { private: { secret: "secret" } },
      tags: { phone: "secret" },
      transaction: "/customer/secret",
      fingerprint: ["secret"],
      exception: {
        values: [
          {
            type: "TypeError",
            value: "secret",
            mechanism: { type: "generic", data: { secret: "secret" } },
            stacktrace: {
              frames: [
                {
                  filename:
                    "https://example.com/_next/static/chunks/app.js?token=secret",
                  function: "submit",
                  lineno: 42,
                  colno: 10,
                  vars: { secret: "secret" },
                  pre_context: ["secret"],
                  context_line: "secret",
                },
              ],
            },
          },
        ],
      },
    };
    const result = scrubMonitoringEvent(event);
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(result?.exception?.values?.[0]).toMatchObject({
      type: "TypeError",
      stacktrace: {
        frames: [
          {
            filename: "_next/static/chunks/app.js",
            function: "submit",
            lineno: 42,
            colno: 10,
          },
        ],
      },
    });
    expect(event.user).toBeDefined();
  });

  it("drops free-form messages and unknown error names rather than sending record content", () => {
    expect(
      scrubMonitoringEvent({ type: undefined, message: "private message" }),
    ).toBeNull();
    const result = scrubMonitoringEvent({
      type: undefined,
      exception: {
        values: [{ type: "Customer secret@example.com", value: "secret" }],
      },
    });
    expect(result?.exception?.values?.[0]?.type).toBe("Error");
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("excludes integrations that collect request content and local variables", () => {
    expect(
      monitoringOptions().integrations([
        { name: "GlobalHandlers" },
        { name: "BrowserSession" },
        { name: "ProcessSession" },
        { name: "HttpContext" },
        { name: "RequestData" },
        { name: "Breadcrumbs" },
        { name: "LocalVariables" },
        { name: "ContextLines" },
      ]),
    ).toEqual([{ name: "GlobalHandlers" }]);
  });

  it("uses the existing translated failure controls without a provider", () => {
    expect(monitoringErrorCopy("/ar/app").locale).toBe("ar");
    expect(monitoringErrorCopy("/ar/app").retry).not.toBe("Try again");
    expect(monitoringErrorCopy("/admin")).toMatchObject({
      locale: "en",
      retry: "Try again",
    });
  });
});
