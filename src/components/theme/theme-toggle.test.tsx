import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";

import { ThemeToggleControl } from "./theme-toggle";

it("keeps appearance controls transparent and labelled while the menu works by keyboard", async () => {
  const user = userEvent.setup();
  render(
    <ThemeToggleControl
      labels={{
        label: "Appearance",
        light: "Light",
        dark: "Dark",
        system: "System",
      }}
    />,
  );
  const trigger = screen.getByRole("button", { name: "Appearance" });
  expect(trigger).toHaveAttribute("data-variant", "ghost");
  expect(trigger).toHaveClass("size-11", "rounded-xl", "bg-transparent");
  expect(trigger).not.toHaveClass("rounded-full", "bg-card");
  trigger.focus();
  await user.keyboard("{Enter}");
  expect(screen.getByRole("menuitemradio", { name: "Dark" })).toBeVisible();
  await user.keyboard("{Escape}");
  expect(trigger).toHaveFocus();
});
