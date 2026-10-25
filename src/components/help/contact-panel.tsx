import { CalendarClockIcon, type LucideIcon, ReplyIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

function Row({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <span className="flex size-8 shrink-0 items-start justify-center pt-1 text-primary">
        <Icon aria-hidden className="size-5" />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <h3 className="font-medium">{title}</h3>
        <div className="text-sm text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}

/** The side of the contact page: availability, hours and reply time. */
export function ContactPanel() {
  const t = useTranslations("help");
  return (
    <aside
      aria-labelledby="contact-other-ways"
      className="flex flex-col gap-6 self-start border-t py-6 md:border-s md:border-t-0 md:py-0 md:ps-6"
    >
      <h2 id="contact-other-ways" className="text-lg font-semibold">
        {t("contact.otherWays")}
      </h2>
      <p className="text-sm text-muted-foreground">
        {t("contact.phoneUnavailable")}
      </p>
      <Row icon={CalendarClockIcon} title={t("contact.hoursTitle")}>
        {t("hours")}
      </Row>
      <Row icon={ReplyIcon} title={t("contact.replyTitle")}>
        {t("replyTime")}
      </Row>
    </aside>
  );
}
