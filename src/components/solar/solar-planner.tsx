"use client";

import {
  ClipboardCheckIcon,
  type LucideIcon,
  PhoneCallIcon,
  ScrollTextIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";

import { useFormat } from "@/components/app/format";

import { Assumptions } from "./assumptions";
import { estimateSolar, readRoof, readUsage, type SolarResult } from "./calc";
import { SolarContactForm } from "./solar-contact-form";
import { type SolarFormState, SolarInputs } from "./solar-inputs";
import { SolarResultView } from "./solar-result";

const initialState: SolarFormState = {
  kind: "home",
  mode: "bill",
  amount: "",
  roof: "",
  areaUnit: "sqft",
};

const nextSteps = [
  { key: "one", icon: PhoneCallIcon },
  { key: "two", icon: ClipboardCheckIcon },
  { key: "three", icon: ScrollTextIcon },
] as const satisfies readonly { key: string; icon: LucideIcon }[];

/**
 * The /solar calculator: inputs on one side, the live estimate on the other,
 * then a way to talk to us that carries the estimate along. `between` is
 * rendered between the two (the subsidy explainer, from the server).
 */
export function SolarPlanner({ between }: { between?: ReactNode }) {
  const t = useTranslations("solar");
  const locale = useLocale();
  const format = useFormat();
  const [state, setState] = useState(initialState);
  const [left, setLeft] = useState({ amount: false, roof: false });

  const usage = readUsage(state.mode, state.amount, locale);
  const roof = readRoof(state.roof, state.areaUnit, locale);
  const result: SolarResult | null =
    usage.status === "ok" && roof.status !== "invalid"
      ? estimateSolar({
          kind: state.kind,
          mode: state.mode,
          amount: usage.value,
          roofM2: roof.status === "ok" ? roof.value : null,
        })
      : null;
  const prefill =
    result?.status === "ok"
      ? t("contact.prefill", {
          kind: state.kind,
          kw: format.number(result.estimate.kw, 1),
        })
      : "";

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)]">
        <section
          aria-labelledby="solar-details"
          className="flex flex-col gap-5 rounded-xl bg-card p-5 sm:p-6 lg:sticky lg:top-24"
        >
          <h2
            id="solar-details"
            className="font-display text-xl font-semibold tracking-tight"
          >
            {t("form.heading")}
          </h2>
          <SolarInputs
            state={state}
            onChange={(next) => {
              if (next.mode !== state.mode) {
                setLeft((current) => ({ ...current, amount: false }));
              }
              setState(next);
            }}
            onLeave={(field) => {
              setLeft((current) => ({ ...current, [field]: true }));
            }}
            amountError={left.amount && usage.status === "invalid"}
            roofError={left.roof && roof.status === "invalid"}
          />
        </section>

        <section
          aria-labelledby="solar-estimate"
          className="flex min-w-0 flex-col gap-5 rounded-xl bg-card p-5 sm:p-6"
        >
          <h2
            id="solar-estimate"
            className="font-display text-xl font-semibold tracking-tight"
          >
            {t("result.heading")}
          </h2>
          <SolarResultView
            result={result}
            mode={state.mode}
            areaUnit={state.areaUnit}
          />
          <Assumptions />
        </section>
      </div>

      {between}

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)]">
        <section
          aria-labelledby="solar-next"
          className="flex min-w-0 flex-col gap-5 rounded-xl bg-card p-5 sm:p-6"
        >
          <h2
            id="solar-next"
            className="font-display text-2xl font-semibold tracking-tight"
          >
            {t("next.title")}
          </h2>
          <ol className="flex flex-col gap-5">
            {nextSteps.map(({ key, icon: Icon }, index) => (
              <li key={key} className="flex items-start gap-4">
                <span className="relative flex size-11 shrink-0 items-center justify-center rounded-lg border bg-card text-foreground">
                  <Icon aria-hidden className="size-5" />
                  <span className="absolute -end-1 -top-1 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                    {format.number(index + 1)}
                  </span>
                </span>
                <div className="flex flex-col gap-1">
                  <h3 className="font-semibold">{t(`next.${key}.title`)}</h3>
                  <p className="text-muted-foreground">
                    {t(`next.${key}.body`)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section
          id="talk-to-us"
          aria-labelledby="solar-contact"
          className="flex scroll-mt-24 flex-col gap-5 rounded-xl bg-card p-5 sm:p-6"
        >
          <div className="flex flex-col gap-1">
            <h2
              id="solar-contact"
              className="font-display text-xl font-semibold tracking-tight"
            >
              {t("contact.title")}
            </h2>
            <p className="text-muted-foreground">{t("contact.lead")}</p>
          </div>
          <SolarContactForm kind={state.kind} prefill={prefill} />
        </section>
      </div>
    </div>
  );
}
