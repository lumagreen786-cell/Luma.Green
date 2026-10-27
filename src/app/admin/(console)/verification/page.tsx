import type { Metadata } from "next";

import { StakeholderQueue } from "@/components/admin/verification/stakeholder-queue";
import { VerificationWorkspace } from "@/components/admin/verification/verification-workspace";

export const metadata: Metadata = { title: "Verification" };

export default function VerificationPage() {
  return (
    <div className="flex flex-col gap-10">
      <VerificationWorkspace />
      <StakeholderQueue />
    </div>
  );
}
