import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { VerificationWorkspace } from "./verification-workspace";

vi.mock("convex/react", () => ({
  useQuery: () => [
    { id: "first", status: "submitted" },
    { id: "second", status: "submitted" },
  ],
}));
vi.mock("./queue", () => ({
  VerificationQueue: ({ onSelect }: { onSelect: (id: string) => void }) => (
    <button
      onClick={() => {
        onSelect("first");
      }}
    >
      Open first application
    </button>
  ),
}));
vi.mock("./application-review", () => ({
  ApplicationReview: ({
    applicationId,
    onBack,
    onDecided,
  }: {
    applicationId: string;
    onBack: () => void;
    onDecided: () => void;
  }) => (
    <div>
      <h2>Application {applicationId}</h2>
      <button onClick={onBack}>Verification queue</button>
      <button onClick={onDecided}>Save decision</button>
    </div>
  ),
}));

it("keeps the queue mounted, saves a decision and opens the next record", async () => {
  const user = userEvent.setup();
  render(<VerificationWorkspace />);
  const opener = screen.getByRole("button", { name: "Open first application" });
  await user.click(opener);
  expect(
    screen.getByRole("region", { name: "Application review" }),
  ).toHaveFocus();
  await user.click(screen.getByRole("button", { name: "Save decision" }));
  expect(screen.getByRole("status")).toHaveTextContent("Decision saved.");
  await user.click(
    within(screen.getByRole("status")).getByRole("button", {
      name: "Review next",
    }),
  );
  expect(
    screen.getByRole("heading", { name: "Application second" }),
  ).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Verification queue" }));
  expect(opener).toHaveFocus();
});
