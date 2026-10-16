import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import messages from "../../../../messages/en.json";
import { DemoTestimonials } from "./demo-testimonials";

vi.mock("next-intl/server", () => import("../intl-server.testing"));

describe("demo testimonials", () => {
  it("visibly labels the invented quotes and attributes them to roles only", async () => {
    render(await DemoTestimonials());
    const section = screen.getByRole("region", {
      name: messages.home.testimonials.title,
    });
    expect(
      within(section).getByText(messages.home.testimonials.note),
    ).toBeVisible();
    expect(section.querySelector("details")).not.toHaveAttribute("open");
    await userEvent.click(section.querySelector("summary") ?? section);
    expect(within(section).getAllByRole("figure")).toHaveLength(3);
    expect(
      within(section).getByText(messages.home.roles.household.title),
    ).toBeVisible();
    expect(
      within(section).getByText(messages.home.roles.kabadiwala.title),
    ).toBeVisible();
    expect(
      within(section).getByText(messages.home.roles.manufacturer.title),
    ).toBeVisible();
    expect(within(section).queryByRole("img")).not.toBeInTheDocument();
  });
});
