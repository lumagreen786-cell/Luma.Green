"use client";

import { TagIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  AppPageHeader,
  DemoNote,
  EmptyState,
} from "@/components/app/page-parts";
import { WorkflowTabs } from "@/components/app/workflow-tabs";

import { buyerKindFor } from "../../../convex/lib/chain";
import { MyListings } from "./my-listings";
import { NewListingForm } from "./new-listing-form";
import { useOrg } from "./use-org";

/**
 * `/app/sell`: put stock on sale for the next business up the chain, and
 * manage what's on sale. Manufacturers can offer eligible non-hazardous
 * byproducts; eligibility and material scope are enforced by the server.
 */
export function SellPage() {
  const t = useTranslations("market");
  const org = useOrg();
  const buyer = org ? (buyerKindFor(org.kind) ?? "other") : null;

  if (!org || !buyer) {
    return (
      <>
        <AppPageHeader title={t("sell.title")} />
        <EmptyState
          icon={TagIcon}
          title={t("forBusinessesTitle")}
          body={t("forBusinessesBody")}
        />
      </>
    );
  }

  return (
    <>
      <AppPageHeader title={t("sell.title")} lead={t("sell.lead", { buyer })} />
      <DemoNote>{t("sampleData")}</DemoNote>
      <WorkflowTabs
        items={[
          {
            value: "listings",
            label: t("sell.mine.title"),
            content: <MyListings />,
          },
          {
            value: "create",
            label: t("sell.form.title"),
            content: (
              <section className="max-w-xl">
                <NewListingForm sellerKind={org.kind} city={org.city} />
              </section>
            ),
          },
        ]}
      />
    </>
  );
}
