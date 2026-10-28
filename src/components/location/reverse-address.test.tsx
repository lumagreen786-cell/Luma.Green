import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";

import messages from "../../../messages/en.json";
import { ReverseAddress } from "./reverse-address";

const calls = vi.hoisted(() => ({
  reverse: vi.fn(),
  phone: "+919000000501",
  userId: "account-a",
  sessionId: "session-a",
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({
      data: { user: { id: calls.userId }, session: { id: calls.sessionId } },
    }),
  },
}));
vi.mock("convex/react", () => ({
  useAction: () => calls.reverse,
  useQuery: () => ({ phone: calls.phone }),
}));
const point = { lat: 12.97, lng: 77.59 };
function wrapper({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  calls.phone = "+919000000501";
  calls.userId = "account-a";
  calls.sessionId = "session-a";
});
function lookup() {
  fireEvent.click(
    screen.getByRole("checkbox", { name: messages.geocoding.consent }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: messages.geocoding.find }),
  );
}
it("requires consent, displays attributed transient content, and never overwrites entered text automatically", async () => {
  calls.reverse.mockResolvedValue({
    status: "found",
    address: "Synthetic Google address",
    allowAddressSave: true,
  });
  const onUse = vi.fn();
  render(
    <ReverseAddress point={point} address="My entered address" onUse={onUse} />,
    { wrapper },
  );
  expect(
    screen.getByRole("button", { name: messages.geocoding.find }),
  ).toBeDisabled();
  expect(calls.reverse).not.toHaveBeenCalled();
  lookup();
  await screen.findByText("Synthetic Google address");
  expect(onUse).not.toHaveBeenCalled();
  expect(screen.getByText("Google Maps")).toHaveAttribute("translate", "no");
  expect(
    screen.getByRole("button", { name: messages.geocoding.use }),
  ).toBeDisabled();
  fireEvent.click(
    screen.getByRole("checkbox", { name: messages.geocoding.confirm }),
  );
  fireEvent.click(screen.getByRole("button", { name: messages.geocoding.use }));
  expect(onUse).toHaveBeenCalledWith("Synthetic Google address");
  fireEvent.click(
    screen.getByRole("button", { name: messages.geocoding.find }),
  );
  expect(calls.reverse).toHaveBeenCalledTimes(1);
});
it("offers manual entry when unavailable and blocks copying provider content before policy review", async () => {
  const onUse = vi.fn();
  calls.reverse.mockResolvedValueOnce({ status: "unavailable" });
  const view = render(
    <ReverseAddress point={point} address="Preserve me" onUse={onUse} />,
    { wrapper },
  );
  lookup();
  await screen.findByText(messages.geocoding.unavailable);
  expect(onUse).not.toHaveBeenCalled();
  calls.reverse.mockResolvedValueOnce({
    status: "found",
    address: "Preview address",
    allowAddressSave: false,
  });
  fireEvent.click(
    screen.getByRole("button", { name: messages.geocoding.find }),
  );
  await screen.findByText(messages.geocoding.preview);
  expect(
    screen.queryByRole("button", { name: messages.geocoding.use }),
  ).not.toBeInTheDocument();
  view.unmount();
});
it("discards late results after address edits, point changes, account changes and unmount", async () => {
  const onUse = vi.fn();
  for (const change of ["address", "point", "account", "unmount"]) {
    const pending = Promise.withResolvers<{
      status: "found";
      address: string;
      allowAddressSave: boolean;
    }>();
    calls.reverse.mockReturnValueOnce(pending.promise);
    const view = render(
      <ReverseAddress point={point} address="Original" onUse={onUse} />,
      { wrapper },
    );
    lookup();
    if (change === "account") calls.phone = "+919000000502";
    if (change === "unmount") view.unmount();
    else
      view.rerender(
        <ReverseAddress
          point={change === "point" ? { ...point, lat: 13 } : point}
          address={change === "address" ? "New entered value" : "Original"}
          onUse={onUse}
        />,
      );
    await act(async () => {
      pending.resolve({
        status: "found",
        address: "Late private address",
        allowAddressSave: true,
      });
      await pending.promise;
    });
    await waitFor(() => {
      expect(
        screen.queryByText("Late private address"),
      ).not.toBeInTheDocument();
    });
    expect(onUse).not.toHaveBeenCalled();
    view.unmount();
  }
});

it("requires fresh consent and replacement confirmation after an account switch at the same point", async () => {
  calls.reverse.mockResolvedValue({
    status: "found",
    address: "Same synthetic address",
    allowAddressSave: true,
  });
  const onUse = vi.fn();
  const view = render(
    <ReverseAddress point={point} address="Original" onUse={onUse} />,
    { wrapper },
  );
  lookup();
  await screen.findByText("Same synthetic address");
  fireEvent.click(
    screen.getByRole("checkbox", { name: messages.geocoding.confirm }),
  );
  expect(
    screen.getByRole("button", { name: messages.geocoding.use }),
  ).toBeEnabled();
  // Even a replacement identity with the same phone cannot inherit consent.
  calls.userId = "account-b";
  calls.sessionId = "session-b";
  view.rerender(
    <ReverseAddress point={point} address="Original" onUse={onUse} />,
  );
  expect(
    screen.getByRole("checkbox", { name: messages.geocoding.consent }),
  ).not.toBeChecked();
  const find = screen.getByRole("button", { name: messages.geocoding.find });
  expect(find).toBeDisabled();
  fireEvent.click(find);
  expect(calls.reverse).toHaveBeenCalledTimes(1);
  expect(screen.queryByText("Same synthetic address")).not.toBeInTheDocument();
  expect(onUse).not.toHaveBeenCalled();
  lookup();
  await screen.findByText("Same synthetic address");
  expect(calls.reverse).toHaveBeenCalledTimes(2);
  expect(
    screen.getByRole("checkbox", { name: messages.geocoding.confirm }),
  ).not.toBeChecked();
  expect(
    screen.getByRole("button", { name: messages.geocoding.use }),
  ).toBeDisabled();
});
