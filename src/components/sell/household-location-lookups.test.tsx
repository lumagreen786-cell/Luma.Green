import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, expect, it, vi } from "vitest";

import en from "../../../messages/en.json";
import { HouseholdLocationLookups } from "./household-location-lookups";

const mocks = vi.hoisted(() => ({
  availability: { air: true, solar: false },
  check: vi.fn(),
  locate: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useAction: () => mocks.check,
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
  useQuery: () => mocks.availability,
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({
      isPending: false,
      data: {
        user: { phoneNumber: "+919000000825", phoneNumberVerified: true },
      },
    }),
  },
}));
vi.mock("@/components/providers/convex-provider", () => ({
  isConvexConfigured: true,
}));
vi.mock("./use-location", () => ({
  useLocation: (
    _kind: string,
    onLocation: (point: { lat: number; lng: number }) => void,
  ) => ({
    state: { status: "off" },
    locate: () => {
      mocks.locate();
      onLocation({ lat: 12.971, lng: 77.591 });
    },
    stop: vi.fn(),
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

it("waits for consent and a user gesture and shows the returned AQI with attribution", async () => {
  mocks.check.mockResolvedValue({
    status: "air",
    score: 74,
    observedAt: 1_700_000_000_000,
  });
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Kolkata">
      <HouseholdLocationLookups />
    </NextIntlClientProvider>,
  );
  fireEvent.click(screen.getByText(en.householdTools.airQuality));
  const button = screen.getByRole("button", { name: en.sell.shop.useLocation });
  expect(button).toBeDisabled();
  expect(mocks.locate).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("checkbox", { name: en.householdTools.lookupConsent }),
  );
  expect(mocks.locate).not.toHaveBeenCalled();
  fireEvent.click(button);
  expect(mocks.check).toHaveBeenCalledWith({
    kind: "air",
    consent: true,
    lat: 12.971,
    lng: 77.591,
  });
  expect(
    await screen.findByText("Universal AQI: 74 out of 100. Higher is better."),
  ).toBeVisible();
  expect(screen.getByText(en.geocoding.attribution)).toBeVisible();
});
