import type { ReactNode } from "react";

import {
  RoleStoryImage,
  type StoryScene,
} from "@/components/showcase/role-story-image";
import { Container } from "@/components/site/container";
import { cn } from "@/lib/utils";

/**
 * The title block at the top of every help page: breadcrumbs, the one `h1`,
 * a lead, an optional picture and whatever the page puts underneath (search,
 * quick actions, jump links).
 */
export function HelpHero({
  eyebrow,
  title,
  lead,
  breadcrumbs,
  art,
  banner,
  children,
}: {
  eyebrow?: string;
  title: string;
  lead: string;
  breadcrumbs?: ReactNode;
  /** A spot illustration, shown beside the title from tablet width up. */
  art?: ReactNode;
  /** A compact process image beside the help task on large screens. */
  banner?: StoryScene;
  children?: ReactNode;
}) {
  return (
    <div data-parallax-scene className="relative isolate bg-background">
      <Container className="relative flex flex-col gap-4 py-6">
        {breadcrumbs}
        <div
          data-reveal
          className={cn(
            "grid items-center gap-4",
            banner && "lg:grid-cols-[minmax(0,1fr)_7rem]",
            !banner && art && "md:grid-cols-[1fr_auto]",
          )}
        >
          <div className="flex min-w-0 flex-col gap-3">
            {eyebrow && !children ? (
              <p className="border-s-2 border-primary ps-3 text-sm font-medium text-muted-foreground">
                {eyebrow}
              </p>
            ) : null}
            <h1 className="max-w-3xl font-display text-3xl leading-tight font-normal tracking-tight text-balance sm:text-5xl">
              {title}
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-pretty text-muted-foreground">
              {lead}
            </p>
            {children ? (
              <div className="mt-3 min-w-0 rounded-panel bg-card p-4 shadow-panel sm:p-5">
                {children}
              </div>
            ) : null}
          </div>
          {banner ? (
            <RoleStoryImage
              scene={banner}
              className="hidden lg:block"
              frameClassName="h-24 aspect-auto"
              sizes="(min-width: 1024px) 112px, 100vw"
            />
          ) : null}
          {!banner && art ? (
            <div className="hidden w-24 shrink-0 md:block md:w-32">{art}</div>
          ) : null}
        </div>
      </Container>
    </div>
  );
}
