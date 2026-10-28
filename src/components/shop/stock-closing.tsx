"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { useFormat } from "@/components/app/format";
import { ActionButton } from "@/components/ui/action-button";
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
import { Textarea } from "@/components/ui/textarea";
import { authClient } from "@/lib/auth-client";
import { asciiDigits } from "@/lib/number-input";

import { api } from "../../../convex/_generated/api";
import { useBusiness } from "./use-shop";

type Board = FunctionReturnType<typeof api.stockClosing.board>;

export function StockClosing() {
  const business = useBusiness();
  const session = authClient.useSession();
  return business && session.data?.user.id ? (
    <ClosingBody key={`${session.data.user.id}:${business.id}`} />
  ) : null;
}
function ClosingBody() {
  const data = useQuery(api.stockClosing.board);
  const t = useTranslations("stockClosing");
  const common = useTranslations("common");
  const number = useFormatter();
  const format = useFormat();
  const record = useMutation(api.stockClosing.record);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingAttempt, setPendingAttempt] = useState(false);
  const [failure, setFailure] = useState<
    "dateChanged" | "alreadyRecorded" | "limit" | "mismatch" | "failed" | null
  >(null);
  const operation = useRef<{ key: string; day: string; note: string } | null>(
    null,
  );
  const now = useNow({ updateInterval: 60_000 });
  if (!data) return null;
  const day = new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);
  return (
    <details
      className="flex flex-col gap-4 border-t border-border pt-5"
      aria-label={t("title")}
    >
      <summary className="cursor-pointer text-lg font-semibold">
        {t("title")}
      </summary>
      <div className="flex flex-col gap-4 pt-4">
        <p className="text-sm text-muted-foreground">{t("notice")}</p>
        {data.latest ? (
          <div className="space-y-2">
            <h3 className="font-medium">
              {t("last")}: {format.date(data.latest.day)}
            </h3>
            <p>
              {number.number(data.latest.totalGrams)} {t("gramsUnit")} ·{" "}
              {data.latest.totalCostPaise === null
                ? t("unknown")
                : format.money(data.latest.totalCostPaise)}
            </p>
            {data.latest.note ? (
              <p className="whitespace-pre-line">{data.latest.note}</p>
            ) : null}
            <details>
              <summary>{t("balances")}</summary>
              <ul className="divide-y border-y">
                {data.latest.lines.map((line) => (
                  <li
                    key={line.materialCode}
                    className="flex flex-wrap justify-between gap-2 py-2"
                  >
                    <span>{line.materialCode}</span>
                    <span>
                      {number.number(line.grams)} {t("gramsUnit")} ·{" "}
                      {line.costPaise === null
                        ? t("unknown")
                        : format.money(line.costPaise)}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        ) : (
          <p>{t("none")}</p>
        )}
        {data.canOperate && data.latest?.day !== day ? (
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (busy) return;
              const today = new Date(Date.now() + 330 * 60_000)
                .toISOString()
                .slice(0, 10);
              operation.current ??= {
                key: crypto.randomUUID(),
                day: today,
                note,
              };
              const attempt = operation.current;
              setBusy(true);
              setPendingAttempt(true);
              setFailure(null);
              void record({
                operationKey: attempt.key,
                day: attempt.day,
                note: attempt.note,
              })
                .then(() => {
                  operation.current = null;
                  setPendingAttempt(false);
                  setNote("");
                  toast.success(t("closed"));
                })
                .catch((error: unknown) => {
                  const code: unknown =
                    error instanceof ConvexError ? error.data : null;
                  // A typed mutation rejection rolls back; only network errors need the original retry key.
                  if (error instanceof ConvexError) {
                    operation.current = null;
                    setPendingAttempt(false);
                  }
                  switch (code) {
                    case "CLOSING_DATE_CHANGED": {
                      setFailure("dateChanged");
                      break;
                    }
                    case "CLOSING_ALREADY_RECORDED": {
                      setFailure("alreadyRecorded");
                      break;
                    }
                    case "STOCK_CLOSING_LIMIT": {
                      setFailure("limit");
                      break;
                    }
                    case "STOCK_LEDGER_MISMATCH": {
                      setFailure("mismatch");
                      break;
                    }
                    default: {
                      setFailure("failed");
                    }
                  }
                })
                .finally(() => {
                  setBusy(false);
                });
            }}
          >
            <Label htmlFor="stock-closing-note">{t("note")}</Label>
            <Textarea
              id="stock-closing-note"
              value={note}
              maxLength={500}
              disabled={busy || pendingAttempt}
              onChange={(event) => {
                setNote(event.target.value);
              }}
            />
            <ActionButton type="submit" label={t("record")} isDisabled={busy} />
          </form>
        ) : null}
        {failure ? (
          <p role="alert">
            {failure === "failed" ? common("error") : t(failure)}
          </p>
        ) : null}
        <h3 className="font-medium">{t("threshold")}</h3>
        <p className="text-sm text-muted-foreground">{t("thresholdHint")}</p>
        {data.canOperate ? <ThresholdForm data={data} /> : null}
        <ul className="divide-y border-y">
          {data.settings.map((row) => (
            <li
              key={row.materialCode}
              className="flex flex-wrap justify-between gap-2 py-2"
            >
              <span>{row.materialCode}</span>
              <span>
                {row.enabled
                  ? `${number.number(row.thresholdGrams)} ${t("gramsUnit")}`
                  : t("disabled")}
                {row.enabled && row.below ? ` · ${t("below")}` : ""}
              </span>
            </li>
          ))}
        </ul>
        <h3 className="font-medium">{t("recent")}</h3>
        {data.alerts.length === 0 ? (
          <p>{t("noAlerts")}</p>
        ) : (
          <ul className="divide-y border-y">
            {data.alerts.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap justify-between gap-2 py-2"
              >
                <span>
                  {row.materialCode} · {number.number(row.grams)}{" "}
                  {t("gramsUnit")}
                </span>
                <span>{format.dateTime(row.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
        <h3 className="font-medium">{t("correction")}</h3>
        {data.canAdjust ? <AdjustmentForm data={data} /> : null}
        <h3 className="font-medium">{t("recentCorrections")}</h3>
        <ul className="divide-y border-y">
          {data.adjustments.map((row) => (
            <li key={row.id} className="space-y-1 py-2">
              <p>
                {row.materialCode} · {number.number(row.deltaGrams)}{" "}
                {t("gramsUnit")}
              </p>
              <p>{row.reason}</p>
              <p className="text-sm text-muted-foreground">
                {row.evidenceReference} · {format.dateTime(row.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

function AdjustmentForm({ data }: { data: Board }) {
  const t = useTranslations("stockClosing"),
    common = useTranslations("common"),
    sourcing = useTranslations("sourcing"),
    lifecycle = useTranslations("tradeLifecycle"),
    costs = useTranslations("recordedCosts");
  const format = useFormat();
  const adjust = useMutation(api.stockClosing.adjust);
  const [materialCode, setMaterial] = useState("");
  const [direction, setDirection] = useState("add");
  const [grams, setGrams] = useState("");
  const [cost, setCost] = useState("");
  const [unknown, setUnknown] = useState(false);
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);
  const operation = useRef<{
    operationKey: string;
    materialCode: string;
    deltaGrams: number;
    costPaise: number | null;
    reason: string;
    evidenceReference: string;
  } | null>(null);
  return (
    <form
      aria-label={t("correction")}
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (busy) return;
        const quantity = asciiDigits(grams.trim());
        if (
          !materialCode ||
          !/^\d+$/.test(quantity) ||
          !Number.isSafeInteger(Number(quantity)) ||
          Number(quantity) <= 0
        )
          return;
        const recordedCost = asciiDigits(cost.trim());
        if (
          direction === "add" &&
          !unknown &&
          (!/^\d+$/.test(recordedCost) ||
            !Number.isSafeInteger(Number(recordedCost)))
        )
          return;
        operation.current ??= {
          operationKey: crypto.randomUUID(),
          materialCode,
          deltaGrams:
            direction === "add" ? Number(quantity) : -Number(quantity),
          costPaise:
            direction === "add" && !unknown ? Number(recordedCost) : null,
          reason,
          evidenceReference: reference,
        };
        setBusy(true);
        setPending(true);
        void adjust(operation.current)
          .then(() => {
            operation.current = null;
            setPending(false);
            setReason("");
            setReference("");
            setGrams("");
            setCost("");
            toast.success(t("corrected"));
          })
          .catch((error: unknown) => {
            if (error instanceof ConvexError) {
              operation.current = null;
              setPending(false);
            }
            toast.error(common("error"));
          })
          .finally(() => {
            setBusy(false);
          });
      }}
    >
      <fieldset disabled={busy || pending} className="flex flex-col gap-3">
        <Label htmlFor="stock-correction-material">{t("material")}</Label>
        <Select value={materialCode} onValueChange={setMaterial}>
          <SelectTrigger id="stock-correction-material">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {data.materials.map((material) => (
              <SelectItem key={material.code} value={material.code}>
                {format.material(material.names, material.code)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={direction} onValueChange={setDirection}>
          <SelectTrigger aria-label={t("correction")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="add">{t("add")}</SelectItem>
            <SelectItem value="remove">{t("remove")}</SelectItem>
          </SelectContent>
        </Select>
        <Label htmlFor="stock-correction-grams">{sourcing("quantity")}</Label>
        <Input
          id="stock-correction-grams"
          inputMode="numeric"
          value={grams}
          onChange={(event) => {
            setGrams(event.target.value);
          }}
          required
        />
        {direction === "add" ? (
          <>
            <div className="flex items-center gap-2">
              <Checkbox
                id="stock-correction-unknown"
                checked={unknown}
                onCheckedChange={(value) => {
                  setUnknown(value === true);
                }}
              />
              <Label htmlFor="stock-correction-unknown">{t("unknown")}</Label>
            </div>
            <Label htmlFor="stock-correction-cost">
              {costs("acquisition")}
            </Label>
            <Input
              id="stock-correction-cost"
              inputMode="numeric"
              value={cost}
              disabled={unknown}
              required={!unknown}
              onChange={(event) => {
                setCost(event.target.value);
              }}
            />
          </>
        ) : null}
        <Label htmlFor="stock-correction-reason">{lifecycle("reason")}</Label>
        <Textarea
          id="stock-correction-reason"
          value={reason}
          minLength={5}
          maxLength={500}
          required
          onChange={(event) => {
            setReason(event.target.value);
          }}
        />
        <Label htmlFor="stock-correction-reference">{t("evidence")}</Label>
        <Input
          id="stock-correction-reference"
          value={reference}
          maxLength={200}
          required
          onChange={(event) => {
            setReference(event.target.value);
          }}
        />
      </fieldset>
      <ActionButton
        type="submit"
        label={common("save")}
        isDisabled={
          busy ||
          !materialCode ||
          !grams ||
          reason.trim().length < 5 ||
          !reference.trim()
        }
      />
    </form>
  );
}
function ThresholdForm({ data }: { data: Board }) {
  const t = useTranslations("stockClosing");
  const common = useTranslations("common");
  const format = useFormat();
  const configure = useMutation(api.stockClosing.configure);
  const [materialCode, setMaterial] = useState("");
  const [grams, setGrams] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = asciiDigits(grams.trim());
        const thresholdGrams = Number(parsed);
        if (
          busy ||
          !materialCode ||
          !Number.isSafeInteger(thresholdGrams) ||
          !/^\d+$/.test(parsed)
        )
          return;
        setBusy(true);
        void configure({ materialCode, enabled, thresholdGrams })
          .then(() => toast.success(t("saved")))
          .catch(() => toast.error(common("error")))
          .finally(() => {
            setBusy(false);
          });
      }}
    >
      <Label htmlFor="stock-threshold-material">{t("material")}</Label>
      <Select
        value={materialCode}
        onValueChange={(value) => {
          setMaterial(value);
          const current = data.settings.find(
            (row) => row.materialCode === value,
          );
          setGrams(current ? String(current.thresholdGrams) : "");
          setEnabled(current?.enabled ?? false);
        }}
      >
        <SelectTrigger id="stock-threshold-material">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {data.materials.map((material) => (
            <SelectItem key={material.code} value={material.code}>
              {format.material(material.names, material.code)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Label htmlFor="stock-threshold-grams">{t("grams")}</Label>
      <Input
        id="stock-threshold-grams"
        inputMode="numeric"
        value={grams}
        onChange={(event) => {
          setGrams(event.target.value);
        }}
        required
      />
      <div className="flex items-center gap-2">
        <Checkbox
          id="stock-threshold-enabled"
          checked={enabled}
          onCheckedChange={(value) => {
            setEnabled(value === true);
          }}
        />
        <Label htmlFor="stock-threshold-enabled">{t("enabled")}</Label>
      </div>
      <ActionButton
        type="submit"
        label={t("save")}
        isDisabled={busy || !materialCode || !grams}
      />
    </form>
  );
}
