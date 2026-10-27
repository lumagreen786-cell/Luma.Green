"use client";

import { useMutation, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { useFormat } from "@/components/app/format";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { api } from "../../../convex/_generated/api";
import type { TrackedBooking } from "./types";

function useReceiptAction() {
  const t = useTranslations("track.review");
  const [busy, setBusy] = useState(false);
  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
    } catch {
      toast.error(t("error"));
    } finally {
      setBusy(false);
    }
  }
  return { busy, run };
}

export function receiptStatusKey(state: TrackedBooking["receiptReview"]) {
  if (state?.paymentAcknowledgedAt) return "acknowledged";
  if (state?.decision === "disputed") return "disputed";
  return state?.decision === "accepted" ? "accepted" : "declaration";
}

function sharingStatusKey(grant: { active: boolean; accepted: boolean }) {
  if (!grant.active) return "ended";
  return grant.accepted ? "active" : "pending";
}

export function CollectionSharing({
  token,
  owner,
  open,
}: {
  token: string;
  owner: boolean;
  open: boolean;
}) {
  const t = useTranslations("track.review");
  const grants = useQuery(api.householdReceipts.sharing, { token });
  const invite = useMutation(api.householdReceipts.invite);
  const accept = useMutation(api.householdReceipts.acceptInvitation);
  const end = useMutation(api.householdReceipts.endInvitation);
  const handover = useMutation(api.householdReceipts.handover);
  const [phone, setPhone] = useState("");
  const [adult, setAdult] = useState(false);
  const [note, setNote] = useState("");
  const { busy, run } = useReceiptAction();
  return (
    <section
      className="flex flex-col gap-3 border-t pt-5"
      aria-label={t("sharing")}
    >
      <h2 className="text-lg font-semibold">{t("sharing")}</h2>
      {owner && open ? (
        <>
          <Label htmlFor="helper-phone">{t("phone")}</Label>
          <Input
            id="helper-phone"
            type="tel"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
            }}
          />
          <div className="flex items-start gap-2">
            <Checkbox
              id="helper-adult"
              checked={adult}
              onCheckedChange={(v) => {
                setAdult(v === true);
              }}
            />
            <Label htmlFor="helper-adult">{t("adult")}</Label>
          </div>
          <Button
            disabled={busy || !adult || !phone}
            onClick={() =>
              void run(() => invite({ token, phone, adultConfirmed: adult }))
            }
          >
            {t("invite")}
          </Button>
          <p className="text-sm text-muted-foreground">{t("shareNote")}</p>
        </>
      ) : null}
      {grants?.map((g) => (
        <div
          key={g.id}
          className="flex flex-wrap items-center gap-3 border-b py-3"
        >
          {g.phone ? <span dir="ltr">{g.phone}</span> : null}
          <span>{t(sharingStatusKey(g))}</span>
          {g.handoverNote ? (
            <p className="basis-full whitespace-pre-wrap">{g.handoverNote}</p>
          ) : null}
          {!owner && g.active && !g.accepted ? (
            <>
              <div className="flex items-start gap-2">
                <Checkbox
                  id="accept-adult"
                  checked={adult}
                  onCheckedChange={(v) => {
                    setAdult(v === true);
                  }}
                />
                <Label htmlFor="accept-adult">{t("adult")}</Label>
              </div>
              <Button
                disabled={busy || !adult}
                onClick={() =>
                  void run(() => accept({ token, adultConfirmed: adult }))
                }
              >
                {t("accept")}
              </Button>
            </>
          ) : null}
          {g.active && (owner || g.accepted) ? (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void run(() => end({ invitationId: g.id }))}
            >
              {t(owner ? "revoke" : "leave")}
            </Button>
          ) : null}
          {!owner && g.active && g.accepted && !g.handoverNote ? (
            <div className="flex basis-full flex-col gap-2">
              <Label htmlFor="handover-note">{t("handover")}</Label>
              <Textarea
                id="handover-note"
                maxLength={500}
                value={note}
                onChange={(e) => {
                  setNote(e.target.value);
                }}
              />
              <Button
                disabled={busy || !note.trim()}
                onClick={() => void run(() => handover({ token, note }))}
              >
                {t("save")}
              </Button>
            </div>
          ) : null}
        </div>
      ))}
    </section>
  );
}

