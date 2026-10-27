"use client";

import { useMutation } from "convex/react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { type SubmitEvent, useRef, useState } from "react";
import { toast } from "sonner";

import { useFormat } from "@/components/app/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCanOperate } from "@/components/workspace/permissions";

import { api } from "../../../convex/_generated/api";
import { errorCode } from "./bookings";
import { MarketSideLabel } from "./market-side";
import { MaterialIcon } from "./material-icon";
import { compareToMarket, effectivePaise } from "./prices";
import type { RateCardRow } from "./types";
import { parseRupees, rupeesInput } from "./weigh";

type Problem = "invalid" | "belowFloor" | "generic";

/** What's wrong with a typed price, before it's sent. */
export function priceProblem(
  text: string,
  _floorPaise: number | null,
): Problem | null {
  if (text.trim() === "") return null;
  const paise = parseRupees(text);
  return paise === null || paise === 0 ? "invalid" : null;
}

/**
 * One material's price, edited in place: the floor and today's market beside
 * it, a Save button once it changes, and a plain message when it's too low.
 */
export function RateRow({ row }: { row: RateCardRow }) {
  const canOperate = useCanOperate();
  const t = useTranslations("shop");
  const workspace = useTranslations("workspace");
  const format = useFormat();
  const dates = useFormatter();
  const now = useNow({ updateInterval: 1000 });
  const setRate = useMutation(api.shop.setRate);
  const isExpired =
    row.offerExpiresAt !== undefined && row.offerExpiresAt <= now.getTime();
  const saved = isExpired ? null : row.myPaise;
  const [text, setText] = useState(
    row.myPaise === null ? "" : rupeesInput(row.myPaise),
  );
  const [serverProblem, setServerProblem] = useState<Problem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const name = format.material(row.material.names, row.material.code);
  const id = `price-${row.material.code}`;
  const paise = parseRupees(text);
  const problem = priceProblem(text, row.floorPaise) ?? serverProblem;
  const isDirty = text.trim() !== "" && paise !== saved;
  const current = effectivePaise(isExpired ? { ...row, myPaise: null } : row);

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isDirty) return;
    if (paise === null || priceProblem(text, row.floorPaise)) {
      input.current?.focus();
      return;
    }
    setIsSaving(true);
    try {
      await setRate({ materialCode: row.material.code, paisePerKg: paise });
      setServerProblem(null);
      setText(rupeesInput(paise));
      toast.success(
        t("prices.saved", { material: name, price: format.perKg(paise) }),
      );
    } catch (error) {
      setServerProblem(
        errorCode(error) === "BELOW_FLOOR" ? "belowFloor" : "generic",
      );
    } finally {
      setIsSaving(false);
      input.current?.focus();
    }
  }

  const messages: Record<Problem, string> = {
    invalid: t("prices.invalid"),
    belowFloor:
      row.floorPaise === null
        ? t("prices.belowFloorUnknown")
        : t("prices.belowFloor", { price: format.perKg(row.floorPaise) }),
    generic: t("errors.generic"),
  };

  return (
    <li>
      <form
        noValidate
        onSubmit={(event) => void onSubmit(event)}
        className="grid items-center gap-3 border-b border-border py-5 sm:grid-cols-[minmax(0,1fr)_minmax(15rem,1fr)]"
      >
        <div className="flex items-center gap-3">
          <MaterialIcon family={row.material.family} />
          <Label htmlFor={id} className="flex-1 text-base font-medium">
            {name}
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-lg text-muted-foreground"
            >
              {t("prices.prefix")}
            </span>
            <Input
              disabled={!canOperate}
              ref={input}
              id={id}
              inputMode="decimal"
              autoComplete="off"
              aria-label={t("prices.label", { material: name })}
              aria-invalid={problem ? true : undefined}
              aria-describedby={problem ? `${id}-error` : `${id}-hint`}
              placeholder={
                row.fallbackPaise === null
                  ? undefined
                  : rupeesInput(row.fallbackPaise)
              }
              value={text}
              onChange={(event) => {
                setServerProblem(null);
                setText(event.target.value);
              }}
              onBlur={() => {
                if (saved !== null && text.trim() === "") {
                  setText(rupeesInput(saved));
                }
              }}
              className="h-12 ps-8 pe-12 text-xl font-semibold tabular-nums md:text-xl"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-muted-foreground"
            >
              {t("prices.suffix")}
            </span>
          </div>
          {isDirty ? (
            <Button
              type="submit"
              size="lg"
              className="h-12 px-5 text-base"
              disabled={!canOperate || isSaving || problem !== null}
            >
              {t(isSaving ? "prices.saving" : "prices.save")}
            </Button>
          ) : null}
        </div>
        {problem ? (
          <p
            id={`${id}-error`}
            role="alert"
            className="text-sm font-medium text-destructive sm:col-span-2"
          >
            {messages[problem]}
          </p>
        ) : null}
        <p
          id={`${id}-hint`}
          className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground sm:col-span-2"
        >
          {row.offerExpiresAt === undefined ? null : (
            <time dateTime={new Date(row.offerExpiresAt).toISOString()}>
              {workspace("expires", {
                date: dates.dateTime(row.offerExpiresAt, {
                  dateStyle: "medium",
                  timeStyle: "short",
                }),
              })}
            </time>
          )}
          <MarketReference row={row} />
          {current === null || row.marketPaise === null ? null : (
            <MarketSideLabel side={compareToMarket(current, row.marketPaise)} />
          )}
        </p>
      </form>
    </li>
  );
}

function MarketReference({ row }: { row: RateCardRow }) {
  const t = useTranslations("shop");
  const format = useFormat();
  const dates = useFormatter();
  return (
    <>
      {row.marketPaise === null ? null : (
        <span>
          {t("prices.market", { price: format.perKg(row.marketPaise) })}
          {row.marketSource ? <> · {row.marketSource}</> : null}
          {row.marketDate ? (
            <>
              {" "}
              ·{" "}
              <time dateTime={row.marketDate}>
                {dates.dateTime(new Date(`${row.marketDate}T00:00:00Z`), {
                  dateStyle: "medium",
                })}
              </time>
            </>
          ) : null}
        </span>
      )}
    </>
  );
}
