"use client";

import { useQuery } from "convex/react";
import { useState } from "react";

import { isConvexConfigured } from "@/components/providers/convex-provider";
import { useVerifiedSession } from "@/components/providers/use-signed-in-query";
import { LanguageSwitcher } from "@/components/site/language-switcher";
import { Skeleton } from "@/components/ui/skeleton";

import { api } from "../../../convex/_generated/api";
import { PhoneForm } from "./phone-form";
import { ResumeSession } from "./resume-session";
import { readActivePhone, useStoredValue } from "./storage";
import { VerifyForm } from "./verify-flow";

/** Phone and code share one screen; language remains an optional control. */
export function LoginFlow() {
  return isConvexConfigured ? (
    <ConfiguredLogin />
  ) : (
    <LoginSteps canSend={false} />
  );
}

function ConfiguredLogin() {
  const session = useVerifiedSession();
  const options = useQuery(api.identity.signInOptions);
  if (session.isPending) return <LoginSkeleton />;
  if (session.isReady) return <ResumeSession />;
  return options === undefined ? (
    <LoginSkeleton />
  ) : (
    <LoginSteps canSend={options.phone} />
  );
}

function LoginSteps({ canSend }: { canSend: boolean }) {
  const [phone, setPhone] = useState<string | null>(null);
  const [lastPhone, setLastPhone] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const activePhone = useStoredValue(readActivePhone);
  const codePhone =
    phone ?? (isConvexConfigured && !isEditing ? activePhone : null);

  if (codePhone === undefined) return <LoginSkeleton />;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <LanguageSwitcher />
      </div>
      {codePhone === null ? (
        <PhoneForm
          canSend={canSend}
          initialPhone={lastPhone || (activePhone?.slice(3) ?? "")}
          onSent={(number) => {
            setLastPhone(number.slice(3));
            setPhone(number);
            setIsEditing(false);
          }}
        />
      ) : (
        <VerifyForm
          phoneNumber={codePhone}
          onChangeNumber={() => {
            setPhone(null);
            setIsEditing(true);
          }}
        />
      )}
    </div>
  );
}

export function LoginSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <Skeleton className="h-8 w-3/4" />
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  );
}
