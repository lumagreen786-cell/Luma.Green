"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { isConvexConfigured } from "@/components/providers/convex-provider";
import { ActionButton } from "@/components/ui/action-button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fixedDecimalInput } from "@/lib/number-input";

import { api } from "../../../convex/_generated/api";
import { electricityLogInput } from "../../../convex/lib/householdFootprints";

export function ElectricityFootprintLog({ reading }: { reading: string }) {
  return isConvexConfigured ? <ConnectedLog reading={reading} /> : null;
}

function ConnectedLog({ reading }: { reading: string }) {
  const { isAuthenticated } = useConvexAuth();
  const t = useTranslations("householdTools.footprintLog");
  return isAuthenticated ? (
    <PrivateLog reading={reading} />
  ) : (
    <p className="text-sm text-muted-foreground">{t("signIn")}</p>
  );
}

function PrivateLog({ reading }: { reading: string }) {
  const t = useTranslations("householdTools.footprintLog");
  const tools = useTranslations("householdTools");
  const common = useTranslations("common");
  const locale = useLocale();
  const format = useFormatter();
  const rows = useQuery(api.householdFootprints.mine, {});
  const save = useMutation(api.householdFootprints.save);
  const remove = useMutation(api.householdFootprints.remove);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const operation = useRef<{ signature: string; key: string } | null>(null);
  const wattHours = fixedDecimalInput(reading, 3, locale);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const isValid =
    wattHours !== null &&
    electricityLogInput(
      { wattHours, periodStart: start, periodEnd: end },
      today,
    ) !== null;
  const day = (value: string) =>
    format.dateTime(new Date(`${value}T00:00:00Z`), {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  async function saveLog() {
    if (!isValid || !consent || busy) return;
    const signature = `${start}/${end}/${String(wattHours)}`;
    if (operation.current?.signature !== signature)
      operation.current = { signature, key: crypto.randomUUID() };
    setBusy(true);
    try {
      await save({
        operationKey: operation.current.key,
        periodStart: start,
        periodEnd: end,
        wattHours,
        consent: true,
      });
      toast.success(t("saved"));
    } catch {
      toast.error(common("error"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4 rounded-[1.75rem] bg-card p-5 text-card-foreground sm:p-6">
      <h2 className="text-xl font-medium">{t("title")}</h2>
      <p className="text-sm text-muted-foreground">{t("explanation")}</p>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void saveLog();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="footprint-start">{t("start")}</Label>
            <Input
              id="footprint-start"
              type="date"
              min="2000-01-01"
              max={today}
              value={start}
              onChange={(e) => {
                setStart(e.target.value);
              }}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="footprint-end">{t("end")}</Label>
            <Input
              id="footprint-end"
              type="date"
              min={start || "2000-01-01"}
              max={today}
              value={end}
              onChange={(e) => {
                setEnd(e.target.value);
              }}
              required
            />
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Checkbox
            id="footprint-consent"
            checked={consent}
            onCheckedChange={(value) => {
              setConsent(value === true);
            }}
          />
          <Label htmlFor="footprint-consent" className="leading-6">
            {t("consent")}
          </Label>
        </div>
        <ActionButton
          type="submit"
          label={common("save")}
          disabled={!isValid || !consent || busy}
          isLoading={busy}
        />
      </form>
      <h3 className="font-medium">{t("history")}</h3>
      {rows === undefined && <p role="status">{t("loading")}</p>}
      {rows?.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      )}
      <ul className="divide-y divide-border">
        {rows?.map((row) => (
          <li
            key={row.id}
            className="flex flex-wrap items-center justify-between gap-3 py-4"
          >
            <div className="min-w-0 space-y-1">
              <p>
                {day(row.periodStart)} – {day(row.periodEnd)}
              </p>
              <p>
                {tools("estimate", {
                  amount: format.number(row.milliGramsCO2 / 1_000_000, {
                    maximumSignificantDigits: 5,
                  }),
                })}
              </p>
              <p className="text-sm text-muted-foreground">
                {tools("electricityReading")}:{" "}
                {format.number(row.wattHours / 1000, {
                  maximumFractionDigits: 3,
                })}
              </p>
              <a className="text-sm underline" href={row.source}>
                {row.factorVersion}
              </a>
            </div>
            <ActionButton
              variant="ghost"
              label={t("remove")}
              clickAction={async () => {
                try {
                  await remove({ id: row.id });
                } catch {
                  toast.error(common("error"));
                }
              }}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
