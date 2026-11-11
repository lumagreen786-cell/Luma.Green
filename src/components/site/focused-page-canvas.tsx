import Image, { type ImageProps } from "next/image";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Decorative context behind a focused task; text and controls remain unblurred. */
export function FocusedPageCanvas({
  children,
  compact = false,
  image,
}: {
  children: ReactNode;
  compact?: boolean;
  image: ImageProps["src"];
}) {
  return (
    <div
      className={cn(
        "relative isolate overflow-clip bg-background",
        compact ? "rounded-xl" : "min-h-dvh",
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <Image
          src={image}
          alt=""
          fill
          sizes="100vw"
          quality={60}
          className="scale-105 object-cover blur-[2px]"
        />
        <div className="absolute inset-0 bg-image-scrim/40" />
      </div>
      <div
        className={cn(
          "relative z-10 flex flex-col",
          compact ? "p-4 sm:p-8" : "min-h-dvh",
        )}
      >
        {children}
      </div>
    </div>
  );
}
