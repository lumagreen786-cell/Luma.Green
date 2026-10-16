import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";
import { ConvexError } from "convex/values";
import { NextIntlClientProvider } from "next-intl";
import type { ComponentProps } from "react";
import { beforeEach, expect, it, vi } from "vitest";

import type { api } from "../../../convex/_generated/api";
import ar from "../../../messages/ar.json";
import en from "../../../messages/en.json";
import { useCanOperate, WorkspacePermissions } from "./permissions";
import { WorkspacePage } from "./workspace-page";

const state = vi.hoisted(() => ({
  role: "owner",
  choose: vi.fn(),
  invite: vi.fn(),
  change: vi.fn(),
  remove: vi.fn(),
  revoke: vi.fn(),
  error: vi.fn(),
}));
vi.mock("@/components/providers/use-signed-in-query", () => ({
  useSignedInQuery: () => [
    {
      org: { id: "org-a", name: "Test yard" },
      role: state.role,
      selected: true,
    },
    {
      org: { id: "org-b", name: "Test factory" },
      role: "viewer",
      selected: false,
    },
  ],
}));
vi.mock("sonner", () => ({ toast: { error: state.error } }));
vi.mock("convex/react", () => ({
  useQuery: () => ({
    role: state.role,
    members: [
      {
        id: "member-a",
        profileId: "profile-a",
        name: "Test owner",
        role: "owner",
        isSelf: true,
        canManage: state.role === "owner",
      },
      {
        id: "member-b",
        profileId: "profile-b",
        name: "Test colleague",
        role: "member",
        isSelf: false,
        canManage: state.role === "owner" || state.role === "admin",
      },
    ],
    invitations: [],
  }),
  useAction: () => state.invite,
  useMutation: (reference: typeof api.workspace.select) => {
    const name = getFunctionName(reference);
    if (name === "workspace:select") return state.choose;
    if (name === "workspace:changeRole") return state.change;
    return name === "workspace:removeMember" ? state.remove : state.revoke;
  },
}));
vi.mock("@/i18n/navigation", () => ({
  Link: (props: ComponentProps<"a">) => <a {...props} />,
}));

beforeEach(() => {
  vi.clearAllMocks();
  state.role = "owner";
});

it("switches workspace through the guarded mutation", async () => {
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <WorkspacePage />
    </NextIntlClientProvider>,
  );
  const choice = screen.getByRole("combobox", { name: en.workspace.choose });
  expect(choice).toHaveTextContent("Test yard");
  await userEvent.click(choice);
  await userEvent.click(screen.getByRole("option", { name: /Test factory/ }));
  expect(state.choose).toHaveBeenCalledWith({ orgId: "org-b" });
});

it("lets an owner submit a member invitation with the current org and locale", async () => {
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <WorkspacePage />
    </NextIntlClientProvider>,
  );
  expect(screen.getByLabelText(en.workspace.role)).toHaveRole("combobox");
  await userEvent.type(
    screen.getByRole("textbox", { name: en.workspace.email }),
    "new@example.test",
  );
  await userEvent.click(
    screen.getByRole("button", { name: en.workspace.invite }),
  );
  expect(state.invite).toHaveBeenCalledWith({
    orgId: "org-a",
    email: "new@example.test",
    role: "member",
    locale: "en",
  });
});

it.each(["viewer", "member"] as const)(
  "hides invitation and role controls for %s",
  (role) => {
    state.role = role;
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <WorkspacePage />
      </NextIntlClientProvider>,
    );
    expect(
      screen.queryByRole("button", { name: en.workspace.invite }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: new RegExp(en.workspace.role) }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Test colleague")).toBeVisible();
  },
);

it("explains the invitation limit and keeps the unsent draft", async () => {
  state.invite.mockRejectedValueOnce(
    new ConvexError("INVITATION_RATE_LIMITED"),
  );
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <WorkspacePage />
    </NextIntlClientProvider>,
  );
  const email = screen.getByRole("textbox", { name: en.workspace.email });
  await userEvent.type(email, "new@example.test");
  await userEvent.click(
    screen.getByRole("button", { name: en.workspace.invite }),
  );
  expect(state.error).toHaveBeenCalledWith(en.workspace.invitationLimit);
  expect(email).toHaveValue("new@example.test");
  expect(
    screen.getByRole("button", { name: en.workspace.invite }),
  ).toBeEnabled();
});

