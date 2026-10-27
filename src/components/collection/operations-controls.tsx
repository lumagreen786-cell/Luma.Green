"use client";
import { useMutation, useQuery } from "convex/react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { useFormat } from "@/components/app/format";
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
import { useCanOperate } from "@/components/workspace/permissions";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { SLOT_WINDOWS, type SlotWindow } from "../../../convex/lib/households";
import { useTimeFormat } from "../sell/time";

export function CollectionAvailabilityControls() {
  const canOperate = useCanOperate();
  const settings = useQuery(api.collectionScheduling.settings);
  const save = useMutation(api.collectionScheduling.saveAvailability);
  const t = useTranslations("collectionOperations"),
    common = useTranslations("common");
  const [busy, setBusy] = useState(false);
  if (!settings) return null;
  return (
    <form
      className="flex flex-col gap-3 border-t border-border py-6"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setBusy(true);
        void save({
          capacityPerWindow: Number(data.get("capacity")),
          holidayDates: formText(data, "holidays")
            .split(",")
            .map((d) => d.trim())
            .filter(Boolean),
          enabledWindows: settings.enabledWindows,
        })
          .then(() => toast.success(t("saved")))
          .catch(() => toast.error(common("error")))
          .finally(() => {
            setBusy(false);
          });
      }}
    >
      <h2 className="text-lg font-semibold">{t("availability")}</h2>
      <Label htmlFor="window-capacity">{t("capacity")}</Label>
      <Input
        id="window-capacity"
        name="capacity"
        type="number"
        min={1}
        max={1000}
        defaultValue={settings.capacityPerWindow}
        required
      />
      <Label htmlFor="collection-holidays">{t("holidays")}</Label>
      <Input
        id="collection-holidays"
        name="holidays"
        defaultValue={settings.holidayDates.join(", ")}
      />
      <ActionButton
        type="submit"
        isDisabled={busy || !canOperate || !settings.canManage}
        label={common("save")}
      />
    </form>
  );
}
export function HouseholdScheduleControls() {
  const rows = useQuery(api.collectionScheduling.myRequests);
  const schedules = useQuery(api.collectionScheduling.schedules);
  const repeat = useMutation(api.collectionScheduling.repeat);
  const stop = useMutation(api.collectionScheduling.stopRepeating);
  const t = useTranslations("collectionOperations"),
    common = useTranslations("common"),
    format = useFormatter();
  if (!rows) return null;
  const run = (promise: Promise<unknown>) => {
    void promise.catch(() => toast.error(common("error")));
  };
  return (
    <section className="flex flex-col gap-4 border-t border-border py-4">
      <h2 className="text-lg font-semibold">{t("schedule")}</h2>
      {rows.map((row) => (
        <section
          key={row.id}
          className="flex flex-col gap-2 border-b border-border py-3"
        >
          <p>
            {format.dateTime(new Date(`${row.date}T12:00:00+05:30`), {
              dateStyle: "medium",
            })}
          </p>
          {row.unassigned ? <p role="status">{t("unassigned")}</p> : null}
          <RescheduleControl
            bookingId={row.id}
            initialDate={row.date}
            initialWindow={row.window}
          />
          <section className="flex flex-wrap gap-2">
            {([7, 14, 30] as const).map((everyDays) => (
              <ActionButton
                key={everyDays}
                onClick={() => {
                  run(repeat({ bookingId: row.id, everyDays }));
                }}
                label={t("repeat", { days: everyDays })}
              />
            ))}
          </section>
        </section>
      ))}
      {schedules
        ?.filter((s) => s.active)
        .map((s) => (
          <section className="flex flex-wrap items-center gap-2" key={s.id}>
            <p>{t("repeat", { days: s.everyDays })}</p>
            <ActionButton
              onClick={() => {
                run(stop({ id: s.id }));
              }}
              label={t("stop")}
            />
          </section>
        ))}
    </section>
  );
}
function RescheduleControl({
  bookingId,
  initialDate,
  initialWindow,
}: {
  bookingId: Id<"bookings">;
  initialDate: string;
  initialWindow: SlotWindow;
}) {
  const [date, setDate] = useState(initialDate),
    [window, setWindow] = useState(initialWindow),
    [busy, setBusy] = useState(false);
  const change = useMutation(api.collectionScheduling.reschedule);
  const t = useTranslations("collectionOperations"),
    common = useTranslations("common"),
    time = useTimeFormat();
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        setBusy(true);
        void change({ bookingId, date, window })
          .then((result) =>
            toast.success(t(result === "requested" ? "requested" : "saved")),
          )
          .catch(() => toast.error(common("error")))
          .finally(() => {
            setBusy(false);
          });
      }}
    >
      <Label className="flex flex-col gap-1">
        {t("reschedule")}
        <Input
          type="date"
          required
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
          }}
        />
      </Label>
      <Select
        value={window}
        onValueChange={(value) => {
          const matched = SLOT_WINDOWS.find((w) => w === value);
          if (matched) setWindow(matched);
        }}
      >
        <SelectTrigger aria-label={t("reschedule")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SLOT_WINDOWS.map((w) => (
            <SelectItem key={w} value={w}>
              {time.window(w)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <ActionButton type="submit" isDisabled={busy} label={common("save")} />
    </form>
  );
}

export function EmployerPaymentControls() {
  const canOperate = useCanOperate();
  const money = useFormat();
  const board = useQuery(api.workforce.board);
  const declare = useMutation(api.workforce.declarePayment);
  const t = useTranslations("collectionOperations"),
    common = useTranslations("common");
  if (!board) return null;
  return (
    <section className="flex flex-col gap-3 border-t border-border py-6">
      <h2 className="text-lg font-semibold">{t("declarePayment")}</h2>
      <p className="text-sm text-muted-foreground">{t("fixedFee")}</p>
      {board.jobs
        .filter((job) => job.status === "done")
        .map((job) => (
          <form
            key={job.id}
            className="flex flex-wrap items-end gap-3 border-b border-border py-3"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void declare({
                jobId: job.id,
                dueDate: formText(form, "dueDate"),
              }).catch(() => toast.error(common("error")));
            }}
          >
            <p>
              {job.title} · {money.money(job.payPaise)}
            </p>
            <Label className="flex flex-col gap-1">
              {t("due", { date: "" })}
              <Input
                type="date"
                name="dueDate"
                required
                min={job.date}
                defaultValue={job.paymentDueDate ?? job.date}
                disabled={job.employerPaidAt !== undefined}
              />
            </Label>
            {job.workerAcknowledgedAt ? <p>{t("acknowledged")}</p> : null}
            {job.employerPaidAt && !job.workerAcknowledgedAt ? (
              <p>{t("paymentDeclared")}</p>
            ) : null}
            {job.employerPaidAt ? null : (
              <ActionButton
                type="submit"
                isDisabled={!canOperate}
                label={t("declarePayment")}
              />
            )}
          </form>
        ))}
    </section>
  );
}

