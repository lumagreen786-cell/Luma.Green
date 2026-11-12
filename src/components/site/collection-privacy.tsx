import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

export function CollectionPrivacy({
  purpose,
}: {
  purpose: "phone" | "email" | "booking";
}) {
  const t = useTranslations("collectionPrivacy");
  const privacy = useTranslations("privacy");
  return (
    <p className="text-sm leading-relaxed text-muted-foreground">
      {t(purpose)}{" "}
      <Link
        href="/privacy"
        className="font-medium text-foreground underline underline-offset-4"
      >
        {privacy("title")}
      </Link>
    </p>
  );
}
