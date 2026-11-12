"use client";

import { useMutation, usePaginatedQuery } from "convex/react";
import { type ComponentProps, useId, useState } from "react";

import { adminErrorMessage } from "@/components/admin/convex-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fixedDecimalInput } from "@/lib/number-input";

import { api } from "../../../convex/_generated/api";
import {
  type SubscriptionPlan,
  subscriptionPlans,
} from "../../../convex/lib/subscriptions";

const PLAN_LABELS = {
  trader: "Trader Plus",
  centre: "Centre",
  yard: "Yard",
  processor: "Processor",
  recycler: "Recycler / Manufacturer",
  enterprise: "Enterprise",
  institution: "Institution Reporting",
} satisfies Record<SubscriptionPlan, string>;

const ERRORS = {
  DRAFT_INVOICE_CONFLICT:
    "This site already has a different draft for the period.",
  DRAFT_PERIOD_OPEN: "Choose a completed billing month.",
  DRAFT_PRICE_BOOK_CONFLICT:
    "That price book version is immutable. Use a new version.",
  DRAFT_PRICE_BOOK_NOT_FOUND: "Check the version, effective month and plan.",
  DRAFT_USAGE_LIMIT: "This period has too many recorded orders for one draft.",
  RECENT_AUTH_REQUIRED: "Sign in again before saving a draft billing record.",
};

const SELECT_CLASS =
  "min-h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm";

function formText(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function BillingField({
  label,
  ...props
}: ComponentProps<typeof Input> & { label: string }) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...props} />
    </div>
  );
}

function useDraftWrite() {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  async function save(operation: () => Promise<unknown>, message: string) {
    setIsSaving(true);
    setError(undefined);
    setNotice(undefined);
    try {
      await operation();
      setNotice(message);
    } catch (error_) {
      setError(adminErrorMessage(error_, ERRORS));
    } finally {
      setIsSaving(false);
    }
  }
  function invalid(message: string) {
    setNotice(undefined);
    setError(message);
  }
  return { isSaving, error, notice, save, invalid };
}

function DraftPriceBookForm() {
  const record = useMutation(api.businessSubscriptions.recordDraftPriceBook);
  const write = useDraftWrite();
  return (
    <form
      className="flex min-w-0 flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const plans: { plan: SubscriptionPlan; monthlyPaise: number }[] = [];
        for (const { id } of subscriptionPlans) {
          const value = formText(form, id);
          if (!value) continue;
          const monthlyPaise = fixedDecimalInput(value, 2);
          if (monthlyPaise === null) {
            write.invalid(
              "Enter plan prices in rupees with up to two decimal places.",
            );
            return;
          }
          plans.push({ plan: id, monthlyPaise });
        }
        const feeText = formText(form, "feeBps");
        const feeBps = Number(feeText);
        const feeCapPaise = fixedDecimalInput(formText(form, "feeCap"), 2);
        if (
          feeCapPaise === null ||
          plans.length === 0 ||
          feeBps > 10_000 ||
          !/^\d{1,5}$/.test(feeText)
        ) {
          write.invalid(
            "Enter at least one plan price, a fee from 0 to 10,000 basis points and a cap in rupees.",
          );
          return;
        }
        void write.save(
          () =>
            record({
              version: formText(form, "version"),
              startsMonth: formText(form, "startsMonth"),
              plans,
              feeBps,
              feeCapPaise,
            }),
          "Draft price book saved.",
        );
      }}
    >
      <h3 className="font-medium">Draft price book</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <BillingField
          label="Price book version"
          name="version"
          required
          maxLength={64}
        />
        <BillingField
          label="First billing month"
          name="startsMonth"
          type="month"
          required
        />
        <BillingField
          label="Order fee in basis points"
          name="feeBps"
          inputMode="numeric"
          required
        />
        <BillingField
          label="Maximum fee per order in rupees"
          name="feeCap"
          inputMode="decimal"
          required
        />
      </div>
      <fieldset className="grid min-w-0 gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-sm text-muted-foreground">
          Monthly plan prices in rupees
        </legend>
        {subscriptionPlans.map(({ id }) => (
          <BillingField
            key={id}
            label={PLAN_LABELS[id]}
            name={id}
            inputMode="decimal"
          />
        ))}
      </fieldset>
      {write.error ? (
        <p role="alert" className="text-sm text-destructive">
          {write.error}
        </p>
      ) : null}
      {write.notice ? (
        <p role="status" className="text-sm">
          {write.notice}
        </p>
      ) : null}
      <Button type="submit" className="self-start" disabled={write.isSaving}>
        Save draft price book
      </Button>
    </form>
  );
}

