import {
  ArrowLeftRightIcon,
  BriefcaseBusinessIcon,
  ClipboardListIcon,
  HouseIcon,
  IndianRupeeIcon,
  LeafIcon,
  type LucideIcon,
  PackageIcon,
  ShieldCheckIcon,
  ShoppingCartIcon,
  TagIcon,
} from "lucide-react";

/** Every screen in the business app, by who uses it. */

export type AppRole =
  "kabadiwala" | "yard" | "recycler" | "manufacturer" | "saathi";

export interface NavItem {
  href: string;
  /** Key under `app.nav` in messages. */
  label: string;
  /** Material evidence owns its labels in the lots namespace. */
  namespace?:
    | "lots"
    | "evidence"
    | "facility"
    | "sourcing"
    | "logistics"
    | "qualityDocuments"
    | "operations"
    | "serviceRecords"
    | "returnClaims";
  icon: LucideIcon;
}

const home: NavItem = { href: "/app", label: "home", icon: HouseIcon };
const stock: NavItem = {
  href: "/app/stock",
  label: "stock",
  icon: PackageIcon,
};
const buy: NavItem = {
  href: "/app/market",
  label: "buy",
  icon: ShoppingCartIcon,
};
const sell: NavItem = { href: "/app/sell", label: "sell", icon: TagIcon };
const trades: NavItem = {
  href: "/app/trades",
  label: "trades",
  icon: ArrowLeftRightIcon,
};
const impact: NavItem = {
  href: "/app/impact",
  label: "impact",
  icon: LeafIcon,
};
const compliance: NavItem = {
  href: "/app/compliance",
  label: "compliance",
  icon: ShieldCheckIcon,
};

/** `primary` sits in the phone's bottom bar (≤ 5); `more` in the menu. */
export const NAV: Record<AppRole, { primary: NavItem[]; more: NavItem[] }> = {
  kabadiwala: {
    primary: [
      home,
      { href: "/app/requests", label: "requests", icon: ClipboardListIcon },
      stock,
      { href: "/app/prices", label: "prices", icon: IndianRupeeIcon },
      sell,
    ],
    more: [buy, trades, impact, compliance],
  },
  yard: {
    primary: [home, buy, stock, sell, trades],
    more: [impact, compliance],
  },
  recycler: {
    primary: [home, buy, stock, sell, trades],
    more: [impact, compliance],
  },
  manufacturer: {
    primary: [home, buy, trades, compliance, impact],
    more: [stock, sell],
  },
  saathi: {
    primary: [
      home,
      { href: "/app/impact", label: "earnings", icon: BriefcaseBusinessIcon },
    ],
    more: [],
  },
};
