import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ConvexError } from "convex/values";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, expect, it, vi } from "vitest";

import type { Id } from "../../../convex/_generated/dataModel";
import messages from "../../../messages/en.json";
import { PanDiscovery } from "./pan-discovery";
const mocks = vi.hoisted(() => ({
  lookup: vi.fn(),
  select: vi.fn(),
  cache: {
    value: null as null | {
      pan: string;
      registrations: {
        gstin: string;
        state: string;
        stateCode: string;
        status: string;
      }[];
    },
  },
}));
vi.mock("convex/react", () => ({
  useAction: () => mocks.lookup,
  useMutation: () => mocks.select,
  useQuery: () => mocks.cache.value,
}));
const applicationId = "application-fixture" as Id<"applications">;
const pan = "ABCDE1234F";
const gstin = "29ABCDE1234F1Z5";
const result = {
  pan,
  registrations: [
    { gstin, state: "Karnataka", stateCode: "29", status: "Active" },
  ],
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.cache.value = null;
  mocks.lookup.mockResolvedValue(result);
  mocks.select.mockResolvedValue(null);
});
function fixture({
  value = pan,
  save = vi.fn().mockResolvedValue(null),
  selected = vi.fn(),
  onPan = vi.fn(),
} = {}) {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <PanDiscovery
        applicationId={applicationId}
        pan={value}
        onPan={onPan}
        onSelected={selected}
        save={save}
      />
    </NextIntlClientProvider>
  );
}
it("saves before explicit consented discovery and saves a server selection before exposing GST details", async () => {
  const pending = Promise.withResolvers<null>();
  const save = vi.fn(() => pending.promise);
  const selected = vi.fn();
  render(fixture({ save, selected }));
  expect(mocks.lookup).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", { name: messages.join.discovery.find }),
  );
  expect(mocks.lookup).not.toHaveBeenCalled();
  pending.resolve(null);
  expect(await screen.findByText(gstin)).toBeVisible();
  expect(mocks.lookup).toHaveBeenCalledWith({ applicationId, consent: true });
  expect(selected).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", { name: messages.join.discovery.select }),
  );
  await waitFor(() => {
    expect(selected).toHaveBeenCalledWith(gstin);
  });
  expect(mocks.select).toHaveBeenCalledWith({ applicationId, gstin });
});
it("hides stale results when PAN changes during a pending lookup", async () => {
  const pending = Promise.withResolvers<typeof result>();
  mocks.lookup.mockReturnValue(pending.promise);
  const view = render(fixture());
  fireEvent.click(
    screen.getByRole("button", { name: messages.join.discovery.find }),
  );
  await waitFor(() => {
    expect(mocks.lookup).toHaveBeenCalledTimes(1);
  });
  view.rerender(fixture({ value: "AAAAA1111A" }));
  pending.resolve(result);
  await waitFor(() => {
    expect(screen.queryByText(gstin)).not.toBeInTheDocument();
  });
});
it("restores owned cached registrations without a paid call and disables inactive selection", () => {
  mocks.cache.value = {
    pan,
    registrations: [{ ...result.registrations[0], status: "Cancelled" }],
  };
  render(fixture());
  expect(screen.getByText(gstin)).toBeVisible();
  expect(
    screen.getByRole("button", { name: messages.join.discovery.inactive }),
  ).toBeDisabled();
  expect(mocks.lookup).not.toHaveBeenCalled();
});
it("shows an empty discovery and preserves PAN on a quota failure", async () => {
  mocks.lookup.mockResolvedValueOnce({ pan, registrations: [] });
  const view = render(fixture());
  fireEvent.click(
    screen.getByRole("button", { name: messages.join.discovery.find }),
  );
  expect(await screen.findByText(messages.join.discovery.empty)).toBeVisible();
  mocks.lookup.mockRejectedValueOnce(new ConvexError("CHECK_LIMIT"));
  fireEvent.click(
    screen.getByRole("button", { name: messages.join.discovery.find }),
  );
  expect(await screen.findByText(messages.join.identity.limit)).toBeVisible();
  expect(screen.getByLabelText(messages.join.identity.pan)).toHaveValue(pan);
  view.unmount();
});
