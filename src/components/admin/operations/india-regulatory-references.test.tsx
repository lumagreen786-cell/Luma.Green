import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { IndiaRegulatoryReferences } from "./india-regulatory-references";

describe("admin regulatory references", () => {
  it("shows dated provenance and labels the transaction proposal as draft", () => {
    render(<IndiaRegulatoryReferences />);
    expect(screen.getByText("Reviewed 2026-10-28")).toBeInTheDocument();
    expect(screen.getByText(/Draft · not in force/)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "CERC proceedings, 23 October 2026 · not market approval",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: "Open official source: Common EPR portal · current official destination",
      }),
    ).toHaveAttribute("href", "https://epr.cpcb.gov.in/");
    expect(screen.getByText("Effective: 2026-04-01")).toBeInTheDocument();
    for (const link of screen.getAllByRole("link")) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
  });

  it("filters reference text without submitting or offering approval actions", async () => {
    const submitted = vi.fn();
    const user = userEvent.setup();
    render(
      <div onSubmit={submitted}>
        <IndiaRegulatoryReferences />
      </div>,
    );
    await user.click(
      screen.getByRole("combobox", { name: "Reference stream" }),
    );
    await user.click(screen.getByRole("option", { name: "Carbon" }));
    expect(
      screen.queryByText("Solid Waste Management Rules, 2026"),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Draft · not in force/)).toBeInTheDocument();
    const details = screen.getAllByText("Applicability and evidence")[0];
    await user.click(details);
    expect(submitted).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: /approve|record|submit|activate/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/does not approve a facility/)).toBeInTheDocument();
  });
});
