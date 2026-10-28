"use client";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useFormatter, useTranslations } from "next-intl";
import { type ReactNode, useRef, useState } from "react";
import { toast } from "sonner";

import { AppPageHeader, ListSkeleton } from "@/components/app/page-parts";
import { useSignedInQuery } from "@/components/providers/use-signed-in-query";
import { ActionButton } from "@/components/ui/action-button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { asciiDigits } from "@/lib/number-input";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  COMMERCIAL_MODELS,
  SERVICE_KINDS,
} from "../../../convex/lib/serviceRecordsSchema";
import { Choice } from "../quality/shared";
type Board = FunctionReturnType<typeof api.services.board>;
type Enquiry = Board["enquiries"][number];
type Programme = Board["programmes"][number];
function field(data: FormData, key: string) {
  const value = data.get(key);
  return typeof value === "string" ? value : "";
}
function integer(data: FormData, key: string) {
  const value = asciiDigits(field(data, key).trim());
  if (!/^\d+$/.test(value)) throw new Error("INVALID_QUANTITY");
  const result = Number(value);
  if (!Number.isSafeInteger(result)) throw new Error("INVALID_QUANTITY");
  return result;
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Label className="flex min-w-0 flex-col gap-2">
      {label}
      {children}
    </Label>
  );
}
export function ServicesPage() {
  const data = useSignedInQuery(api.services.board);
  const t = useTranslations("serviceRecords");
  if (data === undefined) return <ListSkeleton />;
  if (!data) return null;
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <AppPageHeader title={t("title")} lead={t("unavailable")} />
      <ServicesContent key={data.orgId ?? "personal"} data={data} />
    </section>
  );
}
function ServicesContent({ data }: { data: Board }) {
  const format = useFormatter();
  const t = useTranslations("serviceRecords"),
    common = useTranslations("common");
  const [enquiry, setEnquiry] = useState<Enquiry | null>(null),
    [programme, setProgramme] = useState<Programme | null>(null);
  const revoke = useMutation(api.services.revokeProgrammeShare);
  const withdraw = useMutation(api.services.revokeEnquiryRecipient);
  return (
    <>
      <section className="flex flex-col gap-4 border-t border-border pt-6">
        <h2 className="text-lg font-semibold">{t("enquiries")}</h2>
        {data.canCreate &&
        (!enquiry ||
          data.enquiries.some(
            (row) => row.id === enquiry.id && row.canEdit,
          )) ? (
          <EnquiryForm
            key={enquiry?.id ?? "new"}
            data={data}
            row={enquiry}
            onDone={() => {
              setEnquiry(null);
            }}
          />
        ) : null}
        {data.enquiries.map((row) => (
          <article
            key={row.id}
            className="flex flex-wrap items-start justify-between gap-3 border-b border-border py-4"
          >
            <section className="space-y-1">
              <h3 className="font-semibold">{row.title}</h3>
              <p className="text-sm">
                {t(`kinds.${row.kind}`)} · {t(row.state)}
              </p>
              <p className="text-sm whitespace-pre-line">{row.details}</p>
              <p className="text-sm text-muted-foreground">
                {t(`models.${row.commercialModel}`)} ·{" "}
                {t(`directions.${row.paymentDirection}`)}
              </p>
            </section>
            {row.canEdit && row.recipientId ? (
              <ActionButton
                label={t("revoke")}
                onClick={() => {
                  void withdraw({ id: row.id }).catch(() =>
                    toast.error(common("error")),
                  );
                }}
              />
            ) : null}
            {!row.canEdit || row.state === "closed" ? null : (
              <ActionButton
                label={t("edit")}
                onClick={() => {
                  setEnquiry(row);
                }}
              />
            )}
          </article>
        ))}
      </section>
      <section className="flex flex-col gap-3 border-t border-border pt-6">
        <h2 className="text-lg font-semibold">{t("received")}</h2>
        {data.received.map((row) => (
          <article
            key={row.id}
            className="space-y-2 border-b border-border py-3"
          >
            <h3 className="font-semibold">{row.title}</h3>
            <p className="whitespace-pre-line">{row.details}</p>
            <p>{t(`directions.${row.paymentDirection}`)}</p>
            {row.materialSnapshot ? (
              <p>
                {row.materialSnapshot.materialCode} · {t("quantityGrams")}:{" "}
                {format.number(row.materialSnapshot.declaredGrams)}
              </p>
            ) : null}
          </article>
        ))}
      </section>
      <section className="flex flex-col gap-4 border-t border-border pt-6">
        <h2 className="text-lg font-semibold">{t("programmes")}</h2>
        <p className="text-sm text-muted-foreground">{t("reported")}</p>
        {data.canCreate &&
        (!programme ||
          data.programmes.some(
            (row) => row.id === programme.id && row.canEdit,
          )) ? (
          <ProgrammeForm
            key={programme?.id ?? "new"}
            data={data}
            row={programme}
            onDone={() => {
              setProgramme(null);
            }}
          />
        ) : null}
        {data.programmes.map((row) => (
          <article
            key={row.id}
            className="flex flex-col gap-3 border-b border-border py-4"
          >
            <h3 className="font-semibold">{row.title}</h3>
            <p>
              {row.area} · {row.stream}
            </p>
            <ProgrammeTotals row={row} />
            {!row.canEdit || row.state === "closed" ? null : (
              <ActionButton
                label={t("edit")}
                onClick={() => {
                  setProgramme(row);
                }}
              />
            )}
            {row.canEdit ? (
              <ShareForm programmeId={row.id} recipients={data.recipients} />
            ) : null}
          </article>
        ))}
      </section>
      <section className="flex flex-col gap-3 border-t border-border pt-6">
        <h2 className="text-lg font-semibold">{t("sharedReports")}</h2>
        {data.reports.map((row) => (
          <article
            key={row.id}
            className="space-y-3 border-b border-border py-4"
          >
            <h3 className="font-semibold">
              {row.area} · {row.stream}
            </h3>
            <p className="text-sm">{row.purpose}</p>
            <ProgrammeTotals row={row} />
            {row.canRevoke && !row.revokedAt ? (
              <ActionButton
                label={t("revoke")}
                onClick={() => {
                  void revoke({ id: row.id }).catch(() =>
                    toast.error(common("error")),
                  );
                }}
              />
            ) : null}
          </article>
        ))}
      </section>
    </>
  );
}
function EnquiryForm({
  data,
  row,
  onDone,
}: {
  data: Board;
  row: Enquiry | null;
  onDone: () => void;
}) {
  const t = useTranslations("serviceRecords"),
    common = useTranslations("common"),
    contact = useTranslations("help.contact"),
    audit = useTranslations("auditReports");
  const create = useMutation(api.services.createEnquiry),
    update = useMutation(api.services.updateEnquiry);
  const [kind, setKind] = useState<string>(row?.kind ?? "equipment"),
    [model, setModel] = useState<string>(
      row?.commercialModel ?? "partner_service",
    ),
    [target, setTarget] = useState<string>(row?.recipientId ?? "none"),
    [lot, setLot] = useState("none"),
    [shareLot, setShareLot] = useState(false),
    [busy, setBusy] = useState(false);
  const operation = useRef<string | null>(null);
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget,
          values = new FormData(form, event.nativeEvent.submitter);
        const state = field(values, "intent");
        const chosenKind = SERVICE_KINDS.find((value) => value === kind),
          chosenModel = COMMERCIAL_MODELS.find((value) => value === model);
        if (!chosenKind || !chosenModel) return;
        setBusy(true);
        const title = field(values, "title"),
          details = field(values, "details");
        operation.current ??= crypto.randomUUID();
        const run = async () => {
          if (row) {
            await update({
              id: row.id,
              version: row.version,
              title,
              details,
              state: enquiryState(state, row.state),
            });
          } else {
            await create({
              operationKey: operation.current ?? crypto.randomUUID(),
              kind: chosenKind,
              commercialModel: chosenModel,
              principalParty: field(values, "principal"),
              title,
              details,
              orgId: data.orgId ?? undefined,
              recipientId:
                target === "none"
                  ? undefined
                  : (target as Id<"stakeholderAccounts">),
              materialLotId:
                lot === "none" ? undefined : (lot as Id<"materialLots">),
              shareMaterialLotReference: shareLot,
              submit: state === "enquiry",
            });
          }
          operation.current = null;
          form.reset();
          onDone();
        };
        void run()
          .catch(() => toast.error(common("error")))
          .finally(() => {
            setBusy(false);
          });
      }}
    >
      {row ? (
        <p>
          {t(`models.${row.commercialModel}`)} ·{" "}
          {t(`directions.${row.paymentDirection}`)}
        </p>
      ) : (
        <>
          <Choice
            label={contact("topic")}
            value={kind}
            onChange={setKind}
            options={SERVICE_KINDS.map((value) => ({
              id: value,
              label: t(`kinds.${value}`),
            }))}
          />
          <Choice
            label={t("commercialModel")}
            value={model}
            onChange={setModel}
            options={COMMERCIAL_MODELS.map((value) => ({
              id: value,
              label: t(`models.${value}`),
            }))}
          />
          <Field label={t("principal")}>
            <Input
              name="principal"
              minLength={model === "toll_jobwork" ? 3 : undefined}
              required={model === "toll_jobwork"}
              maxLength={120}
            />
          </Field>
          <Choice
            label={audit("recipient")}
            value={target}
            onChange={setTarget}
            options={[
              { id: "none", label: contact("topics.other") },
              ...data.recipients.map((value) => ({
                id: value.id,
                label: value.name,
              })),
            ]}
          />
          {data.lots.length > 0 ? (
            <>
              <Choice
                label={t("materialReference")}
                value={lot}
                onChange={setLot}
                options={[
                  { id: "none", label: contact("topics.other") },
                  ...data.lots.map((value) => ({
                    id: value.id,
                    label: value.label,
                  })),
                ]}
              />
              <Label className="flex items-start gap-3">
                <Checkbox
                  checked={shareLot}
                  onCheckedChange={(checked) => {
                    setShareLot(checked === true);
                  }}
                />
                {t("explicitReference")}
              </Label>
            </>
          ) : null}
        </>
      )}
      <Field label={t("recordName")}>
        <Input
          name="title"
          required
          minLength={3}
          maxLength={120}
          defaultValue={row?.title}
        />
      </Field>
      <Field label={contact("message")}>
        <Textarea
          name="details"
          required
          minLength={5}
          maxLength={2000}
          defaultValue={row?.details}
        />
      </Field>
      <section className="flex flex-wrap gap-2">
        <ActionButton type="submit" label={common("save")} isDisabled={busy} />
        {row?.state === "draft" ? (
          <ActionButton
            type="submit"
            name="intent"
            value="enquiry"
            label={contact("submit")}
            isDisabled={busy}
          />
        ) : null}
        <ActionButton
          type="submit"
          name="intent"
          value={row ? "closed" : "enquiry"}
          label={row ? common("close") : contact("submit")}
          isDisabled={busy}
        />
      </section>
    </form>
  );
}
const COUNT_FIELDS = [
  "coverageCount",
  "trips",
  "centreHandovers",
  "quantityGrams",
  "groupIncomePaise",
] as const;
function ProgrammeForm({
  data,
  row,
  onDone,
}: {
  data: Board;
  row: Programme | null;
  onDone: () => void;
}) {
  const t = useTranslations("serviceRecords"),
    common = useTranslations("common"),
    lots = useTranslations("lots"),
    material = useTranslations("prices.columns");
  const create = useMutation(api.services.createProgramme),
    update = useMutation(api.services.updateProgramme);
  const [busy, setBusy] = useState(false);
  const operation = useRef<string | null>(null);
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget,
          values = new FormData(form, event.nativeEvent.submitter);
        operation.current ??= crypto.randomUUID();
        setBusy(true);
        const run = async () => {
          const fields = {
            title: field(values, "title"),
            area: field(values, "area"),
            stream: field(values, "stream"),
            startsOn: field(values, "startsOn"),
            endsOn: field(values, "endsOn"),
            evidenceReference: field(values, "evidenceReference"),
            coverageCount: integer(values, "coverageCount"),
            trips: integer(values, "trips"),
            centreHandovers: integer(values, "centreHandovers"),
            quantityGrams: integer(values, "quantityGrams"),
            groupIncomePaise: integer(values, "groupIncomePaise"),
            orgId: row?.orgId ?? data.orgId ?? undefined,
          };
          if (row)
            await update({
              ...fields,
              id: row.id,
              version: row.version,
              state: field(values, "intent") === "closed" ? "closed" : "draft",
            });
          else
            await create({
              ...fields,
              operationKey: operation.current ?? crypto.randomUUID(),
            });
          operation.current = null;
          form.reset();
          onDone();
        };
        void run()
          .catch(() => toast.error(common("error")))
          .finally(() => {
            setBusy(false);
          });
      }}
    >
      <Field label={t("recordName")}>
        <Input
          name="title"
          minLength={3}
          maxLength={120}
          required
          defaultValue={row?.title}
        />
      </Field>
      <Field label={t("area")}>
        <Input
          name="area"
          minLength={2}
          maxLength={120}
          required
          defaultValue={row?.area}
        />
      </Field>
      <Field label={material("material")}>
        <Input
          name="stream"
          minLength={2}
          maxLength={80}
          required
          defaultValue={row?.stream}
        />
      </Field>
      <section className="grid gap-3 sm:grid-cols-2">
        {(["startsOn", "endsOn"] as const).map((name) => (
          <Field key={name} label={t(name)}>
            <Input
              name={name}
              type="date"
              required
              defaultValue={row?.[name]}
            />
          </Field>
        ))}
        {COUNT_FIELDS.map((name) => (
          <Field key={name} label={t(name)}>
            <Input
              name={name}
              inputMode="numeric"
              required
              defaultValue={row?.[name] ?? 0}
            />
          </Field>
        ))}
      </section>
      <Field label={lots("evidenceReference")}>
        <Input
          name="evidenceReference"
          maxLength={500}
          defaultValue={row?.evidenceReference}
        />
      </Field>
      <section className="flex flex-wrap gap-2">
        <ActionButton type="submit" label={common("save")} isDisabled={busy} />
        {row ? (
          <ActionButton
            type="submit"
            name="intent"
            value="closed"
            label={common("close")}
            isDisabled={busy}
          />
        ) : null}
      </section>
    </form>
  );
}
function ProgrammeTotals({
  row,
}: {
  row: Pick<
    Programme,
    | "coverageCount"
    | "trips"
    | "centreHandovers"
    | "quantityGrams"
    | "groupIncomePaise"
    | "startsOn"
    | "endsOn"
  >;
}) {
  const t = useTranslations("serviceRecords"),
    format = useFormatter();
  return (
    <dl className="grid gap-2 text-sm sm:grid-cols-2">
      {COUNT_FIELDS.map((key) => (
        <section key={key}>
          <dt className="text-muted-foreground">{t(key)}</dt>
          <dd>{format.number(row[key])}</dd>
        </section>
      ))}
      <section>
        <dt className="text-muted-foreground">{t("startsOn")}</dt>
        <dd>{row.startsOn}</dd>
      </section>
      <section>
        <dt className="text-muted-foreground">{t("endsOn")}</dt>
        <dd>{row.endsOn}</dd>
      </section>
    </dl>
  );
}
function ShareForm({
  programmeId,
  recipients,
}: {
  programmeId: Id<"programmeRecords">;
  recipients: Board["recipients"];
}) {
  const t = useTranslations("serviceRecords"),
    common = useTranslations("common"),
    audit = useTranslations("auditReports");
  const share = useMutation(api.services.shareProgramme);
  const [target, setTarget] = useState(""),
    [busy, setBusy] = useState(false);
  const operation = useRef<string | null>(null);
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!target) return;
        const values = new FormData(event.currentTarget);
        operation.current ??= crypto.randomUUID();
        setBusy(true);
        void share({
          programmeId,
          recipientId: target as Id<"stakeholderAccounts">,
          operationKey: operation.current,
          purpose: field(values, "purpose"),
          expiresAt: new Date(
            `${field(values, "expiry")}T18:00:00+05:30`,
          ).getTime(),
        })
          .then(() => {
            operation.current = null;
          })
          .catch(() => toast.error(common("error")))
          .finally(() => {
            setBusy(false);
          });
      }}
    >
      <Choice
        label={audit("recipient")}
        value={target}
        onChange={setTarget}
        options={recipients.map((row) => ({ id: row.id, label: row.name }))}
      />
      <Field label={audit("purpose")}>
        <Input name="purpose" minLength={3} maxLength={200} required />
      </Field>
      <Field label={t("endsOn")}>
        <Input name="expiry" type="date" required />
      </Field>
      <ActionButton
        type="submit"
        label={t("share")}
        isDisabled={!target || busy}
      />
    </form>
  );
}

function enquiryState(
  intent: string,
  current: Enquiry["state"],
): Enquiry["state"] {
  if (intent === "closed") return "closed";
  return intent === "enquiry" ? "enquiry" : current;
}
