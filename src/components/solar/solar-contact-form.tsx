"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "convex/react";
import { CircleCheckIcon, LockIcon, MailIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { isConvexConfigured } from "@/components/providers/convex-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { site } from "@/lib/site";

import { api } from "../../../convex/_generated/api";
import { normalizeIndianMobile } from "../../../convex/lib/phone";
import type { SolarKind } from "./calc";
import {
  contactSchema,
  type ContactValues,
  fieldForError,
  supportRoleFor,
} from "./contact-schema";

/**
 * "Talk to us" for solar: name, number and a message that starts with the
 * estimate from this page. It lands in the admin's support inbox.
 */
export function SolarContactForm({
  kind,
  prefill,
}: {
  kind: SolarKind;
  prefill: string;
}) {
  const t = useTranslations("solar.contact");
  if (!isConvexConfigured) {
    return (
      <p className="flex items-start gap-3 rounded-xl bg-muted/60 p-4">
        <MailIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
        <span>
          {t.rich("unavailable", {
            email: site.supportEmail,
            link: (chunks) => (
              <a
                href={`mailto:${site.supportEmail}`}
                className="rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {chunks}
              </a>
            ),
          })}
        </span>
      </p>
    );
  }
  return <LiveContactForm kind={kind} prefill={prefill} />;
}

function Hint({
  id,
  error,
  hint,
}: {
  id: string;
  error?: string;
  hint?: string;
}) {
  const t = useTranslations("solar.contact.errors");
  if (error) {
    return (
      <p id={id} role="alert" className="text-sm text-destructive">
        {t(error)}
      </p>
    );
  }
  return hint ? (
    <p id={id} className="text-sm text-muted-foreground">
      {hint}
    </p>
  ) : null;
}

function LiveContactForm({
  kind,
  prefill,
}: {
  kind: SolarKind;
  prefill: string;
}) {
  const t = useTranslations("solar.contact");
  const send = useMutation(api.support.send);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    reset,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<ContactValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: "", phone: "", message: prefill },
  });
  const isMessageEdited = dirtyFields.message === true;

  // The message follows the estimate until they write in it themselves.
  useEffect(() => {
    if (!isMessageEdited) setValue("message", prefill);
  }, [prefill, isMessageEdited, setValue]);

  async function onSubmit(values: ContactValues) {
    const phone = normalizeIndianMobile(values.phone);
    if (!phone) return;
    try {
      await send({
        name: values.name,
        phone,
        role: supportRoleFor(kind),
        topic: "solar",
        message: values.message,
      });
      setSentTo(values.name);
    } catch (error) {
      const field = fieldForError(error);
      if (field) setError(field, { message: field });
      else setError("root", { message: "generic" });
    }
  }

  if (sentTo !== null) {
    return (
      <div
        role="status"
        className="flex flex-col items-start gap-3 border-y border-border py-5"
      >
        <CircleCheckIcon aria-hidden className="size-7 text-primary" />
        <p className="text-lg font-semibold">
          {t("sentTitle", { name: sentTo })}
        </p>
        <p className="text-muted-foreground">{t("sentBody")}</p>
        <Button
          variant="outline"
          className="h-11"
          onClick={() => {
            reset({ name: "", phone: "", message: prefill });
            setSentTo(null);
          }}
        >
          {t("another")}
        </Button>
      </div>
    );
  }

  const errorKey = (field: keyof ContactValues) => errors[field]?.message;

  return (
    <form
      noValidate
      onSubmit={(event) => {
        void handleSubmit(onSubmit)(event);
      }}
      className="flex flex-col gap-5"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="solar-contact-name" className="text-base">
          {t("name")}
        </Label>
        <Input
          id="solar-contact-name"
          autoComplete="name"
          aria-invalid={errorKey("name") ? true : undefined}
          aria-describedby={
            errorKey("name") ? "solar-contact-name-note" : undefined
          }
          className="h-12 text-base"
          {...register("name")}
        />
        <Hint id="solar-contact-name-note" error={errorKey("name")} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="solar-contact-phone" className="text-base">
          {t("phone")}
        </Label>
        <div
          className="flex rounded-md border border-input bg-background focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20"
          dir="ltr"
        >
          <span className="flex h-12 items-center border-e border-input px-4 text-base font-medium text-muted-foreground">
            +91
          </span>
          <Input
            id="solar-contact-phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="98765 43210"
            aria-invalid={errorKey("phone") ? true : undefined}
            aria-describedby="solar-contact-phone-note"
            className="h-12 min-w-0 rounded-s-none border-0 bg-transparent text-base tracking-wide shadow-none focus-visible:ring-0 dark:bg-transparent"
            {...register("phone")}
          />
        </div>
        <Hint
          id="solar-contact-phone-note"
          error={errorKey("phone")}
          hint={t("phoneHint")}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="solar-contact-message" className="text-base">
          {t("message")}
        </Label>
        <Textarea
          id="solar-contact-message"
          rows={4}
          aria-invalid={errorKey("message") ? true : undefined}
          aria-describedby="solar-contact-message-note"
          className="text-base"
          {...register("message")}
        />
        <Hint
          id="solar-contact-message-note"
          error={errorKey("message")}
          hint={t("messageHint")}
        />
      </div>

      <div className="flex flex-col gap-3">
        {errors.root ? (
          <p role="alert" className="text-sm text-destructive">
            {t("errors.generic")}
          </p>
        ) : null}
        <Button
          type="submit"
          size="lg"
          className="h-12 text-base"
          disabled={isSubmitting}
        >
          {t(isSubmitting ? "sending" : "send")}
        </Button>
        <p className="flex gap-2 text-sm text-muted-foreground">
          <LockIcon
            aria-hidden
            className="mt-0.5 size-4 shrink-0 text-primary"
          />
          {t("privacy")}
        </p>
      </div>
    </form>
  );
}
