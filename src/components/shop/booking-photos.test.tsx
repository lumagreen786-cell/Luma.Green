import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAction, useQuery } from "convex/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import type { Id } from "../../../convex/_generated/dataModel";
import messages from "../../../messages/en.json";
import { BookingPhotos } from "./booking-photos";
function renderWithIntl(ui: ReactElement) {
  return render(ui, {
    wrapper: ({ children }) => (
      <NextIntlClientProvider
        locale="en"
        messages={messages}
        timeZone="Asia/Kolkata"
      >
        {children}
      </NextIntlClientProvider>
    ),
  });
}

vi.mock("convex/react", () => ({ useQuery: vi.fn(), useAction: vi.fn() }));
const read = vi.fn();
const createUrl = vi.fn();
const revokeUrl = vi.fn();
const first = "booking-first" as Id<"bookings">;
const second = "booking-second" as Id<"bookings">;
const bytes = {
  bytes: new ArrayBuffer(4),
  contentType: "image/png",
  name: "private.png",
};

beforeEach(() => {
  read.mockReset().mockResolvedValue(bytes);
  createUrl.mockReset().mockReturnValue("blob:private-photo");
  revokeUrl.mockReset();
  vi.stubGlobal(
    "URL",
    class extends URL {
      static readonly createObjectURL = createUrl;
      static readonly revokeObjectURL = revokeUrl;
    },
  );
  vi.mocked(useAction).mockReturnValue(read);
  vi.mocked(useQuery).mockReturnValue([
    {
      id: "photo-first",
      name: "Household materials.png",
      contentType: "image/png",
    },
  ]);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

it("reads private bytes and revokes the local URL when the booking closes", async () => {
  const view = renderWithIntl(<BookingPhotos bookingId={first} />);
  expect(
    await screen.findByRole("img", { name: "Household materials.png" }),
  ).toHaveAttribute("src", "blob:private-photo");
  expect(read).toHaveBeenCalledWith({ photoId: "photo-first" });
  expect(createUrl).toHaveBeenCalledWith(expect.any(Blob));
  view.unmount();
  expect(revokeUrl).toHaveBeenCalledWith("blob:private-photo");
});

it("ignores a byte response after switching to another booking", async () => {
  const pending = Promise.withResolvers<typeof bytes>();
  read.mockReturnValue(pending.promise);
  const view = renderWithIntl(<BookingPhotos bookingId={first} />);
  vi.mocked(useQuery).mockReturnValue([]);
  view.rerender(<BookingPhotos bookingId={second} />);
  await act(async () => {
    pending.resolve(bytes);
    await pending.promise;
  });
  expect(createUrl).not.toHaveBeenCalled();
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
});

it("clears visible photos if the list query loses access", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {
    // The simulated permission error is expected to reach React's boundary.
  });
  const view = renderWithIntl(<BookingPhotos bookingId={first} />);
  await screen.findByRole("img");
  vi.mocked(useQuery).mockImplementation(() => {
    throw new Error("FORBIDDEN");
  });
  view.rerender(<BookingPhotos bookingId={first} />);
  expect(screen.getByRole("alert")).toBeVisible();
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  expect(revokeUrl).toHaveBeenCalledWith("blob:private-photo");
  error.mockRestore();
});

it("allows retry after a rejected read and never requests more than five photos", async () => {
  vi.mocked(useQuery).mockReturnValue(
    Array.from({ length: 6 }, (_, i) => ({
      id: `photo-${String(i)}`,
      name: `Photo ${String(i)}`,
      contentType: "image/png",
    })),
  );
  read.mockRejectedValueOnce(new Error("FORBIDDEN"));
  renderWithIntl(<BookingPhotos bookingId={first} />);
  await screen.findByRole("alert");
  expect(read).toHaveBeenCalledTimes(5);
  await userEvent.click(screen.getByRole("button", { name: "Try again" }));
  await waitFor(() => {
    expect(screen.getAllByRole("img")).toHaveLength(5);
  });
  expect(read).toHaveBeenCalledTimes(6);
});
