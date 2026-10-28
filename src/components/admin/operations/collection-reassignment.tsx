"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";

import { ActionButton } from "@/components/ui/action-button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

export function CollectionReassignment() {
  const data = useQuery(api.adminCollections.board);
  const reassign = useMutation(api.adminCollections.reassign);
  const [bookingId, setBookingId] = useState("");
  const [orgId, setOrgId] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  if (!data) return <p role="status">Loading collections…</p>;
  return (
    <form
      className="flex max-w-2xl flex-col gap-4 border-t py-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (busy || !bookingId || !orgId || reason.trim().length < 5) return;
        setBusy(true);
        void reassign({
          bookingId: bookingId as Id<"bookings">,
          orgId: orgId as Id<"orgs">,
          reason,
        })
          .then(() => {
            toast.success("The new shop has an offer to accept.");
            setBookingId("");
            setOrgId("");
            setReason("");
          })
          .catch(() => {
            toast.error(
              "The offer could not be moved. Check the shop, time and eligibility. Your reason is retained.",
            );
          })
          .finally(() => {
            setBusy(false);
          });
      }}
    >
      <h2 className="text-lg font-semibold">Move a collection offer</h2>
      <p className="text-sm text-muted-foreground">
        Choose an eligible shop and record why. The shop must accept the new
        offer. The latest 50 requests and 50 accepted pickups are shown.
      </p>
      <Label htmlFor="reassign-booking">Collection</Label>
      <Select value={bookingId} onValueChange={setBookingId}>
        <SelectTrigger id="reassign-booking">
          <SelectValue placeholder="Choose collection" />
        </SelectTrigger>
        <SelectContent>
          {data.bookings.map((row) => (
            <SelectItem key={row.id} value={row.id}>
              {row.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Label htmlFor="reassign-shop">New collection shop</Label>
      <Select value={orgId} onValueChange={setOrgId}>
        <SelectTrigger id="reassign-shop">
          <SelectValue placeholder="Choose shop" />
        </SelectTrigger>
        <SelectContent>
          {data.shops.map((row) => (
            <SelectItem key={row.id} value={row.id}>
              {row.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Label htmlFor="reassign-reason">Reason</Label>
      <Textarea
        id="reassign-reason"
        value={reason}
        onChange={(event) => {
          setReason(event.target.value);
        }}
        minLength={5}
        maxLength={500}
        required
      />
      <ActionButton
        type="submit"
        label={busy ? "Moving offer…" : "Send new offer"}
        isDisabled={busy || !bookingId || !orgId || reason.trim().length < 5}
      />
    </form>
  );
}
