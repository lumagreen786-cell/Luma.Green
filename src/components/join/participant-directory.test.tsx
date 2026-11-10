import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import { PARTICIPANT_TYPES } from "../../../convex/lib/participantTypes";
import messages from "../../../messages/en.json";
import { ParticipantDirectory } from "./participant-directory";

const push = vi.hoisted(() => vi.fn());

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push }),
}));

describe("participant directory", () => {
  it("lists all 41 participant types and opens the application for the selected result", async () => {
    const user = userEvent.setup();
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ParticipantDirectory />
      </NextIntlClientProvider>,
    );

    expect(new Set(PARTICIPANT_TYPES).size).toBe(41);
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    await user.type(screen.getByRole("searchbox"), "broker");
    await user.click(screen.getByRole("radio", { name: /trader/i }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(push).toHaveBeenCalledWith({
      pathname: "/join/stakeholder",
      query: { participant: "trader" },
    });
  });
});

it.each([
  ["Intermediate goods manufacturer", "intermediary_manufacturer"],
  ["End goods manufacturer", "end_goods_manufacturer"],
])(
  "keeps the selected %s role in its own application",
  async (label, participant) => {
    const user = userEvent.setup();
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ParticipantDirectory />
      </NextIntlClientProvider>,
    );
    await user.type(screen.getByRole("searchbox"), label);
    await user.click(screen.getByRole("radio", { name: label }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(push).toHaveBeenLastCalledWith({
      pathname: "/join/stakeholder",
      query: { participant },
    });
  },
);
