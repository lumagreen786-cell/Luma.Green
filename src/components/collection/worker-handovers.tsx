"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import { useFormatter, useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";

import { useFormat } from "@/components/app/format";
import { useSignedInQuery } from "@/components/providers/use-signed-in-query";
import { useBusiness, useIndiaToday } from "@/components/shop/use-shop";
import { ActionButton } from "@/components/ui/action-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { authClient } from "@/lib/auth-client";
import { asciiDigits } from "@/lib/number-input";

import { api } from "../../../convex/_generated/api";

type EmployerBoard = FunctionReturnType<
  typeof api.workerHandovers.employerBoard
>;
type Row = EmployerBoard["rows"][number];
function useSave<Args>(save: (args: Args) => Promise<unknown>) {
  const common = useTranslations("common"),
    saved = useTranslations("collectionOperations");
  const [busy, setBusy] = useState(false),
    [attempt, setAttempt] = useState<Args | null>(null);
  async function run(values: () => Args, onDone: () => void) {
    if (busy) return;
    const request = attempt ?? values();
    setAttempt(request);
    setBusy(true);
    try {
      await save(request);
      setAttempt(null);
      onDone();
      toast.success(saved("saved"));
    } catch (error) {
      if (error instanceof ConvexError) setAttempt(null);
      toast.error(common("error"));
    } finally {
      setBusy(false);
    }
  }
  return { busy, locked: busy || attempt !== null, run };
}
function Panel({ children }: { children: ReactNode }) {
  const t = useTranslations("workerHandover");
  return (
    <details className="border-t border-border py-5">
      <summary className="cursor-pointer text-lg font-semibold">
        {t("title")}
      </summary>
      <div className="flex flex-col gap-4 pt-4">
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
        <p className="text-sm text-muted-foreground">{t("limit")}</p>
        {children}
      </div>
    </details>
  );
}
export function EmployerHandovers() {
  const business = useBusiness(),
    session = authClient.useSession();
  return business?.kind === "kabadiwala" && session.data?.user.id ? (
    <EmployerBody key={`${session.data.user.id}:${business.id}`} />
  ) : null;
}
function EmployerBody() {
  const data = useQuery(api.workerHandovers.employerBoard);
  const empty = useTranslations("qualityDocuments");
  if (!data) return null;
  return (
    <Panel>
      {data.canOperate ? <BindForm data={data} /> : null}
      {data.rows.length === 0 ? (
        <p>{empty("empty")}</p>
      ) : (
        data.rows.map((row) => <Handover key={row.id} row={row} />)
      )}
    </Panel>
  );
}
export function WorkerHandovers() {
  const session = authClient.useSession();
  return session.data?.user.id ? (
    <WorkerBody key={session.data.user.id} />
  ) : null;
}
function WorkerBody() {
  const rows = useSignedInQuery(api.workerHandovers.workerBoard);
  const empty = useTranslations("qualityDocuments");
  if (!rows) return null;
  return (
    <Panel>
      {rows.length === 0 ? (
        <p>{empty("empty")}</p>
      ) : (
        rows.map((row) => <Handover key={row.id} row={row} />)
      )}
    </Panel>
  );
}
function BindForm({ data }: { data: EmployerBoard }) {
  const t = useTranslations("workerHandover");
  const bind = useMutation(api.workerHandovers.bind),
    action = useSave<FunctionArgs<typeof api.workerHandovers.bind>>(bind);
  const [jobId, setJob] = useState(""),
    [bookingId, setBooking] = useState("");
  const job = data.jobs.find((row) => row.id === jobId),
    booking = data.bookings.find((row) => row.id === bookingId);
  return (
    <form
      aria-label={t("link")}
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (job && booking)
          void action.run(
            () => ({
              jobId: job.id,
              bookingId: booking.id,
              operationKey: crypto.randomUUID(),
            }),
            () => {
              setJob("");
              setBooking("");
            },
          );
      }}
    >
      <fieldset disabled={action.locked} className="flex flex-col gap-3">
        <Picker
          label={t("job")}
          value={jobId}
          onChange={setJob}
          rows={data.jobs}
        />
        <Picker
          label={t("collection")}
          value={bookingId}
          onChange={setBooking}
          rows={data.bookings}
        />
      </fieldset>
      <ActionButton
        type="submit"
        label={t("link")}
        isDisabled={action.busy || !job || !booking}
      />
    </form>
  );
}
function Picker({
  label,
  value,
  onChange,
  rows,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows: { id: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {rows.map((row) => (
            <SelectItem key={row.id} value={row.id}>
              {row.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
function Handover({ row }: { row: Row }) {
  const t = useTranslations("workerHandover"),
    withdrawn = useTranslations("qualityDocuments");
  const number = useFormatter(),
    format = useFormat();
  const today = useIndiaToday();
  return (
    <article
      aria-labelledby={`handover-${row.id}`}
      className="flex flex-col gap-3 border-b border-border py-4"
    >
      <h3 id={`handover-${row.id}`} className="font-medium">
        {row.jobTitle}
      </h3>
      <p>
        {row.bookingReference} · {row.employerName}
      </p>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {(
          [
            ["collected", row.collectedGrams],
            ["received", row.receivedGrams],
            ["variance", row.varianceGrams],
          ] as const
        ).map(([key, value]) => (
          <div key={key}>
            <dt className="text-sm text-muted-foreground">{t(key)}</dt>
            <dd>{value === null ? "—" : number.number(value)}</dd>
          </div>
        ))}
      </dl>
      {row.evidenceReference ? <p>{row.evidenceReference}</p> : null}
      {row.varianceReason ? <p>{row.varianceReason}</p> : null}
      {row.collectedAt ? (
        <p className="text-sm text-muted-foreground">
          {format.dateTime(row.collectedAt)}
        </p>
      ) : null}
      {row.acknowledgedAt ? (
        <p>
          {t("acknowledged")} · {format.dateTime(row.acknowledgedAt)}
        </p>
      ) : null}
      {row.revoked ? <p>{withdrawn("withdrawn")}</p> : null}
      {row.canCollect && row.jobDate <= today ? (
        <CollectedForm row={row} />
      ) : null}
      {row.canAcknowledge ? <ReasonForm row={row} kind="acknowledge" /> : null}
      {row.canRevoke ? <ReasonForm row={row} kind="revoke" /> : null}
    </article>
  );
}
function CollectedForm({ row }: { row: Row }) {
  const t = useTranslations("workerHandover");
  const record = useMutation(api.workerHandovers.recordCollected),
    action =
      useSave<FunctionArgs<typeof api.workerHandovers.recordCollected>>(record);
  const [grams, setGrams] = useState(""),
    [reference, setReference] = useState("");
  return (
    <form
      aria-label={t("record")}
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const value = asciiDigits(grams.trim());
        if (
          !/^\d+$/.test(value) ||
          !Number.isSafeInteger(Number(value)) ||
          Number(value) <= 0
        )
          return;
        void action.run(
          () => ({
            handoverId: row.id,
            operationKey: crypto.randomUUID(),
            collectedGrams: Number(value),
            evidenceReference: reference,
          }),
          () => {
            setGrams("");
            setReference("");
          },
        );
      }}
    >
      <fieldset disabled={action.locked} className="flex flex-col gap-3">
        <Label className="flex flex-col gap-2">
          {t("collected")}
          <Input
            inputMode="numeric"
            value={grams}
            onChange={(event) => {
              setGrams(event.target.value);
            }}
            required
          />
        </Label>
        <Label className="flex flex-col gap-2">
          {t("evidence")}
          <Input
            value={reference}
            onChange={(event) => {
              setReference(event.target.value);
            }}
            minLength={3}
            maxLength={200}
            required
          />
        </Label>
      </fieldset>
      <ActionButton
        type="submit"
        label={t("record")}
        isDisabled={action.busy || !grams || reference.trim().length < 3}
      />
    </form>
  );
}
function ReasonForm({
  row,
  kind,
}: {
  row: Row;
  kind: "acknowledge" | "revoke";
}) {
  const t = useTranslations("workerHandover");
  const acknowledge = useMutation(api.workerHandovers.acknowledge),
    revoke = useMutation(api.workerHandovers.revoke);
  const [reason, setReason] = useState("");
  const action = useSave<{ operationKey: string; reason: string }>(
    async (request) =>
      kind === "acknowledge"
        ? acknowledge({
            handoverId: row.id,
            operationKey: request.operationKey,
            varianceReason: request.reason,
          })
        : revoke({ handoverId: row.id, reason: request.reason }),
  );
  const isRequired =
    kind === "revoke" ||
    (row.varianceGrams !== null && row.varianceGrams !== 0);
  return (
    <form
      aria-label={t(kind)}
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void action.run(
          () => ({ operationKey: crypto.randomUUID(), reason }),
          () => {
            setReason("");
          },
        );
      }}
    >
      <Label className="flex flex-col gap-2">
        {t("reason")}
        <Textarea
          value={reason}
          required={isRequired}
          minLength={isRequired ? 5 : 0}
          maxLength={500}
          disabled={action.locked}
          onChange={(event) => {
            setReason(event.target.value);
          }}
        />
      </Label>
      <ActionButton
        type="submit"
        label={t(kind)}
        isDisabled={action.busy || (isRequired && reason.trim().length < 5)}
      />
    </form>
  );
}
