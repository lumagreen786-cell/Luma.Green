import type { ReactNode } from "react";

import { HouseholdNavigation } from "@/components/sell/household-navigation";

export default function SellLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <HouseholdNavigation />
      {children}
    </>
  );
}
