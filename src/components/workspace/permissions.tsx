"use client";

import { createContext, type ReactNode, useContext } from "react";

import type { WorkspaceRole } from "../../../convex/lib/workspaceRoles";

const PermissionContext = createContext<WorkspaceRole | null>(null);
export function WorkspacePermissions({
  membershipRole,
  children,
}: {
  membershipRole: WorkspaceRole | null;
  children: ReactNode;
}) {
  return (
    <PermissionContext value={membershipRole}>{children}</PermissionContext>
  );
}
/** Controls default to read-only until the shell has a current workspace role. */
export function useCanOperate() {
  const role = useContext(PermissionContext);
  return role !== null && ["owner", "admin", "member"].includes(role);
}
/** Commercial settings belong to the owner and designated workspace admins. */
export function useCanManage() {
  const role = useContext(PermissionContext);
  return role === "owner" || role === "admin";
}
