import type { Metadata } from "next";

import { DraftBillingSetup } from "@/components/admin/draft-billing-setup";
import { PaymentSetup } from "@/components/admin/payment-setup";

export const metadata: Metadata = { title: "Payment setup" };

export default function PaymentsPage() {
  return (
    <>
      <PaymentSetup />
      <DraftBillingSetup />
    </>
  );
}
