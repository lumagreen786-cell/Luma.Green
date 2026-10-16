"use client";

import { ArrowLeftIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Keep a chosen record beside its list on wide screens, and give phones one
 * focused view with an explicit way back. The caller owns selection and data. */
export function RecordWorkspace({
  list,
  detail,
  detailKey,
  onBack,
}: {
  list: ReactNode;
  detail?: ReactNode;
  detailKey?: string;
  onBack: () => void;
}) {
  const common = useTranslations("common");
  const detailRegion = useRef<HTMLElement>(null);
  const hasDetail = Boolean(detail);
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (hasDetail) {
      const trigger = document.activeElement;
      if (
        trigger instanceof HTMLElement &&
        !detailRegion.current?.contains(trigger)
      ) {
        opener.current = trigger;
      }
      detailRegion.current?.focus();
    } else {
      if (opener.current?.isConnected) opener.current.focus();
      opener.current = null;
    }
  }, [hasDetail, detailKey]);
  return (
    <div
      className={cn(
        "grid min-w-0 gap-8",
        detail && "lg:grid-cols-[18rem_minmax(0,1fr)]",
      )}
    >
      <div className={cn("min-w-0", detail && "hidden lg:block")}>{list}</div>
      {detail ? (
        <section
          ref={detailRegion}
          tabIndex={-1}
          className="min-w-0 space-y-5 lg:border-s lg:ps-8"
        >
          <Button variant="ghost" onClick={onBack} className="px-0">
            <ArrowLeftIcon aria-hidden className="size-4 rtl:rotate-180" />
            {common("close")}
          </Button>
          {detail}
        </section>
      ) : null}
    </div>
  );
}
