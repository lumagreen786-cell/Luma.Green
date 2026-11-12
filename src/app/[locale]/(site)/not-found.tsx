import { getTranslations } from "next-intl/server";

import { Container } from "@/components/site/container";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("notFound");

  return (
    <Container className="my-6 flex max-w-3xl flex-1 flex-col items-start justify-center gap-4 rounded-panel border border-border/60 bg-card py-12 text-card-foreground shadow-panel sm:my-8">
      <p className="font-mono text-sm text-muted-foreground">404</p>
      <h1 className="font-display text-4xl font-normal tracking-tight sm:text-5xl">
        {t("title")}
      </h1>
      <p className="max-w-xl text-lg text-muted-foreground">{t("body")}</p>
      <Button asChild size="lg" className="mt-2">
        <Link href="/">{t("backHome")}</Link>
      </Button>
    </Container>
  );
}
