"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { ActionButton } from "@/components/ui/action-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "@/i18n/navigation";

import {
  PARTICIPANT_GROUPS,
  type ParticipantType,
} from "../../../convex/lib/participantTypes";

const activeRoutes: Partial<Record<ParticipantType, string>> = {
  household: "/sell",
  kabadiwala: "/join/kabadiwala",
  saathi: "/join/saathi",
  preprocessor: "/join/yard",
  recycler: "/join/recycler",
};

export function ParticipantDirectory() {
  const t = useTranslations("participantDirectory");
  const locale = useLocale();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ParticipantType>();
  const term = search.trim().toLocaleLowerCase(locale);
  const groups = Object.entries(PARTICIPANT_GROUPS)
    .map(([group, roles]) => ({
      group,
      roles: roles.filter((role) =>
        t(`roles.${role}`).toLocaleLowerCase(locale).includes(term),
      ),
    }))
    .filter(({ roles }) => roles.length > 0);

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!selected) return;
        const activeRoute = activeRoutes[selected];
        if (activeRoute) router.push(activeRoute);
        else
          router.push({
            pathname: "/join/stakeholder",
            query: { participant: selected },
          });
      }}
    >
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        {t("title")}
      </h1>
      <div className="flex flex-col gap-2">
        <Label htmlFor="participant-search">{t("search")}</Label>
        <Input
          id="participant-search"
          type="search"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
          }}
        />
      </div>
      <fieldset className="min-w-0 divide-y divide-border/60 rounded-xl border border-border/60 px-4">
        <legend className="sr-only">{t("title")}</legend>
        {groups.map(({ group, roles }) => (
          <details key={group} open={term ? true : undefined}>
            <summary className="min-h-12 cursor-pointer py-3 font-medium">
              {t(`groups.${group}`)}
            </summary>
            <ul className="pb-2">
              {roles.map((role) => (
                <li key={role}>
                  <label className="flex min-h-12 min-w-0 cursor-pointer items-center gap-3 rounded-xl px-3 py-3 has-[:checked]:bg-accent/40">
                    <input
                      type="radio"
                      name="participant"
                      className="size-5 shrink-0 accent-primary"
                      checked={role === selected}
                      onChange={() => {
                        setSelected(role);
                      }}
                    />
                    <span>{t(`roles.${role}`)}</span>
                  </label>
                </li>
              ))}
            </ul>
          </details>
        ))}
        {groups.length === 0 ? (
          <p role="status" className="py-3 text-sm text-muted-foreground">
            {t("empty")}
          </p>
        ) : null}
      </fieldset>
      {selected ? (
        <p className="text-sm text-muted-foreground">
          {t(`roles.${selected}`)}
        </p>
      ) : null}
      <ActionButton
        type="submit"
        label={t("continue")}
        isDisabled={!selected}
      />
    </form>
  );
}
