import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";

import en from "../../../messages/en.json";
import { IntegrationsPage } from "./integrations-page";

const state = vi.hoisted(() => ({
  orgId: "first-org",
  role: "owner",
  create: vi.fn(),
  revoke: vi.fn(),
}));
vi.mock("@/components/app/use-workspace", () => ({
  useWorkspace: () => ({
    kind: "org",
    org: { id: state.orgId },
    role: state.role,
  }),
}));
vi.mock("convex/react", () => ({
  useQuery: () => ({ canManage: true, keys: [] }),
  useAction: () => state.create,
  useMutation: () => state.revoke,
}));

function translated(children: ReactNode) {
  return (
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Kolkata">
      {children}
    </NextIntlClientProvider>
  );
}
beforeEach(() => {
  state.orgId = "first-org";
  state.role = "owner";
  state.create.mockReset().mockResolvedValue({
    token: "lg_live_synthetic_first_org",
    keyId: "synthetic-key",
    expiresAt: Date.now() + 86_400_000,
  });
});

it.each(["organization", "role"])(
  "clears a one-time secret when the workspace %s changes",
  async (change) => {
    const user = userEvent.setup();
    const view = render(translated(<IntegrationsPage />));
    await user.type(screen.getByLabelText(en.integrations.label), "ERP");
    await user.click(
      screen.getByRole("button", { name: en.integrations.create }),
    );
    expect(
      await screen.findByLabelText(en.integrations.tokenLabel),
    ).toHaveValue("lg_live_synthetic_first_org");

    if (change === "organization") state.orgId = "second-org";
    else state.role = "admin";
    view.rerender(translated(<IntegrationsPage />));

    expect(
      screen.queryByDisplayValue("lg_live_synthetic_first_org"),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText(en.integrations.label)).toHaveValue("");
  },
);

it("ignores a key created after its workspace closes", async () => {
  const pending = Promise.withResolvers<{
    token: string;
    keyId: string;
    expiresAt: number;
  }>();
  state.create.mockReturnValue(pending.promise);
  const user = userEvent.setup();
  const view = render(translated(<IntegrationsPage />));
  await user.type(screen.getByLabelText(en.integrations.label), "ERP");
  await user.click(
    screen.getByRole("button", { name: en.integrations.create }),
  );
  expect(state.create).toHaveBeenCalledOnce();

  state.orgId = "second-org";
  view.rerender(translated(<IntegrationsPage />));
  await act(async () => {
    pending.resolve({
      token: "lg_live_synthetic_late_result",
      keyId: "synthetic-late-key",
      expiresAt: Date.now() + 86_400_000,
    });
    await pending.promise;
  });

  expect(
    screen.queryByDisplayValue("lg_live_synthetic_late_result"),
  ).not.toBeInTheDocument();
  expect(screen.getByLabelText(en.integrations.label)).toHaveValue("");
});
