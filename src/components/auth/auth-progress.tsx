import { CheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

/** Compact progress remains readable at narrow widths and in RTL scripts. */
export function AuthProgress({ step }: { step: "phone" | "code" }) {
  const t = useTranslations("auth");
  return (
    <ol className="grid grid-cols-[minmax(0,1fr)_1rem_minmax(0,1fr)] items-center gap-2 text-sm">
      <li
        aria-current={step === "phone" ? "step" : undefined}
        className="flex min-w-0 items-center justify-center gap-2 rounded-full bg-accent px-3 py-2 font-medium wrap-anywhere"
      >
        {step === "code" ? (
          <CheckIcon aria-hidden className="size-4 shrink-0 text-primary" />
        ) : (
          <span
            aria-hidden
            className="size-2 shrink-0 rounded-full bg-primary"
          />
        )}
        {t("mobileLabel")}
      </li>
      <li aria-hidden className="h-px min-w-4 flex-1 bg-border" />
      <li
        aria-current={step === "code" ? "step" : undefined}
        className={cn(
          "min-w-0 rounded-full px-3 py-2 text-center wrap-anywhere",
          step === "code"
            ? "bg-accent font-medium text-accent-foreground"
            : "text-muted-foreground",
        )}
      >
        {t("codeLabel")}
      </li>
    </ol>
  );
}
