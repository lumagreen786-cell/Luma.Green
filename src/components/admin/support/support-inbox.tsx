"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { CheckCheckIcon, InboxIcon, PhoneIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  AppPageHeader,
  EmptyState,
  ListSkeleton,
  StatusPill,
} from "@/components/app/page-parts";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { api } from "../../../../convex/_generated/api";
import { adminErrorMessage } from "../convex-error";
import { formatPhone, formatWhen } from "../format";
import { SUPPORT_ROLE_LABELS, SUPPORT_TOPIC_LABELS } from "../labels";

type SupportRequest = FunctionReturnType<typeof api.support.list>[number];

const FILTERS = ["open", "answered", "all"] as const;
type Filter = (typeof FILTERS)[number];

function isFilter(value: string): value is Filter {
  return (FILTERS as readonly string[]).includes(value);
}

const EMPTY: Record<Filter, { title: string; body: string }> = {
  open: {
    title: "No open requests",
    body: "Messages from the help centre and the solar page land here.",
  },
  answered: {
    title: "Nothing answered yet",
    body: "Requests you mark answered move here.",
  },
  all: {
    title: "No messages yet",
    body: "Messages from the help centre and the solar page land here.",
  },
};

/** `/admin/support`: the help-centre inbox. Call back, then mark answered. */
export function SupportInbox() {
  const requests = useQuery(api.support.list);
  const [filter, setFilter] = useState<Filter>("open");
  const openCount = requests?.filter((item) => item.status === "open").length;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 lg:gap-8">
      <AppPageHeader title="Support" lead="Call back, then mark answered." />
      <Tabs
        value={filter}
        onValueChange={(value) => {
          if (isFilter(value)) setFilter(value);
        }}
      >
        <TabsList>
          <TabsTrigger value="open" className="tabular-nums">
            {openCount === undefined ? "Open" : `Open (${String(openCount)})`}
          </TabsTrigger>
          <TabsTrigger value="answered">Answered</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
        {FILTERS.map((value) => (
          <TabsContent key={value} value={value}>
            <RequestList
              filter={value}
              requests={requests?.filter(
                (item) => value === "all" || item.status === value,
              )}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function RequestList({
  filter,
  requests,
}: {
  filter: Filter;
  requests: SupportRequest[] | undefined;
}) {
  if (requests === undefined) return <ListSkeleton rows={2} />;
  if (requests.length === 0) {
    return (
      <EmptyState
        icon={InboxIcon}
        title={EMPTY[filter].title}
        body={EMPTY[filter].body}
      />
    );
  }
  return (
    <ul className="flex flex-col divide-y border-b">
      {requests.map((request) => (
        <li key={request.id}>
          <RequestRow request={request} />
        </li>
      ))}
    </ul>
  );
}

function RequestRow({ request }: { request: SupportRequest }) {
  const markAnswered = useMutation(api.support.markAnswered);
  const triage = useMutation(api.support.triage);
  const [showUpdates, setShowUpdates] = useState(false);
  const updates = useQuery(
    api.support.updates,
    showUpdates ? { id: request.id } : "skip",
  );
  const [isBusy, setIsBusy] = useState(false);
  const isOpen = request.status === "open";
  const headingId = `request-${request.id}`;

  async function answer() {
    setIsBusy(true);
    try {
      await markAnswered({ id: request.id });
      toast.success(`Marked ${request.name}'s message answered.`);
    } catch (error) {
      toast.error(
        adminErrorMessage(error, {
          NOT_FOUND: "This message isn't there any more.",
        }),
      );
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <article
      aria-labelledby={headingId}
      className="flex min-w-0 flex-col gap-4 py-5 sm:py-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id={headingId} className="font-semibold break-words">
            {request.name}
          </h2>
          <p className="text-sm text-muted-foreground">
            {SUPPORT_ROLE_LABELS[request.role] ?? request.role} · Sent{" "}
            {formatWhen(request.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <StatusPill tone="neutral">
            {SUPPORT_TOPIC_LABELS[request.topic] ?? request.topic}
          </StatusPill>
          <StatusPill tone={isOpen ? "warn" : "good"}>
            {isOpen ? "Open" : "Answered"}
          </StatusPill>
        </div>
      </div>
      <p className="text-sm">
        Team: {request.team ?? "operations"} ·{" "}
        {request.acknowledgedAt ? "Acknowledged" : "Needs acknowledgement"}
        {request.escalatedAt ? " · Escalated" : ""}
      </p>
      {request.source ? (
        <p className="text-sm">Linked record: {request.source.kind}</p>
      ) : null}
      {isOpen ? (
        <section className="flex flex-wrap gap-2">
          {(["operations", "accounts", "reviewer"] as const).map((team) => (
            <Button
              key={team}
              variant="outline"
              onClick={() => {
                void triage({
                  id: request.id,
                  team,
                  escalate: team === "accounts",
                }).catch(() =>
                  toast.error("Could not update support request."),
                );
              }}
            >
              Acknowledge · {team}
            </Button>
          ))}
        </section>
      ) : null}
      <p className="max-w-3xl text-sm leading-relaxed break-words whitespace-pre-line">
        {request.message}
      </p>
      <Button
        variant="outline"
        onClick={() => {
          setShowUpdates((value) => !value);
        }}
      >
        View updates
      </Button>
      {showUpdates ? (
        <section className="flex flex-col gap-2">
          {updates?.map((update, index) => (
            <p key={index} className="text-sm">
              {update.team} · {update.urgent ? "Urgent" : "Update"} ·{" "}
              {formatWhen(update.createdAt)}: {update.message}
            </p>
          ))}
        </section>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm" className="min-h-11">
          <a href={`tel:${request.phone}`}>
            <PhoneIcon aria-hidden />
            Call {formatPhone(request.phone)}
          </a>
        </Button>
        {isOpen ? (
          <Button
            size="sm"
            className="min-h-11"
            disabled={isBusy}
            onClick={() => {
              void answer();
            }}
          >
            <CheckCheckIcon aria-hidden />
            {isBusy ? "Marking…" : "Mark answered"}
          </Button>
        ) : null}
      </div>
    </article>
  );
}
