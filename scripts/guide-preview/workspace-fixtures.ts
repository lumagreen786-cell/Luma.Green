import type { FunctionReturnType } from "convex/server";

import type { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { NOW } from "./fixtures";

/** Isolated display records, never real memberships or invitation tokens. */
export const workspaceListFixture: FunctionReturnType<
  typeof api.workspace.list
> = [
  {
    org: {
      id: "guide-workspace-yard" as Id<"orgs">,
      kind: "yard",
      name: "Demo sorting yard",
      slug: "demo-sorting-yard",
      area: "Yeshwanthpur",
      city: "Bengaluru",
      offersPickup: false,
      gstin: undefined,
    },
    role: "owner",
    selected: true,
  },
  {
    org: {
      id: "guide-workspace-shop" as Id<"orgs">,
      kind: "kabadiwala",
      name: "Demo collection shop",
      slug: "demo-collection-shop",
      area: "Yeshwanthpur",
      city: "Bengaluru",
      offersPickup: true,
      gstin: undefined,
    },
    role: "viewer",
    selected: false,
  },
];

export const workspaceTeamFixture: FunctionReturnType<
  typeof api.workspace.team
> = {
  role: "owner",
  members: [
    {
      id: "guide-membership-owner" as Id<"memberships">,
      profileId: "guide-profile-owner" as Id<"profiles">,
      name: "Demo workspace owner",
      role: "owner",
      isSelf: true,
      canManage: true,
    },
    {
      id: "guide-membership-member" as Id<"memberships">,
      profileId: "guide-profile-member" as Id<"profiles">,
      name: "Demo team member",
      role: "member",
      isSelf: false,
      canManage: true,
    },
  ],
  invitations: [
    {
      id: "guide-invitation-member" as Id<"workspaceInvitations">,
      email: "demo-colleague@example.test",
      role: "member",
      expiresAt: NOW + 86_400_000,
      delivery: "pending",
      canManage: true,
    },
  ],
};
