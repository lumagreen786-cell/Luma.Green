import {
  ArrowLeftRightIcon,
  BoxesIcon,
  ClipboardCheckIcon,
  FactoryIcon,
  HardHatIcon,
  type LucideIcon,
  PackageOpenIcon,
  RecycleIcon,
  StoreIcon,
} from "lucide-react";

import type { PublicRoute } from "@/i18n/paths";

/** Primary navigation. `key` is the label in the `nav` namespace. */
export const navItems = [
  { href: "/how-it-works", key: "howItWorks" },
  { href: "/prices", key: "prices" },
  { href: "/help", key: "help" },
  { href: "/join", key: "join" },
] as const satisfies readonly { href: PublicRoute; key: string }[];

/**
 * Footer link groups. `heading` is in the `footer` namespace; each `label` is
 * a full key, as the links share labels with the header.
 */
export const footerGroups = [
  {
    heading: "useHeading",
    links: [
      { href: "/sell", label: "nav.sellScrap" },
      { href: "/prices", label: "nav.prices" },
      { href: "/join", label: "nav.join" },
      { href: "/how-it-works", label: "nav.howItWorks" },
    ],
  },
  {
    heading: "learnHeading",
    links: [
      { href: "/standards", label: "footer.standards" },
      { href: "/solar", label: "footer.solar" },
      { href: "/help", label: "nav.help" },
      { href: "/contact", label: "nav.contact" },
      { href: "/privacy", label: "privacy.title" },
    ],
  },
] as const satisfies readonly {
  heading: string;
  links: readonly { href: PublicRoute; label: string }[];
}[];

/** The three stages of the chain, in order. Copy lives under `loop.<key>`. */
export const loopSteps = [
  { key: "sell", icon: PackageOpenIcon },
  { key: "trade", icon: ArrowLeftRightIcon },
  { key: "record", icon: ClipboardCheckIcon },
] as const satisfies readonly { key: string; icon: LucideIcon }[];

/**
 * The roles the public site describes, in the order material flows through
 * them. Site copy only — the app's roles live in convex/lib/chain.ts.
 */
export const roles = [
  { key: "kabadiwala", icon: StoreIcon },
  { key: "yard", icon: BoxesIcon },
  { key: "recycler", icon: RecycleIcon },
  { key: "manufacturer", icon: FactoryIcon },
  { key: "saathi", icon: HardHatIcon },
] as const satisfies readonly { key: string; icon: LucideIcon }[];
