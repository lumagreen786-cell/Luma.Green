"use client";

import {
  useAction,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { api } from "../../../convex/_generated/api";
import { formatWhen } from "./format";
import { PaymentLifecycleSetup } from "./payment-lifecycle";

type Mode = "sandbox" | "live";
type Organisation = FunctionReturnType<
  typeof api.cashfreePayments.vendorsForAdmin
>["page"][number];

function configurationMessage(
  configuration: { mode: Mode | null } | undefined,
) {
  if (configuration === undefined) return "Checking backend configuration…";
  return configuration.mode === null
    ? "Provider credentials are not configured."
    : `Configured provider mode: ${configuration.mode}.`;
}

function errorMessage(error: unknown): string {
  const code =
    error instanceof ConvexError && typeof error.data === "string"
      ? error.data
      : "";
  const messages: Record<string, string> = {
    VENDOR_MAPPING_FROZEN:
      "This business or vendor already has a different fixed mapping. Check the existing reference.",
    INVALID_VENDOR:
      "Use 1–100 letters, numbers or underscores for the vendor reference.",
    NO_BUSINESS:
      "This business is unavailable or suspended. Refresh and check its approval.",
    PAYMENT_VENDOR_UNVERIFIED:
      "Cashfree did not confirm this vendor. Check the reference and provider account.",
    GATEWAY_REQUIRED:
      "Matching Cashfree credentials are not configured. Add them on the backend before checking the vendor.",
  };
  return (
    messages[code] ??
    "The request could not be completed. Check the setup and try again."
  );
}

export function PaymentSetup() {
  const configuration = useQuery(
    api.cashfreePayments.setupConfigurationForAdmin,
  );
  const { results, status, loadMore } = usePaginatedQuery(
    api.cashfreePayments.vendorsForAdmin,
    {},
    { initialNumItems: 20 },
  );
  const verify = useAction(api.cashfreeActions.verifyVendorForAdmin);
  const [mode, setMode] = useState<Mode>("sandbox");
  const [selected, setSelected] = useState<Organisation | null>(null);
  const [checking, setChecking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function checkVendor(org: Organisation) {
    setChecking(org.orgId);
    setError(null);
    setNotice(null);
    try {
      await verify({ orgId: org.orgId, mode });
      setNotice(
        "Provider lookup finished. Read the returned status below; this does not enable live payments.",
      );
    } catch (error_) {
      setError(errorMessage(error_));
    } finally {
      setChecking(null);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-2 pb-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Payment setup
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Connect each approved business to its existing Cashfree Easy Split
          vendor. Cashfree owns verification. A saved reference is not approval
          or a payment.
        </p>
      </header>
      <section
        aria-labelledby="payment-release-boundary"
        className="space-y-2 border-s-2 border-primary ps-4 text-sm"
      >
        <h2 id="payment-release-boundary" className="font-semibold">
          Payment activation requires approved setup
        </h2>
        <p className="max-w-2xl text-muted-foreground">
          Vendor references and approved terms do not prove payment. Server
          activation and provider verification control checkout. Refund requests
          and reconciliation use the provider; there is no manual paid flag.
        </p>
        <p>{configurationMessage(configuration)}</p>
      </section>
      <Tabs
        value={mode}
        onValueChange={(value) => {
          if (!(value === "sandbox" || value === "live")) {
            return;
          }

          setMode(value);
          setError(null);
          setNotice(null);
        }}
      >
        <TabsList variant="line" aria-label="Payment environment">
          <TabsTrigger value="sandbox" disabled={checking !== null}>
            Sandbox
          </TabsTrigger>
          <TabsTrigger value="live" disabled={checking !== null}>
            Live references
          </TabsTrigger>
        </TabsList>
      </Tabs>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="text-sm">
          {notice}
        </p>
      ) : null}
      {status === "LoadingFirstPage" ? <Skeleton className="h-32" /> : null}
      {status !== "LoadingFirstPage" && results.length === 0 ? (
        <p className="py-6 text-muted-foreground">
          No businesses yet. Approve a business application before adding its
          vendor reference.
        </p>
      ) : null}
      {status !== "LoadingFirstPage" && results.length > 0 ? (
        <ul className="divide-y rounded-xl bg-card px-5 sm:px-6">
          {results.map((org) => {
            const vendor = org.vendors.find((item) => item.mode === mode);
            return (
              <li
                key={org.orgId}
                className="flex flex-wrap items-start justify-between gap-4 py-5"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <h2 className="font-semibold break-words">{org.name}</h2>
                  {org.active ? null : (
                    <p className="text-sm text-destructive">
                      Business suspended
                    </p>
                  )}
                  {vendor ? (
                    <>
                      <p className="text-sm break-all">
                        Vendor reference: {vendor.vendorId}
                      </p>
                      <p className="text-sm">
                        Provider status:{" "}
                        <strong>{vendor.providerStatus}</strong>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {vendor.checkedAt === 0
                          ? "No provider lookup has completed."
                          : `Last checked: ${formatWhen(vendor.checkedAt)} IST. Status can change; checkout checks it again.`}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No vendor reference for this environment.
                    </p>
                  )}
                </div>
                {vendor ? (
                  <Button
                    variant="outline"
                    disabled={
                      checking !== null ||
                      !org.active ||
                      configuration?.mode !== mode
                    }
                    onClick={() => {
                      void checkVendor(org);
                    }}
                  >
                    {checking === org.orgId
                      ? "Checking…"
                      : "Check with Cashfree"}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    disabled={!org.active || checking !== null}
                    onClick={() => {
                      setSelected(org);
                      setError(null);
                      setNotice(null);
                    }}
                  >
                    Add vendor reference
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
      {status === "CanLoadMore" || status === "LoadingMore" ? (
        <Button
          variant="outline"
          className="self-start"
          disabled={status === "LoadingMore"}
          onClick={() => {
            loadMore(20);
          }}
        >
          {status === "LoadingMore" ? "Loading…" : "Load more businesses"}
        </Button>
      ) : null}
      <PaymentLifecycleSetup />
      {selected ? (
        <VendorDialog
          key={`${selected.orgId}-${mode}`}
          org={selected}
          mode={mode}
          close={() => {
            setSelected(null);
          }}
        />
      ) : null}
    </div>
  );
}

function VendorDialog({
  org,
  mode,
  close,
}: {
  org: Organisation;
  mode: Mode;
  close: () => void;
}) {
  const register = useMutation(api.cashfreePayments.registerVendorForAdmin);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    setBusy(true);
    setError(null);
    try {
      await register({ orgId: org.orgId, mode, vendorId: value.trim() });
      close();
    } catch (error_) {
      setError(errorMessage(error_));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) close();
      }}
    >
      <DialogContent showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle>Add vendor reference</DialogTitle>
          <DialogDescription>
            {org.name} · {mode}. This mapping is fixed after saving. Confirm
            that the reference belongs to this business in the matching Cashfree
            environment.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="vendor-reference">Cashfree vendor reference</Label>
            <Input
              id="vendor-reference"
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
              }}
              maxLength={100}
              pattern="[A-Za-z0-9_]{1,100}"
              autoComplete="off"
              required
              disabled={busy}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Do not enter an API key, bank account or identity document. Saving
            leaves the provider status unverified.
          </p>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={close}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={busy || !/^\w{1,100}$/.test(value.trim())}
            >
              {busy ? "Saving…" : "Save fixed reference"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
