import {
  ArrowDownIcon,
  ArrowRightIcon,
  FactoryIcon,
  HandHelpingIcon,
  HouseIcon,
  IndianRupeeIcon,
  type LucideIcon,
  RecycleIcon,
  StoreIcon,
  WarehouseIcon,
} from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";

import { Container } from "../container";
import { SectionHeading } from "../section-heading";

/** The chain in the order material moves through it. */
const steps = [
  { key: "household", icon: HouseIcon },
  { key: "kabadiwala", icon: StoreIcon },
  { key: "yard", icon: WarehouseIcon },
  { key: "recycler", icon: RecycleIcon },
  { key: "manufacturer", icon: FactoryIcon },
] as const satisfies readonly { key: string; icon: LucideIcon }[];

function Lane({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <p
      data-reveal
      className="flex items-start gap-4 border-t border-border py-6"
    >
      <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-foreground" />
      <span className="text-sm leading-relaxed text-muted-foreground">
        {text}
      </span>
    </p>
  );
}

/** An ordered material journey; arrows follow the document's direction. */
export async function ChainDiagram() {
  const [t, format] = await Promise.all([
    getTranslations("home.chain"),
    getFormatter(),
  ]);

  return (
    <section
      aria-labelledby="chain-heading"
      className="py-10 sm:py-12 lg:py-24"
    >
      <Container className="flex flex-col gap-8 sm:gap-10">
        <SectionHeading
          id="chain-heading"
          title={t("heading")}
          intro={t("intro")}
        />
        <div>
          <ol className="grid min-w-0 grid-flow-dense grid-cols-1 divide-y border-y xl:grid-cols-5 xl:divide-x xl:divide-y-0 rtl:xl:divide-x-reverse">
            {steps.map(({ key, icon: Icon }, index) => (
              <li
                data-reveal
                key={key}
                className="relative grid min-w-0 grid-cols-[3.5rem_minmax(0,1fr)] gap-5 py-6 xl:flex xl:flex-col xl:gap-8 xl:px-5 xl:py-8"
              >
                <span className="font-display text-4xl leading-none font-medium tracking-tight text-muted-foreground/60 xl:text-5xl">
                  {format.number(index + 1, { minimumIntegerDigits: 2 })}
                </span>
                <div className="min-w-0 space-y-3 wrap-anywhere">
                  <Icon
                    aria-hidden
                    className="mb-4 size-6 text-foreground"
                    strokeWidth={1.5}
                  />
                  <h3 className="text-lg font-semibold">
                    {t(`steps.${key}.name`)}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {t(`steps.${key}.body`)}
                  </p>
                </div>
                {index < steps.length - 1 ? (
                  <>
                    <ArrowDownIcon
                      aria-hidden
                      className="absolute start-4 bottom-3 size-4 text-foreground xl:hidden"
                    />
                    <ArrowRightIcon
                      aria-hidden
                      className="absolute end-4 top-10 hidden size-5 text-foreground xl:block rtl:rotate-180"
                    />
                  </>
                ) : null}
              </li>
            ))}
          </ol>
          <div className="grid gap-x-10 md:grid-cols-2">
            <Lane icon={IndianRupeeIcon} text={t("money")} />
            <Lane icon={HandHelpingIcon} text={t("saathi")} />
          </div>
        </div>
      </Container>
    </section>
  );
}