export function ReceiptReview({ booking }: { booking: TrackedBooking }) {
  const t = useTranslations("track.review");
  const review = useMutation(api.householdReceipts.review);
  const acknowledge = useMutation(api.householdReceipts.acknowledgePayment);
  const [note, setNote] = useState("");
  const [rejected, setRejected] = useState<number[]>([]);
  const { busy, run } = useReceiptAction();
  const format = useFormat();
  const history = useQuery(
    api.householdReceipts.history,
    booking.isMine && booking.receipt ? { token: booking.token } : "skip",
  );
  const receipt = booking.receipt;
  if (!receipt || !booking.isMine) return null;
  const state = booking.receiptReview;
  return (
    <section
      className="flex flex-col gap-3 border-t pt-5"
      aria-label={t("title")}
    >
      <h2 className="text-lg font-semibold">{t("title")}</h2>
      <p role="status">{t(receiptStatusKey(state))}</p>
      {state ? (
        <>
          <p>
            {t("acceptedTotal", {
              weight: format.weight(state.acceptedGrams),
              amount: format.money(state.acceptedPaise),
            })}
          </p>
          {state.rejectedLineIndexes.map((index) => {
            const line = receipt.lines[index];
            return (
              <p key={index}>
                {t("rejectLine", {
                  material: format.material(
                    line.material.names,
                    line.material.code,
                  ),
                })}
              </p>
            );
          })}
        </>
      ) : null}
      {history?.map((event) => (
        <div key={event.id} className="border-s-2 ps-3 text-sm">
          <p>
            {t(
              event.decision === "payment_acknowledged"
                ? "acknowledged"
                : event.decision,
            )}{" "}
            · {format.dateTime(event.createdAt)}
          </p>
          {event.note ? (
            <p className="whitespace-pre-wrap">{event.note}</p>
          ) : null}
        </div>
      ))}
      {state ? null : (
        <>
          {receipt.lines.map((line, index) => (
            <div key={line.material.code} className="flex items-center gap-2">
              <Checkbox
                id={`reject-${String(index)}`}
                checked={rejected.includes(index)}
                onCheckedChange={(value) => {
                  setRejected((current) =>
                    value === true
                      ? [...current, index]
                      : current.filter((i) => i !== index),
                  );
                }}
              />
              <Label htmlFor={`reject-${String(index)}`}>
                {t("rejectLine", {
                  material: format.material(
                    line.material.names,
                    line.material.code,
                  ),
                })}
              </Label>
            </div>
          ))}
          <Label htmlFor="receipt-note">{t("note")}</Label>
          <Textarea
            id="receipt-note"
            maxLength={500}
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy || rejected.length > 0}
              onClick={() =>
                void run(() =>
                  review({
                    token: booking.token,
                    receiptVersion: receipt.paidAt,
                    decision: "accepted",
                    rejectedLineIndexes: [],
                  }),
                )
              }
            >
              {t("accept")}
            </Button>
            <Button
              variant="outline"
              disabled={busy || !note.trim()}
              onClick={() =>
                void run(() =>
                  review({
                    token: booking.token,
                    receiptVersion: receipt.paidAt,
                    decision: "disputed",
                    rejectedLineIndexes: rejected,
                    note,
                  }),
                )
              }
            >
              {t("dispute")}
            </Button>
          </div>
        </>
      )}
      {state?.decision === "accepted" && !state.paymentAcknowledgedAt ? (
        <Button
          disabled={busy}
          onClick={() =>
            void run(() =>
              acknowledge({
                token: booking.token,
                receiptVersion: receipt.paidAt,
              }),
            )
          }
        >
          {t("acknowledge")}
        </Button>
      ) : null}
    </section>
  );
}
