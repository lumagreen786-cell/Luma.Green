"use client";

import { useQuery } from "convex/react";
import { useState } from "react";

import { isConvexConfigured } from "@/components/providers/convex-provider";
import { Skeleton } from "@/components/ui/skeleton";

import { api } from "../../../convex/_generated/api";
import { LanguageChoice } from "./language-choice";
import { PhoneForm } from "./phone-form";
import { isLanguageChosen, useStoredValue } from "./storage";

/** `/login`: language first (once per browser), then the phone number. */
export function LoginFlow() {
  return isConvexConfigured ? (
    <ConfiguredLogin />
  ) : (
    <LoginSteps canSend={false} />
  );
}

function ConfiguredLogin() {
  const options = useQuery(api.identity.signInOptions);
  return options === undefined ? (
    <LoginSkeleton />
  ) : (
    <LoginSteps canSend={options.phone} />
  );
}

function LoginSteps({ canSend }: { canSend: boolean }) {
  const storedChoice = useStoredValue(isLanguageChosen);
  const [choseJustNow, setChoseJustNow] = useState(false);

  if (storedChoice === undefined) {
    return <LoginSkeleton />;
  }
  if (!storedChoice && !choseJustNow) {
    return (
      <LanguageChoice
        onDone={() => {
          setChoseJustNow(true);
        }}
      />
    );
  }
  return <PhoneForm canSend={canSend} />;
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
