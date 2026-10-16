import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";

import { renderWithIntl } from "@/components/shop/test-helpers";

import { WorkflowTabs } from "./workflow-tabs";

it("keeps a draft when changing tasks and exposes only the active panel", async () => {
  const user = userEvent.setup();
  renderWithIntl(
    <WorkflowTabs
      items={[
        { value: "records", label: "Records", content: <p>Saved records</p> },
        {
          value: "draft",
          label: "New record",
          content: (
            <label>
              Reference
              <input />
            </label>
          ),
        },
      ]}
    />,
  );
  expect(screen.getByRole("tabpanel", { name: "Records" })).toBeVisible();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  await user.click(screen.getByRole("tab", { name: "New record" }));
  await user.type(
    screen.getByRole("textbox", { name: "Reference" }),
    "Delivery 12",
  );
  await user.click(screen.getByRole("tab", { name: "Records" }));
  await user.keyboard("{ArrowRight}");
  expect(screen.getByRole("tab", { name: "New record" })).toHaveFocus();
  expect(screen.getByRole("textbox", { name: "Reference" })).toHaveValue(
    "Delivery 12",
  );
});
