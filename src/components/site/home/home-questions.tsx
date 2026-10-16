import {
  ArrowRightIcon,
  BookOpenIcon,
  HandHelpingIcon,
  HouseIcon,
  StoreIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { FaqList } from "@/components/help/faq-list";
import { Link } from "@/i18n/navigation";

import { Container } from "../container";
import { SectionHeading } from "../section-heading";

const questions = [
  "noAccount",
  "howPriceWorks",
  "howPaid",
  "kabadiwalasChecked",
] as const;
const guides = [
  { role: "household", icon: HouseIcon },
  { role: "kabadiwala", icon: StoreIcon },
  { role: "saathi", icon: HandHelpingIcon },
] as const;

/** Reuse the maintained answers and their keyboard-accessible disclosures. */
export async function HomeQuestions() {
  const [home, help] = await Promise.all([
    getTranslations("home"),
    getTranslations("help"),
  ]);
  return (
    <section
      aria-labelledby="home-questions-heading"
      className="border-t bg-muted/30 py-8 sm:py-10"
    >
      <Container className="grid min-w-0 grid-cols-1 gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
        <div className="flex min-w-0 flex-col gap-8">
          <SectionHeading
            id="home-questions-heading"
            title={home("expansion.questionsTitle")}
          />
          <nav
            aria-label={help("rolesHeading")}
            className="flex flex-col divide-y border-y"
          >
            {guides.map(({ role, icon: Icon }) => (
              <Link
                key={role}
                href={`/help/${role}`}
                className="group flex min-h-16 items-center gap-3 py-4 text-sm font-medium outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Icon
                  aria-hidden
                  className="size-5 shrink-0 text-muted-foreground"
                />
                <span className="min-w-0 flex-1">
                  {help(`roles.${role}.title`)}
                </span>
                <ArrowRightIcon
                  aria-hidden
                  className="size-4 shrink-0 rtl:rotate-180"
                />
              </Link>
            ))}
            <Link
              href="/help"
              className="flex min-h-16 items-center gap-3 py-4 text-sm font-medium outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <BookOpenIcon
                aria-hidden
                className="size-5 shrink-0 text-muted-foreground"
              />
              <span className="flex-1">{help("eyebrow")}</span>
              <ArrowRightIcon aria-hidden className="size-4 rtl:rotate-180" />
            </Link>
          </nav>
        </div>
        <FaqList faqs={questions} />
      </Container>
    </section>
  );
}
