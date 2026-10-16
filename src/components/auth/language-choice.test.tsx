import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, expect, it, vi } from "vitest";

import { locales } from "@/i18n/locales";

import messages from "../../../messages/en.json";
import { LanguageChoice } from "./language-choice";

const calls = vi.hoisted(() => ({
  replace: vi.fn(),
  markLanguageChosen: vi.fn(),
  onDone: vi.fn(),
}));
vi.mock("@/i18n/navigation", () => ({
  usePathname: () => "/login",
  useRouter: () => ({ replace: calls.replace }),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("next=/join/saathi"),
}));
vi.mock("./storage", () => ({ markLanguageChosen: calls.markLanguageChosen }));
beforeEach(() => vi.resetAllMocks());

function renderChoice() {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <LanguageChoice onDone={calls.onDone} />
    </NextIntlClientProvider>,
  );
}

it("shows the current language and all supported choices without leaving the page", () => {
  renderChoice();
  expect(screen.getAllByRole("radio")).toHaveLength(locales.length);
  expect(screen.getByRole("radio", { name: "English" })).toBeChecked();
  expect(
    screen.getByRole("status", { name: messages.common.language }),
  ).toHaveTextContent("Language English");
  expect(calls.replace).not.toHaveBeenCalled();
  expect(calls.markLanguageChosen).not.toHaveBeenCalled();
});

it("finds a language by its English name or native name and keeps the selection visible", async () => {
  renderChoice();
  const search = screen.getByRole("searchbox", {
    name: messages.common.search,
  });
  await userEvent.type(search, "  KANNADA  ");
  expect(screen.getAllByRole("radio")).toHaveLength(1);
  expect(screen.getByRole("radio", { name: "ಕನ್ನಡ Kannada" })).toBeVisible();
  await userEvent.clear(search);
  await userEvent.type(search, "العربية");
  expect(screen.getAllByRole("radio")).toHaveLength(1);
  expect(screen.getByRole("radio", { name: "العربية Arabic" })).toBeVisible();
  expect(
    screen.getByRole("status", { name: messages.common.language }),
  ).toHaveTextContent("English");
});

it("lets keyboard users choose before Continue changes the locale and preserves the destination", async () => {
  renderChoice();
  const english = screen.getByRole("radio", { name: "English" });
  await userEvent.click(english);
  await userEvent.keyboard("{ArrowDown>}");
  await waitFor(() => {
    expect(screen.getByRole("radio", { name: "বাংলা Bengali" })).toBeChecked();
  });
  await userEvent.keyboard("{/ArrowDown}");
  expect(calls.markLanguageChosen).not.toHaveBeenCalled();
  expect(calls.replace).not.toHaveBeenCalled();
  await userEvent.click(
    screen.getByRole("button", { name: messages.auth.continue }),
  );
  expect(calls.markLanguageChosen).toHaveBeenCalledOnce();
  expect(calls.replace).toHaveBeenCalledExactlyOnceWith(
    { pathname: "/login", query: { next: "/join/saathi" } },
    { locale: "bn" },
  );
  expect(calls.onDone).not.toHaveBeenCalled();
});

it("keeps Continue available when a search has no matches", async () => {
  renderChoice();
  await userEvent.type(screen.getByRole("searchbox"), "not-a-language");
  expect(screen.queryAllByRole("radio")).toHaveLength(0);
  expect(screen.getByText(messages.help.search.emptyTitle)).toBeVisible();
  await userEvent.click(
    screen.getByRole("button", { name: messages.auth.continue }),
  );
  expect(calls.onDone).toHaveBeenCalledOnce();
  expect(calls.markLanguageChosen).toHaveBeenCalledOnce();
  expect(calls.replace).not.toHaveBeenCalled();
});

it("applies a pointer selection only after Continue", async () => {
  renderChoice();
  await userEvent.click(screen.getByRole("radio", { name: "हिन्दी Hindi" }));
  expect(
    screen.getByRole("status", { name: messages.common.language }),
  ).toHaveTextContent("हिन्दी");
  expect(calls.markLanguageChosen).not.toHaveBeenCalled();
  await userEvent.click(
    screen.getByRole("button", { name: messages.auth.continue }),
  );
  expect(calls.replace).toHaveBeenCalledWith(
    { pathname: "/login", query: { next: "/join/saathi" } },
    { locale: "hi" },
  );
});
