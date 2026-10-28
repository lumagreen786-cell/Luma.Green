import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConvexError } from "convex/values";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, expect, it, vi } from "vitest";

import ar from "../../../messages/ar.json";
import en from "../../../messages/en.json";
import { AccountRemoval } from "./account-removal";

const mocks = vi.hoisted(() => ({
  status: { recentAuth: true, heldReasons: [] as string[], state: "open" },
  id: "synthetic-account-one",
  close: vi.fn(),
  signOut: vi.fn(),
  normalSignOut: vi.fn(),
  replace: vi.fn(),
}));
vi.mock("convex/react", () => ({ useMutation: () => mocks.close }));
vi.mock("@/components/providers/use-signed-in-query", () => ({
  useSignedInQuery: () => mocks.status,
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({
      data: { user: { id: mocks.id }, session: { id: `${mocks.id}-session` } },
    }),
    signOut: mocks.signOut,
  },
}));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));
vi.mock("./use-sign-out", () => ({
  useSignOut: (done: () => void) => ({
    signOut: async () => {
      await mocks.normalSignOut();
      done();
    },
    busy: false,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.status = { recentAuth: true, heldReasons: [], state: "open" };
  mocks.id = "synthetic-account-one";
  mocks.close.mockResolvedValue({ state: "access_closed", reasons: [] });
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.normalSignOut.mockResolvedValue(undefined);
});
function element(locale: "en" | "ar" = "en") {
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "ar" ? ar : en}
    >
      <AccountRemoval />
    </NextIntlClientProvider>
  );
}
async function confirm() {
  await userEvent.click(
    await screen.findByRole("checkbox", { name: en.accountRemoval.confirm }),
  );
  await userEvent.click(
    screen.getByRole("button", { name: en.accountRemoval.action }),
  );
}
it("requires explicit confirmation and explains retained evidence before closing and signing out", async () => {
  render(element());
  expect(
    await screen.findByRole("button", { name: en.accountRemoval.action }),
  ).toBeDisabled();
  expect(screen.getByText(en.accountRemoval.retained)).toBeVisible();
  await confirm();
  await waitFor(() => {
    expect(mocks.replace).toHaveBeenCalledWith("/login");
  });
  expect(mocks.close).toHaveBeenCalledWith({
    operationKey: expect.any(String),
    confirm: true,
  });
  expect(mocks.signOut).toHaveBeenCalledOnce();
  expect(mocks.normalSignOut).not.toHaveBeenCalled();
  expect(screen.getByRole("status")).toHaveTextContent(
    en.accountRemoval.closed,
  );
});
it("states that held accounts are not closed and never displays backend reason codes", async () => {
  mocks.close.mockResolvedValue({
    state: "held",
    reasons: [
      "business_owner",
      "active_collection",
      "assigned_work",
      "review_limit",
      "__proto__",
    ],
  });
  render(element());
  await confirm();
  expect(await screen.findByText(en.accountRemoval.held)).toBeVisible();
  expect(screen.getByText(en.accountRemoval.businessOwner)).toBeVisible();
  expect(screen.getByText(en.accountRemoval.activeCollection)).toBeVisible();
  expect(screen.getByText(en.accountRemoval.assignedWork)).toBeVisible();
  expect(screen.getByText(en.accountRemoval.reviewLimit)).toBeVisible();
  expect(screen.getByText(en.accountRemoval.unavailable)).toBeVisible();
  expect(screen.queryByText("business_owner")).not.toBeInTheDocument();
  expect(mocks.signOut).not.toHaveBeenCalled();
  expect(screen.getByRole("checkbox")).not.toBeChecked();
});
it("requires a fresh full sign-in and uses normal safe sign-out for that recovery", async () => {
  mocks.status = { recentAuth: false, heldReasons: [], state: "open" };
  render(element());
  expect(await screen.findByRole("checkbox")).toBeDisabled();
  await userEvent.click(
    screen.getByRole("button", { name: en.accountSecurity.signInAgain }),
  );
  expect(mocks.normalSignOut).toHaveBeenCalledOnce();
  expect(mocks.replace).toHaveBeenCalledWith(
    "/login?next=%2Faccount%2Fremoval",
  );
  expect(mocks.close).not.toHaveBeenCalled();
});
it("preserves the operation key on an ambiguous failure without claiming closure", async () => {
  mocks.close
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce({ state: "held", reasons: ["assigned_work"] });
  render(element());
  await confirm();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    en.accountRemoval.retry,
  );
  expect(screen.queryByText(en.accountRemoval.closed)).not.toBeInTheDocument();
  const first = mocks.close.mock.calls[0];
  await userEvent.click(
    screen.getByRole("button", { name: en.accountRemoval.action }),
  );
  await waitFor(() => {
    expect(mocks.close).toHaveBeenCalledTimes(2);
  });
  expect(mocks.close.mock.calls[1]).toEqual(first);
  expect(mocks.signOut).not.toHaveBeenCalled();
});
it("allows a new confirmed attempt after a definitive server rejection", async () => {
  mocks.close
    .mockRejectedValueOnce(new ConvexError("REMOVAL_UNAVAILABLE"))
    .mockResolvedValueOnce({ state: "held", reasons: ["assigned_work"] });
  render(element());
  await confirm();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    en.accountRemoval.unavailable,
  );
  expect(screen.getByRole("checkbox")).not.toBeChecked();
  const first = mocks.close.mock.calls[0];
  await confirm();
  expect(mocks.close.mock.calls[1]).not.toEqual(first);
});
it("does not permit the configured admin to close without a separate replacement", async () => {
  mocks.status = {
    recentAuth: true,
    heldReasons: ["admin_replacement"],
    state: "open",
  };
  render(element());
  expect(
    await screen.findByText(en.accountRemoval.adminReplacement),
  ).toBeVisible();
  expect(screen.getByRole("checkbox")).toBeDisabled();
  expect(
    screen.getByRole("button", { name: en.accountRemoval.action }),
  ).toBeDisabled();
  expect(mocks.close).not.toHaveBeenCalled();
});
it("clears confirmation on identity change and ignores the former account's late response", async () => {
  const deferred = Promise.withResolvers<{
    state: string;
    reasons: string[];
  }>();
  mocks.close.mockReturnValueOnce(deferred.promise);
  const view = render(element());
  await confirm();
  mocks.id = "synthetic-account-two";
  view.rerender(element());
  expect(await screen.findByRole("checkbox")).not.toBeChecked();
  await act(async () => {
    deferred.resolve({ state: "access_closed", reasons: [] });
    await Promise.resolve();
  });
  expect(mocks.signOut).not.toHaveBeenCalled();
  expect(mocks.replace).not.toHaveBeenCalled();
});
it("keeps confirmed server closure visible when local sign-out fails, and retries only local sign-out", async () => {
  mocks.signOut
    .mockResolvedValueOnce({ error: { code: "offline" } })
    .mockResolvedValueOnce({ error: null });
  render(element());
  await confirm();
  expect(await screen.findByRole("status")).toHaveTextContent(
    en.accountRemoval.closed,
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    en.accountRemoval.unavailable,
  );
  await userEvent.click(
    screen.getByRole("button", { name: en.accountSecurity.signInAgain }),
  );
  await waitFor(() => {
    expect(mocks.replace).toHaveBeenCalledWith("/login");
  });
  expect(mocks.close).toHaveBeenCalledOnce();
  expect(mocks.signOut).toHaveBeenCalledTimes(2);
});
it("renders the confirmation and held state in Arabic without technical codes", async () => {
  mocks.status = {
    recentAuth: true,
    heldReasons: ["business_owner"],
    state: "open",
  };
  render(element("ar"));
  expect(
    await screen.findByRole("checkbox", { name: ar.accountRemoval.confirm }),
  ).toBeVisible();
  expect(screen.getByText(ar.accountRemoval.held)).toBeVisible();
  expect(screen.getByText(ar.accountRemoval.businessOwner)).toBeVisible();
});
