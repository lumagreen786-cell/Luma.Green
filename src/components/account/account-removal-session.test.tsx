import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type FunctionReference, getFunctionName } from "convex/server";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { useSignedInQuery } from "@/components/providers/use-signed-in-query";
import { HeaderAuthAction } from "@/components/site/header-auth-action";
import {
  beginSignOutLifecycle,
  getSignOutLifecycle,
} from "@/lib/sign-out-lifecycle";

import { api } from "../../../convex/_generated/api";
import en from "../../../messages/en.json";
import { AccountLinks } from "./account-links";
import { AccountRemoval } from "./account-removal";

const mocks = vi.hoisted(() => ({
  auth: { isLoading: false, isAuthenticated: true },
  status: { state: "open", recentAuth: true, heldReasons: [] },
  person: { kind: "member", twoFactorEnabled: false },
  session: {
    data: {
      user: { id: "synthetic-user" },
      session: { id: "synthetic-session" },
    },
    isPending: false,
    error: null,
  },
  close: vi.fn(),
  signOut: vi.fn(),
  replace: vi.fn(),
  query: vi.fn(),
}));
vi.mock("convex/react", () => ({
  useMutation: () => mocks.close,
  useConvexAuth: () => mocks.auth,
  useQuery: (fn: FunctionReference<"query">, args: unknown) => {
    mocks.query(getFunctionName(fn), args);
    return getFunctionName(fn) === "accountRemoval:status"
      ? mocks.status
      : mocks.person;
  },
}));
vi.mock("@/components/providers/convex-provider", () => ({
  isConvexConfigured: true,
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => mocks.session, signOut: mocks.signOut },
}));
vi.mock("@/i18n/navigation", () => ({
  Link: "a",
  usePathname: () => "/account/removal",
  useRouter: () => ({ replace: mocks.replace }),
}));
vi.mock("./use-sign-out", () => ({
  useSignOut: () => ({ signOut: vi.fn(), busy: false }),
}));

beforeEach(() => {
  beginSignOutLifecycle("reset-removal-test").fail();
  vi.clearAllMocks();
  mocks.auth.isAuthenticated = true;
  mocks.session.data = {
    user: { id: "synthetic-user" },
    session: { id: "synthetic-session" },
  };
  mocks.close.mockResolvedValue({ state: "access_closed", reasons: [] });
  mocks.signOut.mockResolvedValue({ error: null });
});
afterEach(() => {
  cleanup();
  beginSignOutLifecycle("reset-removal-test").fail();
});
function PrivateProbe() {
  const result = useSignedInQuery(api.identity.me);
  let label = "private";
  if (result === undefined) label = "waiting";
  else if (result === null) label = "hidden";
  return <output aria-label="Private query">{label}</output>;
}

function view() {
  return (
    <NextIntlClientProvider locale="en" messages={en}>
      <header>
        <HeaderAuthAction />
        <nav>
          <AccountLinks />
        </nav>
      </header>
      <PrivateProbe />
      <AccountRemoval />
    </NextIntlClientProvider>
  );
}
async function requestClosure() {
  await userEvent.click(
    await screen.findByRole("checkbox", { name: en.accountRemoval.confirm }),
  );
  await userEvent.click(
    screen.getByRole("button", { name: en.accountRemoval.action }),
  );
}
it("keeps header and private hooks safe when Convex revokes before cached Better Auth clears during confirmed closure", async () => {
  const response = Promise.withResolvers<{ error: null }>();
  mocks.signOut.mockReturnValueOnce(response.promise);
  const page = render(view());
  expect(
    screen.getByRole("status", { name: "Private query" }),
  ).toHaveTextContent("private");
  expect(
    screen.getByRole("link", { name: en.accountRemoval.title }),
  ).toHaveAttribute("href", "/account/removal");
  await requestClosure();
  expect(getSignOutLifecycle()).toEqual({
    sessionId: "synthetic-session",
    status: "pending",
  });
  mocks.auth.isAuthenticated = false;
  page.rerender(view());
  expect(
    screen.getByRole("status", { name: "Private query" }),
  ).toHaveTextContent("waiting");
  expect(
    screen.queryByRole("link", { name: en.common.retry }),
  ).not.toBeInTheDocument();
  expect(mocks.query).toHaveBeenCalledWith("identity:me", "skip");
  await act(async () => {
    response.resolve({ error: null });
    await Promise.resolve();
  });
  expect(
    screen.getByRole("status", { name: "Private query" }),
  ).toHaveTextContent("hidden");
  expect(screen.getByRole("link", { name: en.auth.metaTitle })).toBeVisible();
  expect(mocks.replace).toHaveBeenCalledWith("/login");
  expect(getSignOutLifecycle()).toEqual({
    sessionId: "synthetic-session",
    status: "complete",
  });
});
it("clears the exact pending intent on sign-out failure and allows a local-only retry", async () => {
  mocks.signOut
    .mockResolvedValueOnce({ error: { code: "offline" } })
    .mockResolvedValueOnce({ error: null });
  render(view());
  await requestClosure();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    en.accountRemoval.unavailable,
  );
  expect(getSignOutLifecycle()).toBeNull();
  expect(
    screen.getByRole("status", { name: "Private query" }),
  ).toHaveTextContent("private");
  await userEvent.click(
    screen.getByRole("button", { name: en.accountSecurity.signInAgain }),
  );
  await waitFor(() => {
    expect(mocks.replace).toHaveBeenCalledWith("/login");
  });
  expect(mocks.close).toHaveBeenCalledOnce();
});
it("cancels pending intent on account change and ignores the old sign-out completion", async () => {
  const response = Promise.withResolvers<{ error: null }>();
  mocks.signOut.mockReturnValueOnce(response.promise);
  const page = render(view());
  await requestClosure();
  mocks.session.data = {
    user: { id: "synthetic-new-user" },
    session: { id: "synthetic-new-session" },
  };
  page.rerender(view());
  expect(getSignOutLifecycle()).toBeNull();
  expect(await screen.findByRole("checkbox")).not.toBeChecked();
  expect(
    screen.getByRole("status", { name: "Private query" }),
  ).toHaveTextContent("private");
  await act(async () => {
    response.resolve({ error: null });
    await Promise.resolve();
  });
  expect(mocks.replace).not.toHaveBeenCalled();
  expect(getSignOutLifecycle()).toBeNull();
});
it("clears a pending local sign-out when the removal page unmounts", async () => {
  const response = Promise.withResolvers<{ error: null }>();
  mocks.signOut.mockReturnValueOnce(response.promise);
  const page = render(view());
  await requestClosure();
  page.unmount();
  expect(getSignOutLifecycle()).toBeNull();
  await act(async () => {
    response.resolve({ error: null });
    await Promise.resolve();
  });
  expect(mocks.replace).not.toHaveBeenCalled();
  expect(getSignOutLifecycle()).toBeNull();
});
it("does not set a lifecycle intent for an unconfirmed ambiguous close result", async () => {
  mocks.close.mockRejectedValueOnce(new Error("offline"));
  render(view());
  await requestClosure();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    en.accountRemoval.retry,
  );
  expect(getSignOutLifecycle()).toBeNull();
  expect(mocks.signOut).not.toHaveBeenCalled();
});
