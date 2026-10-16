import { ArrowDownRightIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import { RoleStoryImage, type StoryScene } from "./role-story-image";

/** Editorial context for an entry form; never evidence of a live transaction. */
export function EntryStory({
  scene,
  title,
  caption,
  className,
}: {
  scene: StoryScene;
  title: string;
  caption: string;
  className?: string;
}) {
  return (
    <aside
      className={cn(
        "grid min-w-0 grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-4 border-b border-border pb-5 lg:flex lg:flex-col lg:items-stretch lg:gap-6 lg:border-0 lg:pb-0",
        className,
      )}
    >
      <RoleStoryImage
        scene={scene}
        frameClassName="aspect-square rounded-md lg:aspect-[4/5]"
        sizes="(min-width: 1024px) 440px, 88px"
      />
      <div className="min-w-0 space-y-3">
        <p className="font-display text-lg leading-snug font-semibold tracking-tight text-pretty lg:text-3xl">
          {title}
        </p>
        <div className="hidden items-center justify-between gap-4 border-t border-border pt-4 lg:flex">
          <p className="text-sm text-muted-foreground">{caption}</p>
          <ArrowDownRightIcon
            aria-hidden
            className="size-5 shrink-0 text-primary rtl:-scale-x-100"
          />
        </div>
      </div>
    </aside>
  );
}
