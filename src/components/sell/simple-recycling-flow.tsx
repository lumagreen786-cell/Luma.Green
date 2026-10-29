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
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { type RefObject, useEffect, useRef, useState } from "react";
import {
  Controller,
  useForm,
  type UseFormReturn,
  useWatch,
} from "react-hook-form";
import { z } from "zod";

import { CityField } from "@/components/location/city-field";
import { ReverseAddress } from "@/components/location/reverse-address";
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
import { isLocale, localeDirection } from "@/i18n/locales";
import { useRouter } from "@/i18n/navigation";
import { prepareUpload } from "@/lib/upload-image";
import { assertMounted, useMounted } from "@/lib/use-mounted";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { canonicalCity } from "../../../convex/lib/geography";
import {
  bookableDates,
  cleanAddress,
  isValidAddress,
  isValidName,
  isWindowOpen,
  SLOT_WINDOWS,
  type SlotWindow,
} from "../../../convex/lib/households";
import { citySchema } from "../../../convex/lib/onboarding";
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
    city: citySchema,
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
  const isMounted = useMounted();
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
      city: initial.city ?? "",
      mode: initial.mode,
    },
  });
  const mode = useWatch({ control: form.control, name: "mode" });
  const city = useWatch({ control: form.control, name: "city" });
  const shops = useQuery(
    api.households.shops,
    shopQueryArgs(stage, location.point, city),
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
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [stage]);

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
      assertMounted(isMounted);
      await ensureProfile({ locale });
      assertMounted(isMounted);
      let request = retryRequest;
      if (!request) {
        if (!selectedShop || !slotWindow) throw new Error("INVALID_REQUEST");
        const photoIds = await uploadPhotos(files);
        assertMounted(isMounted);
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
      assertMounted(isMounted);
      setStatus("booked");
      clearSellDraft();
      router.push(`/t/${token}`);
    } catch (error_) {
      if (!isMounted()) return;
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
    <div className="space-y-6">
      <RecyclingProgress stage={stage} heading={heading} />
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
          <section className="space-y-3" aria-labelledby="recycling-step-title">
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
          <MissingSchedule
            hasShop={Boolean(selectedShop)}
            slotDate={slotDate}
            hasSlot={hasSlot}
          />
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          {canBook ? (
            <section className="space-y-4">
              <BookingReview
                details={form.getValues()}
                files={files}
                shop={selectedShop}
                slotDate={slotDate}
                slotWindow={slotWindow}
                today={today}
              />
              <p className="text-sm text-muted-foreground">
                {simple("estimateLater")}
              </p>
              <LocationNotice
                mode={mode}
                hasLocation={Boolean(location.point)}
              />
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

function RecyclingProgress({
  stage,
  heading,
}: {
  stage: "details" | "schedule";
  heading: RefObject<HTMLHeadingElement | null>;
}) {
  const t = useTranslations("sell");
  const simple = useTranslations("sell.simple");
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        {t("steps.progress", {
          current: stage === "details" ? 1 : 2,
          total: 2,
        })}
      </p>
      <h2
        id="recycling-step-title"
        ref={heading}
        tabIndex={-1}
        className="text-lg font-semibold outline-none"
      >
        {simple(stage === "details" ? "details" : "chooseShop")}
      </h2>
    </div>
  );
}
function MissingSchedule({
  hasShop,
  slotDate,
  hasSlot,
}: {
  hasShop: boolean;
  slotDate: string;
  hasSlot: boolean;
}) {
  const t = useTranslations("sell");
  let key:
    "simple.chooseShop" | "when.errors.day" | "when.errors.window" | null =
    null;
  if (!hasShop) key = "simple.chooseShop";
  else if (!slotDate) key = "when.errors.day";
  else if (!hasSlot) key = "when.errors.window";
  return key ? (
    <p role="status" className="text-sm text-muted-foreground">
      {t(key)}
    </p>
  ) : null;
}
function LocationNotice({
  mode,
  hasLocation,
}: {
  mode: Details["mode"];
  hasLocation: boolean;
}) {
  const t = useTranslations("sell");
  return mode === "pickup" && hasLocation ? (
    <p className="text-sm text-muted-foreground">{t("confirm.locationNote")}</p>
  ) : null;
}

function BookingReview({
  details,
  files,
  shop,
  slotDate,
  slotWindow,
  today,
}: {
  details: Details;
  files: File[];
  shop: Shop | undefined;
  slotDate: string;
  slotWindow: SlotWindow | undefined;
  today: string;
}) {
  const t = useTranslations("sell");
  const format = useFormatter();
  const time = useTimeFormat();
  return (
    <section
      className="space-y-3 border-y py-4"
      aria-labelledby="booking-review-title"
    >
      <h2 id="booking-review-title" className="text-lg font-semibold">
        {t("confirm.title")}
      </h2>
      <dl className="grid gap-3 text-sm sm:grid-cols-2 [&_dd]:break-words [&>div]:min-w-0">
        <div>
          <dt className="text-muted-foreground">{t("when.nameLabel")}</dt>
          <dd className="font-medium">{details.name}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">
            {t("simple.attachedPhotos")}
          </dt>
          <dd>{format.number(files.length)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("confirm.who")}</dt>
          <dd>{shop?.name}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("confirm.where")}</dt>
          <dd>
            <span className="block">{t(`confirm.${details.mode}`)}</span>
            <span className="block">
              {details.mode === "pickup" ? details.address : shop?.address}
            </span>
          </dd>
        </div>
        {slotWindow ? (
          <div>
            <dt className="text-muted-foreground">{t("confirm.when")}</dt>
            <dd>
              {t("confirm.whenValue", {
                day: time.day(slotDate, today, {
                  today: t("when.today"),
                  tomorrow: t("when.tomorrow"),
                }),
                window: t(`windows.${slotWindow}`),
                time: time.window(slotWindow),
              })}
            </dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}

function usePhotoUploads() {
  const isMounted = useMounted();
  const uploaded = useRef(new Map<File, Id<"householdPhotos">>());
  const upload = useAction(api.householdPhotos.upload);
  async function uploadPhotos(files: File[]) {
    const photoIds: Id<"householdPhotos">[] = [];
    for (const file of files) {
      assertMounted(isMounted);
      let photoId = uploaded.current.get(file);
      if (!photoId) {
        try {
          const prepared = await prepareUpload(file, "machine_media");
          assertMounted(isMounted);
          if (prepared.size > 2 * 1024 * 1024)
            throw new Error("PHOTO_UPLOAD_FAILED");
          const bytes = await prepared.arrayBuffer();
          assertMounted(isMounted);
          photoId = await upload({ name: prepared.name, bytes });
          assertMounted(isMounted);
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
  const address = useWatch({ control: form.control, name: "address" });
  const locale = useLocale();
  return (
    <form
      noValidate
      className="space-y-7"
      onSubmit={(event) => {
        if (files.length === 0) setPhotoError(simple("photoRequired"));
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
        dir={isLocale(locale) ? localeDirection(locale) : "ltr"}
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
      <Controller
        name="city"
        control={form.control}
        render={({ field, fieldState }) => (
          <CityField
            value={field.value}
            onBlur={field.onBlur}
            error={Boolean(fieldState.error)}
            onChange={(value) => {
              field.onChange(value);
              clearShop();
            }}
          />
        )}
      />
      <div className="space-y-2">
        <Label htmlFor="recycle-name">{t("when.nameLabel")}</Label>
        <Input
          id="recycle-name"
          autoComplete="name"
          className="h-12"
          {...form.register("name")}
          aria-invalid={Boolean(form.formState.errors.name)}
          aria-describedby={
            form.formState.errors.name ? "recycle-name-error" : undefined
          }
        />
        {form.formState.errors.name ? (
          <p role="alert" className="text-sm text-destructive">
            <span id="recycle-name-error">{t("when.errors.name")}</span>
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
            aria-describedby={
              form.formState.errors.address
                ? "recycle-address-error"
                : undefined
            }
            placeholder={t("when.addressHint")}
          />
          {form.formState.errors.address ? (
            <p role="alert" className="text-sm text-destructive">
              <span id="recycle-address-error">{t("when.errors.address")}</span>
            </p>
          ) : null}
          {location.state.status === "on" ? (
            <p role="status" className="text-sm text-primary">
              {fields("locationSaved")}
            </p>
          ) : null}
          <ReverseAddress
            point={location.point}
            address={address}
            onUse={(address) => {
              form.setValue("address", address, {
                shouldDirty: true,
                shouldValidate: true,
              });
            }}
          />
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
  const locale = useLocale();
  if (!shops) return <p role="status">{common("loading")}</p>;
  if (shops.length === 0)
    return (
      <p role="status" className="text-muted-foreground">
        {t("shop.empty")}
      </p>
    );
  return (
    <RadioGroup
      dir={isLocale(locale) ? localeDirection(locale) : "ltr"}
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
  const locale = useLocale();
  const direction = isLocale(locale) ? localeDirection(locale) : "ltr";
  const availability = useQuery(
    api.collectionScheduling.availability,
    slotDate ? { orgId: selectedShop.id, date: slotDate } : "skip",
  );
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{simple("schedule")}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          dir={direction}
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
          dir={direction}
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
                slotDate &&
                isWindowOpen(slotDate, window, today, now) &&
                availability?.some(
                  (slot) => slot.window === window && slot.remaining > 0,
                ),
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
    <div className="space-y-3">
      {hasPhone ? null : (
        <p role="status" className="text-sm text-muted-foreground">
          {t("errors.NO_PHONE")}
        </p>
      )}
      <Button
        className="w-full"
        size="lg"
        disabled={!hasPhone}
        onClick={onSubmit}
      >
        {label}
      </Button>
    </div>
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

export function shopQueryArgs(
  stage: "details" | "schedule",
  point: ReturnType<typeof useLocation>["point"],
  city: string,
): FunctionArgs<typeof api.households.shops> | "skip" {
  const selected = canonicalCity(city);
  return stage === "schedule" && selected
    ? { city: selected, items: [], ...(point && { near: point }) }
    : "skip";
}

export function isRecyclingPhotoError(error: unknown): boolean {
  return error instanceof ConvexError
    ? typeof error.data === "string" && error.data.startsWith("PHOTO")
    : error instanceof Error && error.message === "PHOTO_UPLOAD_FAILED";
}
