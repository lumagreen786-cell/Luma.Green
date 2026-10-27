"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "convex/react";
import { FileTextIcon, InfoIcon, ShoppingCartIcon } from "lucide-react";
import { useLocale, useNow, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { useFormat } from "@/components/app/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCanOperate } from "@/components/workspace/permissions";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { api } from "../../../convex/_generated/api";
import { requiresEwayBill, safePaiseFor } from "../../../convex/lib/chain";
import { isListingOfferCurrent } from "../../../convex/lib/rateValidity";
import { type MarketErrorKey, marketErrorKey } from "./errors";
import { kgFieldValue, parseKg } from "./logic";
import { OfferComparison } from "./offer-comparison";
import type { ListingView } from "./types";

/** "Buy" on a lot: opens a short form for how much, with the total. */
export function BuyButton({
  listing,
  className,
}: {
  listing: ListingView;
  className?: string;
}) {
  const canOperate = useCanOperate();
  const now = useNow({ updateInterval: 60_000 });
  const t = useTranslations("market.buy");
  const common = useTranslations("common");
  const format = useFormat();
  const [isOpen, setIsOpen] = useState(false);
  if (!canOperate || !isListingOfferCurrent(listing, now.getTime()))
    return null;
  const material = format.material(
    listing.material.names,
    listing.material.code,
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          size="lg"
          className={cn("h-11 text-base", className)}
          aria-label={t("buttonLabel", {
            material,
            seller: listing.seller.name,
          })}
        >
          <ShoppingCartIcon aria-hidden />
          {t("button")}
        </Button>
      </DialogTrigger>
      <DialogContent
        closeLabel={common("close")}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md"
      >
        {isOpen ? (
          <BuyForm
            listing={listing}
            material={material}
            onDone={() => {
              setIsOpen(false);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function fieldMessageKey(error: string | undefined) {
  switch (error ?? "") {
    case "kgInvalid": {
      return "buy.kgInvalid";
    }
    case "kgTooMuch": {
      return "buy.kgTooMuch";
    }
    case "totalInvalid": {
      return "totalInvalid";
    }
    default: {
      return "buy.kgHint";
    }
  }
}

function BuyForm({
  listing,
  material,
  onDone,
}: {
  listing: ListingView;
  material: string;
  onDone: () => void;
}) {
  const t = useTranslations("market");
  const locale = useLocale();
  const format = useFormat();
  const router = useRouter();
  const requestTrade = useMutation(api.market.requestTrade);
  const [failure, setFailure] = useState<MarketErrorKey | null>(null);

  const schema = useMemo(
    () =>
      z.object({
        kg: z
          .string()
          .refine((value) => parseKg(value, locale) !== null, "kgInvalid")
          .refine(
            (value) => (parseKg(value, locale) ?? 0) <= listing.grams,
            "kgTooMuch",
          )
          .refine((value) => {
            const grams = parseKg(value, locale);
            return (
              grams === null ||
              grams > listing.grams ||
              safePaiseFor(grams, listing.askPaisePerKg) !== null
            );
          }, "totalInvalid"),
      }),
    [listing.grams, listing.askPaisePerKg, locale],
  );
  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { kg: "" },
  });

  const grams = parseKg(useWatch({ control, name: "kg" }), locale);
  const total =
    grams !== null && grams <= listing.grams
      ? safePaiseFor(grams, listing.askPaisePerKg)
      : null;
  const available = format.weight(listing.grams);
  const price = format.perKg(listing.askPaisePerKg);
  const fieldError = errors.kg?.message;

  async function onSubmit(values: z.infer<typeof schema>) {
    const wanted = parseKg(values.kg, locale);
    if (wanted === null) return;
    setFailure(null);
    try {
      await requestTrade({ listingId: listing.id, grams: wanted });
      toast.success(t("buy.sent", { seller: listing.seller.name }), {
        description: t("trades.gatewayPending"),
        action: {
          label: t("buy.seeTrades"),
          onClick: () => {
            router.push({ pathname: "/app/trades", query: { tab: "buying" } });
          },
        },
      });
      onDone();
    } catch (error) {
      const key = marketErrorKey(error);
      setFailure(key);
      toast.error(t(`errors.${key}`));
    }
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        void handleSubmit(onSubmit)(event);
      }}
      className="flex flex-col gap-5"
    >
      <DialogHeader>
        <DialogTitle className="text-lg">
          {t("buy.title", { material })}
        </DialogTitle>
        <DialogDescription>
          {t("buy.from", {
            seller: listing.seller.name,
            area: listing.seller.area,
            weight: available,
            price,
          })}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-2">
        <Label htmlFor="buy-kg" className="text-base">
          {t("buy.kgLabel")}
        </Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              id="buy-kg"
              inputMode="decimal"
              autoComplete="off"
              className="h-12 pe-10 text-lg tabular-nums"
              aria-invalid={fieldError ? true : undefined}
              aria-describedby="buy-kg-help"
              {...register("kg")}
            />
            <span
              aria-hidden
              className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              {t("units.kg")}
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-12"
            onClick={() => {
              setValue("kg", kgFieldValue(listing.grams), {
                shouldValidate: true,
              });
            }}
          >
            {t("buy.all", { weight: available })}
          </Button>
        </div>
        <p
          id="buy-kg-help"
          role={fieldError ? "alert" : undefined}
          className={cn(
            "text-sm",
            fieldError ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {t(fieldMessageKey(fieldError), { weight: available })}
        </p>
      </div>

      <div
        className="flex flex-wrap items-end justify-between gap-3 border-y border-border py-4"
        aria-live="polite"
      >
        <div className="flex flex-col gap-0.5">
          <span className="text-sm text-muted-foreground">
            {t("buy.total")}
          </span>
          <span className="text-sm text-muted-foreground tabular-nums">
            {grams !== null && total !== null
              ? t("buy.totalLine", { weight: format.weight(grams), price })
              : null}
          </span>
        </div>
        <span className="text-2xl font-semibold tracking-tight tabular-nums">
          {total === null && grams !== null && grams <= listing.grams
            ? t("totalInvalid")
            : format.money(total ?? 0)}
        </span>
      </div>

      <OfferComparison listing={listing} />
      <p className="flex gap-2 text-sm text-muted-foreground">
        <InfoIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
        {t("trades.gatewayPending")}
      </p>
      {total !== null && requiresEwayBill(total) ? (
        <p className="flex gap-2 border-s-2 border-primary ps-3 text-sm text-muted-foreground">
          <FileTextIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t("buy.ewayBill")}
        </p>
      ) : null}
      {failure ? (
        <p role="alert" className="text-sm text-destructive">
          {t(`errors.${failure}`)}
        </p>
      ) : null}

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="h-11"
          onClick={onDone}
        >
          {t("buy.cancel")}
        </Button>
        <Button
          type="submit"
          size="lg"
          className="h-11 text-base"
          disabled={isSubmitting}
        >
          {t(isSubmitting ? "buy.sending" : "buy.submit")}
        </Button>
      </DialogFooter>
    </form>
  );
}
