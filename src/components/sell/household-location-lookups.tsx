"use client";

import { useAction, useConvexAuth, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ChevronDownIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useId, useState } from "react";

import { isConvexConfigured } from "@/components/providers/convex-provider";
import { ActionButton } from "@/components/ui/action-button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";

import { api } from "../../../convex/_generated/api";
import type { Point } from "../../../convex/lib/households";
import { verifiedIndianMobile } from "../../../convex/lib/phone";
import { useLocation } from "./use-location";

type Kind = "air" | "solar";
type Result = FunctionReturnType<typeof api.householdLookups.check>;

export function HouseholdLocationLookups() {
  const t = useTranslations("householdTools");
  if (isConvexConfigured) return <ConnectedLookups />;
  return (
    <div className="divide-y divide-border/60 rounded-xl border border-border/60 bg-card px-4">
      <LookupSection title={t("airQuality")}>
        <p>{t("lookupUnavailable")}</p>
      </LookupSection>
      <LookupSection title={t("roofSolar")}>
        <p>{t("lookupUnavailable")}</p>
      </LookupSection>
    </div>
  );
}

function LookupSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group py-3">
      <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 font-medium">
        {title}
        <ChevronDownIcon
          aria-hidden
          className="size-4 shrink-0 group-open:rotate-180"
        />
      </summary>
      <div className="space-y-3 pt-1 pb-2 text-sm text-muted-foreground">
        {children}
      </div>
    </details>
  );
}

function ConnectedLookups() {
  const t = useTranslations("householdTools");
  const availability = useQuery(api.householdLookups.availability);
  return (
    <div className="divide-y divide-border/60 rounded-xl border border-border/60 bg-card px-4">
      <LookupSection title={t("airQuality")}>
        <LookupControls kind="air" available={availability?.air} />
      </LookupSection>
      <LookupSection title={t("roofSolar")}>
        <LookupControls kind="solar" available={availability?.solar} />
      </LookupSection>
    </div>
  );
}

function LookupControls({
  kind,
  available,
}: {
  kind: Kind;
  available: boolean | undefined;
}) {
  const t = useTranslations("householdTools");
  const common = useTranslations("common");
  const phone = useTranslations("accountPhone");
  const signIn = useTranslations("auth");
  const session = authClient.useSession();
  const { isAuthenticated, isLoading } = useConvexAuth();
  if (available === undefined) return <p role="status">{common("loading")}</p>;
  if (!available) return <p>{t("lookupUnavailable")}</p>;
  if (isLoading || session.isPending)
    return <p role="status">{common("loading")}</p>;
  const user = session.data?.user;
  if (!user || !isAuthenticated)
    return (
      <Link
        href={{ pathname: "/login", query: { next: "/sell/services" } }}
        className="inline-flex min-h-11 items-center font-medium text-primary underline"
      >
        {signIn("metaTitle")}
      </Link>
    );
  if (!verifiedIndianMobile(user.phoneNumber, user.phoneNumberVerified))
    return (
      <Link
        href="/account/security"
        className="inline-flex min-h-11 items-center font-medium text-primary underline"
      >
        {phone("title")}
      </Link>
    );
  return <LocationConsent kind={kind} />;
}

function LocationConsent({ kind }: { kind: Kind }) {
  const id = useId();
  const t = useTranslations("householdTools");
  const common = useTranslations("common");
  const sell = useTranslations("sell");
  const check = useAction(api.householdLookups.check);
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const locate = useLocation(
    kind === "solar" ? "building" : "nearby",
    (point: Point) => {
      setPending(true);
      setConsent(false);
      void (async () => {
        try {
          setResult(await check({ kind, consent: true, ...point }));
        } catch {
          setResult({ status: "unavailable" });
        } finally {
          setPending(false);
        }
      })();
    },
  );
  const isBusy = pending || locate.state.status === "locating";

  return (
    <div className="space-y-3">
      {kind === "solar" ? <p>{t("roofPrecision")}</p> : null}
      <div className="flex min-h-11 items-center gap-3">
        <Checkbox
          id={id}
          checked={consent}
          disabled={pending}
          onCheckedChange={(checked) => {
            setConsent(checked === true);
            if (checked !== true) locate.stop();
          }}
        />
        <Label htmlFor={id}>{t("lookupConsent")}</Label>
      </div>
      <ActionButton
        label={sell("shop.useLocation")}
        isDisabled={!consent || isBusy}
        onClick={() => {
          setResult(null);
          locate.locate();
        }}
      />
      {isBusy ? <p role="status">{common("loading")}</p> : null}
      {locate.state.status === "failed" ? (
        <p role="status">{t("locationUnavailable")}</p>
      ) : null}
      {result ? <LookupResult result={result} /> : null}
    </div>
  );
}

function LookupResult({ result }: { result: Result }) {
  const t = useTranslations("householdTools");
  const format = useFormatter();
  const geo = useTranslations("geocoding");
  if (result.status === "limit") return <p role="status">{t("lookupLimit")}</p>;
  if (result.status !== "air" && result.status !== "solar") {
    return <p role="status">{t("lookupUnavailable")}</p>;
  }
  return (
    <div role="status" className="space-y-1 border-t border-border pt-3">
      {result.status === "air" ? (
        <>
          <p className="font-medium text-foreground">
            {t("airScore", { score: format.number(result.score) })}
          </p>
          <p>
            {format.dateTime(result.observedAt, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        </>
      ) : (
        <p className="font-medium text-foreground">
          {t("roofEstimate", {
            energy: format.number(result.annualDcKwh, {
              maximumFractionDigits: 0,
            }),
            panels: format.number(result.panelCount),
          })}
        </p>
      )}
      <p dir="ltr" className="text-start font-normal whitespace-nowrap">
        {geo("attribution")}
      </p>
    </div>
  );
}
