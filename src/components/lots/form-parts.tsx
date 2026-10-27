"use client";

import { useQuery } from "convex/react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { type ComponentProps, type ReactNode, useId, useState } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isLocale, localeDirection } from "@/i18n/locales";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { OrgKind } from "../../../convex/lib/chain";
import { lotError } from "./logic";

export function Mass({ grams }: { grams: number }) {
  const t = useTranslations("lots");
  const format = useFormatter();
  return (
    <span className="tabular-nums">
      {t("grams", {
        value: format.number(grams, { maximumFractionDigits: 0 }),
      })}
    </span>
  );
}
export function LotField({
  label,
  registration,
  invalid,
  ...props
}: {
  label: string;
  registration?: UseFormRegisterReturn;
  invalid?: boolean;
} & ComponentProps<typeof Input>) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <Input
        id={id}
        className="h-11"
        aria-invalid={invalid ?? undefined}
        {...registration}
        {...props}
      />
    </div>
  );
}
export function EvidenceDialog({
  title,
  hint,
  children,
  open,
  onClose,
  onOpen,
}: {
  title: string;
  hint: string;
  children: ReactNode;
  open: boolean;
  onClose: () => void;
  onOpen: () => void;
}) {
  const t = useTranslations("lots");
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (value) onOpen();
        else onClose();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="min-h-11">
          {title}
        </Button>
      </DialogTrigger>
      <DialogContent
        className="flex flex-col gap-0 overflow-clip p-0 sm:max-w-2xl [&>button]:min-h-11 [&>button]:min-w-11"
        closeLabel={t("close")}
      >
        <DialogHeader className="shrink-0 gap-2 border-b p-5 pe-14 sm:p-6 sm:pe-16">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{hint}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto overscroll-contain p-5 sm:p-6">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}
export function FormStatus({
  busy,
  invalid,
  failure,
  invalidMessage,
}: {
  busy: boolean;
  invalidMessage?: string;
  invalid?: boolean;
  failure?: ReturnType<typeof lotError> | null;
}) {
  const t = useTranslations("lots");
  return (
    <>
      <Button
        type="submit"
        disabled={busy}
        className="min-h-11 w-full sm:w-fit"
      >
        {t(busy ? "saving" : "save")}
      </Button>
      {invalid || failure ? (
        <p role="alert" className="text-sm text-destructive">
          {failure ? t(failure) : (invalidMessage ?? t("invalidInput"))}
        </p>
      ) : null}
    </>
  );
}
export function useEvidenceAction() {
  const t = useTranslations("lots");
  const [failure, setFailure] = useState<ReturnType<typeof lotError> | null>(
    null,
  );
  async function run(action: () => Promise<unknown>, done?: () => void) {
    setFailure(null);
    try {
      await action();
      toast.success(t("saved"));
      done?.();
    } catch (error) {
      const key = lotError(error);
      setFailure(key);
      toast.error(t(key));
    }
  }
  return { failure, setFailure, run };
}
export function BusinessPicker({
  city: initialCity,
  value,
  onChange,
  label,
}: {
  city: string;
  value?: Id<"orgs">;
  onChange: (value: Id<"orgs"> | undefined) => void;
  label: string;
}) {
  const t = useTranslations("lots");
  const common = useTranslations("common");
  const locale = useLocale();
  const dir = isLocale(locale) ? localeDirection(locale) : "ltr";
  const [city, setCity] = useState(initialCity);
  const [kind, setKind] = useState<OrgKind>("yard");
  const [filter, setFilter] = useState<{ city: string; kind: OrgKind } | null>(
    null,
  );
  const results = useQuery(api.traceability.recipientOptions, filter ?? "skip");
  const kindId = useId();
  const orgId = useId();
  return (
    <fieldset className="flex min-w-0 flex-col gap-3 border-t pt-4">
      <legend className="font-medium">{label}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <LotField
          label={t("city")}
          value={city}
          maxLength={120}
          onChange={(event) => {
            setCity(event.target.value);
            setFilter(null);
            onChange(undefined);
          }}
        />
        <div className="flex flex-col gap-2">
          <label htmlFor={kindId}>{t("businessKind")}</label>
          <Select
            dir={dir}
            value={kind}
            onValueChange={(next) => {
              const selectedKind = (
                ["kabadiwala", "yard", "recycler", "manufacturer"] as const
              ).find((item) => item === next);
              if (selectedKind) setKind(selectedKind);
              setFilter(null);
              onChange(undefined);
            }}
          >
            <SelectTrigger id={kindId} className="min-h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(
                ["kabadiwala", "yard", "recycler", "manufacturer"] as const
              ).map((item) => (
                <SelectItem key={item} value={item}>
                  {t(item)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        className="min-h-11 w-fit"
        disabled={!city.trim()}
        onClick={() => {
          onChange(undefined);
          setFilter({ city: city.trim(), kind });
        }}
      >
        {t("searchBusinesses")}
      </Button>
      {filter && !results ? <p role="status">{common("loading")}</p> : null}
      {results && filter ? (
        <>
          <label htmlFor={orgId}>{t("chooseBusiness")}</label>
          <Select
            dir={dir}
            value={value ?? ""}
            onValueChange={(next) => {
              const selected = results.rows.find((row) => row.id === next);
              onChange(selected?.id);
            }}
          >
            <SelectTrigger id={orgId} className="min-h-11 w-full">
              <SelectValue placeholder={t("chooseBusiness")} />
            </SelectTrigger>
            <SelectContent>
              {results.rows.map((row) => (
                <SelectItem key={row.id} value={row.id}>
                  {row.name} · {row.area}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {results.rows.length === 0 ? (
            <p role="status" className="text-sm">
              {t("directoryEmpty")}
            </p>
          ) : null}
          {results.hasMore ? <p className="text-sm">{t("limit")}</p> : null}
        </>
      ) : null}
      <p className="text-sm text-muted-foreground">{t("directoryNote")}</p>
    </fieldset>
  );
}
