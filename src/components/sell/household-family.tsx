"use client";

import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import { isConvexConfigured } from "@/components/providers/convex-provider";
import { AgeConfirmation } from "@/components/site/age-confirmation";
import { ActionButton } from "@/components/ui/action-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";

import { api } from "../../../convex/_generated/api";
import { indiaToday } from "../../../convex/lib/onboarding";
import { normalizeIndianMobile } from "../../../convex/lib/phone";
import { ErrorBoundary, LoadError } from "./states";
import { useTimeFormat } from "./time";

const settingsLogin = { pathname: "/login", query: { next: "/sell/settings" } };

export function HouseholdFamily() {
  const t = useTranslations("householdFamily");
  const unavailable = useTranslations("sell.unavailable");
  return (
    <section
      aria-labelledby="household-family"
      className="space-y-4 rounded-[1.75rem] border border-border/60 bg-card p-5 text-card-foreground"
    >
      <h2 id="household-family" className="text-lg font-semibold">
        {t("title")}
      </h2>
      <p className="text-sm text-muted-foreground">{t("description")}</p>
      {isConvexConfigured ? (
        <ErrorBoundary fallback={(reset) => <LoadError onRetry={reset} />}>
          <FamilyEntry />
        </ErrorBoundary>
      ) : (
        <p role="status" className="text-sm">
          {unavailable("title")}
        </p>
      )}
    </section>
  );
}

function FamilyEntry() {
  const auth = useConvexAuth();
  const session = authClient.useSession();
  const common = useTranslations("common");
  const account = useTranslations("emailAuth");
  if (auth.isLoading) return <p role="status">{common("loading")}</p>;
  return auth.isAuthenticated ? (
    <FamilyControls key={session.data?.user.id} />
  ) : (
    <Button asChild variant="outline">
      <Link href={settingsLogin}>{account("signin")}</Link>
    </Button>
  );
}

