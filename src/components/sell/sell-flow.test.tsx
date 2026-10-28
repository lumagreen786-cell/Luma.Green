import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import messages from "../../../messages/en.json";
import { SellFlow } from "./sell-flow";
import { recyclingDetailsSchema } from "./simple-recycling-flow";

const calls = vi.hoisted(() => ({
  upload: vi.fn(),
  ready: vi.fn(),
  book: vi.fn(),
  profile: vi.fn(),
  push: vi.fn(),
  locate: vi.fn(),
  authenticated: true,
  hasPhone: true,
}));
vi.mock("@/components/providers/convex-provider", () => ({
  isConvexConfigured: true,
}));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: calls.push }),
}));
vi.mock("@/lib/upload-image", () => ({
  prepareUpload: (file: File) => Promise.resolve(file),
}));
vi.mock("./use-location", () => ({
  useLocation: () => ({
    state: { status: "off" },
    point: undefined,
    locate: calls.locate,
  }),
}));
vi.mock("./use-auth-ready", () => ({
  useAuthReady: () => calls.ready,
}));
vi.mock("./phone-sign-in", () => ({
  PhoneSignIn: ({ onVerified }: { onVerified: () => void }) => (
    <button onClick={onVerified}>Verify phone</button>
  ),
}));
type QueryFixture =
  | {
      id: string;
      name: string;
      area: string;
      address: string;
      offersPickup: boolean;
      fallbackCodes: string[];
    }[]
  | { window: "morning" | "afternoon" | "evening"; remaining: number }[]
  | undefined
  | { phone: string | undefined };
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({
    isAuthenticated: calls.authenticated,
    isLoading: false,
  }),
  useAction: () => calls.upload,
  useMutation: (reference: never) =>
    getFunctionName(reference) === "households:book"
      ? calls.book
      : calls.profile,
  // eslint-disable-next-line sonarjs/function-return-type -- Each mocked query has its own public return contract.
  useQuery: (reference: never, args: unknown): QueryFixture => {
    if (args === "skip") return;
    if (getFunctionName(reference) === "collectionScheduling:availability")
      return [
        { window: "morning", remaining: 20 },
        { window: "afternoon", remaining: 20 },
        { window: "evening", remaining: 20 },
      ];
    return getFunctionName(reference) === "identity:me"
      ? { phone: calls.hasPhone ? "+919000000109" : undefined }
      : [
          {
            id: "shop-fixture",
            name: "Neighbourhood shop",
            area: "Bengaluru",
            address: "12 Test Street",
            offersPickup: true,
            fallbackCodes: [],
          },
        ];
  },
}));
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-27T02:30:00Z"));
  vi.clearAllMocks();
  sessionStorage.clear();
  calls.authenticated = true;
  calls.hasPhone = true;
  calls.ready.mockResolvedValue(undefined);
  calls.upload.mockResolvedValue("photo-fixture");
  calls.profile.mockResolvedValue(null);
  calls.book.mockResolvedValue("booking-token");
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fixture");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {
    /* No browser URL allocation in this fixture. */
  });
});
afterEach(() => {
  vi.useRealTimers();
});
function show() {
  return render(
    <NextIntlClientProvider
      locale="en"
      messages={messages}
      timeZone="Asia/Kolkata"
      onError={(error) => {
        throw error;
      }}
    >
      <SellFlow />
    </NextIntlClientProvider>,
  );
}
function photo() {
  const file = new File(["photo"], "paper.jpg", { type: "image/jpeg" });
  Object.defineProperty(file, "arrayBuffer", {
    value: () => Promise.resolve(new ArrayBuffer(5)),
  });
  return file;
}
async function details() {
  const user = userEvent.setup();
  await user.type(
    screen.getByLabelText(messages.sell.when.nameLabel),
    "Test person",
  );
  await user.type(
    screen.getByLabelText(messages.sell.when.addressLabel),
    "12 Test Street, Bengaluru",
  );
  fireEvent.change(
    screen.getByLabelText(messages.sell.simple.photos, { selector: "input" }),
    {
      target: { files: [photo()] },
    },
  );
  await user.click(
    screen.getByRole("button", { name: messages.sell.simple.next }),
  );
  return user;
}
async function schedule(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("radio", { name: /Neighbourhood shop/ }));
  await user.click(
    screen.getByRole("combobox", { name: messages.sell.when.dayLabel }),
  );
  await user.click(screen.getAllByRole("option")[0]);
  await user.click(
    screen.getByRole("combobox", { name: messages.sell.when.windowLabel }),
  );
  await user.click(screen.getAllByRole("option")[0]);
}
it("starts with photos and personal details, without a material or weight questionnaire", () => {
  show();
  expect(
    screen.getByLabelText(messages.sell.simple.photos, { selector: "input" }),
  ).toBeInTheDocument();
  expect(screen.getByLabelText(messages.sell.when.nameLabel)).toBeVisible();
  expect(
    screen.queryByText(messages.sell.basket.title),
  ).not.toBeInTheDocument();
  expect(calls.locate).not.toHaveBeenCalled();
  expect(calls.upload).not.toHaveBeenCalled();
});
it("requires photos and a pickup address, while drop-off can omit the address", () => {
  expect(
    recyclingDetailsSchema.safeParse({
      name: "Test",
      address: "",
      mode: "pickup",
    }).success,
  ).toBe(false);
  expect(
    recyclingDetailsSchema.safeParse({
      name: "Test",
      address: "",
      mode: "dropoff",
    }).success,
  ).toBe(true);
});
it("keeps photo uploads behind phone verification and complete scheduling", async () => {
  calls.authenticated = false;
  show();
  const user = await details();
  expect(calls.upload).not.toHaveBeenCalled();
  expect(
    screen.queryByRole("button", { name: "Verify phone" }),
  ).not.toBeInTheDocument();
  await schedule(user);
  expect(screen.getByRole("button", { name: "Verify phone" })).toBeVisible();
  expect(calls.book).not.toHaveBeenCalled();
});
it("submits owned photos without invented materials, weights or prices", async () => {
  show();
  const user = await details();
  await schedule(user);
  await user.click(
    screen.getByRole("button", { name: messages.sell.simple.confirm }),
  );
  await waitFor(() => {
    expect(calls.push).toHaveBeenCalledWith("/t/booking-token");
  });
  expect(calls.upload).toHaveBeenCalledOnce();
  expect(calls.book).toHaveBeenCalledWith(
    expect.objectContaining({
      items: [],
      photoIds: ["photo-fixture"],
      name: "Test person",
      address: "12 Test Street, Bengaluru",
    }),
  );
});
it("retains the details and uploaded photo for retry after booking fails", async () => {
  calls.book.mockRejectedValueOnce(new Error("temporary"));
  show();
  const user = await details();
  await schedule(user);
  await user.click(
    screen.getByRole("button", { name: messages.sell.simple.confirm }),
  );
  await waitFor(() => {
    expect(screen.getByRole("alert")).toBeVisible();
  });
  await user.click(screen.getByRole("button", { name: messages.common.retry }));
  await waitFor(() => {
    expect(calls.book).toHaveBeenCalledTimes(2);
  });
  expect(calls.book.mock.calls[1]).toEqual(calls.book.mock.calls[0]);
  expect(calls.upload).toHaveBeenCalledOnce();
});

