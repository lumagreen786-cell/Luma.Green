"use client";

import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { CopyIcon, KeyRoundIcon } from "lucide-react";
import { useFormatter, useLocale, useNow, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { AppPageHeader, ListSkeleton } from "@/components/app/page-parts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isLocale, localeMeta } from "@/i18n/locales";

import type { api } from "../../../convex/_generated/api";

export type AccessData = FunctionReturnType<typeof api.integrations.listKeys>;
export type CreateKeyInput = FunctionArgs<typeof api.integrations.createKey>;
type CreatedKey = FunctionReturnType<typeof api.integrations.createKey>;
type KeyRecord = AccessData["keys"][number];
type Scope = CreateKeyInput["scopes"][number];

const scopeOptions = [
  { scope: "organization:read", label: "organization" },
  { scope: "materials:read", label: "materials" },
  { scope: "inventory:read", label: "inventory" },
  { scope: "trades:read", label: "trades" },
  { scope: "news:read", label: "news" },
] as const satisfies readonly { scope: Scope; label: string }[];

interface Props {
  data: AccessData | undefined;
  onCreate: (input: CreateKeyInput) => Promise<CreatedKey>;
  onRevoke: (keyId: KeyRecord["id"]) => Promise<unknown>;
}

/** Also used by the visibly labelled, disconnected guide preview. */
export function ApiAccess({ data, onCreate, onRevoke }: Props) {
  const t = useTranslations("integrations");
  return (
    <>
      <AppPageHeader title={t("title")} lead={t("lead")} />
      <section
        aria-labelledby="api-connection-title"
        className="flex flex-col gap-3 border-b border-border pb-6"
      >
        <h2 id="api-connection-title" className="text-lg font-semibold">
          {t("connection")}
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {t("readOnly")}
        </p>
        <p className="text-sm">
          {t("baseUrl")}{" "}
          <code dir="ltr" className="font-mono">
            /api/v1
          </code>
        </p>
        <Button asChild variant="outline" className="self-start">
          <a href="/api/v1/openapi.json">{t("openApi")}</a>
        </Button>
      </section>
      <AccessControls data={data} onCreate={onCreate} onRevoke={onRevoke} />
    </>
  );
}

function AccessControls(props: Props) {
  const t = useTranslations("integrations");
  if (props.data === undefined) return <ListSkeleton />;
  if (props.data.canManage) return <OwnerAccess {...props} data={props.data} />;
  return (
    <p role="status" className="text-sm text-muted-foreground">
      {t("ownerOnly")}
    </p>
  );
}

function keyStatus(key: KeyRecord, now: number) {
  if (key.revokedAt !== undefined) return "revoked";
  return key.expiresAt > now ? "active" : "expired";
}

function restoreRevokeFocus(trigger: HTMLButtonElement | null) {
  const target: HTMLElement | null = trigger?.isConnected
    ? trigger
    : document.querySelector("#api-keys-title");
  target?.focus();
}

function OwnerAccess({
  data,
  onCreate,
  onRevoke,
}: Props & { data: AccessData }) {
  const locale = useLocale();
  const t = useTranslations("integrations");
  const common = useTranslations("common");
  const now = useNow({ updateInterval: 60_000 }).getTime();
  const [label, setLabel] = useState("");
  const [scopes, setScopes] = useState<Scope[]>(["organization:read"]);
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [created, setCreated] = useState<CreatedKey | null>(null);
  const [pendingRevoke, setPendingRevoke] = useState<KeyRecord | null>(null);
  const revokeTrigger = useRef<HTMLButtonElement | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [hasCreateError, setCreateError] = useState(false);
  const [revokeError, setRevokeError] = useState(false);

  const liveKeys = data.keys.filter(
    (key) => key.revokedAt === undefined && key.expiresAt > now,
  ).length;
  const canCreate = liveKeys < 5 && !isCreating && created === null;
  const isValidInput =
    label.trim().length > 0 && label.trim().length <= 80 && scopes.length > 0;

  const create = async () => {
    if (!canCreate || !isValidInput) return;
    setIsCreating(true);
    setCreateError(false);
    try {
      const result = await onCreate({
        label: label.trim(),
        scopes,
        expiresInDays,
      });
      setCreated(result);
      setLabel("");
    } catch {
      setCreateError(true);
      toast.error(common("error"));
    } finally {
      setIsCreating(false);
    }
  };

  const revoke = async () => {
    if (!pendingRevoke || isRevoking) return;
    setIsRevoking(true);
    setRevokeError(false);
    try {
      await onRevoke(pendingRevoke.id);
      if (created?.keyId === pendingRevoke.id) setCreated(null);
      setPendingRevoke(null);
    } catch {
      setRevokeError(true);
      toast.error(common("error"));
    } finally {
      setIsRevoking(false);
    }
  };

  return (
    <>
      <KeyList
        keys={data.keys}
        onRevokeRequest={(key, trigger) => {
          revokeTrigger.current = trigger;
          setPendingRevoke(key);
          setRevokeError(false);
        }}
      />
      {created ? (
        <NewKey
          created={created}
          onDismiss={() => {
            setCreated(null);
          }}
        />
      ) : (
        <details open={data.keys.length === 0} className="border-y py-4">
          <summary className="cursor-pointer py-2 font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            {t("createTitle")}
          </summary>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void create();
            }}
            className="flex flex-col gap-4 border-b border-border pb-6"
            aria-labelledby="api-create-title"
          >
            <h2 id="api-create-title" className="sr-only">
              {t("createTitle")}
            </h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {t("keyHint")}
            </p>
            <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-2">
                <Label htmlFor="api-key-label">{t("label")}</Label>
                <Input
                  id="api-key-label"
                  value={label}
                  onChange={(event) => {
                    setLabel(event.target.value);
                  }}
                  maxLength={80}
                  autoComplete="off"
                  disabled={!canCreate}
                  required
                />
              </div>
              <div className="flex min-w-0 flex-col gap-2">
                <Label htmlFor="api-key-expiry">{t("expiry")}</Label>
                <Select
                  dir={localeMeta[isLocale(locale) ? locale : "en"].dir}
                  value={String(expiresInDays)}
                  onValueChange={(value) => {
                    setExpiresInDays(Number(value));
                  }}
                  disabled={!canCreate}
                >
                  <SelectTrigger id="api-key-expiry" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 7, 30, 90].map((days) => (
                      <SelectItem key={days} value={String(days)}>
                        {t("days", { count: days })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {t("newsHint")}
            </p>
            <fieldset disabled={!canCreate} className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium">
                {t("permissions")}
              </legend>
              {scopeOptions.map(({ scope, label: scopeLabel }) => (
                <div key={scope} className="flex min-h-11 items-center gap-3">
                  <Checkbox
                    id={`api-scope-${scopeLabel}`}
                    checked={scopes.includes(scope)}
                    disabled={!canCreate}
                    onCheckedChange={(checked) => {
                      setScopes((current) =>
                        checked === true
                          ? [...current, scope]
                          : current.filter((value) => value !== scope),
                      );
                    }}
                  />
                  <Label
                    htmlFor={`api-scope-${scopeLabel}`}
                    className="min-h-11 flex-1 leading-relaxed"
                  >
                    {t(`scopes.${scopeLabel}`)}
                  </Label>
                </div>
              ))}
            </fieldset>
            {liveKeys >= 5 ? (
              <p role="status" className="text-sm text-muted-foreground">
                {t("limit")}
              </p>
            ) : null}
            {hasCreateError ? (
              <p role="alert" className="text-sm text-destructive">
                {t("createError")}
              </p>
            ) : null}
            <Button
              type="submit"
              disabled={!canCreate || !isValidInput}
              className="self-start"
            >
              <KeyRoundIcon aria-hidden />
              {t(isCreating ? "creating" : "create")}
            </Button>
          </form>
        </details>
      )}
      <Dialog
        open={pendingRevoke !== null}
        onOpenChange={(open) => {
          if (!open && !isRevoking) setPendingRevoke(null);
        }}
      >
        <DialogContent
          closeLabel={common("close")}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            restoreRevokeFocus(revokeTrigger.current);
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("revokeTitle")}</DialogTitle>
            <DialogDescription>
              {t("revokeHint", { label: pendingRevoke?.label ?? "" })}
            </DialogDescription>
          </DialogHeader>
          {revokeError ? (
            <p role="alert" className="text-sm text-destructive">
              {t("revokeError")}
            </p>
          ) : null}
          <DialogFooter className="flex-wrap">
            <Button
              type="button"
              variant="outline"
              disabled={isRevoking}
              onClick={() => {
                setPendingRevoke(null);
              }}
            >
              {common("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isRevoking}
              onClick={() => void revoke()}
            >
              {t(isRevoking ? "revoking" : "revoke")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function KeyList({
  keys,
  onRevokeRequest,
}: {
  keys: KeyRecord[];
  onRevokeRequest: (key: KeyRecord, trigger: HTMLButtonElement) => void;
}) {
  const t = useTranslations("integrations");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 }).getTime();
  const date = (value: number) =>
    format.dateTime(value, { dateStyle: "medium", timeStyle: "short" });
  return (
    <section aria-labelledby="api-keys-title" className="flex flex-col gap-4">
      <h2 id="api-keys-title" tabIndex={-1} className="text-lg font-semibold">
        {t("keysTitle")}
      </h2>
      {keys.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {keys.map((key) => {
            const status = keyStatus(key, now);
            return (
              <li
                key={key.id}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="flex min-w-0 flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium break-all">{key.label}</h3>
                    <Badge variant="outline">{t(`status.${status}`)}</Badge>
                  </div>
                  <code dir="ltr" className="font-mono text-sm">
                    {key.prefix}…
                  </code>
                  <p className="text-sm text-muted-foreground">
                    {scopeOptions
                      .filter(({ scope }) => key.scopes.includes(scope))
                      .map(({ label: scopeLabel }) => t(`scopes.${scopeLabel}`))
                      .join(" · ")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t("expiresOn", { date: date(key.expiresAt) })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {key.lastUsedAt === undefined
                      ? t("neverUsed")
                      : t("lastUsed", { date: date(key.lastUsedAt) })}
                  </p>
                </div>
                {status === "active" ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="self-start"
                    onClick={(event) => {
                      onRevokeRequest(key, event.currentTarget);
                    }}
                    aria-label={t("revokeLabel", { label: key.label })}
                  >
                    {t("revoke")}
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function NewKey({
  created,
  onDismiss,
}: {
  created: CreatedKey;
  onDismiss: () => void;
}) {
  const t = useTranslations("integrations");
  const format = useFormatter();
  const date = (value: number) =>
    format.dateTime(value, { dateStyle: "medium", timeStyle: "short" });
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(created.token);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  };

  return (
    <section
      aria-labelledby="api-token-title"
      className="flex flex-col gap-4 border-b border-border pb-6"
    >
      <h2 id="api-token-title" className="text-lg font-semibold">
        {t("tokenTitle")}
      </h2>
      <p
        id="api-token-hint"
        className="max-w-2xl text-sm text-muted-foreground"
      >
        {t("tokenHint")}
      </p>
      <Label htmlFor="api-token">{t("tokenLabel")}</Label>
      <Input
        id="api-token"
        value={created.token}
        readOnly
        dir="ltr"
        autoComplete="off"
        spellCheck={false}
        aria-describedby="api-token-hint"
        className="ph-no-capture max-w-2xl font-mono text-sm"
        data-sentry-mask
      />
      <p className="text-sm text-muted-foreground">
        {t("expiresOn", { date: date(created.expiresAt) })}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => void copy()}>
          <CopyIcon aria-hidden />
          {t("copy")}
        </Button>
        <Button type="button" onClick={onDismiss}>
          {t("dismiss")}
        </Button>
      </div>
      {copyState === "idle" ? null : (
        <p
          role={copyState === "failed" ? "alert" : "status"}
          className="text-sm"
        >
          {t(copyState === "failed" ? "copyError" : "copied")}
        </p>
      )}
    </section>
  );
}
