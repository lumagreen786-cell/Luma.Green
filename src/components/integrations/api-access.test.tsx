import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Id } from "../../../convex/_generated/dataModel";
import arabic from "../../../messages/ar.json";
import english from "../../../messages/en.json";
import urdu from "../../../messages/ur.json";
import { type AccessData, ApiAccess } from "./api-access";

const now = new Date("2026-10-02T08:00:00.000Z");
const keyId = "fixture-key-1" as Id<"integrationKeys">;
const token = "lg_live_fixture_token_only";
const expiresAt = now.getTime() + 30 * 86_400_000;
const create = vi.fn();
const revoke = vi.fn();
const copy = vi.fn();
const key: AccessData["keys"][number] = {
  id: keyId,
  label: "Factory ERP",
  prefix: "lg_live_12345678",
  scopes: ["organization:read", "inventory:read"],
  createdAt: now.getTime(),
  expiresAt,
};
const empty = { canManage: true, keys: [] } satisfies AccessData;

function content(
  data: AccessData | undefined,
  locale: "en" | "ar" | "ur" = "en",
) {
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={{ en: english, ar: arabic, ur: urdu }[locale]}
      now={now}
      timeZone="Asia/Kolkata"
      onError={(error) => {
        throw error;
      }}
    >
      <div dir={locale === "en" ? "ltr" : "rtl"}>
        <ApiAccess data={data} onCreate={create} onRevoke={revoke} />
      </div>
    </NextIntlClientProvider>
  );
}
async function submit() {
  await userEvent.type(
    screen.getByRole("textbox", { name: "System name" }),
    "Factory ERP",
  );
  await userEvent.click(screen.getByRole("button", { name: "Create key" }));
}
beforeEach(() => {
  create.mockReset().mockResolvedValue({ token, keyId, expiresAt });
  revoke.mockReset().mockResolvedValue(null);
  copy.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: copy },
  });
});

