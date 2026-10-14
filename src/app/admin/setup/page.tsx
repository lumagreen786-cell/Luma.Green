import type { Metadata } from "next";

import { AdminSetup } from "@/components/admin/admin-setup";
import { AdminAuthShell } from "@/components/admin/auth-shell";

export const metadata: Metadata = { title: "Set up" };

/** Run once per deployment — docs/architecture/auth.md#the-admin. */
export default function AdminSetupPage() {
  return (
    <AdminAuthShell
      title="Set up the admin account"
      description="Once per deployment. Verify your phone, add your details, then connect an authenticator app."
    >
      <AdminSetup />
    </AdminAuthShell>
  );
}