function FamilyControls() {
  const t = useTranslations("householdFamily");
  const common = useTranslations("common");
  const track = useTranslations("track.review");
  const account = useTranslations("accountSecurity");
  const format = useFormatter();
  const [phone, setPhone] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [receivedCode, setReceivedCode] = useState("");
  const [inviteAdult, setInviteAdult] = useState(false);
  const [joinAdult, setJoinAdult] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<"recent" | "invalid" | "generic" | null>(
    null,
  );
  const family = useQuery(api.householdFamily.mine);
  const invite = useAction(api.householdFamily.invite);
  const accept = useMutation(api.householdFamily.accept);
  const revoke = useMutation(api.householdFamily.revoke);

  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (error_) {
      const code: unknown = error_ instanceof ConvexError ? error_.data : null;
      if (code === "RECENT_AUTH_REQUIRED") setError("recent");
      else if (code === "INVITATION_UNAVAILABLE") setError("invalid");
      else setError("generic");
    } finally {
      setBusy(false);
    }
  }

  if (family === undefined) return <p role="status">{common("loading")}</p>;
  if (family === null)
    return (
      <p>
        <Link href="/account/security" className="text-foreground underline">
          {account("title")}
        </Link>
      </p>
    );
  return (
    <div className="space-y-5">
      {family.canInvite ? null : (
        <p className="text-sm">
          {t("verified")}{" "}
          <Link href="/account/security" className="text-foreground underline">
            {account("title")}
          </Link>
        </p>
      )}
      {family.canInvite ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!inviteAdult || !normalizeIndianMobile(phone)) return;
            void run(async () => {
              setInviteCode(
                await invite({
                  phone,
                  permission: "shared_collection_progress",
                  adultConfirmed: true,
                }),
              );
              setPhone("");
              setInviteAdult(false);
            });
          }}
        >
          <Label htmlFor="family-phone">{t("phone")}</Label>
          <Input
            id="family-phone"
            type="tel"
            dir="ltr"
            autoComplete="off"
            value={phone}
            maxLength={24}
            onChange={(event) => {
              setPhone(event.target.value);
            }}
          />
          <AgeConfirmation checked={inviteAdult} onChange={setInviteAdult} />
          <ActionButton
            type="submit"
            label={t("invite")}
            className="self-start"
            isDisabled={busy || !inviteAdult || !normalizeIndianMobile(phone)}
          />
        </form>
      ) : null}
      {inviteCode ? (
        <div className="space-y-2 border-s-2 ps-3">
          <Label htmlFor="created-family-code">{t("code")}</Label>
          <Input
            id="created-family-code"
            dir="ltr"
            className="font-mono"
            readOnly
            value={inviteCode}
            onFocus={(event) => {
              event.currentTarget.select();
            }}
          />
          <p className="text-sm text-muted-foreground">{t("codeHelp")}</p>
        </div>
      ) : null}
      {family.invited.length > 0 ? (
        <ul className="divide-y border-y">
          {family.invited.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center gap-3 py-2">
              <span dir="ltr">•••• {row.phoneLastFour}</span>
              <span className="flex-1 text-sm">
                {track(row.accepted ? "active" : "pending")}
              </span>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await revoke({ id: row.id });
                    setInviteCode("");
                  })
                }
              >
                {track("revoke")}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      {family.canInvite ? (
        <form
          className="flex flex-col gap-3 border-t pt-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!joinAdult || !receivedCode.trim()) return;
            void run(async () => {
              await accept({
                token: receivedCode.trim(),
                adultConfirmed: true,
              });
              setReceivedCode("");
              setJoinAdult(false);
            });
          }}
        >
          <Label htmlFor="received-family-code">{t("code")}</Label>
          <Input
            id="received-family-code"
            dir="ltr"
            autoComplete="off"
            spellCheck={false}
            value={receivedCode}
            maxLength={70}
            onChange={(event) => {
              setReceivedCode(event.target.value);
            }}
          />
          <AgeConfirmation checked={joinAdult} onChange={setJoinAdult} />
          <ActionButton
            type="submit"
            label={t("join")}
            className="self-start"
            isDisabled={busy || !joinAdult || !receivedCode.trim()}
          />
        </form>
      ) : null}
      {family.joined.length > 0 ? (
        <ul className="divide-y border-y">
          {family.joined.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center gap-3 py-2">
              <span className="flex-1 text-sm">
                {t("joinedAt", {
                  date: format.dateTime(row.acceptedAt, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }),
                })}
              </span>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await revoke({ id: row.id });
                  })
                }
              >
                {t("leave")}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error === "generic" ? common("error") : t(error)}
        </p>
      ) : null}
    </div>
  );
}

export function SharedFamilyCollections() {
  return isConvexConfigured ? <LiveSharedFamilyCollections /> : null;
}

function LiveSharedFamilyCollections() {
  const t = useTranslations("householdFamily");
  const when = useTranslations("sell.when");
  const windows = useTranslations("sell.windows");
  const status = useTranslations("track.status");
  const time = useTimeFormat();
  const { isAuthenticated } = useConvexAuth();
  const rows = useQuery(
    api.householdFamily.collections,
    isAuthenticated ? {} : "skip",
  );
  if (!rows?.length) return null;
  return (
    <section
      className="space-y-2 rounded-[1.75rem] border border-border/60 bg-card p-5 text-card-foreground"
      aria-labelledby="family-collections"
    >
      <h2 id="family-collections" className="text-lg font-semibold">
        {t("collections")}
      </h2>
      <ul className="divide-y">
        {rows.map((row) => (
          <li key={row.token}>
            <Link
              href={`/t/${row.token}`}
              className="flex min-h-12 flex-col gap-1 py-2 hover:underline"
            >
              <span className="font-medium">{row.shopName}</span>
              <span className="text-sm text-muted-foreground">
                {time.day(row.slotDate, indiaToday(), {
                  today: when("today"),
                  tomorrow: when("tomorrow"),
                })}{" "}
                · {windows(row.slotWindow)} · {status(row.status)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
