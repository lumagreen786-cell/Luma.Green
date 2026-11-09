import type { Metadata } from "next";

import { PrivacyRequestQueue } from "@/components/admin/support/privacy-request-queue";
import { SupportInbox } from "@/components/admin/support/support-inbox";

export const metadata: Metadata = { title: "Support" };

export default function SupportPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <SupportInbox />
      <PrivacyRequestQueue />
    </div>
  );
}
