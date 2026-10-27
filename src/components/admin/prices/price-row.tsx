"use client";

import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useId, useState } from "react";
import { toast } from "sonner";

import { StatusPill } from "@/components/app/page-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { api } from "../../../../convex/_generated/api";
import { adminErrorMessage } from "../convex-error";
import { formatRupees, formatWhen } from "../format";
import {
  parseRupees,
  PRICE_PROBLEM_MESSAGES,
  priceInputProblem,
  rupeesInput,
} from "./rupees";

export type PriceRowData = FunctionReturnType<
  typeof api.adminPrices.list
>[number];

/** The grid every row and the column header share on wide screens. */
export const PRICE_COLUMNS =
  "xl:grid-cols-[minmax(0,1fr)_8.5rem_8.5rem_8rem_9rem]";

const SAVE_ERRORS: Readonly<Record<string, string>> = {
  ...PRICE_PROBLEM_MESSAGES,
  UNKNOWN_MATERIAL: "This material isn't in the catalogue any more.",
};

function PriceField({
  id,
  label,
  material,
  value,
  onChange,
  isInvalid,
  describedBy,
}: {
  id: string;
  label: string;
  material: string;
  value: string;
  onChange: (value: string) => void;
  isInvalid: boolean;
  describedBy: string | undefined;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label
        htmlFor={id}
        className="text-xs font-normal text-muted-foreground xl:sr-only"
      >
        {label} ₹/kg<span className="sr-only"> for {material}</span>
      </Label>
      <div className="relative">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 start-2.5 flex items-center text-sm text-muted-foreground"
        >
          ₹
        </span>
        <Input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          value={value}
          placeholder="Not set"
          onChange={(event) => {
            onChange(event.target.value);
          }}
          aria-invalid={isInvalid || undefined}
          aria-describedby={describedBy}
          className="h-11 ps-6 tabular-nums"
        />
      </div>
    </div>
  );
}

/** One material's minimum and fallback, edited and saved on its own. */
export function PriceRow({ row, city }: { row: PriceRowData; city: string }) {
  const setPrices = useMutation(api.adminPrices.set);
  const [floor, setFloor] = useState(() => rupeesInput(row.floorPaise));
  const [fallback, setFallback] = useState(() =>
    rupeesInput(row.fallbackPaise),
  );
  const [isSaving, setIsSaving] = useState(false);
  const id = useId();
  const names: Readonly<Record<string, string | undefined>> = row.names;
  const name = names.en ?? row.code;

  const floorPaise = parseRupees(floor);
  const fallbackPaise = parseRupees(fallback);
  const isDirty =
    floorPaise !== row.floorPaise || fallbackPaise !== row.fallbackPaise;
  const problem = isDirty ? priceInputProblem(floor, fallback) : null;
  const errorId = `${id}-problem`;

  async function save() {
    if (!isDirty || problem || floorPaise === null || fallbackPaise === null) {
      return;
    }
    setIsSaving(true);
    try {
      await setPrices({
        city,
        materialCode: row.code,
        floorPaise,
        fallbackPaise,
      });
      setFloor(rupeesInput(floorPaise));
      setFallback(rupeesInput(fallbackPaise));
      toast.success(
        `${name}: reference low ${formatRupees(floorPaise)}, reference price ${formatRupees(fallbackPaise)} a kilo.`,
      );
    } catch (error) {
      toast.error(adminErrorMessage(error, SAVE_ERRORS));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form
      noValidate
      aria-label={name}
      className={cn("grid gap-x-4 gap-y-3 py-4 xl:items-center", PRICE_COLUMNS)}
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <div className="flex min-w-0 flex-col">
        <span className="flex flex-wrap items-center gap-2 font-medium">
          {name}
          {row.stage === "recycled" ? (
            <StatusPill tone="info">Recycled</StatusPill>
          ) : null}
        </span>
        <span className="font-mono text-xs text-muted-foreground">
          {row.code}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 xl:contents">
        <PriceField
          id={`${id}-floor`}
          label="Reference low"
          material={name}
          value={floor}
          onChange={setFloor}
          isInvalid={problem !== null}
          describedBy={problem ? errorId : undefined}
        />
        <PriceField
          id={`${id}-fallback`}
          label="Reference price"
          material={name}
          value={fallback}
          onChange={setFallback}
          isInvalid={problem !== null}
          describedBy={problem ? errorId : undefined}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {row.updatedAt === null
          ? "Not set yet"
          : `Changed ${formatWhen(row.updatedAt)}`}
      </p>
      <div className="flex gap-2 xl:justify-end">
        <Button
          type="submit"
          size="sm"
          className="min-h-11"
          disabled={!isDirty || problem !== null || isSaving}
        >
          {isSaving ? "Saving…" : "Save"}
        </Button>
        {isDirty ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-11"
            disabled={isSaving}
            onClick={() => {
              setFloor(rupeesInput(row.floorPaise));
              setFallback(rupeesInput(row.fallbackPaise));
            }}
          >
            Undo
          </Button>
        ) : null}
      </div>
      {problem ? (
        <p id={errorId} className="text-xs text-destructive xl:col-span-5">
          {PRICE_PROBLEM_MESSAGES[problem]}
        </p>
      ) : null}
    </form>
  );
}
