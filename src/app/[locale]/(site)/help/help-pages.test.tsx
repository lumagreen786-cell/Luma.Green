import { render, screen, within } from "@testing-library/react";
import {
  type AbstractIntlMessages,
  createTranslator,
  NextIntlClientProvider,
} from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import messages from "../../../../../messages/en.json";
import GuidePage, {
  generateMetadata as guideMetadata,
  generateStaticParams as guideParams,
} from "./[role]/[guide]/page";
import RoleHelpPage, {
  generateMetadata as roleMetadata,
  generateStaticParams as roleParams,
} from "./[role]/page";
import HelpContactPage, {
  generateMetadata as contactMetadata,
} from "./contact/page";
import HelpPage, { generateMetadata as helpMetadata } from "./page";

vi.mock("next-intl/server", async () => {
  const { createTranslator: translator } = await import("next-intl");
  const { default: all } = await import("../../../../../messages/en.json");
  const catalog: AbstractIntlMessages = all;
  return {
    getTranslations: (options: string | { namespace: string }) =>
      Promise.resolve(
        translator({
          locale: "en",
          messages: catalog,
          namespace: typeof options === "string" ? options : options.namespace,
        }),
      ),
  };
});

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string | { pathname: string; query?: Record<string, string> };
    children: ReactNode;
  }) => {
    const query =
      typeof href === "string"
        ? ""
        : new URLSearchParams(href.query).toString();
    const suffix = query ? `?${query}` : "";
    const url = typeof href === "string" ? href : `${href.pathname}${suffix}`;
    return (
      <a href={url} {...props}>
        {children}
      </a>
    );
  },
}));

const catalog: AbstractIntlMessages = messages;
const t = createTranslator({
  locale: "en",
  messages: catalog,
  namespace: "help",
});

function params<T extends Record<string, string>>(value: T) {
  return { params: Promise.resolve({ locale: "en", ...value }) };
}

function show(page: ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {page}
    </NextIntlClientProvider>,
  );
}

describe("/help", () => {
  it("is indexed with its own canonical", async () => {
    const meta = await helpMetadata(params({}));
    expect(meta.title).toBe("Help centre");
    expect(meta.alternates?.canonical).toBe("/help");
    expect(meta.robots).toBeUndefined();
  });

  it("offers search, topics, every role and a way to talk to us", async () => {
    show(await HelpPage());
    expect(
      screen.getByRole("heading", { level: 1, name: "How can we help?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("searchbox", { name: "Search help" }),
    ).toBeVisible();
    for (const role of [
      "household",
      "kabadiwala",
      "yard",
      "recycler",
      "manufacturer",
      "saathi",
    ]) {
      expect(
        screen.getByRole("link", { name: t(`roles.${role}.name`) }),
      ).toHaveAttribute("href", `/help/${role}`);
    }
    expect(
      screen.queryByRole("link", { name: /Call/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /WhatsApp/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Write to us/ })).toHaveAttribute(
      "href",
      "/help/contact",
    );
    expect(
      screen.getByText("Phone and WhatsApp support are not available."),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });
});

describe("/help/[role]", () => {
  it("pre-renders one page per role", () => {
    expect(roleParams()).toHaveLength(6);
  });

  it("describes the role in its metadata", async () => {
    const meta = await roleMetadata(params({ role: "yard" }));
    expect(meta.title).toBe("Help for preprocessors");
    expect(meta.alternates?.canonical).toBe("/help/yard");
  });

  it("404s for a role that doesn't exist", async () => {
    await expect(roleMetadata(params({ role: "admin" }))).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    await expect(RoleHelpPage(params({ role: "admin" }))).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });

  it("has guides, questions, videos and training", async () => {
    show(await RoleHelpPage(params({ role: "kabadiwala" })));
    expect(
      screen.getByRole("heading", { level: 1, name: "Help for kabadiwalas" }),
    ).toBeInTheDocument();
    const guides = screen.getByRole("region", { name: "Guides" });
    expect(
      within(guides).getByRole("link", { name: "Weigh and pay" }),
    ).toHaveAttribute("href", "/help/kabadiwala/weigh-and-pay");
    expect(screen.getByText("What is auto-accept?")).toBeInTheDocument();
    expect(screen.getAllByText("Video coming soon")).toHaveLength(3);
    expect(
      screen.getAllByRole("checkbox", { name: "Mark as done" }),
    ).toHaveLength(5);
    expect(screen.getByRole("link", { name: /Write to us/ })).toHaveAttribute(
      "href",
      "/help/contact?role=kabadiwala",
    );
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });
});

describe("/help/[role]/[guide]", () => {
  it("pre-renders every guide under every role that lists it", () => {
    const all = guideParams();
    expect(all).toContainEqual({ role: "saathi", guide: "sign-in" });
    expect(all).toContainEqual({ role: "household", guide: "first-pickup" });
    expect(all).not.toContainEqual({ role: "household", guide: "sign-in" });
  });

  it("names the guide and the role in its title", async () => {
    const meta = await guideMetadata(
      params({ role: "recycler", guide: "carbon-epr" }),
    );
    expect(meta.title).toBe("Carbon credits and EPR, simply · Recyclers");
    expect(meta.alternates?.canonical).toBe("/help/recycler/carbon-epr");
  });

  it("404s for a guide the role doesn't have", async () => {
    await expect(
      GuidePage(params({ role: "household", guide: "set-prices" })),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(
      guideMetadata(params({ role: "yard", guide: "nope" })),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("shows numbered steps, related questions and the next guide", async () => {
    show(await GuidePage(params({ role: "kabadiwala", guide: "set-prices" })));
    expect(
      screen.getByRole("heading", { level: 1, name: "Set your prices" }),
    ).toBeInTheDocument();
    const steps = screen.getByRole("region", { name: "Steps" });
    expect(within(steps).getAllByRole("listitem")).toHaveLength(5);
    expect(within(steps).getByText("Step 3 of 5")).toBeInTheDocument();
    expect(screen.getByText("Can I set my own prices?")).toBeInTheDocument();
    const next = screen.getByRole("region", { name: "Next guide" });
    expect(
      within(next).getByRole("link", {
        name: "Demo guide: Sort your stock and sell to preprocessors",
      }),
    ).toHaveAttribute("href", "/help/kabadiwala/stock-and-sell");
    expect(screen.getByRole("link", { name: /Write to us/ })).toHaveAttribute(
      "href",
      "/help/contact?role=kabadiwala&topic=prices",
    );
  });

  it("wraps from the last guide back to the first", async () => {
    show(await GuidePage(params({ role: "saathi", guide: "saathi-pay" })));
    const next = screen.getByRole("region", { name: "Next guide" });
    expect(within(next).getByRole("link")).toHaveAttribute(
      "href",
      "/help/saathi/sign-in",
    );
  });
});

describe("/help/contact", () => {
  it("is indexed with its own canonical", async () => {
    const meta = await contactMetadata(params({}));
    expect(meta.title).toBe("Contact support");
    expect(meta.alternates?.canonical).toBe("/help/contact");
  });

  it("keeps the message form and marks unconfigured phone contacts unavailable", async () => {
    show(await HelpContactPage());
    expect(
      screen.getByRole("heading", { level: 1, name: "Contact us" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Call/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /WhatsApp/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Send a message" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Phone and WhatsApp support are not available."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Monday to Saturday, 9 am to 7 pm"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("We reply within one working day."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Prototype: these are sample numbers."),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Please try again later.")).toBeInTheDocument();
    expect(
      screen.queryByText("Call or WhatsApp us instead. We're happy to help."),
    ).not.toBeInTheDocument();
  });
});
