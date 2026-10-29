import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";
import { ConvexError } from "convex/values";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, expect, it, vi } from "vitest";

import { subscriptionPlans } from "../../../convex/lib/subscriptions";
import ar from "../../../messages/ar.json";
import messages from "../../../messages/en.json";
import { BillingPage } from "./billing-page";
const mocks = vi.hoisted(() => ({
  business: { id: "site-a" },
  canManage: true,
  request: null as null | {
    selectedPlan: "trader";
    requestState: "selected";
    version: number;
    updatedAt: number;
  },
  signOut: vi.fn().mockResolvedValue(undefined),
  replace: vi.fn(),
  select: vi.fn().mockResolvedValue(1),
  cancel: vi.fn().mockResolvedValue(2),
}));
vi.mock("@/components/account/use-sign-out", () => ({
  useSignOut: (onSignedOut: () => void) => ({
    busy: false,
    signOut: async () => {
      await mocks.signOut();
      onSignedOut();
    },
  }),
}));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));
vi.mock("@/components/shop/use-shop", () => ({
  useBusiness: () => mocks.business,
}));
vi.mock("convex/react", () => ({
  useQuery: (ref: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(ref).endsWith(":catalogue")
      ? { version: 1, plans: subscriptionPlans }
      : {
          billingAvailable: false,
          request: mocks.request,
          canManage: mocks.canManage,
          memberCount: 1,
          entitlement: null,
          events: [],
        },
  useMutation: (ref: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(ref).endsWith(":selectPlan") ? mocks.select : mocks.cancel,
}));
afterEach(() => {
  vi.clearAllMocks();
  mocks.canManage = true;
  mocks.request = null;
  mocks.select.mockResolvedValue(1);
});
function view(locale = "en") {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "ar" ? ar : messages}
    >
      <BillingPage />
    </NextIntlClientProvider>,
  );
}
it("shows target plans, saves an explicit choice and never offers checkout", async () => {
  view();
  const u = userEvent.setup();
  expect(screen.getByText(messages.businessSubscriptions.off)).toBeVisible();
  expect(
    screen.getByRole("button", { name: messages.businessSubscriptions.save }),
  ).toBeDisabled();
  await u.click(
    screen.getByRole("combobox", { name: messages.businessSubscriptions.plan }),
  );
  await u.click(screen.getByRole("option", { name: "Trader Plus" }));
  await u.click(
    screen.getByRole("button", { name: messages.businessSubscriptions.save }),
  );
  await waitFor(() => {
    expect(mocks.select).toHaveBeenCalledWith({
      orgId: "site-a",
      plan: "trader",
      expectedVersion: 0,
    });
  });
  expect(screen.queryByText(/checkout|subscribe now/i)).not.toBeInTheDocument();
});
it("retains choice after a stale write error and cancels only the saved request", async () => {
  mocks.request = {
    selectedPlan: "trader",
    requestState: "selected",
    version: 4,
    updatedAt: 1,
  };
  mocks.select.mockRejectedValueOnce(new ConvexError("STALE_VERSION"));
  view();
  const u = userEvent.setup();
  await u.click(screen.getByRole("combobox"));
  await u.click(screen.getByRole("option", { name: "Yard" }));
  await u.click(
    screen.getByRole("button", { name: messages.businessSubscriptions.save }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    messages.businessSubscriptions.stale,
  );
  expect(screen.getByRole("combobox")).toHaveTextContent("Yard");
  await u.click(
    screen.getByRole("button", { name: messages.businessSubscriptions.cancel }),
  );
  await waitFor(() => {
    expect(mocks.cancel).toHaveBeenCalledWith({
      orgId: "site-a",
      expectedVersion: 4,
    });
  });
});
it("keeps viewer access read-only in Arabic", () => {
  mocks.canManage = false;
  view("ar");
  expect(screen.getByText(ar.businessSubscriptions.ownerOnly)).toBeVisible();
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: ar.businessSubscriptions.save }),
  ).not.toBeInTheDocument();
});

it("retains the plan choice and offers a real sign-in recovery after recent-auth rejection", async () => {
  mocks.select.mockRejectedValueOnce(new ConvexError("RECENT_AUTH_REQUIRED"));
  view();
  const user = userEvent.setup();
  await user.click(screen.getByRole("combobox"));
  await user.click(screen.getByRole("option", { name: "Yard" }));
  await user.click(
    screen.getByRole("button", { name: messages.businessSubscriptions.save }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    messages.accountRemoval.reauth,
  );
  expect(screen.getByRole("combobox")).toHaveTextContent("Yard");
  await user.click(
    screen.getByRole("button", { name: messages.accountSecurity.signInAgain }),
  );
  await waitFor(() => {
    expect(mocks.signOut).toHaveBeenCalledOnce();
  });
  expect(mocks.replace).toHaveBeenCalledWith("/login?next=%2Fapp%2Fbilling");
});
