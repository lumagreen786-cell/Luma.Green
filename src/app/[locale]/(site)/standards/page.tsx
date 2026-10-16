import {
  ArrowRightIcon,
  BookOpenCheckIcon,
  DropletOffIcon,
  EyeIcon,
  FileCheckIcon,
  LayersIcon,
  LockIcon,
  ReceiptTextIcon,
  ScaleIcon,
  ShieldCheckIcon,
  SparklesIcon,
  StampIcon,
  TagsIcon,
} from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { FaqHashOpener } from "@/components/help/faq-hash-opener";
import { Container } from "@/components/site/container";
import { PageHeader } from "@/components/site/page-header";
import { MaterialCodes } from "@/components/standards/material-codes";
import {
  EscrowSteps,
  NormSection,
  ReceiptAnatomy,
  RuleCards,
  VerificationList,
} from "@/components/standards/norms";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { localeFromParams } from "@/i18n/paths";
import { pageMetadata } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await localeFromParams(params);
  const t = await getTranslations({ locale, namespace: "standards" });

  return pageMetadata({
    locale,
    path: "/standards",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

/** Section anchors, in page order; `nav` is the short label for the jump list. */
const sections = [
  "codes",
  "grading",
  "weighing",
  "custody",
  "verification",
  "escrow",
] as const;

/**
 * The Luma.Green standard: the open material codes and the trading norms
 * behind them, written so anyone in the industry can adopt them.
 */
export default async function StandardsPage() {
  const t = await getTranslations("standards");

  return (
    <>
      <FaqHashOpener />
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        lead={t("lead")}
        scene="electronics"
      />

      <Container className="flex flex-col gap-10 py-8 lg:py-12">
        <nav aria-label={t("onThisPage")} className="flex flex-col gap-3">
          <p className="text-sm font-medium text-muted-foreground">
            {t("onThisPage")}
          </p>
          <ul className="flex flex-wrap gap-2">
            {sections.map((id) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className="inline-flex min-h-11 items-center border-b px-3 text-sm font-medium outline-none hover:border-primary hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {t(`${id}.nav`)}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <NormSection
          id="codes"
          icon={TagsIcon}
          title={t("codes.title")}
          body={t("codes.body")}
        >
          <MaterialCodes />
        </NormSection>

        <NormSection
          id="grading"
          icon={LayersIcon}
          title={t("grading.title")}
          body={t("grading.body")}
          scene="sorting"
        >
          <RuleCards
            rules={[
              {
                key: "dry",
                icon: DropletOffIcon,
                title: t("grading.dry.title"),
                body: t("grading.dry.body"),
              },
              {
                key: "sorted",
                icon: LayersIcon,
                title: t("grading.sorted.title"),
                body: t("grading.sorted.body"),
              },
              {
                key: "clean",
                icon: SparklesIcon,
                title: t("grading.clean.title"),
                body: t("grading.clean.body"),
              },
            ]}
          />
        </NormSection>

        <NormSection
          id="weighing"
          icon={ScaleIcon}
          title={t("weighing.title")}
          body={t("weighing.body")}
          scene="fairWeighing"
        >
          <RuleCards
            rules={[
              {
                key: "stamped",
                icon: StampIcon,
                title: t("weighing.stamped.title"),
                body: t("weighing.stamped.body"),
              },
              {
                key: "shown",
                icon: EyeIcon,
                title: t("weighing.shown.title"),
                body: t("weighing.shown.body"),
              },
              {
                key: "receipt",
                icon: FileCheckIcon,
                title: t("weighing.receipt.title"),
                body: t("weighing.receipt.body"),
              },
            ]}
          />
        </NormSection>

        <NormSection
          id="custody"
          icon={ReceiptTextIcon}
          title={t("custody.title")}
          body={t("custody.body")}
          scene="dispatch"
        >
          <ReceiptAnatomy />
        </NormSection>

        <NormSection
          id="verification"
          icon={ShieldCheckIcon}
          title={t("verification.title")}
          body={t("verification.body")}
        >
          <VerificationList />
        </NormSection>

        <NormSection
          id="escrow"
          icon={LockIcon}
          title={t("escrow.title")}
          body={t("escrow.body")}
        >
          <EscrowSteps />
        </NormSection>

        <section
          aria-labelledby="adopt-heading"
          className="flex flex-col items-start gap-5 border-y py-8 text-foreground md:flex-row md:items-center md:justify-between"
        >
          <div className="flex max-w-2xl items-start gap-4">
            <BookOpenCheckIcon aria-hidden className="mt-1 size-7 shrink-0" />
            <div className="flex flex-col gap-2">
              <h2
                id="adopt-heading"
                className="font-display text-2xl font-semibold tracking-tight"
              >
                {t("adopt.title")}
              </h2>
              <p className="text-muted-foreground">{t("adopt.body")}</p>
            </div>
          </div>
          <Button
            asChild
            size="lg"
            variant="default"
            className="h-12 px-5 text-base"
          >
            <Link href="/help">
              {t("adopt.cta")}
              <ArrowRightIcon aria-hidden className="rtl:rotate-180" />
            </Link>
          </Button>
        </section>
      </Container>
    </>
  );
}
