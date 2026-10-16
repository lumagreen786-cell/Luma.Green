import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

import { JoinGate } from "./join-gate";

const state = vi.hoisted(() => ({
  person: undefined as
    undefined | { kind: "admin" | "member"; twoFactorEnabled: boolean },
  admin: vi.fn(),
  replace: vi.fn(),
}));
vi.mock("@/components/providers/use-signed-in-query", () => ({
  useSignedInQuery: () => state.person,
}));
vi.mock("@/lib/admin-navigation", () => ({ navigateToAdmin: state.admin }));
vi.mock("@/i18n/navigation", () => ({
  usePathname: () => "/join/kabadiwala",
  useRouter: () => ({ replace: state.replace }),
}));
vi.mock("./use-mine", () => ({ useMine: () => ({ application: null }) }));
vi.mock("./consent-card", () => ({ ConsentCard: () => <p>Member consent</p> }));
vi.mock("@/components/showcase/role-story-image", () => ({
  RoleStoryImage: () => null,
}));
beforeEach(() => {
  vi.clearAllMocks();
  state.person = undefined;
});
function form() {
  return <JoinGate kind="kabadiwala">{() => <p>Application form</p>}</JoinGate>;
}
it("does not show member consent until the account role is known", () => {
  const view = render(form());
  expect(screen.queryByText("Member consent")).not.toBeInTheDocument();
  state.person = { kind: "member", twoFactorEnabled: false };
  view.rerender(form());
  expect(screen.getByText("Member consent")).toBeVisible();
  expect(state.admin).not.toHaveBeenCalled();
});
it.each([false, true])(
  "routes admins away from the consent they cannot submit (%s)",
  async (twoFactorEnabled) => {
    state.person = { kind: "admin", twoFactorEnabled };
    render(form());
    await waitFor(() => {
      expect(state.admin).toHaveBeenCalledWith(twoFactorEnabled);
    });
    expect(screen.queryByText("Member consent")).not.toBeInTheDocument();
    expect(state.replace).not.toHaveBeenCalled();
  },
);
