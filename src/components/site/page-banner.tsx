import {
  RoleStoryImage,
  type StoryScene,
} from "@/components/showcase/role-story-image";

/** Full-width public-page artwork, with a taller crop on small screens. */
export function PageBanner({
  scene,
  split = false,
}: {
  scene: StoryScene;
  split?: boolean;
}) {
  return (
    <div data-page-banner className="w-full min-w-0">
      <RoleStoryImage
        scene={scene}
        frameClassName={
          split
            ? "aspect-[16/9] lg:aspect-[4/3]"
            : "aspect-[3/2] sm:aspect-[2/1] lg:aspect-[3/1]"
        }
        sizes={
          split
            ? "(min-width: 1024px) 40vw, 100vw"
            : "(min-width: 1280px) 1184px, (min-width: 1024px) calc(100vw - 96px), (min-width: 640px) calc(100vw - 64px), calc(100vw - 40px)"
        }
      />
    </div>
  );
}
