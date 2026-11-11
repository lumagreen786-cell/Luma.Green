"use client";

import { useMutation, useQuery } from "convex/react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { useVerifiedSession } from "@/components/providers/use-signed-in-query";
import { ActionButton } from "@/components/ui/action-button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { isLocale, localeDirection } from "@/i18n/locales";

import { api } from "../../../convex/_generated/api";
import { privacyRequestKinds } from "../../../convex/lib/privacyRequestSchema";

type Kind = (typeof privacyRequestKinds)[number];

export function PrivacyRequests() {
  const t = useTranslations("privacyRequests");
  const common = useTranslations("common");
  const { isReady, isPending, userId } = useVerifiedSession();
  return (
    <section className="w-full space-y-5">
      <header className="space-y-2">
        <h1 className="font-display text-2xl font-semibold">{t("title")}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">{t("lead")}</p>
      </header>
      {isPending && <p role="status">{common("loading")}</p>}
      {isReady && <RequestForm key={userId} />}
    </section>
  );
}

function RequestForm() {
  const t = useTranslations("privacyRequests");
  const common = useTranslations("common");
  const format = useFormatter();
  const locale = useLocale();
  const rows = useQuery(api.privacyRequests.mine);
  const submit = useMutation(api.privacyRequests.submit);
  const [kind, setKind] = useState<Kind>();
  const [isSaving, setSaving] = useState(false);
  const [status, setStatus] = useState<"received" | "error">();
  const pending = useRef(false);

  async function send() {
    if (!kind || pending.current) return;
    pending.current = true;
    setSaving(true);
    setStatus(undefined);
    try {
      await submit({ kind });
      setKind(undefined);
      setStatus("received");
    } catch {
      setStatus("error");
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  if (rows === undefined) return <p role="status">{common("loading")}</p>;
  if (rows === null) return <p role="alert">{common("error")}</p>;

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <form
        className="space-y-4 rounded-xl bg-card p-5 sm:p-6"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <fieldset>
          <legend className="font-medium">{t("kind")}</legend>
          <RadioGroup
            aria-label={t("kind")}
            className="mt-2 gap-0"
            dir={isLocale(locale) ? localeDirection(locale) : "ltr"}
            disabled={isSaving}
            value={kind ?? ""}
            onValueChange={(value) => {
              setKind(privacyRequestKinds.find((option) => option === value));
            }}
          >
            {privacyRequestKinds.map((option) => (
              <Label
                key={option}
                htmlFor={`request-${option}`}
                className="min-h-12 min-w-0 cursor-pointer gap-4 rounded-xl px-3 py-3 leading-relaxed font-normal has-[[aria-checked=true]]:bg-accent/40"
              >
                <RadioGroupItem id={`request-${option}`} value={option} />
                {t(option)}
              </Label>
            ))}
          </RadioGroup>
        </fieldset>
        <ActionButton
          type="submit"
          label={t("submit")}
          isDisabled={!kind || isSaving}
        />
        {status === "received" && <p role="status">{t("received")}</p>}
        {status === "error" && <p role="alert">{common("error")}</p>}
      </form>
      {rows.length > 0 && (
        <ul
          aria-label={t("title")}
          className="divide-y rounded-xl bg-card px-5"
        >
          {rows.map((row) => (
            <li key={row.id} className="space-y-1 py-4">
              <p className="font-medium">{t(row.kind)}</p>
              <p className="text-sm text-muted-foreground">
                {t(row.status)} ·{" "}
                {format.dateTime(row.respondedAt ?? row.createdAt, {
                  dateStyle: "medium",
                })}
              </p>
              <bdi className="block font-mono text-xs break-all text-muted-foreground">
                {row.id}
              </bdi>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
