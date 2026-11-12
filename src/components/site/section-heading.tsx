import { cn } from "@/lib/utils";

/** A section's h2 and intro, with a high-contrast option for brand panels. */
export function SectionHeading({
  id,
  title,
  intro,
  className,
  inverse = false,
}: {
  id: string;
  title: string;
  intro?: string;
  className?: string;
  inverse?: boolean;
}) {
  return (
    <div
      data-reveal
      className={cn("max-w-3xl space-y-3 lg:space-y-4", className)}
    >
      <h2
        id={id}
        className="scroll-mt-24 font-display text-3xl leading-[1.15] font-normal tracking-tight text-balance sm:text-4xl lg:text-[2.75rem]"
      >
        {title}
      </h2>
      {intro ? (
        <p
          className={cn(
            "max-w-2xl text-base leading-relaxed text-pretty sm:text-lg",
            inverse ? "text-brand-100" : "text-muted-foreground",
          )}
        >
          {intro}
        </p>
      ) : null}
    </div>
  );
}
