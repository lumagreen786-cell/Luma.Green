"use client";

import { useQuery } from "convex/react";
import { ShieldCheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  AppPageHeader,
  DemoNote,
  EmptyState,
  ListSkeleton,
} from "@/components/app/page-parts";
import { useWorkspace } from "@/components/app/use-workspace";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

import { api } from "../../../convex/_generated/api";
import { Checklist } from "./checklist";
import { ConsentCard } from "./consent-card";
import { EprSummary } from "./epr-summary";
import { QueryBoundary } from "./query-boundary";
import { Receipts } from "./receipts";

function ComplianceBody() {
  const t = useTranslations("compliance");
  const record = useQuery(api.insights.compliance);
  if (record === undefined) return <ListSkeleton rows={4} />;

  return (
    <>
      <ConsentCard consent={record.consent} orgKind={record.orgKind} />
      <Checklist record={record} />
      <Receipts receipts={record.receipts} />
      {record.epr ? <EprSummary epr={record.epr} /> : null}
      <DemoNote>{t("demoNote")}</DemoNote>
    </>
  );
}

/** A Saathi has no business papers; point them back to their jobs. */
function NotForSaathis() {
  const t = useTranslations("compliance.saathi");
  return (
    <EmptyState
      icon={ShieldCheckIcon}
      title={t("title")}
      body={t("body")}
      action={
        <Button asChild size="lg" className="mt-2 h-12 text-base">
          <Link href="/app">{t("home")}</Link>
        </Button>
      }
    />
  );
}

/**
 * `/app/compliance`: GST and the pollution-board consent (with a renewal
 * reminder), a checklist with what each item means, the business's trade
 * invoices, and the year's EPR record for recyclers and manufacturers.
 */
export function CompliancePage() {
  const t = useTranslations("compliance");
  const workspace = useWorkspace();
  const integrations = useTranslations("integrations");
  const carbon = useTranslations("carbonProjects");

  return (
    <>
      <AppPageHeader
        title={t("title")}
        lead={t("lead")}
        actions={
          workspace?.kind === "org" ? (
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link href="/app/integrations">{integrations("title")}</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/app/carbon-projects">{carbon("title")}</Link>
              </Button>
            </div>
          ) : undefined
        }
      />
      {workspace?.kind === "org" ? (
        <QueryBoundary>
          <ComplianceBody />
        </QueryBoundary>
      ) : null}
      {workspace?.kind === "saathi" ? <NotForSaathis /> : null}
    </>
  );
}
