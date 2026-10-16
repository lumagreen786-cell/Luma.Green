"use client";

import { useTranslations } from "next-intl";

import { isConvexConfigured } from "@/components/providers/convex-provider";
import { useSignedInQuery } from "@/components/providers/use-signed-in-query";
import { ErrorBoundary } from "@/components/sell/states";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

import { api } from "../../../convex/_generated/api";

interface Props {
  className?: string;
  variant?: "ghost" | "outline";
  onNavigate?: () => void;
}

/** Keep public HTML cacheable; account state is resolved only in this island. */
export function HeaderAuthAction(props: Props) {
  const t = useTranslations("common");
  return isConvexConfigured ? (
    <ErrorBoundary
      fallback={() => (
        <Button
          asChild
          variant={props.variant ?? "ghost"}
          className={props.className}
        >
          <Link href="/login" onClick={props.onNavigate} title={t("error")}>
            {t("retry")}
          </Link>
        </Button>
      )}
    >
      <ConnectedAction {...props} />
    </ErrorBoundary>
  ) : (
    <SignedOutAction {...props} />
  );
}
function SignedOutAction({ className, variant = "ghost", onNavigate }: Props) {
  const t = useTranslations("auth");
  return (
    <Button asChild variant={variant} className={className}>
      <Link href="/login" onClick={onNavigate}>
        {t("metaTitle")}
      </Link>
    </Button>
  );
}
function ConnectedAction(props: Props) {
  const common = useTranslations("common");
  const join = useTranslations("join");
  const person = useSignedInQuery(api.identity.me);
  if (person === undefined)
    return (
      <Button
        disabled
        aria-busy="true"
        variant={props.variant ?? "ghost"}
        className={props.className}
      >
        {common("loading")}
      </Button>
    );
  if (person === null) return <SignedOutAction {...props} />;
  const label = join("status.approved.open");
  return (
    <Button
      asChild
      variant={props.variant ?? "ghost"}
      className={props.className}
    >
      {person.kind === "admin" ? (
        <a
          href={person.twoFactorEnabled ? "/admin" : "/admin/setup"}
          onClick={props.onNavigate}
        >
          {label}
        </a>
      ) : (
        <Link href="/app" onClick={props.onNavigate}>
          {label}
        </Link>
      )}
    </Button>
  );
}
