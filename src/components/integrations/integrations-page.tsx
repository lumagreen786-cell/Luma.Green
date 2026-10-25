"use client";

import { useAction, useMutation, useQuery } from "convex/react";

import { useWorkspace } from "@/components/app/use-workspace";
import { QueryBoundary } from "@/components/insights/query-boundary";

import { api } from "../../../convex/_generated/api";
import { ApiAccess } from "./api-access";

function ConnectedAccess() {
  const workspace = useWorkspace();
  const data = useQuery(
    api.integrations.listKeys,
    workspace?.kind === "org" ? {} : "skip",
  );
  const createKey = useAction(api.integrations.createKey);
  const revokeKey = useMutation(api.integrations.revokeKey);
  return (
    <ApiAccess
      key={
        workspace?.kind === "org"
          ? `${workspace.org.id}:${workspace.role}`
          : workspace?.kind
      }
      data={
        workspace?.kind === "saathi" ? { canManage: false, keys: [] } : data
      }
      onCreate={createKey}
      onRevoke={(keyId) => revokeKey({ keyId })}
    />
  );
}

export function IntegrationsPage() {
  return (
    <QueryBoundary>
      <ConnectedAccess />
    </QueryBoundary>
  );
}
