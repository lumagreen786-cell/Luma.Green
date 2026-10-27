import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { expect, it, vi } from "vitest";

import messages from "../../../messages/en.json";
import { LoginFlow } from "./login-flow";

vi.mock("@/components/providers/convex-provider", () => ({
  isConvexConfigured: false,
}));
vi.mock("./storage", () => ({
  clearPhoneChallenge: vi.fn(),
  readActivePhone: () => null,
  useStoredValue: () => null,
}));
vi.mock("./resume-session", () => ({ ResumeSession: () => null }));
vi.mock("./phone-form", () => ({ PhoneForm: () => <p>Phone form</p> }));
vi.mock("./email-form", () => ({ EmailForm: () => <p>Email form</p> }));
vi.mock("@/components/site/language-switcher", () => ({
  LanguageSwitcher: () => null,
}));

it.each(["en", "ar", "ur"])("offers only the phone form in %s", (locale) => {
  render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <LoginFlow />
    </NextIntlClientProvider>,
  );
  expect(screen.getByText("Phone form")).toBeVisible();
  expect(screen.queryByText("Email form")).not.toBeInTheDocument();
  expect(screen.queryByRole("tab")).not.toBeInTheDocument();
});
