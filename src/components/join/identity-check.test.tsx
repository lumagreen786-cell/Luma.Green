import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ConvexError } from "convex/values";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Id } from "../../../convex/_generated/dataModel";
import messages from "../../../messages/en.json";
import { IdentityCheck } from "./identity-check";

const { lookup, confirm, cache } = vi.hoisted(() => ({
  lookup: vi.fn(),
  confirm: vi.fn(),
  cache: {
    current: null as null | {
      gstin: string;
      businessName: string;
      legalName: string;
      address: string;
      confirmed: boolean;
    },
  },
}));
vi.mock("convex/react", () => ({
  useAction: () => lookup,
  useMutation: () => confirm,
  useQuery: () => cache.current,
}));
const applicationId = "application-fixture" as Id<"applications">;
const details = {
  gstin: "29ABCDE1234F1Z5",
  businessName: "Example recycling",
  legalName: "Example recycling limited",
  address: "Example registered street",
};
function fixture(
  save: () => Promise<unknown>,
  gstin = details.gstin,
  onConfirmed = vi.fn(),
) {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <IdentityCheck
        applicationId={applicationId}
        gstin={gstin}
        save={save}
        onConfirmed={onConfirmed}
      />
    </NextIntlClientProvider>
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  cache.current = null;
  lookup.mockResolvedValue(details);
  confirm.mockResolvedValue(null);
});

describe("GST lookup and business confirmation", () => {
  it("requires a saved draft, lookup consent and a separate explicit business confirmation", async () => {
    const pending = Promise.withResolvers<null>();
    const save = vi.fn(() => pending.promise);
    const accepted = vi.fn();
    render(fixture(save, details.gstin, accepted));
    expect(lookup).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: messages.join.identity.check }),
    );
    expect(lookup).not.toHaveBeenCalled();
    pending.resolve(null);
    expect(await screen.findByText(details.businessName)).toBeVisible();
    expect(screen.getByText(details.address)).toBeVisible();
    expect(confirm).not.toHaveBeenCalled();
    expect(accepted).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", {
        name: messages.join.identity.confirm,
      }),
    );
    expect(
      await screen.findByText(messages.join.identity.verified),
    ).toBeVisible();
    expect(lookup).toHaveBeenCalledExactlyOnceWith({
      applicationId,
      consent: true,
    });
    expect(confirm).toHaveBeenCalledExactlyOnceWith({
      applicationId,
      gstin: details.gstin,
    });
    expect(accepted).toHaveBeenCalledWith(details);
  });
  it("does not call a paid lookup if draft saving fails", async () => {
    const save = vi.fn().mockRejectedValue(new Error("Save failed"));
    render(fixture(save));
    fireEvent.click(
      screen.getByRole("button", { name: messages.join.identity.check }),
    );
    expect(
      await screen.findByText(messages.join.identity.saveFailed),
    ).toBeVisible();
    expect(lookup).not.toHaveBeenCalled();
  });
  it("shows account limit and never invents business data or retries", async () => {
    lookup.mockRejectedValue(new ConvexError("CHECK_LIMIT"));
    render(fixture(vi.fn().mockResolvedValue(null)));
    fireEvent.click(
      screen.getByRole("button", { name: messages.join.identity.check }),
    );
    expect(await screen.findByText(messages.join.identity.limit)).toBeVisible();
    expect(screen.queryByText(details.businessName)).not.toBeInTheDocument();
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(confirm).not.toHaveBeenCalled();
  });
  it("invalidates preview and confirmation when the GST input changes", async () => {
    const save = vi.fn().mockResolvedValue(null);
    const { rerender } = render(fixture(save));
    fireEvent.click(
      screen.getByRole("button", { name: messages.join.identity.check }),
    );
    expect(await screen.findByText(details.businessName)).toBeVisible();
    rerender(fixture(save, "27ABCDE1234F1Z5"));
    expect(screen.queryByText(details.businessName)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: messages.join.identity.confirm,
      }),
    ).not.toBeInTheDocument();
  });
  it("restores confirmed current proof on reload without another paid lookup", async () => {
    const accepted = vi.fn();
    cache.current = { ...details, confirmed: true };
    render(fixture(vi.fn(), details.gstin, accepted));
    await waitFor(() => {
      expect(accepted).toHaveBeenCalledWith(cache.current, true);
    });
    expect(screen.getByText(messages.join.identity.verified)).toBeVisible();
    expect(lookup).not.toHaveBeenCalled();
  });
  it("needs no check when no GST identifier applies", () => {
    render(fixture(vi.fn(), ""));
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(lookup).not.toHaveBeenCalled();
  });
});
