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
    <div className="space-y-2">
      <Button
        asChild={Boolean(href)}
        disabled={!href}
        size="lg"
        className="gap-3 px-7"
      >
        {href ? (
          <a href={href}>
            <WhatsAppIcon className="size-5" />
            {t("bookNow")}
          </a>
        ) : (
          <span className="inline-flex items-center gap-3">
            <WhatsAppIcon className="size-5" />
            {t("bookNow")}
          </span>
        )}
      </Button>
      {!href && <p className="text-xs opacity-80">{t("bookingUnavailable")}</p>}
    </div>
  );
}
