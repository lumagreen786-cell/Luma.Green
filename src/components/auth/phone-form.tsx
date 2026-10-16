"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRightIcon, HomeIcon, LockIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useRouter } from "@/i18n/navigation";
import { requestPhoneCode } from "@/lib/phone-auth";

import { normalizeIndianMobile } from "../../../convex/lib/phone";
import { AuthProgress } from "./auth-progress";
import { rememberPhone, rememberPreviewPhone } from "./storage";

const schema = z.object({
  phone: z
    .string()
    .refine((value) => normalizeIndianMobile(value) !== null, "mobileInvalid"),
});

type Values = z.infer<typeof schema>;

/** Step one of signing in: a mobile number, then an SMS code is sent. */
export function PhoneForm({ canSend = true }: { canSend?: boolean }) {
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
    defaultValues: { phone: "" },
  });

  async function onSubmit(values: Values) {
    const phone = normalizeIndianMobile(values.phone);
    if (!phone) return;
    if (canSend) {
      const error = await requestPhoneCode(phone);
      if (error) {
        setError("root", { message: error });
        return;
      }
      rememberPhone(phone);
    } else {
      rememberPreviewPhone(phone);
    }
    const next = searchParams.get("next");
    router.push({
      pathname: "/login/verify",
      query: next ? { next } : undefined,
    });
  }

  const fieldError = errors.phone?.message ?? errors.root?.message;
  const hasHint = canSend || Boolean(fieldError);
  const readyLabel = canSend ? "sendCode" : "previewAction";

  return (
    <div className="flex flex-col gap-6">
      <AuthProgress step="phone" />
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-2xl leading-tight font-semibold tracking-tight wrap-anywhere sm:text-3xl">
          {t("title")}
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t(canSend ? "lead" : "previewPhoneHint")}
        </p>
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
        <Button
          type="submit"
          size="lg"
          className="w-full justify-between"
          disabled={isSubmitting}
        >
          {t(isSubmitting ? "sending" : readyLabel)}
          <ArrowRightIcon
            aria-hidden
            className="ms-auto hidden sm:block rtl:rotate-180"
          />
        </Button>
      </form>

      <div className="flex flex-col border-t border-border pt-4">
        <p className="flex items-start gap-2 font-medium">
          <HomeIcon aria-hidden className="mt-1 size-4 shrink-0 text-primary" />
          {t("homeTitle")}
        </p>
        <Link
          href="/how-it-works"
          className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {t("homeLink")}
        </Link>
      </div>

      <p className="flex gap-2 text-sm text-muted-foreground">
        <LockIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
        {t("privacy")}
      </p>
    </div>
  );
}
