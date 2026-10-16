"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { LoaderCircleIcon, MessageSquareWarningIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useSignOut } from "@/components/account/use-sign-out";
import { useFormat } from "@/components/app/format";
import { DemoNote } from "@/components/app/page-parts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "@/i18n/navigation";

import { api } from "../../../convex/_generated/api";
import { kgToGrams, pointsFor } from "../../../convex/lib/chain";
import {
  type BasketItem,
  cleanAddress,
  type Point,
} from "../../../convex/lib/households";
import { formatIndianMobile } from "../../../convex/lib/phone";
import type { CompleteDraft, SellStep } from "./draft";
import { type SellErrorKey, sellErrorKey, stepToFix } from "./errors";
import { MoneyCard } from "./money-card";
import { PhoneSignIn } from "./phone-sign-in";
import { useTimeFormat } from "./time";
import type { Material, ShopOffer } from "./types";
import { useAuthReady } from "./use-auth-ready";
import { clearSellDraft } from "./use-draft";

function ltr(text: string): string {
  return `\u{2066}${text}\u{2069}`;
}

function SummaryRow({
  label,
  onChange,
  children,
}: {
  label: string;
  onChange: () => void;
  children: ReactNode;
}) {
  const t = useTranslations("sell.confirm");
  return (
    <div className="flex items-start gap-3 py-3">
      <dt className="w-16 shrink-0 pt-0.5 text-sm text-muted-foreground">
        {label}
      </dt>
      <dd className="flex min-w-0 flex-1 items-start gap-3">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">{children}</span>
        <Button
          type="button"
          variant="ghost"
          className="-my-1.5 -me-2 h-11 shrink-0 px-2 text-primary"
          aria-label={t("changeLabel", { section: label })}
          onClick={onChange}
        >
          {t("change")}
        </Button>
      </dd>
    </div>
  );
}

/**
 * Step 4: everything on one card, the money, then the mobile number. Once
 * the SMS code is accepted the booking is made straight away and the
 * household lands on its tracking page.
 */
