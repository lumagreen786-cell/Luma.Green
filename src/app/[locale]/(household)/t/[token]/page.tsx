import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { TrackPage } from "@/components/track/track-page";
import { localeFromParams } from "@/i18n/paths";
import { privateMetadata } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string; token: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await localeFromParams(params);
  const t = await getTranslations({ locale, namespace: "track" });
  return privateMetadata(t("metaTitle"));
}

/**
 * The collection link locates the record; Convex checks the current session.
 */
export default async function TrackRoute({ params }: Props) {
  const { token } = await params;
  return <TrackPage token={token} />;
}
