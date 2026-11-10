"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { toast } from "sonner";

import { useFormat } from "@/components/app/format";
import { parseGrams } from "@/components/lots/logic";
import { ActionButton } from "@/components/ui/action-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "@/i18n/navigation";

import { api } from "../../../convex/_generated/api";
import {
  FINANCIAL_REFERENCE_MAX,
  FINANCIAL_REFERENCE_MIN,
} from "../../../convex/lib/cashfreeLifecycleContract";
import type { TradeView } from "./types";

type Options = NonNullable<
  FunctionReturnType<typeof api.market.directCashFulfillment>
>;
type ActionOptions = Exclude<Options, { action: "renewScope" }>;
type FacilityOption = Extract<
  ActionOptions,
  { action: "dispatch" }
>["sellerFacilities"][number];

export function DirectCashCustody({ trade }: { trade: TradeView }) {
  const t = useTranslations("tradeLifecycle");
  const [isOpen, setOpen] = useState(false);
  const options = useQuery(
    api.market.directCashFulfillment,
    isOpen ? { tradeId: trade.id } : "skip",
  );
  const action = trade.status === "dispatched" ? "receive" : "dispatch";
  return (
    <details
      onToggle={(event) => {
        setOpen(event.currentTarget.open);
      }}
    >
      <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-primary">
        {t(`action.${action}`)}
      </summary>
      {isOpen ? <CustodyOptions trade={trade} options={options} /> : null}
    </details>
  );
}

function CustodyOptions({
  trade,
  options,
}: {
  trade: TradeView;
  options: Options | null | undefined;
}) {
  const common = useTranslations("common");
  const t = useTranslations("tradeLifecycle");
  if (options === undefined) return <p role="status">{common("loading")}</p>;
  if (!options) return <p role="status">{t("actionUnavailable")}</p>;
  return options.action === "renewScope" ||
    (options.action === "dispatch" &&
      (options.sellerFacilities.length === 0 ||
        options.buyerFacilities.length === 0)) ? (
    <PermitRecovery />
  ) : (
    <CustodyForm key={options.action} trade={trade} options={options} />
  );
}

function PermitRecovery() {
  const reviews = useTranslations("operations");
  const facility = useTranslations("facility.registration");
  return (
    <div className="flex flex-col gap-2 text-sm text-muted-foreground">
      <p role="status">{reviews("reviewHint")}</p>
      <div className="flex flex-wrap gap-4">
        <Link href="/app/facility" className="min-h-11 text-primary underline">
          {facility("correct")}
        </Link>
        <Link
          href="/app/material-standards"
          className="min-h-11 text-primary underline"
        >
          {reviews("reviews")}
        </Link>
      </div>
    </div>
  );
}

function SiteChoice({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: FacilityOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  const t = useTranslations("operations");
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange} required>
        <SelectTrigger id={id} className="w-full max-w-full">
          <SelectValue placeholder={t("choose")} />
        </SelectTrigger>
        <SelectContent>
          {options.map(({ id, name }) => (
            <SelectItem key={id} value={id}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function CustodyForm({
  trade,
  options,
}: {
  trade: TradeView;
  options: ActionOptions;
}) {
  const t = useTranslations("tradeLifecycle");
  const lots = useTranslations("lots");
  const facility = useTranslations("facility");
  const party = useTranslations("market.receipt");
  const format = useFormat();
  const move = useMutation(api.market.moveDirectCashTrade);
  const massId = useId();
  const referenceId = useId();
  const [mass, setMass] = useState("");
  const [reference, setReference] = useState("");
  const [seller, setSeller] = useState("");
  const [buyer, setBuyer] = useState("");
  const [isBusy, setBusy] = useState(false);
  const [hasFailed, setFailed] = useState(false);
  const [hasSaved, setSaved] = useState(false);

  const grams = parseGrams(mass);
  const sellerFacilityId =
    options.action === "dispatch"
      ? options.sellerFacilities.find((site) => site.id === seller)?.id
      : undefined;
  const buyerFacilityId =
    options.action === "dispatch"
      ? options.buyerFacilities.find((site) => site.id === buyer)?.id
      : undefined;
  const canSave =
    !isBusy &&
    !hasSaved &&
    grams === trade.grams &&
    reference.trim().length >= FINANCIAL_REFERENCE_MIN &&
    (options.action === "receive" ||
      Boolean(sellerFacilityId && buyerFacilityId));

  async function submit() {
    if (!canSave) return;
    const evidence = { grams, reference: reference.trim() };
    setBusy(true);
    setFailed(false);
    try {
      if (options.action === "receive") {
        await move({
          tradeId: trade.id,
          movement: { kind: "receive", ...evidence },
        });
      } else if (sellerFacilityId && buyerFacilityId) {
        await move({
          tradeId: trade.id,
          movement: {
            kind: "dispatch",
            sellerFacilityId,
            buyerFacilityId,
            ...evidence,
          },
        });
      }
      setSaved(true);
      toast.success(t("saved"));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/30 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <p className="text-sm">
        {t("fullQuantity", { weight: format.weight(trade.grams) })}
      </p>
      {options.action === "dispatch" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <SiteChoice
            label={`${party("seller")} · ${facility("name")}`}
            options={options.sellerFacilities}
            value={seller}
            onChange={setSeller}
          />
          <SiteChoice
            label={`${party("buyer")} · ${facility("name")}`}
            options={options.buyerFacilities}
            value={buyer}
            onChange={setBuyer}
          />
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor={massId}>{lots("mass")}</Label>
        <Input
          id={massId}
          inputMode="numeric"
          maxLength={20}
          required
          value={mass}
          onChange={(event) => {
            setMass(event.target.value);
          }}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={referenceId}>{t("reference")}</Label>
        <Input
          id={referenceId}
          maxLength={FINANCIAL_REFERENCE_MAX}
          required
          value={reference}
          onChange={(event) => {
            setReference(event.target.value);
          }}
        />
      </div>
      {hasFailed ? (
        <p role="alert" className="text-sm">
          {t("failed")}
        </p>
      ) : null}
      <ActionButton
        type="submit"
        label={t("confirm")}
        isDisabled={!canSave}
        className="self-start"
      />
    </form>
  );
}
