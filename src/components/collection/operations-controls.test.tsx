import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useMutation, useQuery } from "convex/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, expect, it, vi } from "vitest";

import { WorkspacePermissions } from "@/components/workspace/permissions";

import messages from "../../../messages/en.json";
import { CollectionAvailabilityControls } from "./operations-controls";
vi.mock("convex/react", () => ({ useQuery: vi.fn(), useMutation: vi.fn() }));
const save = vi.fn();
beforeEach(() => {
  save.mockReset().mockResolvedValue(null);
  vi.mocked(useMutation).mockReturnValue(
    save as unknown as ReturnType<typeof useMutation>,
  );
  vi.mocked(useQuery).mockReturnValue({
    canManage: true,
    capacityPerWindow: 20,
    holidayDates: [],
    enabledWindows: ["morning", "afternoon", "evening"],
  });
});
it("saves a shop holiday and capacity from named controls", async () => {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <WorkspacePermissions membershipRole="owner">
        <CollectionAvailabilityControls />
      </WorkspacePermissions>
    </NextIntlClientProvider>,
  );
  const user = userEvent.setup();
  await user.clear(screen.getByLabelText("Capacity per window"));
  await user.type(screen.getByLabelText("Capacity per window"), "3");
  await user.type(
    screen.getByLabelText(/Closed dates/),
    "2026-10-30, 2026-10-31",
  );
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(save).toHaveBeenCalledWith({
    capacityPerWindow: 3,
    holidayDates: ["2026-10-30", "2026-10-31"],
    enabledWindows: ["morning", "afternoon", "evening"],
  });
});
it("keeps availability saving disabled for a read-only member", () => {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <WorkspacePermissions membershipRole="viewer">
        <CollectionAvailabilityControls />
      </WorkspacePermissions>
    </NextIntlClientProvider>,
  );
  expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
});
