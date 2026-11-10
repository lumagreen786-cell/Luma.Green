import { v } from "convex/values";

export const privacyRequestKinds = [
  "access",
  "correction",
  "erasure",
  "grievance",
  "nomination",
  "withdrawal",
] as const;

export const vPrivacyRequestKind = v.union(
  ...privacyRequestKinds.map((kind) => v.literal(kind)),
);

export const vPrivacyRequestStatus = v.union(
  v.literal("received"),
  v.literal("responded"),
);
