import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, expect, it, vi } from "vitest";

import messages from "../../../messages/en.json";
import { ConsentCard } from "./consent-card";

const calls = vi.hoisted(() => ({ start: vi.fn(), save: vi.fn() }));
vi.mock("convex/react", () => ({
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(reference) === "applications:start"
      ? calls.start
      : calls.save,
}));
beforeEach(() => {
  vi.clearAllMocks();
  calls.start.mockResolvedValue("application-example");
  calls.save.mockResolvedValue(null);
});

it("starts registration with the first field and two explicit choices, retaining all input after failure", async () => {
  calls.save.mockRejectedValueOnce(new Error("unavailable"));
  const complete = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ConsentCard kind="kabadiwala" onComplete={complete} />
    </NextIntlClientProvider>,
  );
  await userEvent.type(
    screen.getByLabelText(messages.join.kabadiwala.ownerName),
    "Example owner",
  );
  await userEvent.click(
    screen.getByRole("button", { name: messages.auth.continue }),
  );
  expect(calls.start).not.toHaveBeenCalled();
  await userEvent.click(
    screen.getByRole("checkbox", { name: messages.join.consent.age }),
  );
  await userEvent.click(
    screen.getByRole("checkbox", { name: messages.join.consent.accept }),
  );
  await userEvent.click(
    screen.getByRole("button", { name: messages.auth.continue }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    messages.join.errors.generic,
  );
  expect(screen.getByLabelText(messages.join.kabadiwala.ownerName)).toHaveValue(
    "Example owner",
  );
  expect(
    screen.getByRole("checkbox", { name: messages.join.consent.age }),
  ).toBeChecked();
  await userEvent.click(
    screen.getByRole("button", { name: messages.auth.continue }),
  );
  await waitFor(() => {
    expect(complete).toHaveBeenCalledOnce();
  });
  expect(calls.start).toHaveBeenCalledWith({
    kind: "kabadiwala",
    locale: "en",
    ageConfirmed: true,
    privacyAccepted: true,
  });
  expect(calls.save).toHaveBeenLastCalledWith({
    applicationId: "application-example",
    kabadiwala: { ownerName: "Example owner" },
  });
});
