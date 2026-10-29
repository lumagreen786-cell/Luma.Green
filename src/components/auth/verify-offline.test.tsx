import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { expect, it, vi } from "vitest";

import messages from "../../../messages/en.json";
import { VerifyFlow } from "./verify-flow";

vi.mock("@/components/providers/convex-provider", () => ({
  isConvexConfigured: false,
}));
vi.mock("convex/react", () => ({
  useQuery: () => {
    throw new Error("Offline pages have no data provider");
  },
}));
vi.mock("@/i18n/navigation", () => ({
  Link: "a",
  useRouter: () => ({ replace: vi.fn() }),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

it("shows unavailable phone entry without a data provider in an unconfigured clone", () => {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <VerifyFlow />
    </NextIntlClientProvider>,
  );
  expect(
    screen.getByRole("button", { name: messages.auth.sendCode }),
  ).toBeDisabled();
  expect(screen.getByText(messages.auth.unavailableBody)).toBeVisible();
});
