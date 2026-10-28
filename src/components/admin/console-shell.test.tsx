import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ConsoleShell } from "./console-shell";

const mocks = vi.hoisted(() => ({
  identity: vi.fn(),
  pathname: vi.fn(),
  replace: vi.fn(),
  signOut: vi.fn(),
  revoke: vi.fn(),
}));

vi.mock("@/components/providers/use-signed-in-query", () => ({
  useSignedInQuery: mocks.identity,
}));
vi.mock("convex/react", () => ({
  useQuery: () => ({ waiting: 2, openSupport: 1 }),
}));
vi.mock("next/navigation", () => ({
  usePathname: mocks.pathname,
  useRouter: () => ({ replace: mocks.replace }),
}));
vi.mock("@/components/notifications/device-provider", () => ({
  lockDeviceSignOut: () => vi.fn(),
  revokeCurrentDevice: mocks.revoke,
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: { session: { id: "fixture-session" } } }),
    signOut: mocks.signOut,
  },
}));
vi.mock("@/components/providers/query-provider", () => ({
  QueryProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/components/theme/theme-toggle", () => ({
  ThemeToggleControl: () => <button type="button">Appearance</button>,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.identity.mockReturnValue({
    kind: "admin",
    adminName: "Asha",
    twoFactorEnabled: true,
  });
  mocks.pathname.mockReturnValue("/admin/verification/application");
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.revoke.mockResolvedValue(undefined);
});

describe("admin navigation", () => {
  it("keeps all eight destinations and marks the active review section", () => {
    render(<ConsoleShell>Review workspace</ConsoleShell>);
    const navigation = screen.getByRole("navigation", { name: "Admin" });
    expect(within(navigation).getAllByRole("link")).toHaveLength(8);
    expect(
      within(navigation).getByRole("link", { name: /Account removal/ }),
    ).toHaveAttribute("href", "/admin/account-removals");
    expect(
      within(navigation).getByRole("link", { name: /Material/ }),
    ).toHaveAttribute("href", "/admin/operations");
    expect(
      within(navigation).getByRole("link", { name: /Payment/ }),
    ).toHaveAttribute("href", "/admin/payments");
    expect(
      within(navigation).getByRole("link", { current: "page" }),
    ).toHaveAttribute("href", "/admin/verification");
    expect(
      within(navigation).getByText("waiting for review"),
    ).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveTextContent("Review workspace");
  });

  it("gives the compact sign-out control a name and returns to sign-in", async () => {
    const user = userEvent.setup();
    render(<ConsoleShell>Review workspace</ConsoleShell>);
    await user.click(screen.getByRole("button", { name: "Sign out Asha" }));
    expect(mocks.signOut).toHaveBeenCalledOnce();
    expect(mocks.replace).toHaveBeenCalledWith("/admin/login");
  });

  it("keeps the workspace hidden until the admin finishes authenticator setup", () => {
    mocks.identity.mockReturnValue({
      kind: "admin",
      adminName: "Asha",
      twoFactorEnabled: false,
    });
    render(<ConsoleShell>Review workspace</ConsoleShell>);
    expect(screen.queryByText("Review workspace")).not.toBeInTheDocument();
    expect(mocks.replace).toHaveBeenCalledWith("/admin/setup");
  });

  it("keeps member accounts out of the workspace", () => {
    mocks.identity.mockReturnValue({ kind: "member" });
    render(<ConsoleShell>Review workspace</ConsoleShell>);
    expect(screen.queryByText("Review workspace")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "This area is for the admin" }),
    ).toBeInTheDocument();
  });
});

it("keeps the session when push revocation fails and allows a safe retry", async () => {
  const user = userEvent.setup();
  mocks.revoke.mockRejectedValueOnce(new Error("fixture offline"));
  render(<ConsoleShell>Review workspace</ConsoleShell>);
  await user.click(screen.getByRole("button", { name: "Sign out Asha" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Could not sign out");
  expect(mocks.signOut).not.toHaveBeenCalled();
  expect(mocks.replace).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Sign out Asha" }));
  expect(mocks.signOut).toHaveBeenCalledOnce();
  expect(mocks.replace).toHaveBeenCalledWith("/admin/login");
});

it("keeps the console visible on a failed auth sign-out response", async () => {
  const user = userEvent.setup();
  mocks.signOut.mockResolvedValueOnce({ error: { status: 503 } });
  render(<ConsoleShell>Review workspace</ConsoleShell>);
  await user.click(screen.getByRole("button", { name: "Sign out Asha" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Could not sign out");
  expect(mocks.replace).not.toHaveBeenCalled();
});
