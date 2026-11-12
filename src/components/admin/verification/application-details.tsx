import { ExternalLinkIcon } from "lucide-react";
import type { ReactNode } from "react";

import { StatusPill } from "@/components/app/page-parts";

import type {
  MaterialOrigin,
  SiteType,
} from "../../../../convex/lib/siteClassification";
import { formatDay, formatPhone } from "../format";
import {
  FAMILY_LABELS,
  radiusLabel,
  SAATHI_TIME_LABELS,
  SAATHI_VEHICLE_LABELS,
  SAATHI_WORK_LABELS,
  SHOP_VEHICLE_LABELS,
  weekdaysLabel,
} from "../labels";
import { mapLink, type ReviewedApplication } from "./checklist";

/** Each form field's name, for "changed since the last version". */
const FIELD_LABELS: Readonly<Record<string, string>> = {
  "kabadiwala.ownerName": "Owner's name",
  "kabadiwala.shopName": "Shop name",
  "kabadiwala.gstRegistered": "GST",
  "kabadiwala.gstin": "GST",
  "kabadiwala.address": "Address",
  "kabadiwala.location": "Address",
  "kabadiwala.offersPickup": "Home pickups",
  "kabadiwala.vehicle": "Home pickups",
  "kabadiwala.phones": "Other phone numbers",
  "kabadiwala.opens": "Opening hours",
  "kabadiwala.closes": "Opening hours",
  "kabadiwala.weeklyOff": "Weekly holiday",
  "business.businessName": "Business name",
  "business.siteType": "Primary site",
  "business.materialOrigins": "Material origins",
  "business.gstRegistered": "GST",
  "business.gstin": "GST",
  "business.materials": "Materials",
  "business.address": "Address",
  "business.location": "Address",
  "business.locationTags": "Location tags",
  "business.collectsFromSuppliers": "Collects from suppliers",
  "business.phones": "Other phone numbers",
  "business.opens": "Working hours",
  "business.closes": "Working hours",
  "business.weeklyOff": "Weekly holiday",
  "documents.pcbNotRequired": "Consent needed",
  "documents.notRequiredReason": "Consent needed",
  "documents.board": "Issuing board",
  "documents.boardState": "Issuing board",
  "documents.consentNumber": "Consent number",
  "documents.validUntil": "Valid until",
  "documents.declaration": "Declaration",
  "saathi.name": "Name",
  "saathi.area": "Area",
  "saathi.location": "Area",
  "saathi.radiusKm": "Travel radius",
  "saathi.workTypes": "Work",
  "saathi.vehicle": "Vehicle",
  "saathi.times": "Times",
  "saathi.days": "Days",
  files: "Documents and photos",
};

const SITE_LABELS: Record<SiteType, string> = {
  preprocessor_yard: "Preprocessor yard",
  recycling_facility: "Recycling facility",
  manufacturing_facility: "Manufacturing facility",
  apartment_community: "Apartment community",
  office: "Office",
  hotel: "Hotel",
  resort: "Resort",
  other: "Other site",
};

const ORIGIN_LABELS: Record<MaterialOrigin, string> = {
  industrial_byproduct: "Industrial byproduct",
  post_consumer: "Post-consumer material",
};

/** `["kabadiwala.opens", "files"]` → `["Opening hours", "Documents and photos"]` */
export function changeLabels(changes: readonly string[]): string[] {
  return [...new Set(changes.map((change) => FIELD_LABELS[change] ?? change))];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** A warning for a consent that has run out or is about to. */
export function expiryNote(
  validUntil: string | undefined,
  today: string,
): { tone: "bad" | "warn"; text: string } | null {
  if (!validUntil) return null;
  if (validUntil <= today) return { tone: "bad", text: "Expired" };
  const days = Math.round(
    (Date.parse(validUntil) - Date.parse(today)) / DAY_MS,
  );
  return days <= 30
    ? { tone: "warn", text: `Expires in ${String(days)} days` }
    : null;
}

type Changed = (label: string) => boolean;

/** The form, section by section, as the applicant sent it. */
export function ApplicationDetails({
  application,
  today,
}: {
  application: ReviewedApplication;
  today: string;
}) {
  const changed = new Set(changeLabels(application.changes));
  const isChanged: Changed = (label) => changed.has(label);
  const { kabadiwala, business, documents, saathi } = application;
  return (
    <>
      {kabadiwala ? (
        <ShopDetails shop={kabadiwala} isChanged={isChanged} />
      ) : null}
      {business ? (
        <BusinessDetails business={business} isChanged={isChanged} />
      ) : null}
      {documents ? (
        <DocumentDetails
          documents={documents}
          today={today}
          isChanged={isChanged}
        />
      ) : null}
      {saathi ? <SaathiDetails saathi={saathi} isChanged={isChanged} /> : null}
    </>
  );
}

function DetailsSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-4 border-t border-border pt-6">
      <header className="flex flex-col gap-1.5">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          {title}
        </h2>
      </header>
      <div>
        <dl className="flex flex-col divide-y">{children}</dl>
      </div>
    </section>
  );
}