function formText(data: FormData, key: string): string {
  const value = data.get(key);
  return typeof value === "string" ? value : "";
}

export function CollectionVisitControls() {
  const rows = useQuery(api.collectionScheduling.operatorRequests);
  const approve = useMutation(api.collectionScheduling.approveReschedule);
  const fail = useMutation(api.collectionScheduling.failedVisit);
  const canOperate = useCanOperate();
  const t = useTranslations("collectionOperations"),
    common = useTranslations("common"),
    contact = useTranslations("help.contact");
  if (!rows?.length) return null;
  return (
    <section className="flex flex-col gap-3 border-t border-border py-6">
      <h2 className="text-lg font-semibold">{t("schedule")}</h2>
      {rows.map((row) => (
        <section
          key={row.id}
          className="flex flex-col gap-2 border-b border-border py-3"
        >
          <p>{row.date}</p>
          {row.rescheduleDate ? (
            <ActionButton
              label={t("reschedule")}
              isDisabled={!canOperate}
              onClick={() => {
                void approve({ bookingId: row.id }).catch(() =>
                  toast.error(common("error")),
                );
              }}
            />
          ) : null}
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              void fail({
                bookingId: row.id,
                reason: formText(data, "reason"),
              }).catch(() => toast.error(common("error")));
            }}
          >
            <Label className="flex flex-col gap-1">
              {contact("message")}
              <Input name="reason" required minLength={5} maxLength={500} />
            </Label>
            <ActionButton
              label={t("failedVisit")}
              type="submit"
              isDisabled={!canOperate}
            />
          </form>
        </section>
      ))}
    </section>
  );
}
