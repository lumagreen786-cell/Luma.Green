import { Reveal } from "@/components/afterlife/reveal";
import {
  RoleStoryImage,
  type StoryScene,
} from "@/components/showcase/role-story-image";
import { cn } from "@/lib/utils";

import { Container } from "./container";
import styles from "./public-pages.module.css";

/** Editorial pages open with their process; task pages keep the action close. */
export function PageHeader({
  title,
  lead,
  eyebrow,
  scene,
  atmosphere = false,
  variant = "editorial",
}: {
  title: string;
  lead: string;
  eyebrow?: string;
  scene: StoryScene;
  atmosphere?: boolean;
  variant?: "editorial" | "task";
}) {
  return (
    <header
      className={cn(
        styles.pageHeader,
        variant === "editorial" ? styles.editorial : styles.task,
      )}
    >
      <RoleStoryImage
        scene={scene}
        className={styles.headerImage}
        frameClassName={styles.headerFrame}
        sizes="100vw"
      />
      <Container className={styles.headerContent}>
        <Reveal className={styles.headingCopy}>
          {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
          <h1 data-text-entrance={atmosphere || undefined}>{title}</h1>
          <p className={styles.lead}>{lead}</p>
        </Reveal>
      </Container>
    </header>
  );
}
