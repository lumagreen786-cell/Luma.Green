import { redirect } from "@/i18n/navigation";

export default async function RetiredEmailPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return redirect({ href: "/login", locale });
}
