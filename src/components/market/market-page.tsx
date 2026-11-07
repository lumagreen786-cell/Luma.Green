"use client";

import { useQuery } from "convex/react";
import { SearchXIcon, StoreIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

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
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

import { api } from "../../../convex/_generated/api";
import { BuyButton } from "./buy-dialog";
import { ListingCard } from "./listing-card";
import { materialOptions, recycledFirst } from "./logic";
import { MaterialFilter } from "./material-filter";
import { isRecycledPetFeedstock } from "./pet-procurement";
import { useOrg } from "./use-org";
import { useRecycledCodes } from "./use-recycled-codes";

/**
 * `/app/market`: server-approved chain and manufacturer-byproduct offers.
 * The server checks the buyer's approved material scope for every offer.
 */
export function MarketPage({
  isRecycledPet = false,
}: {
  isRecycledPet?: boolean;
}) {
  const t = useTranslations("market");
  const org = useOrg();
  const canBuy = org !== null;

  return (
    <>
      <AppPageHeader
        title={t(isRecycledPet ? "recycledPetProcurement" : "browse.title")}
        lead={canBuy ? t("browse.lead") : undefined}
        actions={
          canBuy ? (
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link
                  href={
                    isRecycledPet
                      ? "/app/market"
                      : "/app/market?procurement=pet"
                  }
                >
                  {t(isRecycledPet ? "browse.all" : "recycledPetProcurement")}
                </Link>
              </Button>
              {isRecycledPet ? (
                <Button asChild variant="outline">
                  <Link href="/app/trades?procurement=pet&tab=buying">
                    {t("trades.title")}
                  </Link>
                </Button>
              ) : null}
            </div>
          ) : undefined
        }
      />
      {canBuy ? (
        <Lots
          key={isRecycledPet ? "pet" : "all"}
          org={org}
          isRecycledPet={isRecycledPet}
        />
      ) : (
        <NotForYou />
      )}
    </>
  );
}

function Lots({
  org,
  isRecycledPet,
}: {
  org: OrgWorkspace;
  isRecycledPet: boolean;
}) {
  const t = useTranslations("market");
  const format = useFormat();
  const available = useQuery(api.market.browse, {});
  const listings = isRecycledPet
    ? available?.filter((lot) => isRecycledPetFeedstock(lot.material.code))
    : available;
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

  const ordered =
    org.kind === "manufacturer" ? recycledFirst(listings, recycled) : listings;
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
                  action={
                    <BuyButton
                      listing={listing}
                      isRecycledPet={isRecycledPet}
                    />
                  }
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
