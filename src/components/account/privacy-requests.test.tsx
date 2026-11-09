import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, expect, it, vi } from "vitest";

import ar from "../../../messages/ar.json";
import { PrivacyRequests } from "./privacy-requests";

const mocks = vi.hoisted(() => ({
  submit: vi.fn(),
  session: {
    isPending: false,
    isReady: true,
    userId: "test-account",
  },
}));

vi.mock("convex/react", () => ({
  useMutation: () => mocks.submit,
  useQuery: () => [],
}));

vi.mock("@/components/providers/use-signed-in-query", () => ({
  useVerifiedSession: () => mocks.session,
}));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it("submits a selected request and reports receipt in an RTL locale", async () => {
  mocks.submit.mockResolvedValue("request-id");
  render(
    <NextIntlClientProvider locale="ar" messages={ar}>
      <PrivacyRequests />
    </NextIntlClientProvider>,
  );

  const user = userEvent.setup();
  const send = screen.getByRole("button", { name: ar.privacyRequests.submit });
  expect(send).toBeDisabled();
  const group = screen.getByRole("radiogroup", {
    name: ar.privacyRequests.kind,
  });
  expect(group).toHaveAttribute("dir", "rtl");
  await user.tab();
  expect(
    screen.getByRole("radio", { name: ar.privacyRequests.access }),
  ).toHaveFocus();
  await user.keyboard("{ArrowDown}");
  const correction = screen.getByRole("radio", {
    name: ar.privacyRequests.correction,
  });
  await waitFor(() => {
    expect(correction).toHaveFocus();
  });
  await user.keyboard(" ");
  expect(correction).toBeChecked();
  await user.click(send);
  expect(mocks.submit).toHaveBeenCalledWith({ kind: "correction" });
  expect(await screen.findByText(ar.privacyRequests.received)).toHaveAttribute(
    "role",
    "status",
  );
});