function Field({
  label,
  isChanged,
  children,
}: {
  label: string;
  isChanged: Changed;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1 py-2.5 first:pt-0 last:pb-0 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
      <dt className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        {label}
        {isChanged(label) ? <StatusPill tone="warn">Changed</StatusPill> : null}
      </dt>
      <dd className="min-w-0 text-sm break-words">{children}</dd>
    </div>
  );
}

function Chips({ items }: { items: readonly string[] }) {
  if (items.length === 0) return <span>None</span>;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <li
          key={item}
          className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

function OutLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex min-h-11 items-center gap-2 self-start rounded-sm text-xs font-medium text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {children}
      <ExternalLinkIcon aria-hidden className="size-3" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

function Place({
  text,
  location,
}: {
  text: string | undefined;
  location: { lat: number; lng: number } | undefined;
}) {
  const href = mapLink({ address: text, location });
  return (
    <span className="flex flex-col gap-1">
      <span>{text ?? "—"}</span>
      {href ? (
        <OutLink href={href}>
          {location ? "See the pin on Google Maps" : "Find it on Google Maps"}
        </OutLink>
      ) : null}
    </span>
  );
}

function GstValue({
  isRegistered,
  gstin,
}: {
  isRegistered: boolean | undefined;
  gstin: string | undefined;
}) {
  if (isRegistered === undefined) return <span>—</span>;
  if (!isRegistered) return <span>Not registered</span>;
  return gstin ? (
    <span className="font-mono">{gstin.toUpperCase()}</span>
  ) : (
    <span>Registered, number missing</span>
  );
}

function hoursText(opens: string | undefined, closes: string | undefined) {
  return opens && closes ? `${opens} to ${closes}` : "—";
}

function Phones({
  phones,
}: {
  phones: readonly { number: string; label: string }[] | undefined;
}) {
  if (!phones || phones.length === 0) return <span>None</span>;
  return (
    <ul className="flex flex-col gap-1">
      {phones.map((phone) => (
        <li key={phone.number}>
          {phone.label} ·{" "}
          <a
            href={`tel:${phone.number}`}
            className="font-mono text-foreground underline-offset-4 hover:underline"
          >
            {formatPhone(phone.number)}
          </a>
        </li>
      ))}
    </ul>
  );
}

function yesNo(value: boolean | undefined): string {
  if (value === undefined) return "—";
  return value ? "Yes" : "No";
}

function ShopDetails({
  shop,
  isChanged,
}: {
  shop: NonNullable<ReviewedApplication["kabadiwala"]>;
  isChanged: Changed;
}) {
  const pickups =
    shop.offersPickup && shop.vehicle
      ? `Yes, by ${SHOP_VEHICLE_LABELS[shop.vehicle].toLowerCase()}`
      : yesNo(shop.offersPickup);
  return (
    <DetailsSection title="The shop">
      <Field label="Owner's name" isChanged={isChanged}>
        {shop.ownerName ?? "—"}
      </Field>
      <Field label="Shop name" isChanged={isChanged}>
        {shop.shopName ?? "—"}
      </Field>
      <Field label="GST" isChanged={isChanged}>
        <GstValue isRegistered={shop.gstRegistered} gstin={shop.gstin} />
      </Field>
      <Field label="Address" isChanged={isChanged}>
        <Place text={shop.address} location={shop.location} />
      </Field>
      <Field label="Home pickups" isChanged={isChanged}>
        {pickups}
      </Field>
      <Field label="Other phone numbers" isChanged={isChanged}>
        <Phones phones={shop.phones} />
      </Field>
      <Field label="Opening hours" isChanged={isChanged}>
        {hoursText(shop.opens, shop.closes)}
      </Field>
      <Field label="Weekly holiday" isChanged={isChanged}>
        {weekdaysLabel(shop.weeklyOff)}
      </Field>
    </DetailsSection>
  );
}

function BusinessDetails({
  business,
  isChanged,
}: {
  business: NonNullable<ReviewedApplication["business"]>;
  isChanged: Changed;
}) {
  return (
    <DetailsSection title="The business">
      <Field label="Business name" isChanged={isChanged}>
        {business.businessName ?? "—"}
      </Field>
      {business.siteType ? (
        <Field label="Primary site" isChanged={isChanged}>
          {SITE_LABELS[business.siteType]}
        </Field>
      ) : null}
      {business.materialOrigins ? (
        <Field label="Material origins" isChanged={isChanged}>
          <Chips
            items={business.materialOrigins.map(
              (origin) => ORIGIN_LABELS[origin],
            )}
          />
        </Field>
      ) : null}
      <Field label="GST" isChanged={isChanged}>
        <GstValue
          isRegistered={business.gstRegistered}
          gstin={business.gstin}
        />
      </Field>
      <Field label="Materials" isChanged={isChanged}>
        <Chips
          items={(business.materials ?? []).map(
            (family) => FAMILY_LABELS[family],
          )}
        />
      </Field>
      <Field label="Address" isChanged={isChanged}>
        <Place text={business.address} location={business.location} />
      </Field>
      <Field label="Location tags" isChanged={isChanged}>
        <Chips items={business.locationTags ?? []} />
      </Field>
      <Field label="Collects from suppliers" isChanged={isChanged}>
        {yesNo(business.collectsFromSuppliers)}
      </Field>
      <Field label="Other phone numbers" isChanged={isChanged}>
        <Phones phones={business.phones} />
      </Field>
      <Field label="Working hours" isChanged={isChanged}>
        {hoursText(business.opens, business.closes)}
      </Field>
      <Field label="Weekly holiday" isChanged={isChanged}>
        {weekdaysLabel(business.weeklyOff)}
      </Field>
    </DetailsSection>
  );
}

function boardText(
  documents: NonNullable<ReviewedApplication["documents"]>,
): string {
  if (documents.board === "kspcb") return "KSPCB (Karnataka)";
  const state = documents.boardState?.trim();
  if (documents.board === "other") {
    return state ? `${state} pollution control board` : "Another state's board";
  }
  return "—";
}

function DocumentDetails({
  documents,
  today,
  isChanged,
}: {
  documents: NonNullable<ReviewedApplication["documents"]>;
  today: string;
  isChanged: Changed;
}) {
  const expiry = expiryNote(documents.validUntil, today);
  return (
    <DetailsSection title="Pollution-control papers">
      {documents.pcbNotRequired ? (
        <Field label="Consent needed" isChanged={isChanged}>
          <span className="flex flex-col gap-1">
            <span>No: they say the unit needs no consent.</span>
            {documents.notRequiredReason ? (
              <q className="text-muted-foreground">
                {documents.notRequiredReason}
              </q>
            ) : null}
          </span>
        </Field>
      ) : (
        <>
          <Field label="Issuing board" isChanged={isChanged}>
            {boardText(documents)}
          </Field>
          <Field label="Consent number" isChanged={isChanged}>
            <span className="font-mono">{documents.consentNumber ?? "—"}</span>
          </Field>
          <Field label="Valid until" isChanged={isChanged}>
            <span className="flex flex-wrap items-center gap-2">
              {documents.validUntil ? formatDay(documents.validUntil) : "—"}
              {expiry ? (
                <StatusPill tone={expiry.tone}>{expiry.text}</StatusPill>
              ) : null}
            </span>
          </Field>
        </>
      )}
      <Field label="Declaration" isChanged={isChanged}>
        {documents.declaration
          ? "Ticked: the documents are genuine and belong to this business"
          : "Not ticked"}
      </Field>
    </DetailsSection>
  );
}

function SaathiDetails({
  saathi,
  isChanged,
}: {
  saathi: NonNullable<ReviewedApplication["saathi"]>;
  isChanged: Changed;
}) {
  return (
    <DetailsSection title="The Saathi">
      <Field label="Name" isChanged={isChanged}>
        {saathi.name ?? "—"}
      </Field>
      <Field label="Area" isChanged={isChanged}>
        <Place text={saathi.area} location={saathi.location} />
      </Field>
      <Field label="Travel radius" isChanged={isChanged}>
        {saathi.radiusKm ? radiusLabel(saathi.radiusKm) : "—"}
      </Field>
      <Field label="Work" isChanged={isChanged}>
        <Chips
          items={(saathi.workTypes ?? []).map(
            (work) => SAATHI_WORK_LABELS[work],
          )}
        />
      </Field>
      <Field label="Vehicle" isChanged={isChanged}>
        {saathi.vehicle ? SAATHI_VEHICLE_LABELS[saathi.vehicle] : "—"}
      </Field>
      <Field label="Times" isChanged={isChanged}>
        <Chips
          items={(saathi.times ?? []).map((time) => SAATHI_TIME_LABELS[time])}
        />
      </Field>
      <Field label="Days" isChanged={isChanged}>
        {weekdaysLabel(saathi.days)}
      </Field>
    </DetailsSection>
  );
}