it("shows two-stage progress and explains the next missing schedule choice", async () => {
  show();
  expect(screen.getByText("Step 1 of 2")).toBeVisible();
  const user = await details();
  expect(screen.getByText("Step 2 of 2")).toBeVisible();
  expect(screen.getByRole("status")).toHaveTextContent(
    messages.sell.simple.chooseShop,
  );
  await user.click(screen.getByRole("radio", { name: /Neighbourhood shop/ }));
  expect(screen.getByRole("status")).toHaveTextContent(
    messages.sell.when.errors.day,
  );
  await schedule(user);
  expect(
    screen.getByRole("heading", { name: messages.sell.confirm.title }),
  ).toBeVisible();
  expect(screen.getByText("Test person")).toBeVisible();
  expect(screen.getByText("12 Test Street, Bengaluru")).toBeVisible();
});
it("retains photos and entered details when moving back from scheduling", async () => {
  show();
  const user = await details();
  await user.click(screen.getByRole("button", { name: messages.sell.back }));
  expect(screen.getByLabelText(messages.sell.when.nameLabel)).toHaveValue(
    "Test person",
  );
  expect(screen.getByLabelText(messages.sell.when.addressLabel)).toHaveValue(
    "12 Test Street, Bengaluru",
  );
  expect(screen.getByRole("img", { name: "paper.jpg" })).toBeVisible();
});
it("explains why a signed-in account without a phone cannot book", async () => {
  calls.hasPhone = false;
  show();
  const user = await details();
  await schedule(user);
  expect(screen.getByRole("status")).toHaveTextContent(
    messages.sell.errors.NO_PHONE,
  );
  expect(
    screen.getByRole("button", { name: messages.sell.simple.confirm }),
  ).toBeDisabled();
});
