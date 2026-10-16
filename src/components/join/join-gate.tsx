"use client";

import { type ReactNode, useEffect } from "react";

import { useSignedInQuery } from "@/components/providers/use-signed-in-query";
import { RoleStoryImage } from "@/components/showcase/role-story-image";
import { Skeleton } from "@/components/ui/skeleton";
import { usePathname, useRouter } from "@/i18n/navigation";
import { navigateToAdmin } from "@/lib/admin-navigation";

import { api } from "../../../convex/_generated/api";
import { isEditable } from "../../../convex/lib/lifecycle";
import type { ApplicationKind } from "../../../convex/lib/onboarding";
import { ConsentCard } from "./consent-card";
import { type Application, useMine } from "./use-mine";

/**
 * Every form page goes through here. Signed out → sign in and come back. No
 * application yet → the consent card. A different role, or one that's
 * already sent → the status page. Otherwise the form.
 */
export function JoinGate({
  kind,
  children,
}: {
  kind: ApplicationKind;
  children: (props: {
    application: Application;
    loginPhone: string | undefined;
  }) => ReactNode;
}) {
  const mine = useMine();
  const person = useSignedInQuery(api.identity.me);
  const isAdmin = person?.kind === "admin";
  const router = useRouter();
  const pathname = usePathname();
  const application = mine?.application;

  const isSignedOut = mine === null;
  const isElsewhere =
    application !== undefined &&
    application !== null &&
    (application.kind !== kind || !isEditable(application.status));

  useEffect(() => {
    if (isAdmin) {
      navigateToAdmin(person.twoFactorEnabled);
    } else if (isSignedOut) {
      router.replace({ pathname: "/login", query: { next: pathname } });
    } else if (isElsewhere) {
      router.replace("/join/status");
    }
  }, [isAdmin, person, isSignedOut, isElsewhere, pathname, router]);

  if (
    person === undefined ||
    isAdmin ||
    mine === undefined ||
    mine === null ||
    isElsewhere
  )
    return <FormSkeleton />;
  return (
    <div className="flex flex-col gap-6">
      {application ? (
        children({ application, loginPhone: mine.loginPhone })
      ) : (
        <ConsentCard kind={kind} />
      )}
      {application ? null : (
        <RoleStoryImage
          scene={kind}
          compact
          frameClassName="aspect-16/9 rounded-none"
        />
      )}
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
