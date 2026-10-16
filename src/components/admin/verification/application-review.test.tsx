import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { fixtures } from "../../../../scripts/guide-preview/fixtures";
import { ApplicationReview } from "./application-review";

vi.mock("convex/react", () => ({ useQuery: () => fixtures["review:get"] }));
vi.mock("../use-minute-clock", () => ({ useMinuteClock: () => 0 }));
vi.mock("./application-details", () => ({
  ApplicationDetails: () => <p>Application fields</p>,
  changeLabels: {},
}));
vi.mock("../files/file-gallery", () => ({
  FileGallery: () => <p>Attached documents</p>,
}));
vi.mock("./audit-trail", () => ({
  AuditTrail: () => <p>Recorded decisions</p>,
}));
vi.mock("./decision-panel", () => ({
  DecisionPanel: ({ canApprove }: { canApprove: boolean }) => (
    <button disabled={!canApprove}>Approve</button>
  ),
}));

it("keeps decision controls visible while switching between evidence and history", async () => {
  render(<ApplicationReview applicationId="synthetic-review" />);
  expect(screen.getByText("Application fields")).toBeVisible();
  expect(screen.getByRole("button", { name: "Approve" })).toBeDisabled();
  await userEvent.click(screen.getByRole("tab", { name: "Documents" }));
  expect(screen.getByText("Attached documents")).toBeVisible();
  expect(screen.queryByText("Application fields")).not.toBeInTheDocument();
  expect(
    screen.getByRole("complementary", { name: "Checks and decision" }),
  ).toBeVisible();
  for (const checkbox of screen.getAllByRole("checkbox")) {
    await userEvent.click(checkbox);
  }
  await userEvent.click(screen.getByRole("tab", { name: "History" }));
  expect(screen.getByText("Recorded decisions")).toBeVisible();
  expect(screen.getByRole("button", { name: "Approve" })).toBeEnabled();
});
