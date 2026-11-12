import Image from "next/image";

import { cn } from "@/lib/utils";

import workshop from "../../../public/images/showcase/circular-workshop.webp";
import collection from "../../../public/images/showcase/collection-partners.webp";
import electronics from "../../../public/images/showcase/electronics-sorting.webp";
import fairWeighing from "../../../public/images/showcase/fair-weighing.webp";
import preparation from "../../../public/images/showcase/household-preparation.webp";
import household from "../../../public/images/showcase/household-sorting.webp";
import weighing from "../../../public/images/showcase/kabadiwala-weighing.webp";
import sorting from "../../../public/images/showcase/material-sorting.webp";
import yard from "../../../public/images/showcase/material-yard.webp";
import operations from "../../../public/images/showcase/operations-desk.webp";
import pellets from "../../../public/images/showcase/recycled-pellets.webp";
import recycling from "../../../public/images/showcase/recycling-line.webp";
import solar from "../../../public/images/showcase/solar-rooftop.webp";
import dispatch from "../../../public/images/showcase/yard-dispatch.webp";

export type StoryRole =
  | "household"
  | "kabadiwala"
  | "yard"
  | "recycler"
  | "manufacturer"
  | "saathi"
  | "admin"
  | "solar";
export type StoryScene =
  | StoryRole
  | "sorting"
  | "fairWeighing"
  | "pellets"
  | "electronics"
  | "preparation"
  | "dispatch";
const scenes = {
  household,
  kabadiwala: weighing,
  yard,
  recycler: recycling,
  manufacturer: workshop,
  saathi: collection,
  admin: operations,
  solar,
  sorting,
  fairWeighing,
  pellets,
  electronics,
  preparation,
  dispatch,
} satisfies Record<StoryScene, typeof household>;

/** Process views for the public role directories; operational art stays unchanged. */
export const roleProcessScenes = {
  household: "preparation",
  kabadiwala: "fairWeighing",
  yard: "dispatch",
  recycler: "sorting",
  manufacturer: "pellets",
  saathi: "saathi",
  admin: "admin",
  solar: "solar",
} as const satisfies Record<StoryRole, StoryScene>;

/** Decorative editorial art, separate from the localized app preview. */
export function RoleStoryImage({
  scene,
  placement,
  compact = false,
  className,
  frameClassName,
  imageClassName,
  sizes = "(min-width: 1280px) 560px, (min-width: 768px) 45vw, 92vw",
}: {
  scene: StoryScene;
  /** Use a new illustration only for a newly added visual context. Existing scenes keep their original artwork. */
  placement?: string;
  compact?: boolean;
  className?: string;
  frameClassName?: string;
  imageClassName?: string;
  sizes?: string;
}) {
  return (
    <figure className={cn("min-w-0", className)}>
      <div
        className={cn(
          "relative overflow-hidden bg-muted",
          compact ? "aspect-[2/1]" : "aspect-[4/3]",
          frameClassName,
        )}
      >
        <Image
          src={placement ? `/images/ship-x/${placement}.webp` : scenes[scene]}
          alt=""
          fill
          sizes={sizes}
          className={cn("object-cover", imageClassName)}
        />
      </div>
    </figure>
  );
}
