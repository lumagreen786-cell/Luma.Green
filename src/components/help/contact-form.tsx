"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "convex/react";
import { CircleCheckIcon, MessageSquareOffIcon, SendIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";

import { isConvexConfigured } from "@/components/providers/convex-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { defaultLocale, isLocale, localeDirection } from "@/i18n/locales";
import { Link } from "@/i18n/navigation";

import { api } from "../../../convex/_generated/api";
import { normalizeIndianMobile } from "../../../convex/lib/phone";
import {
  type ContactErrorKey,
  type ContactInput,
  contactSchema,
  type ContactValues,
  MESSAGE_MAX,
  serverFieldError,
} from "./contact-schema";
import {
  isSupportRole,
  isSupportTopic,
  SUPPORT_ROLES,
  SUPPORT_TOPICS,
} from "./support-api";

/** The contact form, or an unavailable state when there's no backend. */
export function ContactForm() {
  return isConvexConfigured ? <ContactMessageForm /> : <ContactUnavailable />;
}

/** Shown while the form reads `?role=` and `?topic=` from the address. */
export function ContactFormSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-5">
      {[0, 1, 2, 3].map((row) => (
        <div key={row} className="flex flex-col gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      ))}
      <Skeleton className="h-32 w-full rounded-lg" />
      <Skeleton className="h-12 w-full rounded-lg" />
    </div>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  counter,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  /** Shown at the end of the note line, e.g. characters used. */
  counter?: ReactNode;
  children: ReactNode;
}) {
  const t = useTranslations("help.contact.errors");
  let note: ReactNode = null;
  if (error) {
    note = (
      <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
        {t(error)}
      </p>
    );
  } else if (hint) {
    note = (
      <p id={`${id}-hint`} className="text-sm text-muted-foreground">
        {hint}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="text-base">
        {label}
      </Label>
      {children}
      {counter ? (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">{note}</div>
          {counter}
        </div>
      ) : (
        note
      )}
    </div>
  );
}

/** Which of a field's notes describes it right now. */
function describedBy(id: string, error?: string, hint?: string) {
  if (error) return `${id}-error`;
  return hint ? `${id}-hint` : undefined;
}

/** `/help/contact`: name, number, who they are, topic and the message. */
export function ContactMessageForm() {
  const t = useTranslations("help.contact");
  const locale = useLocale();
  const direction = localeDirection(isLocale(locale) ? locale : defaultLocale);
  const searchParams = useSearchParams();
  const send = useMutation(api.support.send);
  const [isSent, setIsSent] = useState(false);
  const [failure, setFailure] = useState<ContactErrorKey | null>(null);

  const roleParam = searchParams.get("role");
  const topicParam = searchParams.get("topic");
  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<ContactInput, unknown, ContactValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: "",
      phone: "",
      role: isSupportRole(roleParam) ? roleParam : undefined,
      topic: isSupportTopic(topicParam) ? topicParam : undefined,
      message: "",
    },
  });
  const message = useWatch({ control, name: "message" });

  async function onSubmit(values: ContactValues) {
    setFailure(null);
    try {
      await send({
        name: values.name,
        phone: normalizeIndianMobile(values.phone) ?? values.phone,
        role: values.role,
        topic: values.topic,
        message: values.message,
      });
      setIsSent(true);
    } catch (error) {
      const refusal = serverFieldError(error);
      if (refusal) {
        setError(refusal.field, { message: refusal.key });
      } else {
        setFailure("generic");
      }
    }
  }

  if (isSent) {
    return (
      <SentPanel
        onSendAnother={() => {
          // Same person, new question: keep who they are, clear the rest.
          const { name, phone, role } = getValues();
          reset({
            name: name.trim(),
            phone,
            role,
            topic: undefined,
            message: "",
          });
          setIsSent(false);
        }}
      />
    );
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        void handleSubmit(onSubmit)(event);
      }}
    >
      <Field id="contact-name" label={t("name")} error={errors.name?.message}>
        <Input
          id="contact-name"
          autoComplete="name"
          className="h-12 text-base md:text-base"
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={describedBy("contact-name", errors.name?.message)}
          {...register("name")}
        />
      </Field>

      <Field
        id="contact-phone"
        label={t("phone")}
        hint={t("phoneHint")}
        error={errors.phone?.message}
      >
        <div
          className="flex rounded-md border border-input bg-background focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20"
          dir="ltr"
        >
          <span className="flex h-12 items-center border-e border-input px-4 text-base font-medium text-muted-foreground">
            +91
          </span>
          <Input
            id="contact-phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="98765 43210"
            className="h-12 min-w-0 rounded-s-none border-0 bg-transparent text-base tracking-wide shadow-none focus-visible:ring-0 md:text-base dark:bg-transparent"
            aria-invalid={errors.phone ? true : undefined}
            aria-describedby={describedBy(
              "contact-phone",
              errors.phone?.message,
              t("phoneHint"),
            )}
            {...register("phone")}
          />
        </div>
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="contact-role" label={t("role")} error={errors.role?.message}>
          <Controller
            control={control}
            name="role"
            render={({ field }) => (
              <Select
                dir={direction}
                name={field.name}
                value={field.value ?? ""}
                onValueChange={(value) => {
                  if (isSupportRole(value)) field.onChange(value);
                }}
              >
                <SelectTrigger
                  id="contact-role"
                  ref={field.ref}
                  className="h-12 w-full text-base data-[size=default]:h-12"
                  aria-invalid={errors.role ? true : undefined}
                  aria-describedby={describedBy(
                    "contact-role",
                    errors.role?.message,
                  )}
                >
                  <SelectValue placeholder={t("choose")} />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORT_ROLES.map((role) => (
                    <SelectItem
                      key={role}
                      value={role}
                      className="min-h-11 text-base"
                    >
                      {t(`roles.${role}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>

        <Field
          id="contact-topic"
          label={t("topic")}
          error={errors.topic?.message}
        >
          <Controller
            control={control}
            name="topic"
            render={({ field }) => (
              <Select
                dir={direction}
                name={field.name}
                value={field.value ?? ""}
                onValueChange={(value) => {
                  if (isSupportTopic(value)) field.onChange(value);
                }}
              >
                <SelectTrigger
                  id="contact-topic"
                  ref={field.ref}
                  className="h-12 w-full text-base data-[size=default]:h-12"
                  aria-invalid={errors.topic ? true : undefined}
                  aria-describedby={describedBy(
                    "contact-topic",
                    errors.topic?.message,
                  )}
                >
                  <SelectValue placeholder={t("choose")} />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORT_TOPICS.map((topic) => (
                    <SelectItem
                      key={topic}
                      value={topic}
                      className="min-h-11 text-base"
                    >
                      {t(`topics.${topic}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
      </div>

      <Field
        id="contact-message"
        label={t("message")}
        hint={t("messageHint")}
        error={errors.message?.message}
        counter={
          <p
            id="contact-message-count"
            className="shrink-0 text-xs text-muted-foreground tabular-nums"
          >
            {t("messageCount", { count: message.length, max: MESSAGE_MAX })}
          </p>
        }
      >
        <Textarea
          id="contact-message"
          rows={5}
          maxLength={MESSAGE_MAX}
          className="min-h-32 text-base md:text-base"
          aria-invalid={errors.message ? true : undefined}
          aria-describedby={[
            describedBy(
              "contact-message",
              errors.message?.message,
              t("messageHint"),
            ),
            "contact-message-count",
          ]
            .filter(Boolean)
            .join(" ")}
          {...register("message")}
        />
      </Field>

      <div className="flex flex-col gap-3 border-t pt-5">
        {failure ? (
          <p role="alert" className="text-sm text-destructive">
            {t(`errors.${failure}`)}
          </p>
        ) : null}
        <Button
          type="submit"
          size="lg"
          className="h-12 text-base"
          disabled={isSubmitting}
        >
          <SendIcon aria-hidden />
          {t(isSubmitting ? "sending" : "submit")}
        </Button>
        <p className="text-sm text-muted-foreground">{t("privacy")}</p>
      </div>
    </form>
  );
}

function SentPanel({ onSendAnother }: { onSendAnother: () => void }) {
  const t = useTranslations("help.contact");
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  return (
    <div
      role="status"
      className="flex flex-col items-start gap-3 border-y border-primary/30 py-6"
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <CircleCheckIcon aria-hidden className="size-6" />
      </span>
      <h3
        ref={heading}
        tabIndex={-1}
        className="text-xl font-semibold tracking-tight outline-none"
      >
        {t("sentTitle")}
      </h3>
      <p className="text-muted-foreground">{t("sentBody")}</p>
      <div className="flex flex-wrap gap-2 pt-2">
        <Button
          type="button"
          size="lg"
          variant="outline"
          className="h-11 px-4"
          onClick={onSendAnother}
        >
          {t("sendAnother")}
        </Button>
        <Button asChild size="lg" variant="ghost" className="h-11 px-4">
          <Link href="/help">{t("backToHelp")}</Link>
        </Button>
      </div>
    </div>
  );
}

function ContactUnavailable() {
  const t = useTranslations("help.contact");
  return (
    <div
      role="status"
      className="flex flex-col items-start gap-3 border-y py-6"
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-accent text-primary">
        <MessageSquareOffIcon aria-hidden className="size-6" />
      </span>
      <h3 className="text-lg font-semibold">{t("unavailableTitle")}</h3>
      <p className="text-muted-foreground">{t("unavailableBody")}</p>
    </div>
  );
}
