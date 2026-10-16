import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** A titled block of a help page that in-page links can jump to. */
export function HelpSection({
  id,
  title,
  lead,
  className,
  children,
}: {
  id: string;
  title: string;
  lead?: string;
  className?: string;
  children: ReactNode;
}) {
  if (["videos", "training", "other-roles"].includes(id))
    return (
      <details id={id} className={cn("scroll-mt-20 border-t py-3", className)}>
        <summary className="min-h-11 cursor-pointer py-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <h2 className="inline font-display text-xl font-semibold">{title}</h2>
        </summary>
        <div className="flex flex-col gap-5 pt-4">
          {lead ? (
            <p className="text-sm text-muted-foreground">{lead}</p>
          ) : null}
          {children}
        </div>
      </details>
    );
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className={cn("flex scroll-mt-20 flex-col gap-5", className)}
    >
      <div className="flex flex-col gap-1">
        <h2
          id={`${id}-heading`}
          className="font-display text-2xl font-semibold tracking-tight"
        >
          {title}
        </h2>
        {lead ? <p className="text-muted-foreground">{lead}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** A compact section index for long help pages. */
export function JumpLinks({
  label,
  links,
}: {
  label: string;
  links: readonly { id: string; label: string }[];
}) {
  return (
    <nav aria-label={label}>
      <ul className="flex flex-wrap gap-2">
        {links.map((link) => (
          <li key={link.id}>
            <a
              href={`#${link.id}`}
              className="inline-flex min-h-11 items-center border-b px-3 text-sm font-medium outline-none hover:border-primary hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
