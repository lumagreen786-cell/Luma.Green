/// <reference types="vite/client" />

import type { ImageProps } from "next/image";

// Vite serves built fonts from .next/static. Resolve public image strings
// through its module graph so generated assets use permitted local /@fs URLs.
const publicImages = import.meta.glob<string>("../../public/images/**/*", {
  eager: true,
  query: "?url",
  import: "default",
});

/** Local Vite URLs replace Next's optimizer only in synthetic guide captures. */
export default function GuideImage({
  src,
  alt,
  fill,
  width,
  height,
  sizes,
  className,
  style,
}: ImageProps) {
  const image = typeof src !== "string" && "default" in src ? src.default : src;
  const url = typeof image === "string" ? image : image.src;
  const fixtureUrl = url.startsWith("/images/")
    ? (publicImages[`../../public${url}`] ?? url)
    : url;
  const dimensions = typeof image === "string" ? undefined : image;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- Vite has no Next optimizer; this adapter is restricted to documentation fixtures.
    <img
      src={fixtureUrl}
      alt={alt}
      width={fill ? undefined : (width ?? dimensions?.width)}
      height={fill ? undefined : (height ?? dimensions?.height)}
      sizes={sizes}
      className={className}
      style={
        fill
          ? {
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              ...style,
            }
          : style
      }
    />
  );
}
