"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRightIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { ActionButton } from "@/components/ui/action-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "@/i18n/navigation";
import { requestPhoneCode } from "@/lib/phone-auth";

import { normalizeIndianMobile } from "../../../convex/lib/phone";
import { rememberPhone } from "./storage";

const schema = z.object({
  phone: z
    .string()
    .refine((value) => normalizeIndianMobile(value) !== null, "mobileInvalid"),
});

type Values = z.infer<typeof schema>;

/** Step one of signing in: a mobile number, then an SMS code is sent. */
export function PhoneForm({
  canSend = true,
  initialPhone = "",
  onSent,
}: {
  canSend?: boolean;
  initialPhone?: string;
  onSent?: (phone: string) => void;
}) {
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const t = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { phone: initialPhone },
  });

  async function onSubmit(values: Values) {
    const phone = normalizeIndianMobile(values.phone);
    if (!phone || !canSend) return;
    const error = await requestPhoneCode(phone, () => mounted.current);
    if (!mounted.current) return;
    if (error) {
      setError("root", { message: error });
      return;
    }
    rememberPhone(phone);
    if (onSent) {
      onSent(phone);
      return;
    }
    const next = searchParams.get("next");
    router.push({
      pathname: "/login/verify",
      query: next ? { next } : undefined,
    });
  }

  const fieldError = errors.phone?.message ?? errors.root?.message;
  const hasHint = canSend || Boolean(fieldError);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl leading-tight font-semibold tracking-tight wrap-anywhere sm:text-4xl">
          {t("metaTitle")}
        </h1>
        {canSend ? null : (
          <p
            role="status"
            className="text-sm leading-relaxed text-muted-foreground"
          >
            {t("unavailableBody")}
          </p>
        )}
      </div>

      <form
        noValidate
        onSubmit={(event) => {
          void handleSubmit(onSubmit)(event);
        }}
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="phone" className="text-sm">
            {t("mobileLabel")}
          </Label>
          <div
            className="flex rounded-md border border-input bg-background transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20"
            dir="ltr"
          >
            <span className="flex h-12 items-center border-e border-input px-4 text-base font-medium text-muted-foreground tabular-nums">
              +91
            </span>
            <Input
              id="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="98765 43210"
              aria-invalid={fieldError ? true : undefined}
              aria-describedby={hasHint ? "phone-hint" : undefined}
              className="h-12 min-w-0 rounded-s-none border-0 bg-transparent text-base tracking-wide shadow-none focus-visible:ring-0 dark:bg-transparent"
              {...register("phone")}
            />
          </div>
          {hasHint ? (
            <p
              id="phone-hint"
              role={fieldError ? "alert" : undefined}
              className={
                fieldError
                  ? "text-sm text-destructive"
                  : "text-sm text-muted-foreground"
              }
            >
              {t(
                fieldError &&
                  ["mobileInvalid", "sendFailed", "sendRateLimited"].includes(
                    fieldError,
                  )
                  ? fieldError
                  : "mobileHint",
              )}
            </p>
          ) : null}
        </div>
        <ActionButton
          type="submit"
          className="w-full"
          label={t(isSubmitting ? "sending" : "sendCode")}
          isDisabled={isSubmitting || !canSend}
          endContent={
            <ArrowRightIcon
              aria-hidden
              className="hidden size-4 sm:block rtl:rotate-180"
            />
          }
        />
      </form>

      <p className="text-xs leading-relaxed text-muted-foreground">
        {t("privacy")}
      </p>
    </div>
  );
}
