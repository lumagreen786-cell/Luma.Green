import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

import { Container } from "../container";

/** Useful next destinations, with the original section imagery retained. */
export async function HomeResourceGrid() {
  const [home, participants, trade, help, footer] = await Promise.all([
    getTranslations("home"),
    getTranslations("participants"),
    getTranslations("howItWorks.trade"),
    getTranslations("help.faqs"),
    getTranslations("footer"),
  ]);
  const resources = [
    {
      title: home("expansion.shopTitle"),
      body: participants("kabadiwala.body"),
      image: "material-yard.webp",
      href: "/join/kabadiwala",
      action: home("roles.kabadiwala.cta"),
    },
    {
      title: home("roles.manufacturer.one"),
      body: trade("body"),
      image: "recycle-chain-illustration.webp",
      href: "/join/manufacturer",
      action: home("roles.manufacturer.cta"),
    },
    {
      title: home("expansion.recordsTitle"),
      body: help("carbonCredits.a"),
      image: "recycling-line.webp",
      href: "/standards",
      action: footer("standards"),
    },
  ];
  return (
    <section className="py-5 sm:py-6">
      <Container>
        <div className="grid min-w-0 gap-4 md:grid-cols-3">
          {resources.map((resource) => (
            <article
              key={resource.href}
              className="flex min-w-0 flex-col overflow-hidden rounded-panel bg-card shadow-panel"
            >
              <div className="relative h-36 overflow-hidden sm:h-40">
                <Image
                  src={`/images/showcase/${resource.image}`}
                  alt=""
                  fill
                  sizes="(min-width:768px) 33vw,100vw"
                  className="object-cover"
                />
              </div>
              <div className="flex flex-1 flex-col gap-3 p-5 sm:p-6">
                <h2 className="font-display text-xl font-normal text-foreground">
                  {resource.title}
                </h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {resource.body}
                </p>
                <Link
                  href={resource.href}
                  className="mt-auto flex min-h-11 items-center justify-between gap-3 rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring"
                >
                  <span>{resource.action}</span>
                  <ArrowUpRight
                    aria-hidden
                    className="size-4 shrink-0 rtl:-scale-x-100"
                  />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
