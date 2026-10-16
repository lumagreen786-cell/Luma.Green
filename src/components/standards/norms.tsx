import {
  BadgeCheckIcon,
  FactoryIcon,
  HandHelpingIcon,
  HandshakeIcon,
  LockIcon,
  type LucideIcon,
  ReceiptTextIcon,
  StoreIcon,
  TruckIcon,
} from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import {
  RoleStoryImage,
  type StoryScene,
} from "@/components/showcase/role-story-image";

/** One norm of the standard: what it is on the left, how on the right. */
export function NormSection({
  id,
  icon: Icon,
  title,
  body,
  scene,
  children,
}: {
  id: string;
  icon: LucideIcon;
  title: string;
  body: string;
  scene?: StoryScene;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={`${id}-title`}
      className="scroll-mt-24 border-t py-5"
    >
      <details id={id} open={id === "codes"} className="group">
        <summary className="flex min-h-12 cursor-pointer items-center gap-3 font-display text-xl font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <Icon aria-hidden className="size-5 shrink-0 text-primary" />
          <h2 id={`${id}-title`}>{title}</h2>
        </summary>
        <div className="grid gap-6 pt-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-10">
          {scene ? (
            <RoleStoryImage
              scene={scene}
              frameClassName="aspect-[3/2]"
              sizes="(min-width: 1024px) 30vw, 92vw"
            />
          ) : null}
          <div className="min-w-0">{children}</div>
        </div>
      </details>
      <p className="max-w-3xl pt-2 text-sm text-muted-foreground">{body}</p>
    </section>
  );
}

/** Three short rules, each with an icon, side by side on wide screens. */
export function RuleCards({
  rules,
}: {
  rules: readonly {
    key: string;
    icon: LucideIcon;
    title: string;
    body: string;
  }[];
}) {
  return (
    <ul className="grid grid-flow-dense divide-y border-y sm:grid-cols-3 sm:divide-x sm:divide-y-0 rtl:sm:divide-x-reverse">
      {rules.map(({ key, icon: Icon, title, body }) => (
        <li key={key} className="flex flex-col gap-3 py-5 sm:px-5">
          <Icon aria-hidden className="size-6 text-primary" />
          <h3 className="font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{body}</p>
        </li>
      ))}
    </ul>
  );
}

const receiptFields = [
  "number",
  "time",
  "seller",
  "buyer",
  "code",
  "weight",
  "rate",
  "total",
] as const;

/** The fields every receipt carries, drawn as a blank receipt. */
export async function ReceiptAnatomy() {
  const t = await getTranslations("standards.custody");
  return (
    <figure
      aria-labelledby="receipt-anatomy-title"
      className="mx-auto w-full max-w-md border-y-2 border-dashed bg-muted/20 px-5 py-6 lg:mx-0"
    >
      <figcaption
        id="receipt-anatomy-title"
        className="mb-3 flex items-center gap-2 font-semibold"
      >
        <ReceiptTextIcon aria-hidden className="size-5 text-primary" />
        {t("receiptTitle")}
      </figcaption>
      <ul className="divide-y divide-dashed">
        {receiptFields.map((field) => (
          <li
            key={field}
            className="flex items-center justify-between gap-4 py-2.5 text-sm"
          >
            <span>{t(`fields.${field}`)}</span>
            <span
              aria-hidden
              className="h-2 w-16 shrink-0 rounded-full bg-muted"
            />
          </li>
        ))}
      </ul>
    </figure>
  );
}

/** Who is checked for what before they can trade. */
export async function VerificationList() {
  const t = await getTranslations("standards.verification");
  const items = [
    { key: "business", icon: StoreIcon },
    { key: "consent", icon: FactoryIcon },
    { key: "saathi", icon: HandHelpingIcon },
  ] as const;
  return (
    <ul className="flex flex-col divide-y border-y">
      {items.map(({ key, icon: Icon }) => (
        <li key={key} className="flex items-start gap-3 py-5">
          <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
          <span>{t(key)}</span>
        </li>
      ))}
    </ul>
  );
}

/** A business trade, step by step: the money waits until the goods arrive. */
export async function EscrowSteps() {
  const [t, format] = await Promise.all([
    getTranslations("standards.escrow.steps"),
    getFormatter(),
  ]);
  const steps = [
    { key: "accepted", icon: HandshakeIcon },
    { key: "paid", icon: LockIcon },
    { key: "dispatched", icon: TruckIcon },
    { key: "released", icon: BadgeCheckIcon },
  ] as const;
  return (
    <ol className="divide-y border-y">
      {steps.map(({ key, icon: Icon }, index) => (
        <li key={key} className="flex items-start gap-4 py-4">
          <span className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {format.number(index + 1)}
            </span>
            <Icon aria-hidden className="size-5 text-primary" />
          </span>
          <p className="font-medium">{t(key)}</p>
        </li>
      ))}
    </ol>
  );
}
