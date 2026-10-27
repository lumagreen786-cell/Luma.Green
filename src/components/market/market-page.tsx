"use client";

import { useQuery } from "convex/react";
import { SearchXIcon, StoreIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { useFormat } from "@/components/app/format";
import {
  AppPageHeader,
  DemoNote,
  EmptyState,
  ListSkeleton,
  Section,
} from "@/components/app/page-parts";
import { useListScroll } from "@/components/app/use-list-scroll";
import { useViewPreference } from "@/components/app/use-view-preference";
import type { OrgWorkspace } from "@/components/app/use-workspace";

import { api } from "../../../convex/_generated/api";
import { BuyButton } from "./buy-dialog";
import { ListingCard } from "./listing-card";
import { materialOptions, recycledFirst } from "./logic";
import { MaterialFilter } from "./material-filter";
import { useOrg } from "./use-org";
import { useRecycledCodes } from "./use-recycled-codes";

/**
 * `/app/market`: server-approved chain and manufacturer-byproduct offers.
 * The server checks the buyer's approved material scope for every offer.
 */
export function MarketPage() {
  const t = useTranslations("market");
  const org = useOrg();
  const canBuy = org !== null;

  return (
    <>
      <AppPageHeader
        title={t("browse.title")}
        lead={canBuy ? t("browse.lead") : undefined}
      />
      {canBuy ? <Lots org={org} /> : <NotForYou />}
    </>
  );
}

function Lots({ org }: { org: OrgWorkspace }) {
  const t = useTranslations("market");
  const format = useFormat();
  const listings = useQuery(api.market.browse, {});
  const recycled = useRecycledCodes();
  const [savedMaterial, saveMaterial] = useViewPreference(
    `market.${org.id}`,
    "",
  );
  const [chosenMaterial, chooseMaterial] = useState<string | null>();
  const material =
    chosenMaterial === undefined ? savedMaterial || null : chosenMaterial;
  const setMaterial = (value: string | null) => {
    chooseMaterial(value);
    saveMaterial(value ?? "");
  };

  useListScroll(`market.${org.id}`, listings !== undefined);
  const ordered = useMemo(() => {
    if (!listings) return [];
    return org.kind === "manufacturer"
      ? recycledFirst(listings, recycled)
      : listings;
  }, [listings, org.kind, recycled]);

  if (listings === undefined) return <ListSkeleton rows={4} />;
  if (listings.length === 0) {
    return (
      <EmptyState
        icon={StoreIcon}
        title={t("browse.emptyTitle")}
        body={t("browse.emptyBody")}
      />
    );
  }

  const options = materialOptions(listings, (names, code) =>
    format.material(names, code),
  );
  // A material whose lots have all sold drops out of the chips; show all.
  const selected = options.find((option) => option.code === material);
  const shown = selected
    ? ordered.filter((listing) => listing.material.code === selected.code)
    : ordered;

  return (
    <>
      <DemoNote>{t("sampleData")}</DemoNote>
      <div className="grid items-start gap-8 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <div className="min-w-0 lg:sticky lg:top-6">
          <MaterialFilter
            options={options}
            value={selected?.code ?? null}
            onChange={setMaterial}
          />
        </div>
        <Section title={t("browse.count", { count: shown.length })}>
          <ul className="flex flex-col">
            {shown.map((listing) => (
              <li key={listing.id}>
                <ListingCard
                  listing={listing}
                  isRecycled={recycled.has(listing.material.code)}
                  action={<BuyButton listing={listing} />}
                />
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </>
  );
}

/** Personal and Saathi accounts do not have business trading access. */
function NotForYou() {
  const t = useTranslations("market");
  return (
    <EmptyState
      icon={SearchXIcon}
      title={t("forBusinessesTitle")}
      body={t("forBusinessesBody")}
    />
  );
}