describe("business API key controls", () => {
  it.each(["ar", "ur"] as const)(
    "keeps the expiry selector aligned with its %s form",
    (locale) => {
      const messages = locale === "ar" ? arabic : urdu;
      render(content(empty, locale));
      const expiry = screen.getByRole("combobox", {
        name: messages.integrations.expiry,
      });
      expect(expiry).toHaveAttribute("dir", "rtl");
      expect(expiry).toHaveTextContent(locale === "ar" ? "30 أيام" : "30 دن");
    },
  );
  it("creates only selected permissions and shows the secret once without storing it", async () => {
    const storage = vi.spyOn(Storage.prototype, "setItem");
    render(content(empty));
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Business stock" }),
    );
    await submit();
    expect(create).toHaveBeenCalledWith({
      label: "Factory ERP",
      scopes: ["organization:read", "inventory:read"],
      expiresInDays: 30,
    });
    expect(
      await screen.findByRole("textbox", { name: "New API key" }),
    ).toHaveValue(token);
    expect(
      screen.queryByRole("button", { name: "Create key" }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Copy key" }));
    expect(copy).toHaveBeenCalledWith(token);
    expect(await screen.findByRole("status")).toHaveTextContent("Key copied.");
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByDisplayValue(token)).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "System name" })).toHaveValue(
      "",
    );
    expect(storage).not.toHaveBeenCalled();
    storage.mockRestore();
  });
  it("keeps the one-time key available when clipboard access fails", async () => {
    copy.mockRejectedValueOnce(new Error("denied"));
    render(content(empty));
    await submit();
    await userEvent.click(screen.getByRole("button", { name: "Copy key" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Copy failed. Select and copy the key manually.",
    );
    expect(screen.getByRole("textbox", { name: "New API key" })).toHaveValue(
      token,
    );
  });
  it("does not create a key without a name and a permission", async () => {
    render(content(empty));
    expect(screen.getByRole("button", { name: "Create key" })).toBeDisabled();
    await userEvent.type(
      screen.getByRole("textbox", { name: "System name" }),
      "ERP",
    );
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Business details" }),
    );
    expect(screen.getByRole("button", { name: "Create key" })).toBeDisabled();
    expect(create).not.toHaveBeenCalled();
  });
  it("preserves choices after a create failure and allows a retry", async () => {
    create.mockRejectedValueOnce(new Error("offline"));
    render(content(empty));
    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      english.integrations.createError,
    );
    expect(screen.getByRole("textbox", { name: "System name" })).toHaveValue(
      "Factory ERP",
    );
    await userEvent.click(screen.getByRole("button", { name: "Create key" }));
    expect(
      await screen.findByRole("textbox", { name: "New API key" }),
    ).toHaveValue(token);
  });
  it("blocks duplicate submissions while creation is pending", async () => {
    create.mockReturnValue(
      new Promise(() => {
        /* Keep the request pending to test duplicate prevention. */
      }),
    );
    render(content(empty));
    await submit();
    expect(screen.getByRole("button", { name: "Creating…" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "System name" })).toBeDisabled();
    expect(create).toHaveBeenCalledTimes(1);
  });
  it("shows only prefixes and requires confirmation before revocation", async () => {
    render(content({ canManage: true, keys: [key] }));
    expect(screen.getByText("lg_live_12345678…")).toBeVisible();
    await userEvent.click(
      screen.getByRole("button", { name: "Revoke Factory ERP" }),
    );
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Systems using “Factory ERP” will lose access immediately.",
    );
    expect(revoke).not.toHaveBeenCalled();
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Cancel",
      }),
    );
    expect(revoke).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole("button", { name: "Revoke Factory ERP" }),
    );
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Revoke",
      }),
    );
    expect(revoke).toHaveBeenCalledWith(keyId);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Active", { exact: true })).toBeVisible();
  });
  it("returns keyboard focus to the key after closing its confirmation", async () => {
    render(content({ canManage: true, keys: [key] }));
    const trigger = screen.getByRole("button", { name: "Revoke Factory ERP" });
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    expect(screen.getByRole("dialog")).toBeVisible();
    await userEvent.keyboard("{Escape}");
    expect(trigger).toHaveFocus();
    expect(revoke).not.toHaveBeenCalled();
  });

  it("keeps the revoke dialog open on failure and allows a retry", async () => {
    revoke.mockRejectedValueOnce(new Error("offline"));
    render(content({ canManage: true, keys: [key] }));
    await userEvent.click(
      screen.getByRole("button", { name: "Revoke Factory ERP" }),
    );
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Revoke",
      }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      english.integrations.revokeError,
    );
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Revoke",
      }),
    );
    expect(revoke).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("removes a displayed secret when owner access is lost", async () => {
    const view = render(content(empty));
    await submit();
    expect(await screen.findByDisplayValue(token)).toBeVisible();
    view.rerender(content({ canManage: false, keys: [] }));
    expect(screen.queryByDisplayValue(token)).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      english.integrations.ownerOnly,
    );
    view.rerender(content(empty));
    expect(screen.queryByDisplayValue(token)).not.toBeInTheDocument();
  });
  it("does not expose key controls to staff", () => {
    render(content({ canManage: false, keys: [] }));
    expect(screen.getByRole("status")).toHaveTextContent(
      english.integrations.ownerOnly,
    );
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open API specification" }),
    ).toHaveAttribute("href", "/api/v1/openapi.json");
  });
  it("holds the layout while keys load", () => {
    const { container } = render(content(undefined));
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Create key" }),
    ).not.toBeInTheDocument();
  });
  it("counts live keys only when enforcing the five-key limit", async () => {
    const active = Array.from({ length: 5 }, (_, index) => ({
      ...key,
      id: `key-${String(index)}` as Id<"integrationKeys">,
    }));
    const view = render(content({ canManage: true, keys: active }));
    await userEvent.click(
      screen.getByText(english.integrations.createTitle, {
        selector: "summary",
      }),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      english.integrations.limit,
    );
    expect(screen.getByRole("textbox", { name: "System name" })).toBeDisabled();
    view.rerender(
      content({
        canManage: true,
        keys: active.map((item, index) =>
          index === 0 ? { ...item, revokedAt: now.getTime() } : item,
        ),
      }),
    );
    expect(screen.getByRole("textbox", { name: "System name" })).toBeEnabled();
    expect(screen.getByText("Revoked", { exact: true })).toBeVisible();
  });
  it("labels expired keys and never offers to revoke them", () => {
    render(
      content({
        canManage: true,
        keys: [{ ...key, expiresAt: now.getTime() - 1 }],
      }),
    );
    expect(screen.getByText("Expired", { exact: true })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Revoke Factory ERP" }),
    ).not.toBeInTheDocument();
  });
  it("provides translated accessible field and scope labels in RTL", () => {
    render(content(empty, "ar"));
    expect(
      screen.getByRole("textbox", { name: arabic.integrations.label }),
    ).toBeVisible();
    expect(
      screen.getByRole("combobox", { name: arabic.integrations.expiry }),
    ).toBeVisible();
    expect(
      screen.getByRole("checkbox", { name: arabic.integrations.scopes.news }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: arabic.integrations.create }),
    ).toBeDisabled();
  });
});

it("keeps a key draft when its creation panel is closed and reopened", async () => {
  const user = userEvent.setup();
  render(content(empty));
  await user.type(
    screen.getByRole("textbox", { name: english.integrations.label }),
    "ERP draft",
  );
  const summary = screen.getByText(english.integrations.createTitle, {
    selector: "summary",
  });
  await user.click(summary);
  expect(summary.closest("details")).not.toHaveAttribute("open");
  await user.click(summary);
  expect(
    screen.getByRole("textbox", { name: english.integrations.label }),
  ).toHaveValue("ERP draft");
  expect(create).not.toHaveBeenCalled();
});
