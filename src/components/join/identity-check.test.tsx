import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ConvexError } from "convex/values";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Id } from "../../../convex/_generated/dataModel";
import messages from "../../../messages/en.json";
import { IdentityCheck } from "./identity-check";

const { verify } = vi.hoisted(() => ({ verify: vi.fn() }));
vi.mock("convex/react", () => ({ useAction: () => verify }));

const applicationId = "application-fixture" as Id<"applications">;
function fixture(
  save: () => Promise<unknown>,
  pan = "ABCDE1234F",
  gstin?: string,
) {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <IdentityCheck
        applicationId={applicationId}
        pan={pan}
        gstin={gstin}
        save={save}
      />
    </NextIntlClientProvider>
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  verify.mockResolvedValue(null);
});

describe("explicit identity checks", () => {
  it("sends no paid request until consent and successful draft save", async () => {
    const pending = Promise.withResolvers<null>();
    const save = vi.fn(() => pending.promise);
    render(fixture(save));
    expect(verify).not.toHaveBeenCalled();
    expect(screen.getByText(messages.join.identity.disclosure)).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: messages.join.identity.check }),
    );
    expect(
      screen.getByRole("button", { name: messages.join.identity.checking }),
    ).toBeDisabled();
    expect(verify).not.toHaveBeenCalled();
    pending.resolve(null);
    await waitFor(() => {
      expect(verify).toHaveBeenCalledExactlyOnceWith({
        applicationId,
        consent: true,
      });
    });
    expect(
      await screen.findByText(messages.join.identity.verified),
    ).toBeVisible();
  });

  it("does not send a paid request when saving fails", async () => {
    const save = vi.fn().mockRejectedValue(new Error("Save failed"));
    render(fixture(save));
    fireEvent.click(
      screen.getByRole("button", { name: messages.join.identity.check }),
    );
    expect(
      await screen.findByText(messages.join.identity.saveFailed),
    ).toBeVisible();
    expect(verify).not.toHaveBeenCalled();
  });

  it("shows the shared daily limit and leaves retry explicit", async () => {
    verify.mockRejectedValue(new ConvexError({ code: "CHECK_LIMIT" }));
    render(fixture(vi.fn().mockResolvedValue(null)));
    fireEvent.click(
      screen.getByRole("button", { name: messages.join.identity.check }),
    );
    expect(await screen.findByText(messages.join.identity.limit)).toBeVisible();
    expect(verify).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: messages.join.identity.check }),
    ).toBeEnabled();
  });

  it("removes verified status when PAN or GST changes", async () => {
    const save = vi.fn().mockResolvedValue(null);
    const { rerender } = render(fixture(save));
    fireEvent.click(
      screen.getByRole("button", { name: messages.join.identity.check }),
    );
    expect(
      await screen.findByText(messages.join.identity.verified),
    ).toBeVisible();
    rerender(fixture(save, "ABCDE1234G"));
    expect(
      screen.queryByText(messages.join.identity.verified),
    ).not.toBeInTheDocument();
    expect(verify).toHaveBeenCalledTimes(1);
  });

  it("needs no check when no identifier applies", () => {
    render(fixture(vi.fn(), ""));
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(verify).not.toHaveBeenCalled();
  });
});

it("clears a translated verification message safely when PAN changes", async () => {
  const save = vi.fn().mockResolvedValue(null);
  const { rerender } = render(fixture(save));
  fireEvent.click(
    screen.getByRole("button", { name: messages.join.identity.check }),
  );
  const status = await screen.findByText(messages.join.identity.verified);
  const node = [...status.childNodes].find(
    (child) => child.nodeType === Node.TEXT_NODE,
  );
  if (!node) throw new Error("Missing status text");
  const translated = document.createElement("span");
  translated.textContent = node.textContent;
  node.replaceWith(translated);
  expect(() => {
    rerender(fixture(save, "ABCDE1234G"));
  }).not.toThrow();
  expect(
    screen.queryByText(messages.join.identity.verified),
  ).not.toBeInTheDocument();
});
