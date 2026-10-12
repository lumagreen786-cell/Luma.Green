"use client";

import { useConvexAuth, useMutation } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { useSignedInQuery } from "@/components/providers/use-signed-in-query";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { defaultLocale, isLocale, localeDirection } from "@/i18n/locales";
import { useRouter } from "@/i18n/navigation";

import { api } from "../../../convex/_generated/api";
import type { SiteType } from "../../../convex/lib/siteClassification";
import {
  GENERATOR_SITE_TYPES,
  STAKEHOLDER_KINDS,
  type StakeholderKind,
} from "../../../convex/lib/stakeholderKinds";
import { FormSkeleton } from "./join-gate";

/** A private, default-deny account request. Approval does not open workspaces. */
export function StakeholderRequest() {
  const locale = useLocale();
  const direction = localeDirection(isLocale(locale) ? locale : defaultLocale);
  const t = useTranslations("stakeholder");
  const join = useTranslations("join");
  const account = useSignedInQuery(api.stakeholderAccounts.mine);
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();
  const request = useMutation(api.stakeholderAccounts.request);
  const [kind, setKind] = useState<StakeholderKind | undefined>();
  const [siteType, setSiteType] = useState<SiteType | undefined>();
  const [organizationName, setOrganizationName] = useState("");
  const [isAdult, setIsAdult] = useState(false);
  const [hasRead, setHasRead] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace({
        pathname: "/login",
        query: { next: "/join/stakeholder" },
      });
    }
  }, [isAuthenticated, isLoading, router]);

  if (account === undefined || (!isLoading && !isAuthenticated)) {
    return <FormSkeleton />;
  }

  if (account) {
    const title = {
      pending: join("status.submitted.title"),
      approved: join("status.approved.title"),
      rejected: join("status.rejected.title"),
    }[account.status];
    return (
      <section className="flex flex-col gap-5 border-t border-border py-6">
        <h1 className="font-display text-2xl leading-[1.25] font-semibold tracking-tight">
          {title}
        </h1>
        <p className="font-medium">{account.organizationName}</p>
        <p className="text-sm text-muted-foreground">
          {t(`kinds.${account.kind}`)}
          {account.siteType ? <> · {t(`sites.${account.siteType}`)}</> : null}
        </p>
        {account.status === "rejected" && account.reviewNote ? (
          <div className="border-s-2 border-destructive ps-4">
            <p className="font-medium">{join("status.rejected.lead")}</p>
            <p className="whitespace-pre-line">{account.reviewNote}</p>
          </div>
        ) : null}
        <p className="text-sm text-muted-foreground">{t("note")}</p>
      </section>
    );
  }

  const canSubmit =
    kind !== undefined &&
    (kind !== "material_generator" || siteType !== undefined) &&
    organizationName.trim().length >= 2 &&
    isAdult &&
    hasRead &&
    !submitting;

  async function send() {
    if (!kind || !canSubmit) return;
    setSubmitting(true);
    setFailed(false);
    try {
      await request({
        kind,
        siteType: kind === "material_generator" ? siteType : undefined,
        organizationName,
        ageConfirmed: true,
        privacyAccepted: true,
      });
    } catch {
      setFailed(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      <header className="border-b border-border pb-5">
        <h1 className="font-display text-2xl leading-[1.25] font-semibold tracking-tight">
          {t("title")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("note")}</p>
      </header>
      <div className="flex flex-col gap-2">
        <Label htmlFor="stakeholder-kind">{t("kind")}</Label>
        <Select
          dir={direction}
          value={kind ?? ""}
          onValueChange={(value) => {
            setKind(value as StakeholderKind);
            setSiteType(undefined);
          }}
        >
          <SelectTrigger
            id="stakeholder-kind"
            aria-label={t("kind")}
            className="w-full"
          >
            <SelectValue placeholder={t("kind")} />
          </SelectTrigger>
          <SelectContent>
            {STAKEHOLDER_KINDS.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`kinds.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {kind === "material_generator" ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="stakeholder-site">{t("site")}</Label>
          <Select
            dir={direction}
            value={siteType ?? ""}
            onValueChange={(value) => {
              setSiteType(value as SiteType);
            }}
          >
            <SelectTrigger
              id="stakeholder-site"
              aria-label={t("site")}
              className="w-full"
            >
              <SelectValue placeholder={t("site")} />
            </SelectTrigger>
            <SelectContent>
              {GENERATOR_SITE_TYPES.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`sites.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor="stakeholder-name">{t("name")}</Label>
        <Input
          id="stakeholder-name"
          autoComplete="organization"
          maxLength={120}
          value={organizationName}
          onChange={(event) => {
            setOrganizationName(event.target.value);
          }}
        />
      </div>
      <div className="flex flex-col divide-y divide-border border-y border-border">
        <div className="flex items-start gap-3 py-4">
          <Checkbox
            id="stakeholder-age"
            checked={isAdult}
            onCheckedChange={(checked) => {
              setIsAdult(checked === true);
            }}
          />
          <Label htmlFor="stakeholder-age" className="font-normal">
            {join("consent.age")}
          </Label>
        </div>
        <div className="flex items-start gap-3 py-4">
          <Checkbox
            id="stakeholder-privacy"
            checked={hasRead}
            onCheckedChange={(checked) => {
              setHasRead(checked === true);
            }}
          />
          <Label htmlFor="stakeholder-privacy" className="font-normal">
            {join("consent.accept")}
          </Label>
        </div>
      </div>
      {failed ? (
        <p role="alert" className="text-sm text-destructive">
          {join("errors.generic")}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={!canSubmit}>
        {t("submit")}
      </Button>
    </form>
  );
}