function DraftInvoiceForm() {
  const generate = useMutation(api.businessSubscriptions.generateDraftInvoice);
  const sites = usePaginatedQuery(
    api.businessSubscriptions.draftSitesForAdmin,
    {},
    {
      initialNumItems: 20,
    },
  );
  const write = useDraftWrite();
  const siteId = useId();
  const planId = useId();
  return (
    <form
      className="flex min-w-0 flex-col gap-4 border-t pt-6"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const site = sites.results.find(
          ({ orgId }) => orgId === formText(form, "orgId"),
        );
        const plan = subscriptionPlans.find(
          ({ id }) => id === formText(form, "plan"),
        );
        if (!site || !plan) {
          write.invalid("Select a business site and a draft plan.");
          return;
        }
        void write.save(
          () =>
            generate({
              orgId: site.orgId,
              month: formText(form, "month"),
              priceBookVersion: formText(form, "priceBookVersion"),
              plan: plan.id,
            }),
          "Draft invoice saved to the business site.",
        );
      }}
    >
      <h3 className="font-medium">Draft invoice</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor={siteId}>Business site</Label>
          <select
            id={siteId}
            name="orgId"
            className={SELECT_CLASS}
            required
            defaultValue=""
          >
            <option value="" disabled>
              Select a business site
            </option>
            {sites.results.map(({ orgId, name, city }) => (
              <option key={orgId} value={orgId}>
                {name} · {city}
              </option>
            ))}
          </select>
          {sites.status === "CanLoadMore" ? (
            <Button
              type="button"
              variant="outline"
              className="self-start"
              onClick={() => {
                sites.loadMore(20);
              }}
            >
              Load more sites
            </Button>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor={planId}>Draft plan</Label>
          <select
            id={planId}
            name="plan"
            className={SELECT_CLASS}
            required
            defaultValue=""
          >
            <option value="" disabled>
              Select a draft plan
            </option>
            {subscriptionPlans.map(({ id }) => (
              <option key={id} value={id}>
                {PLAN_LABELS[id]}
              </option>
            ))}
          </select>
        </div>
        <BillingField
          label="Price book for invoice"
          name="priceBookVersion"
          required
          maxLength={64}
        />
        <BillingField
          label="Completed billing month"
          name="month"
          type="month"
          required
        />
      </div>
      {write.error ? (
        <p role="alert" className="text-sm text-destructive">
          {write.error}
        </p>
      ) : null}
      {write.notice ? (
        <p role="status" className="text-sm">
          {write.notice}
        </p>
      ) : null}
      <Button type="submit" className="self-start" disabled={write.isSaving}>
        Generate draft invoice
      </Button>
    </form>
  );
}

export function DraftBillingSetup() {
  return (
    <section
      aria-labelledby="draft-billing-setup"
      className="mx-auto mt-6 flex w-full max-w-5xl flex-col gap-6 rounded-panel bg-card p-5 text-card-foreground sm:p-6"
    >
      <div className="space-y-2">
        <h2 id="draft-billing-setup" className="text-xl font-semibold">
          Draft billing
        </h2>
        <p className="text-sm text-muted-foreground">
          Drafts show a subtotal before tax. Saving a draft leaves payments and
          site access unchanged.
        </p>
      </div>
      <DraftPriceBookForm />
      <DraftInvoiceForm />
    </section>
  );
}
