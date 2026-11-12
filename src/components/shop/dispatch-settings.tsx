"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { ListSkeleton } from "@/components/app/page-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Link } from "@/i18n/navigation";

import { api } from "../../../convex/_generated/api";

const schema = z.object({
  autoAccept: z.boolean(),
  pickupRadiusKm: z.number().int().min(1).max(50),
});
type Settings = z.infer<typeof schema>;

/** Owners choose whether nearby pickups require a manual reply. */
export function DispatchSettings() {
  const settings = useQuery(api.shop.dispatchSettings);
  if (settings === undefined) return <ListSkeleton rows={1} />;
  return (
    <SettingsForm
      key={`${String(settings.autoAccept)}-${String(settings.pickupRadiusKm)}`}
      settings={settings}
    />
  );
}

function SettingsForm({
  settings,
}: {
  settings: Settings & { canManage: boolean; canAutoAccept: boolean };
}) {
  const t = useTranslations("shop.dispatch");
  const common = useTranslations("common");
  const nav = useTranslations("nav");
  const configure = useMutation(api.shop.configureDispatch);
  const [failure, setFailure] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Settings>({
    resolver: zodResolver(schema),
    defaultValues: settings,
  });

  const isDisabled = isSubmitting || !settings.canManage;
  const isAutoAccept = useWatch({ control, name: "autoAccept" });

  async function save(values: Settings) {
    setFailure(false);
    try {
      await configure(values);
      toast.success(t("saved"));
    } catch {
      setFailure(true);
      toast.error(t("error"));
    }
  }

  return (
    <section
      aria-labelledby="dispatch-settings-title"
      className="border-t border-border pt-6"
    >
      <form
        noValidate
        onSubmit={(event) => {
          void handleSubmit(save)(event);
        }}
        className="flex flex-col gap-4"
      >
        <h2 id="dispatch-settings-title" className="text-lg font-semibold">
          {t("title")}
        </h2>
        {settings.canManage ? null : (
          <p className="text-sm text-muted-foreground">{t("ownerOnly")}</p>
        )}
        {settings.canAutoAccept ? null : (
          <p className="text-sm text-muted-foreground">
            {t("locationRequired")}{" "}
            <Link
              href="/help/kabadiwala"
              className="inline-flex min-h-11 items-center text-foreground underline underline-offset-4"
            >
              {nav("help")}
            </Link>
          </p>
        )}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <Label htmlFor="dispatch-auto" className="min-h-11 text-base">
              {t("autoAccept")}
            </Label>
            <p
              id="dispatch-auto-hint"
              className="text-sm text-muted-foreground"
            >
              {t("autoAcceptHint")}
            </p>
          </div>
          <div className="flex min-h-11 items-center px-3">
            <Switch
              id="dispatch-auto"
              aria-describedby="dispatch-auto-hint"
              checked={isAutoAccept}
              disabled={
                isDisabled || (!settings.canAutoAccept && !isAutoAccept)
              }
              onCheckedChange={(value) => {
                setValue("autoAccept", value, { shouldDirty: true });
              }}
            />
          </div>
        </div>
        <div className="flex max-w-sm flex-col gap-2">
          <Label htmlFor="dispatch-radius">{t("radius")}</Label>
          <Input
            id="dispatch-radius"
            type="number"
            inputMode="numeric"
            min={1}
            max={50}
            step={1}
            aria-invalid={Boolean(errors.pickupRadiusKm)}
            aria-describedby="dispatch-radius-hint"
            disabled={isDisabled}
            {...register("pickupRadiusKm", { valueAsNumber: true })}
          />
          <p
            id="dispatch-radius-hint"
            role={errors.pickupRadiusKm ? "alert" : undefined}
            className={
              errors.pickupRadiusKm
                ? "text-sm text-destructive"
                : "text-sm text-muted-foreground"
            }
          >
            {t("radiusHint")}
          </p>
        </div>
        {failure ? (
          <p role="alert" className="text-sm text-destructive">
            {t("error")}
          </p>
        ) : null}
        <Button
          type="submit"
          disabled={isDisabled}
          className="min-h-12 self-start px-5"
        >
          {isSubmitting ? t("saving") : common("save")}
        </Button>
      </form>
    </section>
  );
}
