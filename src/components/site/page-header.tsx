import { cva } from "class-variance-authority";

import {
  RoleStoryImage,
  type StoryScene,
} from "@/components/showcase/role-story-image";
import { cn } from "@/lib/utils";

import { Container } from "./container";
import effects from "./public-effects.module.css";

const headerLayout = cva("grid min-w-0 lg:items-center", {
  variants: {
    variant: {
      editorial: "gap-3 py-6 sm:py-7",
      task: "gap-4 py-6 sm:py-7 lg:grid-cols-[minmax(0,1fr)_6rem]",
    },
  },
  defaultVariants: { variant: "editorial" },
});

const headerTitle = cva(
  "max-w-2xl font-display leading-[1.1] font-semibold tracking-tight text-balance",
  {
    variants: {
      variant: {
        editorial: "text-[1.75rem] sm:text-3xl",
        task: "text-2xl leading-tight sm:text-3xl",
      },
    },
    defaultVariants: { variant: "editorial" },
  },
);

/** A restrained title and a clear reading order shared by public routes. */
export function PageHeader({
  title,
  lead,
  eyebrow,
  scene,
  imagePlacement,
  atmosphere = false,
  variant = "editorial",
}: {
  title: string;
  lead: string;
  eyebrow?: string;
  scene: StoryScene;
  imagePlacement?: string;
  atmosphere?: boolean;
  variant?: "editorial" | "task";
}) {
  return (
    <div className="bg-background">
      <Container className={headerLayout({ variant })}>
        <div
          className={cn(
            "min-w-0 space-y-2",
            variant === "editorial" && "max-w-3xl",
          )}
        >
          <h1
            data-text-entrance={atmosphere || undefined}
            className={cn(
              headerTitle({ variant }),
              atmosphere && effects.heading,
            )}
          >
            {title}
          </h1>
          <p className="max-w-3xl text-sm leading-relaxed text-pretty text-muted-foreground">
            {lead}
          </p>
          {eyebrow ? (
            <p className="text-sm font-medium text-muted-foreground">
              {eyebrow}
            </p>
          ) : null}
        </div>
        {variant === "task" ? (
          <RoleStoryImage
            scene={scene}
            placement={imagePlacement}
            className="hidden lg:block"
            frameClassName="h-18 aspect-auto rounded-xl"
            sizes="96px"
          />
        ) : null}
      </Container>
    </div>
  );
}
