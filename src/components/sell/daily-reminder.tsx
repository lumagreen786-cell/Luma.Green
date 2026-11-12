"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { ActionButton } from "@/components/ui/action-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dailyCalendarReminder } from "@/lib/calendar-reminder";

export function DailyReminder() {
  const t = useTranslations("homeReminder");
  const [time, setTime] = useState("08:00");
  return (
    <section className="flex flex-col gap-4 rounded-[1.75rem] border border-border/60 bg-card p-5 text-card-foreground">
      <h2 className="text-lg font-semibold">{t("dailyTitle")}</h2>
      <form
        className="flex flex-col items-start gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          const reminder = dailyCalendarReminder(
            time,
            t("notificationTitle"),
            t("notificationBody"),
            new Date(),
            crypto.randomUUID(),
          );
          if (!reminder) return;
          const download = document.createElement("a");
          download.href = `data:text/calendar;charset=utf-8,${encodeURIComponent(reminder)}`;
          download.download = "luma-reminder.ics";
          download.click();
        }}
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="reminder-time">{t("time")}</Label>
          <Input
            id="reminder-time"
            type="time"
            required
            value={time}
            onChange={(event) => {
              setTime(event.target.value);
            }}
          />
        </div>
        <p className="text-sm text-muted-foreground">{t("calendarHelp")}</p>
        <ActionButton type="submit" label={t("add")} />
      </form>
    </section>
  );
}
