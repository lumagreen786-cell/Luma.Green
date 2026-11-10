"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";

import { CityField } from "@/components/location/city-field";
import { ActionButton } from "@/components/ui/action-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { api } from "../../../../convex/_generated/api";
import { canonicalCity } from "../../../../convex/lib/geography";
import { apartmentCode } from "../../../../convex/lib/households";

export function ApartmentRoutes() {
  const routes = useQuery(api.adminCollections.apartmentRoutes);
  const publish = useMutation(api.adminCollections.publishApartmentRoute);
  const revoke = useMutation(api.adminCollections.revokeApartmentRoute);
  const [city, setCity] = useState("");
  const [code, setCode] = useState("");
  const [shop, setShop] = useState("");
  const [partner, setPartner] = useState("");
  const [reviewReference, setReference] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [busy, setBusy] = useState(false);
  const canonical = canonicalCity(city);
  const choices = useQuery(
    api.adminCollections.apartmentChoices,
    canonical ? { city: canonical } : "skip",
  );
  const selectedShop = choices?.shops.find((row) => row.id === shop);
  const selectedPartner = choices?.partners.find((row) => row.id === partner);
  const canPublish = Boolean(
    validUntil &&
    canonical &&
    selectedShop &&
    selectedPartner &&
    reviewReference.trim().length >= 5 &&
    apartmentCode(code),
  );

  async function run(work: () => Promise<unknown>) {
    setBusy(true);
    try {
      await work();
    } catch {
      toast.error(
        "The route could not be saved. Check the partner, collector and review dates. Sign in again if your session is older than ten minutes.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="space-y-4 border-t py-6"
      aria-labelledby="apartment-routes"
    >
      <h2 id="apartment-routes" className="text-lg font-semibold">
        Reviewed apartment collection routes
      </h2>
      <p className="max-w-prose text-sm text-muted-foreground">
        Check that the partner represents this community and that the collector
        agrees to serve it. Record the evidence reference and review expiry. The
        partner shares the community code directly with residents.
      </p>
      <form
        className="flex max-w-2xl flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (
            busy ||
            !canPublish ||
            !canonical ||
            !selectedShop ||
            !selectedPartner
          )
            return;
          void run(async () => {
            await publish({
              city: canonical,
              code,
              orgId: selectedShop.id,
              partnerId: selectedPartner.id,
              reviewReference,
              validUntil,
            });
            setCode("");
            setReference("");
            setValidUntil("");
            toast.success("Apartment collection route published.");
          });
        }}
      >
        <CityField
          value={city}
          labels={{
            city: "City",
            state: "State or union territory",
            choose: "Choose one",
            cityError: "Enter the city name.",
          }}
          onChange={(value) => {
            setCity(value);
            setShop("");
            setPartner("");
          }}
        />
        <Label htmlFor="apartment-route-code">Community code</Label>
        <Input
          id="apartment-route-code"
          required
          minLength={6}
          maxLength={32}
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
          }}
        />
        <Label htmlFor="apartment-route-partner">
          Approved society or community partner
        </Label>
        <Select
          value={partner}
          onValueChange={setPartner}
          disabled={!choices?.partners.length}
        >
          <SelectTrigger id="apartment-route-partner">
            <SelectValue placeholder="Choose partner" />
          </SelectTrigger>
          <SelectContent>
            {choices?.partners.map((row) => (
              <SelectItem key={row.id} value={row.id}>
                {row.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Label htmlFor="apartment-route-collector">Local pickup shop</Label>
        <Select
          value={shop}
          onValueChange={setShop}
          disabled={!choices?.shops.length}
        >
          <SelectTrigger id="apartment-route-collector">
            <SelectValue placeholder="Choose shop" />
          </SelectTrigger>
          <SelectContent>
            {choices?.shops.map((row) => (
              <SelectItem key={row.id} value={row.id}>
                {row.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {choices &&
        (choices.partners.length === 0 || choices.shops.length === 0) ? (
          <p role="status">
            An approved partner and a pickup shop in this city are required.
          </p>
        ) : null}
        <Label htmlFor="apartment-route-reference">
          Review evidence reference
        </Label>
        <Input
          id="apartment-route-reference"
          required
          maxLength={200}
          value={reviewReference}
          onChange={(event) => {
            setReference(event.target.value);
          }}
        />
        <Label htmlFor="apartment-route-expiry">Review valid through</Label>
        <Input
          id="apartment-route-expiry"
          type="date"
          required
          value={validUntil}
          onChange={(event) => {
            setValidUntil(event.target.value);
          }}
        />
        <ActionButton
          type="submit"
          className="self-start"
          label="Publish route"
          isDisabled={busy || !canPublish}
        />
      </form>
      {routes === undefined ? <p role="status">Loading routes…</p> : null}
      {routes?.length === 0 ? <p>No reviewed apartment routes.</p> : null}
      {routes?.length ? (
        <ul className="divide-y border-y">
          {routes.map((route) => (
            <li
              key={route.id}
              className="flex flex-wrap items-center gap-3 py-2"
            >
              <div className="min-w-0 flex-1 wrap-anywhere">
                <p className="font-medium">
                  {route.code} · {route.collector}
                </p>
                <p className="text-sm text-muted-foreground">
                  {route.city} · Valid through {route.validUntil}
                </p>
              </div>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void run(() => revoke({ id: route.id }))}
              >
                Revoke route
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
