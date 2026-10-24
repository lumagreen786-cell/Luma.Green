import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import messages from "../../../messages/en.json";
import {
  FieldSet,
  SaveIndicator,
  ToggleChips,
  WeekdayChips,
  YesNo,
} from "./fields";

function withIntl(children: ReactNode) {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}

describe("YesNo", () => {
  it("starts unanswered — no silent default", () => {
    render(
      withIntl(
        <FieldSet id="gst" legend="Do you have a GST number?">
          <YesNo name="gst" isYes={undefined} onChange={vi.fn()} />
        </FieldSet>,
      ),
    );
    const group = screen.getByRole("radiogroup", {
      name: "Do you have a GST number?",
    });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Yes" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "No" })).not.toBeChecked();
  });

  it("answers with a boolean", async () => {
    const onChange = vi.fn();
    render(
      withIntl(<YesNo name="gst" isYes={undefined} onChange={onChange} />),
    );
    await userEvent.click(screen.getByRole("radio", { name: "No" }));
    expect(onChange).toHaveBeenCalledWith(false);
  });
});

describe("ToggleChips", () => {
  const options = [
    { value: "paper", label: "Paper" },
    { value: "plastic", label: "Plastic" },
    { value: "metal", label: "Metal" },
  ] as const;

  it("shows what's picked and keeps the list in option order", async () => {
    const onChange = vi.fn();
    render(
      <ToggleChips options={options} value={["metal"]} onChange={onChange} />,
    );
    expect(screen.getByRole("checkbox", { name: "Metal" })).toBeChecked();
    await userEvent.click(screen.getByText("Paper"));
    expect(onChange).toHaveBeenLastCalledWith(["paper", "metal"]);
  });

  it("unpicks on a second tap", async () => {
    const onChange = vi.fn();
    render(
      <ToggleChips
        options={options}
        value={["paper", "metal"]}
        onChange={onChange}
      />,
    );
    await userEvent.click(screen.getByRole("checkbox", { name: "Paper" }));
    expect(onChange).toHaveBeenLastCalledWith(["metal"]);
  });

  it("keeps independent choices reachable and toggleable by keyboard", async () => {
    const onChange = vi.fn();
    render(
      <ToggleChips options={options} value={["metal"]} onChange={onChange} />,
    );
    await userEvent.tab();
    expect(screen.getByRole("checkbox", { name: "Paper" })).toHaveFocus();
    await userEvent.keyboard(" ");
    expect(onChange).toHaveBeenLastCalledWith(["paper", "metal"]);
    await userEvent.tab();
    expect(screen.getByRole("checkbox", { name: "Plastic" })).toHaveFocus();
    await userEvent.tab();
    await userEvent.keyboard(" ");
    expect(onChange).toHaveBeenLastCalledWith([]);
  });
});

describe("WeekdayChips", () => {
  it("labels days from the translations", () => {
    render(withIntl(<WeekdayChips value={["sun"]} onChange={vi.fn()} />));
    expect(screen.getAllByRole("checkbox")).toHaveLength(7);
    expect(screen.getByRole("checkbox", { name: "Sun" })).toBeChecked();
  });
});

// Emulate the DOM rewrite performed by page translators on visible text.
it("keeps autosave updates safe after a translator replaces the status text", () => {
  const { rerender } = render(withIntl(<SaveIndicator state="saving" />));
  const text = screen.getByText(messages.join.form.saving);
  const node = [...text.childNodes].find(
    (child) => child.nodeType === Node.TEXT_NODE,
  );
  if (!node) throw new Error("Missing status text");
  const translated = document.createElement("span");
  translated.textContent = node.textContent;
  node.replaceWith(translated);
  expect(() => {
    rerender(withIntl(<SaveIndicator state="saved" />));
  }).not.toThrow();
  expect(screen.getByText(messages.join.form.saved)).toBeVisible();
});
