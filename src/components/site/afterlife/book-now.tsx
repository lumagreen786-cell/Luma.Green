import { getTranslations } from "next-intl/server";

import { WhatsAppIcon } from "@/components/afterlife/whatsapp-icon";
import { Button } from "@/components/ui/button";
import { clientEnv } from "@/lib/env";
import { whatsappBookingUrl } from "@/lib/whatsapp";
export async function BookNow() {
  const t = await getTranslations("afterlife");
  const href = whatsappBookingUrl(
    clientEnv.NEXT_PUBLIC_WHATSAPP_NUMBER,
    t("bookingMessage"),
  );
  return (
    <div className="max-w-full min-w-0 space-y-2">
      <Button
        asChild={Boolean(href)}
        disabled={!href}
        size="lg"
        className="h-auto min-h-13 max-w-full gap-3 rounded-2xl px-7 py-3 whitespace-normal"
      >
        {href ? (
          <a href={href}>
            <WhatsAppIcon className="size-5" />
            <span className="min-w-0 [overflow-wrap:anywhere]">
              {t("bookNow")}
            </span>
          </a>
        ) : (
          <span className="inline-flex min-w-0 items-center gap-3">
            <WhatsAppIcon className="size-5" />
            <span className="min-w-0 [overflow-wrap:anywhere]">
              {t("bookNow")}
            </span>
          </span>
        )}
      </Button>
      {!href && <p className="text-xs opacity-80">{t("bookingUnavailable")}</p>}
    </div>
  );
}