export function ConfirmStep({
  draft,
  location,
  items,
  materials,
  shop,
  today,
  onEdit,
}: {
  draft: CompleteDraft;
  location?: Point;
  items: readonly BasketItem[];
  materials: readonly Material[];
  shop: ShopOffer;
  today: string;
  onEdit: (step: SellStep) => void;
}) {
  const t = useTranslations("sell");
  const format = useFormat();
  const time = useTimeFormat();
  const locale = useLocale();
  const router = useRouter();
  const book = useMutation(api.households.book);
  const ensureProfile = useMutation(api.identity.ensureProfile);
  const waitForAuth = useAuthReady();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const me = useQuery(api.identity.me, isAuthenticated ? {} : "skip");
  const [status, setStatus] = useState<"idle" | "booking" | "booked">("idle");
  const [error, setError] = useState<SellErrorKey | null>(null);
  const isBooked = useRef(false);
  const isSubmitting = useRef(false);

  // The draft goes once the household has left for the tracking page, so
  // this page never flashes an empty basket on the way out.
  useEffect(
    () => () => {
      if (isBooked.current) clearSellDraft();
    },
    [],
  );

  async function submit() {
    // One booking per tap, even if the code check and a tap land together.
    if (isSubmitting.current) return;
    isSubmitting.current = true;
    setStatus("booking");
    setError(null);
    try {
      await waitForAuth();
      await ensureProfile({ locale });
      const token = await book({
        orgId: shop.id,
        mode: draft.mode,
        items: [...items],
        slotDate: draft.slotDate,
        slotWindow: draft.slotWindow,
        address:
          draft.mode === "pickup" ? cleanAddress(draft.address) : undefined,
        name: draft.name,
        location: draft.mode === "pickup" ? location : undefined,
      });
      isBooked.current = true;
      setStatus("booked");
      router.push(`/t/${token}`);
    } catch (error_) {
      isSubmitting.current = false;
      const key = sellErrorKey(error_);
      setError(key);
      setStatus("idle");
      toast.error(t(`errors.${key}`));
    }
  }

  const { signOut: switchNumber } = useSignOut(() => {
    setError(null);
  });

  const byCode = new Map(
    materials.map((material) => [material.code, material]),
  );
  const fixStep = error ? stepToFix(error) : null;
  const bookLabel = t(
    draft.mode === "pickup" ? "confirm.bookPickup" : "confirm.bookDropoff",
  );

  function phoneContent() {
    if (status !== "idle") {
      return (
        <p role="status" className="flex items-center gap-2 font-medium">
          <LoaderCircleIcon
            aria-hidden
            className="size-5 animate-spin text-primary"
          />
          {t(status === "booked" ? "confirm.booked" : "confirm.booking")}
        </p>
      );
    }
    if (isLoading || (isAuthenticated && me === undefined)) {
      return <Skeleton className="h-24 w-full" />;
    }
    if (isAuthenticated) {
      const phone = me?.phone;
      return (
        <div className="flex flex-col gap-3">
          <p
            className={phone ? "font-medium" : "text-sm text-muted-foreground"}
          >
            {phone
              ? t("confirm.bookingAs", {
                  phone: ltr(formatIndianMobile(phone)),
                })
              : t("errors.NO_PHONE")}
          </p>
          {phone ? (
            <Button
              size="lg"
              className="h-12 text-base"
              onClick={() => {
                void submit();
              }}
            >
              {bookLabel}
            </Button>
          ) : null}
          <Button
            variant="ghost"
            className="self-start"
            onClick={() => {
              void switchNumber();
            }}
          >
            {t("confirm.notYou")}
          </Button>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          {t("confirm.phoneLead")}
        </p>
        <PhoneSignIn
          verifyLabel={t("confirm.confirmAndBook")}
          onVerified={() => {
            void submit();
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <dl className="flex flex-col divide-y border-y border-border">
        <SummaryRow
          label={t("confirm.what")}
          onChange={() => {
            onEdit("basket");
          }}
        >
          {items.map((item) => {
            const material = byCode.get(item.materialCode);
            return (
              <span
                key={item.materialCode}
                className="flex justify-between gap-2"
              >
                <span>
                  {material
                    ? format.material(material.names, material.code)
                    : item.materialCode}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {format.weight(kgToGrams(item.kg))}
                </span>
              </span>
            );
          })}
        </SummaryRow>
        <SummaryRow
          label={t("confirm.who")}
          onChange={() => {
            onEdit("shop");
          }}
        >
          <span className="font-medium">{shop.name}</span>
          <span className="text-sm text-muted-foreground">
            {t(draft.mode === "pickup" ? "confirm.pickup" : "confirm.dropoff")}
          </span>
        </SummaryRow>
        <SummaryRow
          label={t("confirm.when")}
          onChange={() => {
            onEdit("when");
          }}
        >
          <span>
            {t("confirm.whenValue", {
              day: time.day(draft.slotDate, today, {
                today: t("when.today"),
                tomorrow: t("when.tomorrow"),
              }),
              window: t(`windows.${draft.slotWindow}`),
              time: time.window(draft.slotWindow),
            })}
          </span>
        </SummaryRow>
        <SummaryRow
          label={t("confirm.where")}
          onChange={() => {
            onEdit("when");
          }}
        >
          <span className="break-words">
            {draft.mode === "pickup"
              ? cleanAddress(draft.address)
              : shop.address}
          </span>
          <span className="text-sm text-muted-foreground">
            {draft.name.trim()}
          </span>
        </SummaryRow>
      </dl>

      <MoneyCard
        amount={
          shop.estimatePaise === undefined
            ? t("simple.estimateLater")
            : t("confirm.youGet", {
                amount: format.money(shop.estimatePaise),
              })
        }
        points={
          shop.estimatePaise === undefined
            ? undefined
            : t("basket.points", { points: pointsFor(shop.estimatePaise) })
        }
        note={t("confirm.payNote")}
      />
      {location && draft.mode === "pickup" ? (
        <p className="border-t border-border py-4 text-sm text-muted-foreground">
          {t("confirm.locationNote")}
        </p>
      ) : null}
      <DemoNote>{t("demoNote")}</DemoNote>

      <section
        aria-labelledby="phone-title"
        className="flex flex-col gap-4 border-t border-border py-4"
      >
        <h3 id="phone-title" className="text-lg font-semibold">
          {t("confirm.phoneTitle")}
        </h3>
        {error ? (
          <Alert variant="destructive">
            <MessageSquareWarningIcon aria-hidden />
            <AlertDescription className="flex flex-col items-start gap-2">
              {t(`errors.${error}`)}
              {fixStep ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onEdit(fixStep);
                  }}
                >
                  {t("confirm.fixIt")}
                </Button>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}
        {phoneContent()}
      </section>
    </div>
  );
}
