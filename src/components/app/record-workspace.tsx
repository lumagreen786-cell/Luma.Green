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
  const listScroll = useRef(0);
  useEffect(() => {
    if (hasDetail) {
      const trigger = document.activeElement;
      if (
        trigger instanceof HTMLElement &&
        !detailRegion.current?.contains(trigger)
      ) {
        opener.current = trigger;
        if (!opener.current.closest("[data-record-detail]"))
          listScroll.current = window.scrollY;
      }
      detailRegion.current?.focus();
    } else {
      if (opener.current?.isConnected) {
        opener.current.focus({ preventScroll: true });
        window.scrollTo({ top: listScroll.current });
      }
      opener.current = null;
    }
  }, [hasDetail, detailKey]);
  return (
    <div
      className={cn(
        "record-sheet grid min-w-0 items-start gap-4 rounded-panel p-3 shadow-panel sm:p-5",
        detail && "lg:grid-cols-[minmax(16rem,0.8fr)_minmax(0,1.5fr)]",
      )}
    >
      <div
        className={cn(
          "min-w-0",
          detail &&
            "hidden lg:sticky lg:top-24 lg:block lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto lg:pe-2",
        )}
      >
        {list}
      </div>
      {detail ? (
        <section
          ref={detailRegion}
          data-record-detail
          tabIndex={-1}
          className="record-detail min-w-0 space-y-5 rounded-panel p-5 shadow-panel sm:p-6"
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
