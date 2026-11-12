"use client";

import {
  ArrowRightIcon,
  AwardIcon,
  CheckIcon,
  ClockIcon,
  RotateCcwIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import {
  guide,
  type HelpRole,
  trainingFor,
  type TrainingModule,
} from "./content";
import { useTrainingProgress } from "./training-progress";

const POINTS = ["p1", "p2", "p3"] as const;

/**
 * A role's training path: short lessons, each marked done by the learner,
 * with a progress bar and a badge once every lesson is done. Progress stays
 * in this browser (see `training-progress.ts`).
 */
export function TrainingPath({ role }: { role: HelpRole }) {
  const t = useTranslations("help");
  const progress = useTrainingProgress(role);
  const lessons = trainingFor(role);
  const doneCount = progress.done.length;
  const percent = Math.round((doneCount / progress.total) * 100);

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div className="flex flex-col gap-3 border-y py-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p id={`training-${role}-label`} className="font-medium">
            {t("training.progressLabel")}
          </p>
          <p className="text-sm text-muted-foreground tabular-nums">
            {t("training.progress", {
              done: doneCount,
              total: progress.total,
            })}
          </p>
        </div>
        <Progress
          value={percent}
          aria-labelledby={`training-${role}-label`}
          className="h-2"
        />
      </div>

      <div aria-live="polite">
        {progress.isComplete ? (
          <div className="flex items-center gap-4 border-s-2 border-primary py-3 ps-4">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <AwardIcon aria-hidden className="size-7" />
            </span>
            <div className="flex flex-col gap-0.5">
              <p className="font-semibold">{t("training.badgeTitle")}</p>
              <p className="text-sm text-muted-foreground">
                {t("training.badgeBody")}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <ol className="divide-y divide-border/60 rounded-xl border border-border/60 bg-card px-4 sm:px-5">
        {lessons.map((lesson, index) => (
          <li key={lesson.key}>
            <LessonCard
              role={role}
              lesson={lesson}
              number={index + 1}
              isDone={progress.isDone(lesson.key)}
              onDoneChange={(isDone) => {
                progress.setDone(lesson.key, isDone);
              }}
            />
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {t("training.savedHere")}
        </p>
        {doneCount > 0 ? (
          <Button
            type="button"
            variant="ghost"
            className="h-11"
            onClick={progress.reset}
          >
            <RotateCcwIcon aria-hidden />
            {t("training.reset")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function LessonCard({
  role,
  lesson,
  number,
  isDone,
  onDoneChange,
}: {
  role: HelpRole;
  lesson: TrainingModule;
  number: number;
  isDone: boolean;
  onDoneChange: (isDone: boolean) => void;
}) {
  const t = useTranslations("help");
  const Icon = lesson.icon;
  const base = `modules.${lesson.key}`;
  const titleId = `lesson-${role}-${lesson.key}`;
  const checkboxId = `${titleId}-done`;

  return (
    <article
      aria-labelledby={titleId}
      className={cn(
        "flex flex-col gap-4 py-6 transition-colors",
        isDone && "bg-muted/25",
      )}
    >
      <div className="flex gap-4">
        <span
          className={cn(
            "relative flex size-10 shrink-0 items-center justify-center",
            isDone ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {isDone ? (
            <CheckIcon aria-hidden className="size-6" />
          ) : (
            <Icon aria-hidden className="size-6" />
          )}
          <span className="absolute -end-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full border bg-background text-xs font-semibold text-foreground tabular-nums">
            {number}
          </span>
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <h3 id={titleId} className="font-semibold">
              {t(`${base}.title`)}
            </h3>
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <ClockIcon aria-hidden className="size-3.5" />
              {t("training.minutes", { minutes: lesson.minutes })}
            </p>
          </div>
          <ul className="flex flex-col gap-1.5">
            {POINTS.map((point) => (
              <li key={point} className="flex items-start gap-2 text-sm">
                <CheckIcon
                  aria-hidden
                  className="mt-0.5 size-4 shrink-0 text-foreground"
                />
                <span>{t(`${base}.${point}`)}</span>
              </li>
            ))}
          </ul>
          <Link
            href={`/help/${role}/${guide(lesson.guide).slug}`}
            className="inline-flex min-h-11 items-center gap-1 self-start rounded-sm text-sm font-medium text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {t("training.openGuide")}
            <ArrowRightIcon aria-hidden className="size-4 rtl:rotate-180" />
          </Link>
        </div>
      </div>
      <div className="flex items-center gap-3 border-t pt-3">
        <Checkbox
          id={checkboxId}
          checked={isDone}
          aria-describedby={titleId}
          className="size-6"
          onCheckedChange={(checked) => {
            onDoneChange(checked === true);
          }}
        />
        <Label htmlFor={checkboxId} className="min-h-11 flex-1 text-base">
          {t("training.markDone")}
        </Label>
      </div>
    </article>
  );
}
