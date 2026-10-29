"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import { FileTextIcon } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";

import { useSignOut } from "@/components/account/use-sign-out";
import { AppPageHeader, ListSkeleton } from "@/components/app/page-parts";
import { NotForYou } from "@/components/shop/guards";
import { useBusiness } from "@/components/shop/use-shop";
import { ActionButton } from "@/components/ui/action-button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter } from "@/i18n/navigation";
import { formatPaise } from "@/lib/money-format";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type Status = FunctionReturnType<typeof api.businessSubscriptions.status>;
type Catalogue = FunctionReturnType<typeof api.businessSubscriptions.catalogue>;
type Plan = Catalogue["plans"][number]["id"];
type RequestFailure = "stale" | "reauth" | "error";
function requestFailure(failure: unknown): RequestFailure {
  if (failure instanceof ConvexError) {
    if (failure.data === "STALE_VERSION") return "stale";
    if (failure.data === "RECENT_AUTH_REQUIRED") return "reauth";
  }
  return "error";
}
export function BillingPage() {
  const business = useBusiness();
  const t = useTranslations("businessSubscriptions"),
    workspace = useTranslations("workspace");
  if (business === undefined) return <ListSkeleton />;
  if (!business)
    return (
      <NotForYou
        title={t("title")}
        heading={t("title")}
        body={workspace("empty")}
        icon={FileTextIcon}
      />
    );
  return <BillingBoard key={business.id} orgId={business.id} />;
}
function BillingBoard({ orgId }: { orgId: Id<"orgs"> }) {
  const status = useQuery(api.businessSubscriptions.status, { orgId }),
    catalogue = useQuery(api.businessSubscriptions.catalogue, {});
  return !status || !catalogue ? (
    <ListSkeleton />
  ) : (
    <BillingDetails orgId={orgId} status={status} catalogue={catalogue} />
  );
}
function BillingDetails({
  orgId,
  status,
  catalogue,
}: {
  orgId: Id<"orgs">;
  status: Status;
  catalogue: Catalogue;
}) {
  const t = useTranslations("businessSubscriptions"),
    common = useTranslations("common"),
    recovery = useTranslations("accountRemoval"),
    security = useTranslations("accountSecurity"),
    locale = useLocale(),
    format = useFormatter(),
    id = useId();
  const save = useMutation(api.businessSubscriptions.selectPlan),
    cancel = useMutation(api.businessSubscriptions.cancelRequest);
  const [choice, setChoice] = useState<Plan | undefined>(
      status.request?.selectedPlan,
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<RequestFailure>();
  const router = useRouter();
  const { signOut, busy: isSigningOut } = useSignOut(() => {
    router.replace("/login?next=%2Fapp%2Fbilling");
  });
  const isBusy = busy || isSigningOut;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function write(action: "save" | "cancel") {
    setBusy(true);
    setError(undefined);
    try {
      if (action === "save" && choice)
        await save({
          orgId,
          plan: choice,
          expectedVersion: status.request?.version ?? 0,
        });
      if (action === "cancel")
        await cancel({ orgId, expectedVersion: status.request?.version ?? 0 });
    } catch (error_) {
      if (mounted.current) setError(requestFailure(error_));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  let errorMessage = common("error");
  if (error === "stale") errorMessage = t("stale");
  else if (error === "reauth") errorMessage = recovery("reauth");
  return (
    <section className="flex min-w-0 flex-col gap-6" aria-busy={isBusy}>
      <AppPageHeader title={t("title")} lead={t("lead")} />
      <p role="status" className="text-sm text-muted-foreground">
        {t("off")}
      </p>
      <section className="flex min-w-0 flex-col gap-4 border-t pt-6">
        <p>
          {t(status.request ? status.request.requestState : "none")}
          {status.request ? (
            <> · {t(`plans.${status.request.selectedPlan}`)}</>
          ) : null}
        </p>
        <p className="text-sm text-muted-foreground">
          {t("members", { count: format.number(status.memberCount) })}
        </p>
        {status.entitlement ? (
          <p>
            {t("verified", {
              count: format.number(status.entitlement.memberLimit),
            })}
          </p>
        ) : null}
        {status.canManage ? (
          <div className="flex min-w-0 flex-col items-start gap-3">
            <Label htmlFor={id}>{t("plan")}</Label>
            <Select
              value={choice ?? ""}
              onValueChange={(value) => {
                const selected = catalogue.plans.find(
                  (plan) => plan.id === value,
                );
                if (selected) setChoice(selected.id);
              }}
              disabled={isBusy}
            >
              <SelectTrigger
                id={id}
                className="h-auto min-h-11 w-full max-w-md min-w-0 [&_[data-slot=select-value]]:text-start [&_[data-slot=select-value]]:whitespace-normal"
              >
                <SelectValue placeholder={t("plan")} />
              </SelectTrigger>
              <SelectContent>
                {catalogue.plans.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {t(`plans.${plan.id}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex flex-wrap gap-3">
              <ActionButton
                label={t("save")}
                isDisabled={
                  !choice ||
                  isBusy ||
                  (status.request?.requestState === "selected" &&
                    status.request.selectedPlan === choice)
                }
                onClick={() => {
                  void write("save");
                }}
              />
              {status.request?.requestState === "selected" ? (
                <ActionButton
                  label={t("cancel")}
                  variant="secondary"
                  isDisabled={isBusy}
                  onClick={() => {
                    void write("cancel");
                  }}
                />
              ) : null}
            </div>
          </div>
        ) : (
          <p>{t("ownerOnly")}</p>
        )}
        {error ? (
          <div className="flex flex-col items-start gap-3">
            <p role="alert" className="text-destructive">
              {errorMessage}
            </p>
            {error === "reauth" ? (
              <ActionButton
                label={security("signInAgain")}
                variant="secondary"
                isDisabled={isBusy}
                onClick={() => {
                  void signOut();
                }}
              />
            ) : null}
          </div>
        ) : null}
      </section>
      <section className="min-w-0 border-t">
        {catalogue.plans.map((plan) => {
          const minimum = formatPaise(plan.monthlyMinPaise, locale),
            maximum =
              plan.monthlyMaxPaise === null
                ? null
                : formatPaise(plan.monthlyMaxPaise, locale);
          const fixedOrRange =
            maximum !== null && plan.priceKind === "range"
              ? `${minimum}–${maximum}`
              : minimum;
          const price =
            plan.priceKind === "from"
              ? t("from", { price: minimum })
              : fixedOrRange;
          return (
            <div
              key={plan.id}
              className="grid min-w-0 gap-2 border-b py-4 sm:grid-cols-[1fr_1fr]"
            >
              <h2 className="font-medium">{t(`plans.${plan.id}`)}</h2>
              <div className="flex min-w-0 flex-col gap-1 text-sm">
                <p>
                  {t("monthly")}: <span className="tabular-nums">{price}</span>
                </p>
                <p className="text-muted-foreground">
                  {plan.memberLimit === null
                    ? t("agreed")
                    : t("members", { count: format.number(plan.memberLimit) })}
                </p>
              </div>
            </div>
          );
        })}
      </section>
      {status.events.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-medium">{t("history")}</h2>
          <ul className="divide-y">
            {status.events.map((event) => (
              <li
                key={event.version}
                className="flex flex-wrap justify-between gap-2 py-3 text-sm"
              >
                <span>
                  {t(event.action === "cancelled" ? "cancelled" : "selected")} ·{" "}
                  {t(`plans.${event.plan}`)}
                </span>
                <time dateTime={new Date(event.createdAt).toISOString()}>
                  {format.dateTime(event.createdAt, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </time>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}
