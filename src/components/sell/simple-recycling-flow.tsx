"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  LocateFixedIcon,
  MapPinIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { useForm, type UseFormReturn, useWatch } from "react-hook-form";
import { z } from "zod";

import { isConvexConfigured } from "@/components/providers/convex-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter } from "@/i18n/navigation";
import { prepareUpload } from "@/lib/upload-image";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  bookableDates,
  cleanAddress,
  isValidAddress,
  isValidName,
  isWindowOpen,
  SLOT_WINDOWS,
  type SlotWindow,
} from "../../../convex/lib/households";
import { indiaToday } from "../../../convex/lib/onboarding";
import type { SellDraft } from "./draft";
import { sellErrorKey } from "./errors";
import { PhoneSignIn } from "./phone-sign-in";
import { RecyclingPhotos } from "./recycling-photos";
import {
  ErrorBoundary,
  LoadError,
  SellSkeleton,
  SellUnavailable,
  useNow,
} from "./states";
import { useTimeFormat } from "./time";
import { useAuthReady } from "./use-auth-ready";
import { clearSellDraft, useSellDraft } from "./use-draft";
import { useLocation } from "./use-location";

export const recyclingDetailsSchema = z
  .object({
    name: z.string().refine(isValidName, "name"),
    address: z.string(),
    mode: z.enum(["pickup", "dropoff"]),
  })
  .refine(
    (value) => value.mode === "dropoff" || isValidAddress(value.address),
    { path: ["address"], message: "address" },
  );
type Details = z.infer<typeof recyclingDetailsSchema>;

