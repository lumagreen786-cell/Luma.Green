"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import {
  useSignedInQuery,
  useVerifiedSession,
} from "@/components/providers/use-signed-in-query";
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
import { Link, useRouter } from "@/i18n/navigation";

import { api } from "../../../convex/_generated/api";
import type { ParticipantType } from "../../../convex/lib/participantTypes";
import type { SiteType } from "../../../convex/lib/siteClassification";
import {
  GENERATOR_SITE_TYPES,
  STAKEHOLDER_KINDS,
  type StakeholderKind,
} from "../../../convex/lib/stakeholderKinds";
import { FormSkeleton } from "./join-gate";

/** A private, default-deny account request. Approval does not open workspaces. */
type Account = FunctionReturnType<typeof api.stakeholderAccounts.mine>;

export function StakeholderRequest() {
  const account = useSignedInQuery(api.stakeholderAccounts.mine);
  return <RequestForm account={account} />;
}

export function ParticipantRequest({
  participantType,
}: {
  participantType: ParticipantType;
}) {
  const { isReady } = useVerifiedSession();
  const account = useQuery(
    api.stakeholderAccounts.mineForParticipant,
    isReady ? { participantType } : "skip",
  );
  return (
    <RequestForm
      key={participantType}
      account={account}
      participantType={participantType}
    />
  );
}

function RequestForm({
  account,
  participantType,
}: {
  account: Account | undefined;
  participantType?: ParticipantType;
}) {
  const locale = useLocale();
  const direction = localeDirection(isLocale(locale) ? locale : defaultLocale);
  const t = useTranslations("stakeholder");
  const join = useTranslations("join");
  const participants = useTranslations("participantDirectory");
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();
  const request = useMutation(api.stakeholderAccounts.request);
  const [kind, setKind] = useState<StakeholderKind | undefined>(
    participantType ? "participant_applicant" : undefined,
  );
  const [siteType, setSiteType] = useState<SiteType | undefined>();
  const [organizationName, setOrganizationName] = useState("");
  const [isAdult, setIsAdult] = useState(false);
  const [hasRead, setHasRead] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<"generic" | "pending">();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace({
        pathname: "/login",
        query: {
          next: participantType
            ? `/join/stakeholder?participant=${participantType}`
            : "/join/stakeholder",
        },
      });
    }
  }, [isAuthenticated, isLoading, participantType, router]);

  if (account === undefined || (!isLoading && !isAuthenticated)) {
    return <FormSkeleton />;
  }

  if (account) return <ApplicationStatus account={account} />;

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
    setFailure(undefined);
    try {
      await request({
        kind,
        ...(participantType && { participantType }),
        siteType: kind === "material_generator" ? siteType : undefined,
        organizationName,
        ageConfirmed: true,
        privacyAccepted: true,
      });
    } catch (error) {
      setFailure(
        error instanceof ConvexError && error.data === "INITIAL_ROLE_PENDING"
          ? "pending"
          : "generic",
      );
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
          {participantType ? participants("apply") : t("title")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("note")}</p>
      </header>
      {participantType ? (
        <p className="font-medium">
          {participants(`roles.${participantType}`)}
        </p>
      ) : (
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
      )}
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
      {failure ? (
        <p role="alert" className="text-sm text-destructive">
          {join(
            failure === "pending" ? "status.submitted.title" : "errors.generic",
          )}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={!canSubmit}>
        {t("submit")}
      </Button>
    </form>
  );
}

function ApplicationStatus({ account }: { account: NonNullable<Account> }) {
  const t = useTranslations("stakeholder");
  const participants = useTranslations("participantDirectory");
  const join = useTranslations("join");
  const isManufacturer =
    account.participantType === "intermediary_manufacturer" ||
    account.participantType === "end_goods_manufacturer";
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
        {account.participantType
          ? participants(`roles.${account.participantType}`)
          : t(`kinds.${account.kind}`)}
        {account.siteType ? <> · {t(`sites.${account.siteType}`)}</> : null}
      </p>
      {account.status === "rejected" && account.reviewNote ? (
        <div className="border-s-2 border-destructive ps-4">
          <p className="font-medium">{join("status.rejected.lead")}</p>
          <p className="whitespace-pre-line">{account.reviewNote}</p>
        </div>
      ) : null}
      <p className="text-sm text-muted-foreground">{t("note")}</p>
      {account.participantType && account.status === "approved" ? (
        <Link
          href={isManufacturer ? "/join/manufacturer" : "/join/roles"}
          className="inline-flex min-h-11 items-center self-start text-primary underline"
        >
          {participants(isManufacturer ? "continue" : "title")}
        </Link>
      ) : null}
    </section>
  );
}