it("uses RTL selects and excludes administrator and owner grants for an administrator", async () => {
  state.role = "admin";
  render(
    <NextIntlClientProvider locale="ar" messages={ar}>
      <WorkspacePage />
    </NextIntlClientProvider>,
  );
  const invitation = screen.getByRole("region", { name: ar.workspace.invite });
  await userEvent.click(within(invitation).getByRole("combobox"));
  const options = screen.getByRole("listbox");
  expect(options).toHaveAttribute("dir", "rtl");
  expect(
    within(options).queryByRole("option", { name: ar.workspace.owner }),
  ).not.toBeInTheDocument();
  expect(
    within(options).queryByRole("option", { name: ar.workspace.admin }),
  ).not.toBeInTheDocument();
});

function ProtectedControl() {
  return useCanOperate() ? (
    <button>Operate fixture</button>
  ) : (
    <p>Read-only fixture</p>
  );
}
it("defaults operational controls to deny and updates when a membership is downgraded", () => {
  const view = render(<ProtectedControl />);
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  view.rerender(
    <WorkspacePermissions membershipRole="member">
      <ProtectedControl />
    </WorkspacePermissions>,
  );
  expect(screen.getByRole("button", { name: "Operate fixture" })).toBeVisible();
  view.rerender(
    <WorkspacePermissions membershipRole="viewer">
      <ProtectedControl />
    </WorkspacePermissions>,
  );
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

it("keeps the entered invitation address after a recoverable server failure", async () => {
  state.invite.mockRejectedValueOnce(new Error("Temporary failure"));
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <WorkspacePage />
    </NextIntlClientProvider>,
  );
  const email = screen.getByRole("textbox", { name: en.workspace.email });
  await userEvent.type(email, "retry@example.test");
  await userEvent.click(
    screen.getByRole("button", { name: en.workspace.invite }),
  );
  expect(email).toHaveValue("retry@example.test");
  expect(
    screen.getByRole("button", { name: en.workspace.invite }),
  ).toBeEnabled();
  expect(state.error).toHaveBeenCalledWith(en.workspace.error);
});

it("requires confirmation before removing a teammate and supports cancel", async () => {
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <WorkspacePage />
    </NextIntlClientProvider>,
  );
  const row = screen.getByText("Test colleague").closest("li");
  if (!row) throw new Error("Missing teammate row");
  await userEvent.click(
    within(row).getByRole("button", { name: en.workspace.remove }),
  );
  expect(state.remove).not.toHaveBeenCalled();
  await userEvent.click(
    within(row).getByRole("button", { name: en.common.cancel }),
  );
  expect(
    within(row).queryByText(en.workspace.confirmRemove),
  ).not.toBeInTheDocument();
  await userEvent.click(
    within(row).getByRole("button", { name: en.workspace.remove }),
  );
  const buttons = within(row).getAllByRole("button", {
    name: en.workspace.remove,
  });
  await userEvent.click(buttons[1]);
  expect(state.remove).toHaveBeenCalledWith({
    orgId: "org-a",
    membershipId: "member-b",
  });
});

it("separates pending invitations from the active team without changing permissions", async () => {
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <WorkspacePage />
    </NextIntlClientProvider>,
  );
  expect(screen.getByText("Test colleague")).toBeVisible();
  await userEvent.click(
    screen.getByRole("tab", { name: en.workspace.pending }),
  );
  expect(screen.queryByText("Test colleague")).not.toBeInTheDocument();
  expect(
    screen.getByRole("region", { name: en.workspace.pending }),
  ).toBeVisible();
  await userEvent.click(screen.getByRole("tab", { name: en.workspace.team }));
  expect(screen.getByText("Test colleague")).toBeVisible();
});
