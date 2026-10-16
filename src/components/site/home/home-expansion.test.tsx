import { render, screen, within } from "@testing-library/react";
import {
  createFormatter,
  createTranslator,
  NextIntlClientProvider,
} from "next-intl";
import type { ComponentProps, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { findGuide } from "@/components/help/content";

import { CATALOGUE } from "../../../../convex/lib/catalogue";
import arabic from "../../../../messages/ar.json";
import english from "../../../../messages/en.json";
import { HomeQuestions } from "./home-questions";
import { MaterialDirectory } from "./material-directory";
import { MaterialRecords } from "./material-records";
import { PickupJourney } from "./pickup-journey";
import { ShopWorkday } from "./shop-workday";
import { WeightPayment } from "./weight-payment";

const language = vi.hoisted((): { current: "en" | "ar" } => ({
  current: "en",
}));

type HomeNamespace =
  | "home"
  | "nav"
  | "prices.families"
  | "sell"
  | "help.modules.sortOnce"
  | "help"
  | "howItWorks.sell"
  | "participants"
  | "impact.ledger"
  | "howItWorks.record"
  | "principles"
  | "help.faqs"
  | "footer";

vi.mock("next-intl/server", () => ({
  getTranslations: (namespace?: HomeNamespace) =>
    Promise.resolve(
      createTranslator({
        locale: language.current,
        messages: language.current === "ar" ? arabic : english,
        namespace,
        onError: (error) => {
          throw error;
        },
      }),
    ),
  getFormatter: () =>
    Promise.resolve(
      createFormatter({ locale: language.current, timeZone: "Asia/Kolkata" }),
    ),
  getLocale: () => Promise.resolve(language.current),
}));
vi.mock("@/i18n/navigation", () => ({
  Link: (props: ComponentProps<"a">) => <a {...props} />,
}));

async function section(component: () => Promise<ReactNode>) {
  const element = await component();
  const messages = language.current === "ar" ? arabic : english;
  return render(
    <NextIntlClientProvider
      locale={language.current}
      messages={messages}
      onError={(error) => {
        throw error;
      }}
    >
      {element}
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  language.current = "en";
});

describe("extended homepage", () => {
  it("shows six supported scrap families with catalogue names and no factory output", async () => {
    await section(MaterialDirectory);
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(6);
    expect(screen.getByText("Newspaper")).toBeInTheDocument();
    for (const item of CATALOGUE) {
      if (item.stage !== "recycled") continue;
      expect(screen.queryByText(item.names.en)).not.toBeInTheDocument();
    }
    expect(
      screen.getByRole("link", { name: english.home.hero.sell }),
    ).toHaveAttribute("href", "/sell");
  });

  it("starts booking with manual material selection and links to the existing guide", async () => {
    await section(PickupJourney);
    const journey = screen.getAllByRole("list")[0];
    expect(
      within(journey)
        .getAllByRole("heading", { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual([
      english.sell.basket.title,
      english.sell.shop.title,
      english.help.guides.firstPickup.steps.slot.title,
      english.sell.confirm.title,
    ]);
    expect(
      screen.getByRole("link", { name: english.help.training.openGuide }),
    ).toHaveAttribute("href", "/help/household/first-pickup");
    expect(findGuide("household", "first-pickup")).toBeDefined();
  });

  it("explains shop work and keeps its join and help destinations separate", async () => {
    await section(ShopWorkday);
    expect(
      screen.getByText(english.help.guides.weighAndPay.steps.save.body),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: `${english.nav.join}: ${english.home.roles.kabadiwala.cta}`,
      }),
    ).toHaveAttribute("href", "/join/kabadiwala");
    expect(
      screen.getByRole("link", {
        name: `${english.nav.help}: ${english.help.roles.kabadiwala.title}`,
      }),
    ).toHaveAttribute("href", "/help/kabadiwala");
  });

  it("states the credit limitation beside the material record", async () => {
    await section(MaterialRecords);
    expect(
      screen.getByText(english.help.faqs.carbonCredits.a),
    ).toBeInTheDocument();
    expect(
      screen.getByText(english.principles.frozen.body),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: english.footer.standards }),
    ).toHaveAttribute("href", "/standards");
  });

  it("distinguishes estimated value from weighed payment and retains the receipt guide", async () => {
    await section(WeightPayment);
    expect(screen.getByText(english.sell.basket.weighNote)).toBeInTheDocument();
    expect(
      screen.getByText(english.help.guides.weighingAtDoor.steps.pay.body),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: `${english.help.training.openGuide}: ${english.help.guides.weighingAtDoor.title}`,
      }),
    ).toHaveAttribute("href", "/help/household/weighing-at-door");
    expect(findGuide("household", "weighing-at-door")).toBeDefined();
  });

  it("keeps first-pickup answers and a path to the full help library", async () => {
    await section(HomeQuestions);
    expect(
      screen.getByText(english.help.faqs.noAccount.q).closest("summary"),
    ).not.toBeNull();
    expect(screen.getByText(english.help.faqs.howPaid.a)).toBeInTheDocument();
    expect(
      screen.getByText(english.help.faqs.howPriceWorks.a),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: english.help.eyebrow }),
    ).toHaveAttribute("href", "/help");
  });

  it("resolves every expanded section against the Arabic catalogue", async () => {
    language.current = "ar";
    for (const component of [
      MaterialDirectory,
      PickupJourney,
      ShopWorkday,
      WeightPayment,
      MaterialRecords,
      HomeQuestions,
    ]) {
      await section(component);
    }
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(6);
    expect(
      screen.getByRole("link", { name: arabic.footer.standards }),
    ).toHaveAttribute("href", "/standards");
  });

  it("uses Arabic headings, material names and link labels", async () => {
    language.current = "ar";
    await section(MaterialDirectory);
    expect(
      screen.getByRole("heading", {
        name: arabic.home.expansion.materialsTitle,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("صحف")).toBeInTheDocument();
    expect(screen.queryByText("Newspaper")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: arabic.home.hero.sell }),
    ).toHaveAttribute("href", "/sell");
  });
});
