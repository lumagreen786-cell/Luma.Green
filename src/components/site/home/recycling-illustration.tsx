import Image from "next/image";

/** Decorative process artwork, never evidence of a live collection. */
export function RecyclingIllustration() {
  return (
    <Image
      aria-hidden="true"
      data-recycling-illustration
      src="/images/showcase/recycle-household-illustration.webp"
      alt=""
      fill
      preload
      sizes="(min-width: 1024px) 50vw, 100vw"
      className="object-cover"
    />
  );
}