export function SimpleRecyclingFlow() {
  if (!isConvexConfigured) return <SellUnavailable />;
  return (
    <ErrorBoundary fallback={(reset) => <LoadError onRetry={reset} />}>
      <StoredRecyclingFlow />
    </ErrorBoundary>
  );
}
function StoredRecyclingFlow() {
  const [draft, update] = useSellDraft();
  if (!draft) return <SellSkeleton />;
  return (
    <RecyclingFlow
      initial={draft}
      save={(patch) => {
        update((current) => ({ ...current, ...patch, items: [] }));
      }}
    />
  );
}
function RecyclingFlow({
  initial,
  save,
}: {
  initial: SellDraft;
  save: (patch: Partial<SellDraft>) => void;
}) {
  const t = useTranslations("sell");
  const simple = useTranslations("sell.simple");
  const common = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const now = useNow();
  const today = indiaToday(now);
  const location = useLocation();
  const [stage, setStage] = useState<"details" | "schedule">("details");
  const [files, setFiles] = useState<File[]>([]);
  const [photoError, setPhotoError] = useState<string>();
  const [shopId, setShopId] = useState(initial.shopId);
  const [slotDate, setSlotDate] = useState(initial.slotDate ?? "");
  const [slotWindow, setSlotWindow] = useState<SlotWindow | undefined>(
    initial.slotWindow,
  );
  const [status, setStatus] = useState<"idle" | "booking" | "booked">("idle");
  const [retryRequest, setRetryRequest] = useState<FunctionArgs<
    typeof api.households.book
  > | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const { uploadPhotos, clearUploads } = usePhotoUploads();
  const book = useMutation(api.households.book);
  const ensureProfile = useMutation(api.identity.ensureProfile);
  const waitForAuth = useAuthReady();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const identity = useQuery(api.identity.me, isAuthenticated ? {} : "skip");
  const form = useForm<Details>({
    resolver: zodResolver(recyclingDetailsSchema),
    defaultValues: {
      name: initial.name,
      address: initial.address,
      mode: initial.mode,
    },
  });
  const mode = useWatch({ control: form.control, name: "mode" });
  const shops = useQuery(
    api.households.shops,
    shopQueryArgs(stage, location.point),
  );
  const available = shopsForMode(shops, mode);
  const selectedShop = available?.find((shop) => shop.id === shopId);
  const days = bookableDates(today).filter((day) =>
    SLOT_WINDOWS.some((window) => isWindowOpen(day, window, today, now)),
  );
  const hasSlot =
    days.includes(slotDate) &&
    slotWindow !== undefined &&
    isWindowOpen(slotDate, slotWindow, today, now);
  const canBook = Boolean(
    retryRequest ?? (selectedShop && hasSlot && files.length > 0),
  );

  const isLocked = status !== "idle" || retryRequest !== null;

  function next(values: Details) {
    if (files.length === 0) {
      setPhotoError(simple("photoRequired"));
      return;
    }
    setPhotoError(undefined);
    save(values);
    setStage("schedule");
    setError(null);
  }
  async function submit() {
    if (!canBook || pending.current) return;
    pending.current = true;
    setStatus("booking");
    setError(null);
    try {
      await waitForAuth();
      await ensureProfile({ locale });
      let request = retryRequest;
      if (!request) {
        if (!selectedShop || !slotWindow) throw new Error("INVALID_REQUEST");
        const photoIds = await uploadPhotos(files);
        const values = form.getValues();
        request = {
          orgId: selectedShop.id,
          mode: values.mode,
          items: [],
          photoIds,
          name: values.name,
          ...pickupDetails(values, location.point),
          slotDate,
          slotWindow,
        };
        setRetryRequest(request);
      }
      const token = await book(request);
      setStatus("booked");
      clearSellDraft();
      router.push(`/t/${token}`);
    } catch (error_) {
      if (error_ instanceof ConvexError) {
        setRetryRequest(null);
        if (error_.data === "PHOTO_NOT_AVAILABLE") clearUploads();
      }
      const key = sellErrorKey(error_);
      setError(
        isRecyclingPhotoError(error_)
          ? simple("uploadFailed")
          : t(`errors.${key}`),
      );
      setStatus("idle");
      pending.current = false;
    }
  }
  return (
    <div className="space-y-7">
      {stage === "details" ? (
        <DetailsForm
          form={form}
          mode={mode}
          location={location}
          files={files}
          photoError={photoError}
          next={next}
          setFiles={setFiles}
          setPhotoError={setPhotoError}
          clearShop={() => {
            setShopId(undefined);
          }}
        />
      ) : (
        <div className="space-y-7">
          <Button
            variant="ghost"
            type="button"
            disabled={status !== "idle" || retryRequest !== null}
            onClick={() => {
              setStage("details");
            }}
          >
            <ArrowLeftIcon aria-hidden className="rtl:rotate-180" />
            {t("back")}
          </Button>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">{simple("chooseShop")}</h2>
            <ShopSelection
              shops={available}
              shopId={shopId}
              setShopId={setShopId}
              isDisabled={isLocked}
            />
          </section>
          {selectedShop ? (
            <ScheduleFields
              selectedShop={selectedShop}
              mode={mode}
              days={days}
              today={today}
              now={now}
              slotDate={slotDate}
              slotWindow={slotWindow}
              setSlotDate={setSlotDate}
              setSlotWindow={setSlotWindow}
              isDisabled={isLocked}
            />
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          {canBook ? (
            <section className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {simple("estimateLater")}
              </p>
              <PhoneAction
                status={status}
                isLoading={
                  isLoading || (isAuthenticated && identity === undefined)
                }
                isAuthenticated={isAuthenticated}
                hasPhone={Boolean(identity?.phone)}
                label={retryRequest ? common("retry") : simple("confirm")}
                onSubmit={() => {
                  void submit();
                }}
              />
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}

function usePhotoUploads() {
  const uploaded = useRef(new Map<File, Id<"householdPhotos">>());
  const upload = useAction(api.householdPhotos.upload);
  async function uploadPhotos(files: File[]) {
    const photoIds: Id<"householdPhotos">[] = [];
    for (const file of files) {
      let photoId = uploaded.current.get(file);
      if (!photoId) {
        try {
          const prepared = await prepareUpload(file, "machine_media");
          if (prepared.size > 2 * 1024 * 1024)
            throw new Error("PHOTO_UPLOAD_FAILED");
          photoId = await upload({
            name: prepared.name,
            bytes: await prepared.arrayBuffer(),
          });
        } catch {
          throw new Error("PHOTO_UPLOAD_FAILED");
        }
        uploaded.current.set(file, photoId);
      }
      photoIds.push(photoId);
    }
    return photoIds;
  }
  return {
    uploadPhotos,
    clearUploads: () => {
      uploaded.current.clear();
    },
  };
}

function DetailsForm({
  form,
  mode,
  location,
  files,
  photoError,
  next,
  setFiles,
  setPhotoError,
  clearShop,
}: {
  form: UseFormReturn<Details>;
  mode: Details["mode"];
  location: ReturnType<typeof useLocation>;
  files: File[];
  photoError: string | undefined;
  next: (values: Details) => void;
  setFiles: (files: File[]) => void;
  setPhotoError: (error: string | undefined) => void;
  clearShop: () => void;
}) {
  const t = useTranslations("sell");
  const simple = useTranslations("sell.simple");
  const fields = useTranslations("join.form");
  const locationError = fields("locationFailed");
  return (
    <form
      noValidate
      className="space-y-7"
      onSubmit={(event) => {
        void form.handleSubmit(next)(event);
      }}
    >
      <RecyclingPhotos
        files={files}
        onChange={(value) => {
          setFiles(value);
          setPhotoError(undefined);
        }}
        error={photoError}
      />
      <RadioGroup
        value={mode}
        onValueChange={(value) => {
          if (!(value === "pickup" || value === "dropoff")) {
            return;
          }

          form.setValue("mode", value);
          clearShop();
        }}
        className="grid grid-cols-2 gap-3"
        aria-label={simple("schedule")}
      >
        {(["pickup", "dropoff"] as const).map((value) => (
          <Label
            key={value}
            htmlFor={`recycle-${value}`}
            className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg bg-muted/50 px-4"
          >
            <RadioGroupItem id={`recycle-${value}`} value={value} />
            {simple(value)}
          </Label>
        ))}
      </RadioGroup>
      <div className="space-y-2">
        <Label htmlFor="recycle-name">{t("when.nameLabel")}</Label>
        <Input
          id="recycle-name"
          autoComplete="name"
          className="h-12"
          {...form.register("name")}
          aria-invalid={Boolean(form.formState.errors.name)}
        />
        {form.formState.errors.name ? (
          <p role="alert" className="text-sm text-destructive">
            {t("when.errors.name")}
          </p>
        ) : null}
      </div>
      {mode === "pickup" ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor="recycle-address">{t("when.addressLabel")}</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={location.state.status === "locating"}
              onClick={location.locate}
            >
              <LocateFixedIcon aria-hidden />
              {simple("location")}
            </Button>
          </div>
          <Input
            id="recycle-address"
            autoComplete="street-address"
            className="h-12"
            {...form.register("address")}
            aria-invalid={Boolean(form.formState.errors.address)}
            placeholder={t("when.addressHint")}
          />
          {form.formState.errors.address ? (
            <p role="alert" className="text-sm text-destructive">
              {t("when.errors.address")}
            </p>
          ) : null}
          {location.state.status === "on" ? (
            <p role="status" className="text-sm text-primary">
              {fields("locationSaved")}
            </p>
          ) : null}
          {location.state.status === "failed" ? (
            <p role="status" className="text-sm text-muted-foreground">
              {locationError}
            </p>
          ) : null}
        </div>
      ) : (
        <Button type="button" variant="outline" onClick={location.locate}>
          <LocateFixedIcon aria-hidden />
          {simple("location")}
        </Button>
      )}
      <Button size="lg" type="submit" className="w-full">
        {simple("next")}
        <ArrowRightIcon aria-hidden className="rtl:rotate-180" />
      </Button>
    </form>
  );
}

type Shop = FunctionReturnType<typeof api.households.shops>[number];
function ShopSelection({
  shops,
  shopId,
  setShopId,
  isDisabled,
}: {
  shops: Shop[] | undefined;
  shopId: string | undefined;
  setShopId: (id: string) => void;
  isDisabled: boolean;
}) {
  const t = useTranslations("sell");
  const common = useTranslations("common");
  if (!shops) return <p role="status">{common("loading")}</p>;
  if (shops.length === 0)
    return (
      <p role="status" className="text-muted-foreground">
        {t("shop.empty")}
      </p>
    );
  return (
    <RadioGroup
      value={shopId ?? ""}
      disabled={isDisabled}
      onValueChange={setShopId}
    >
      {shops.map((shop) => (
        <Label
          key={shop.id}
          htmlFor={`recycle-shop-${shop.id}`}
          className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-4 hover:bg-muted/50 has-[[data-state=checked]]:bg-accent"
        >
          <RadioGroupItem id={`recycle-shop-${shop.id}`} value={shop.id} />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{shop.name}</span>
            <span className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
              <MapPinIcon aria-hidden className="size-4" />
              {shop.area}
            </span>
          </span>
        </Label>
      ))}
    </RadioGroup>
  );
}

function ScheduleFields({
  selectedShop,
  mode,
  days,
  today,
  now,
  slotDate,
  slotWindow,
  setSlotDate,
  setSlotWindow,
  isDisabled,
}: {
  selectedShop: Shop;
  mode: Details["mode"];
  days: string[];
  today: string;
  now: number;
  slotDate: string;
  slotWindow: SlotWindow | undefined;
  setSlotDate: (day: string) => void;
  setSlotWindow: (window: SlotWindow | undefined) => void;
  isDisabled: boolean;
}) {
  const t = useTranslations("sell");
  const simple = useTranslations("sell.simple");
  const time = useTimeFormat();
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{simple("schedule")}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          value={slotDate}
          disabled={isDisabled}
          onValueChange={(day) => {
            setSlotDate(day);
            setSlotWindow(undefined);
          }}
        >
          <SelectTrigger
            className="h-12 w-full"
            aria-label={t("when.dayLabel")}
          >
            <SelectValue placeholder={t("when.dayLabel")} />
          </SelectTrigger>
          <SelectContent>
            {days.map((day) => (
              <SelectItem key={day} value={day}>
                {time.day(day, today, {
                  today: t("when.today"),
                  tomorrow: t("when.tomorrow"),
                })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={slotWindow ?? ""}
          disabled={!slotDate || isDisabled}
          onValueChange={(window) => {
            const value = SLOT_WINDOWS.find(
              (candidate) => candidate === window,
            );
            setSlotWindow(value);
          }}
        >
          <SelectTrigger
            className="h-12 w-full"
            aria-label={t("when.windowLabel")}
          >
            <SelectValue placeholder={t("when.windowLabel")} />
          </SelectTrigger>
          <SelectContent>
            {SLOT_WINDOWS.filter(
              (window) =>
                slotDate && isWindowOpen(slotDate, window, today, now),
            ).map((window) => (
              <SelectItem key={window} value={window}>
                {t(`windows.${window}`)} · {time.window(window)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {mode === "dropoff" ? (
        <p className="text-sm text-muted-foreground">{selectedShop.address}</p>
      ) : null}
    </section>
  );
}

function PhoneAction({
  status,
  isLoading,
  isAuthenticated,
  hasPhone,
  label,
  onSubmit,
}: {
  status: "idle" | "booking" | "booked";
  isLoading: boolean;
  isAuthenticated: boolean;
  hasPhone: boolean;
  label: string;
  onSubmit: () => void;
}) {
  const t = useTranslations("sell");
  const common = useTranslations("common");
  if (status !== "idle")
    return (
      <p role="status">
        {t(status === "booked" ? "confirm.booked" : "confirm.booking")}
      </p>
    );
  if (isLoading) return <p role="status">{common("loading")}</p>;
  if (!isAuthenticated)
    return <PhoneSignIn verifyLabel={label} onVerified={onSubmit} />;
  return (
    <Button
      className="w-full"
      size="lg"
      disabled={!hasPhone}
      onClick={onSubmit}
    >
      {label}
    </Button>
  );
}

function pickupDetails(
  values: Details,
  point: ReturnType<typeof useLocation>["point"],
) {
  return values.mode === "pickup"
    ? { address: cleanAddress(values.address), location: point }
    : {};
}

function shopsForMode(shops: Shop[] | undefined, mode: Details["mode"]) {
  return shops?.filter((shop) => mode === "dropoff" || shop.offersPickup);
}

function shopQueryArgs(
  stage: "details" | "schedule",
  point: ReturnType<typeof useLocation>["point"],
): FunctionArgs<typeof api.households.shops> | "skip" {
  return stage === "schedule"
    ? { items: [], ...(point && { near: point }) }
    : "skip";
}

export function isRecyclingPhotoError(error: unknown): boolean {
  return error instanceof ConvexError
    ? typeof error.data === "string" && error.data.startsWith("PHOTO")
    : error instanceof Error && error.message === "PHOTO_UPLOAD_FAILED";
}
