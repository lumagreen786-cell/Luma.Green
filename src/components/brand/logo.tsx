import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

import styles from "./logo.module.css";

/**
 * The Luma.Green mark: four leaf blades turning around a shared centre —
 * material in motion, always coming back around.
 *
 * Gradient ids are static, so repeats on one page resolve to the same paint.
 * That breaks when the first copy sits in a hidden subtree (a sidebar that is
 * display:none on phones): its gradients don't paint, and neither does any
 * copy that points at them. A second mark on such a page takes its own
 * `idPrefix`.
 */
export function LogoMark({
  className,
  idPrefix = "lg",
  ...props
}: React.ComponentProps<"svg"> & { idPrefix?: string }) {
  const id = (name: string) => `${idPrefix}-${name}`;
  return (
    <svg
      viewBox="0 0 512 512"
      role="img"
      aria-label={site.name}
      className={cn("size-10", styles.mark, className)}
      {...props}
    >
      <defs>
        <linearGradient
          id={id("mid")}
          x1="0"
          y1="-200"
          x2="130"
          y2="0"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#8FD073" />
          <stop offset="1" stopColor="#1F7A5A" />
        </linearGradient>
        <linearGradient
          id={id("light")}
          x1="0"
          y1="-200"
          x2="130"
          y2="0"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#CDEDA3" />
          <stop offset="1" stopColor="#7DC46B" />
        </linearGradient>
        <linearGradient
          id={id("deep")}
          x1="0"
          y1="-200"
          x2="130"
          y2="0"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#2E8B57" />
          <stop offset="1" stopColor="#0E4030" />
        </linearGradient>
        <linearGradient
          id={id("fold-deep")}
          x1="0"
          y1="-200"
          x2="130"
          y2="0"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#145C43" />
          <stop offset="1" stopColor="#0B3326" />
        </linearGradient>
        <linearGradient
          id={id("fold-mid")}
          x1="0"
          y1="-200"
          x2="130"
          y2="0"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#4CA96B" />
          <stop offset="1" stopColor="#2E8B57" />
        </linearGradient>
      </defs>

      <g transform="translate(256 256)">
        <g transform="rotate(0)">
          <path
            d="M0 0 L0 -200 A130 100 0 0 1 0 0 Z"
            fill={`url(#${id("mid")})`}
          />
          <path
            d="M0 -200 A130 100 0 0 1 0 0 C40 -60 110 -140 0 -200 Z"
            fill={`url(#${id("fold-deep")})`}
          />
        </g>
        <g transform="rotate(90)">
          <path
            d="M0 0 L0 -200 A130 100 0 0 1 0 0 Z"
            fill={`url(#${id("light")})`}
          />
          <path
            d="M0 -200 A130 100 0 0 1 0 0 C40 -60 110 -140 0 -200 Z"
            fill={`url(#${id("fold-mid")})`}
            opacity="0.55"
          />
        </g>
        <g transform="rotate(180)">
          <path
            d="M0 0 L0 -200 A130 100 0 0 1 0 0 Z"
            fill={`url(#${id("deep")})`}
          />
          <path
            d="M0 -200 A130 100 0 0 1 0 0 C40 -60 110 -140 0 -200 Z"
            fill={`url(#${id("fold-deep")})`}
          />
        </g>
        <g transform="rotate(270)">
          <path
            d="M0 0 L0 -200 A130 100 0 0 1 0 0 Z"
            fill={`url(#${id("light")})`}
          />
          <path
            d="M0 -200 A130 100 0 0 1 0 0 C40 -60 110 -140 0 -200 Z"
            fill={`url(#${id("fold-mid")})`}
            opacity="0.55"
          />
        </g>
      </g>
    </svg>
  );
}

/** Mark + wordmark, set in Noto so it holds up in every locale we ship. */
export function Logo({
  className,
  idPrefix,
}: {
  className?: string;
  idPrefix?: string;
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-2.5", styles.logo, className)}
    >
      <LogoMark className="size-8 shrink-0" idPrefix={idPrefix} />
      <span
        aria-hidden="true"
        className="inline font-display text-lg font-semibold tracking-tight whitespace-nowrap sm:text-xl"
      >
        {site.name}
      </span>
    </span>
  );
}
