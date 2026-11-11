"use client";
import { useQuery } from "convex/react";
import { PackageSearchIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";

import { AppPageHeader, ListSkeleton } from "@/components/app/page-parts";
import { useWorkspace } from "@/components/app/use-workspace";
import { NotForYou } from "@/components/shop/guards";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isLocale, localeDirection } from "@/i18n/locales";

import { api } from "../../../convex/_generated/api";

export function MaterialStandards() {
  const workspace = useWorkspace();
  const t = useTranslations("operations");
  if (workspace === undefined) return <ListSkeleton />;
  if (workspace?.kind !== "org")
    return (
      <NotForYou
        title={t("standards")}
        heading={t("standards")}
        body={t("workspaceRequired")}
        icon={PackageSearchIcon}
      />
    );
  return <StandardsContent key={workspace.org.id} />;
}
function StandardsContent() {
  const locale = useLocale();
  const t = useTranslations("operations");
  const lots = useTranslations("lots");
  const facility = useTranslations("facility");
  const [search, setSearch] = useState("");
  const id = useId();
  const data = useQuery(api.operationalCatalogue.active, { search });
  const reviews = useQuery(api.complianceReview.myReviews, {});
  const destinations = useQuery(api.complianceReview.destinations, {});
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <AppPageHeader title={t("standards")} lead={t("standardsHint")} />
      <Tabs
        dir={isLocale(locale) ? localeDirection(locale) : "ltr"}
        defaultValue="definitions"
      >
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="definitions">{t("definitions")}</TabsTrigger>
          <TabsTrigger value="reviews">{t("reviews")}</TabsTrigger>
          <TabsTrigger value="destinations">{t("destinations")}</TabsTrigger>
        </TabsList>
        <TabsContent
          value="definitions"
          className="grid min-w-0 items-start gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]"
        >
          <div className="min-w-0 space-y-2 rounded-xl bg-card p-4 lg:sticky lg:top-24">
            <Label htmlFor={id}>{t("search")}</Label>
            <Input
              id={id}
              value={search}
              maxLength={120}
              onChange={(e) => {
                setSearch(e.target.value);
              }}
            />
          </div>
          {data === undefined ? (
            <ListSkeleton />
          ) : (
            <>
              <ul className="grid min-w-0 gap-4 xl:grid-cols-2">
                {data.rows.map((row) => (
                  <li
                    key={row.id}
                    className="min-w-0 space-y-3 rounded-xl bg-card p-5"
                  >
                    <h2 className="font-display text-lg font-semibold">
                      {row.name}
                    </h2>
                    <p className="break-words">
                      {row.materialCode} · {row.processingState} · {row.grade}
                    </p>
                    <p>
                      {lots("specificationVersion")}: {row.version}
                    </p>
                    <p className="text-sm break-words whitespace-pre-wrap">
                      {row.specification}
                    </p>
                    <p className="text-sm break-words text-muted-foreground">
                      {row.sourceReference}
                    </p>
                  </li>
                ))}
              </ul>
              {data.rows.length === 0 ? <p>{t("empty")}</p> : null}
              {data.truncated ? <p>{t("truncated")}</p> : null}
            </>
          )}
        </TabsContent>
        <TabsContent value="reviews" className="space-y-5">
          <p className="text-sm text-muted-foreground">{t("reviewHint")}</p>
          {reviews === undefined ? (
            <ListSkeleton />
          ) : (
            reviews.map((f) => (
              <section key={f.facilityName} className="space-y-3 border-b py-4">
                <h2 className="font-display text-lg font-semibold">
                  {f.facilityName}
                </h2>
                {f.reviews.length === 0 ? (
                  <p>{t("empty")}</p>
                ) : (
                  f.reviews.map((r) => (
                    <div key={r.id} className="space-y-2 border-s ps-3">
                      <p>
                        {t(r.current ? "current" : "historical")} ·{" "}
                        {t(`decisions.${r.decision}`)}
                      </p>
                      <p className="break-words">
                        {r.materialCodes.join(", ")}
                      </p>
                      <p>
                        {r.processes
                          .map((p) => facility(`processKinds.${p}`))
                          .join(", ")}
                      </p>
                      <p>
                        {t("validUntil")}: {r.validUntil}
                      </p>
                      <p className="text-sm break-words">
                        {r.evidenceReference}
                      </p>
                    </div>
                  ))
                )}
              </section>
            ))
          )}
        </TabsContent>
        <TabsContent value="destinations" className="space-y-5">
          <p className="text-sm text-muted-foreground">
            {t("destinationHint")}
          </p>
          {destinations === undefined ? (
            <ListSkeleton />
          ) : (
            <ul className="divide-y divide-border/60 rounded-xl border border-border/60 bg-card px-4 sm:px-5">
              {destinations.map((d) => (
                <li key={d.id} className="space-y-2 py-4">
                  <h2 className="font-display text-lg font-semibold">
                    {d.name}
                  </h2>
                  <p className="break-words">{d.siteReference}</p>
                  <p>
                    {t(d.effective ? "current" : "historical")} ·{" "}
                    {t("validUntil")}: {d.validUntil}
                  </p>
                  <p className="break-words">{d.materialCodes.join(", ")}</p>
                  <p className="text-sm break-words">
                    {d.authorisationReference}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
