import {
  ArchiveIcon,
  BadgeCheckIcon,
  BanknoteIcon,
  BatteryIcon,
  BatteryWarningIcon,
  BellIcon,
  BriefcaseIcon,
  BriefcaseMedicalIcon,
  Building2Icon,
  CalculatorIcon,
  CalendarClockIcon,
  CameraIcon,
  ChartNoAxesColumnIcon,
  CheckCheckIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CirclePauseIcon,
  CircleXIcon,
  ClipboardCheckIcon,
  ClipboardListIcon,
  ClockIcon,
  CogIcon,
  CompassIcon,
  CupSodaIcon,
  DoorOpenIcon,
  EyeIcon,
  FactoryIcon,
  FileBadgeIcon,
  FileCheckIcon,
  FileTextIcon,
  GlobeIcon,
  HandIcon,
  HandshakeIcon,
  HardHatIcon,
  HeartHandshakeIcon,
  HistoryIcon,
  HouseIcon,
  IdCardIcon,
  InboxIcon,
  IndianRupeeIcon,
  LayersIcon,
  LeafIcon,
  LinkIcon,
  LockIcon,
  type LucideIcon,
  MagnetIcon,
  MapPinIcon,
  MessageCircleWarningIcon,
  MessageSquareTextIcon,
  MonitorSmartphoneIcon,
  NewspaperIcon,
  PackageCheckIcon,
  PackageIcon,
  PackagePlusIcon,
  PencilIcon,
  PhoneIcon,
  ReceiptIcon,
  ReceiptTextIcon,
  RecycleIcon,
  RefreshCwIcon,
  SaveIcon,
  ScaleIcon,
  SearchCheckIcon,
  SearchIcon,
  SendIcon,
  ShieldCheckIcon,
  ShoppingCartIcon,
  SmartphoneIcon,
  SparklesIcon,
  SplitIcon,
  StoreIcon,
  TagIcon,
  ToggleRightIcon,
  TriangleAlertIcon,
  TruckIcon,
  UserCheckIcon,
  UsersIcon,
  WalletIcon,
  ZapOffIcon,
} from "lucide-react";

import type { IllustrationName } from "@/components/illustrations";

import type { SupportRole, SupportTopic } from "./support-api";

/**
 * The help centre's content, as data. Every string lives in the `help`
 * namespace of `messages/en.json`; this file only says which keys exist, in
 * what order, and which picture goes with each. `content.test.ts` checks that
 * every key here has English copy.
 *
 * Message paths:
 * - guides:    `help.guides.<key>.{title,summary}` and
 *              `help.guides.<key>.steps.<step>.{title,body}`
 * - FAQs:      `help.faqs.<key>.{q,a}`
 * - tutorials: `help.tutorials.<key>`
 * - training:  `help.modules.<key>.{title,p1,p2,p3}`
 */

// --- Roles and topics -------------------------------------------------------

export const HELP_ROLES = [
  "household",
  "kabadiwala",
  "yard",
  "recycler",
  "manufacturer",
  "saathi",
] as const;

export type HelpRole = (typeof HELP_ROLES)[number];

export function isHelpRole(value: string): value is HelpRole {
  return (HELP_ROLES as readonly string[]).includes(value);
}

/** What a guide or question is about. Labels: `help.topics.<topic>`. */
export const HELP_TOPICS = [
  "start",
  "signIn",
  "pickups",
  "prices",
  "weighing",
  "payments",
  "trading",
  "documents",
  "safety",
  "carbon",
  "disputes",
  "privacy",
] as const;

export type HelpTopic = (typeof HELP_TOPICS)[number];

export function isHelpTopic(value: string): value is HelpTopic {
  return (HELP_TOPICS as readonly string[]).includes(value);
}

export const TOPIC_ICONS: Record<HelpTopic, LucideIcon> = {
  start: CompassIcon,
  signIn: MessageSquareTextIcon,
  pickups: TruckIcon,
  prices: IndianRupeeIcon,
  weighing: ScaleIcon,
  payments: WalletIcon,
  trading: HandshakeIcon,
  documents: FileCheckIcon,
  safety: HardHatIcon,
  carbon: LeafIcon,
  disputes: MessageCircleWarningIcon,
  privacy: LockIcon,
};

// --- Guides -------------------------------------------------------------------

export interface GuideStep {
  key: string;
  icon: LucideIcon;
  /** A spot illustration shown instead of the icon. */
  art?: IllustrationName;
}

export interface GuideDef {
  topic: HelpTopic;
  icon: LucideIcon;
  /** The picture at the top of the guide. */
  art?: IllustrationName;
  steps: readonly GuideStep[];
}

const GUIDES = {
  // Shared by several roles
  signIn: {
    topic: "signIn",
    icon: MessageSquareTextIcon,
    art: "smsCodePhone",
    steps: [
      { key: "open", icon: GlobeIcon },
      { key: "number", icon: SmartphoneIcon },
      { key: "code", icon: MessageSquareTextIcon },
      { key: "stay", icon: ShieldCheckIcon },
    ],
  },
  safetyAtWork: {
    topic: "safety",
    icon: HardHatIcon,
    art: "saathiWorker",
    steps: [
      { key: "gear", icon: HardHatIcon },
      { key: "lift", icon: PackageIcon },
      { key: "sharp", icon: TriangleAlertIcon },
      { key: "batteries", icon: BatteryWarningIcon },
      { key: "machines", icon: CogIcon },
      { key: "firstAid", icon: BriefcaseMedicalIcon },
    ],
  },
  verifyBusiness: {
    topic: "documents",
    icon: BadgeCheckIcon,
    art: "handshake",
    steps: [
      { key: "start", icon: ClipboardListIcon },
      { key: "details", icon: Building2Icon },
      { key: "consent", icon: FileCheckIcon },
      { key: "photos", icon: CameraIcon },
      { key: "review", icon: ClockIcon },
      { key: "live", icon: BadgeCheckIcon },
    ],
  },
  escrow: {
    topic: "payments",
    icon: ShieldCheckIcon,
    art: "escrowShield",
    steps: [
      { key: "request", icon: ShoppingCartIcon },
      { key: "accept", icon: CircleCheckIcon },
      { key: "pay", icon: ShieldCheckIcon },
      { key: "dispatch", icon: TruckIcon },
      { key: "confirm", icon: PackageCheckIcon },
    ],
  },
  paperwork: {
    topic: "trading",
    icon: ReceiptTextIcon,
    steps: [
      { key: "invoice", icon: ReceiptTextIcon },
      { key: "ewayBill", icon: FileTextIcon },
      { key: "vehicle", icon: TruckIcon, art: "autoPickup" },
      { key: "keep", icon: ArchiveIcon },
    ],
  },
  tradeDisputes: {
    topic: "disputes",
    icon: MessageCircleWarningIcon,
    art: "weighingScale",
    steps: [
      { key: "check", icon: ScaleIcon },
      { key: "hold", icon: CirclePauseIcon },
      { key: "report", icon: CameraIcon },
      { key: "settle", icon: UsersIcon },
    ],
  },
  carbonEpr: {
    topic: "carbon",
    icon: LeafIcon,
    art: "solarRoof",
    steps: [
      { key: "record", icon: ClipboardCheckIcon },
      { key: "carbon", icon: LeafIcon },
      { key: "epr", icon: FactoryIcon, art: "factory" },
      { key: "certificates", icon: FileBadgeIcon },
      { key: "proof", icon: SearchCheckIcon },
    ],
  },

  // Households
  firstPickup: {
    topic: "pickups",
    icon: CameraIcon,
    art: "householdScrap",
    steps: [
      { key: "photo", icon: CameraIcon },
      { key: "estimate", icon: SparklesIcon },
      { key: "choose", icon: MapPinIcon },
      { key: "slot", icon: CalendarClockIcon },
      { key: "code", icon: MessageSquareTextIcon, art: "smsCodePhone" },
      { key: "track", icon: LinkIcon },
    ],
  },
  getReady: {
    topic: "pickups",
    icon: PackageIcon,
    steps: [
      { key: "paper", icon: NewspaperIcon },
      { key: "bottles", icon: CupSodaIcon },
      { key: "metal", icon: MagnetIcon },
      { key: "ewaste", icon: BatteryIcon },
      { key: "door", icon: DoorOpenIcon },
    ],
  },
  trackPickup: {
    topic: "pickups",
    icon: LinkIcon,
    art: "autoPickup",
    steps: [
      { key: "open", icon: LinkIcon },
      { key: "when", icon: ClockIcon },
      { key: "who", icon: UserCheckIcon },
      { key: "after", icon: ReceiptIcon },
    ],
  },
  weighingAtDoor: {
    topic: "weighing",
    icon: ScaleIcon,
    art: "weighingScale",
    steps: [
      { key: "zero", icon: ScaleIcon },
      { key: "each", icon: LayersIcon },
      { key: "amount", icon: CalculatorIcon },
      { key: "pay", icon: BanknoteIcon },
      { key: "receipt", icon: ReceiptTextIcon },
    ],
  },
  howPricesWork: {
    topic: "prices",
    icon: IndianRupeeIcon,
    steps: [
      { key: "estimate", icon: ChartNoAxesColumnIcon },
      { key: "own", icon: StoreIcon },
      { key: "floor", icon: ShieldCheckIcon },
      { key: "final", icon: ScaleIcon },
    ],
  },
  cancelBooking: {
    topic: "pickups",
    icon: CircleXIcon,
    steps: [
      { key: "open", icon: LinkIcon },
      { key: "cancel", icon: CircleXIcon },
      { key: "declined", icon: RefreshCwIcon },
      { key: "help", icon: PhoneIcon },
    ],
  },
  batteriesAtHome: {
    topic: "safety",
    icon: BatteryWarningIcon,
    steps: [
      { key: "apart", icon: BatteryIcon },
      { key: "tape", icon: ZapOffIcon },
      { key: "swollen", icon: TriangleAlertIcon },
      { key: "handover", icon: MonitorSmartphoneIcon },
    ],
  },

  // Kabadiwalas
  registerShop: {
    topic: "documents",
    icon: StoreIcon,
    art: "kabadiShop",
    steps: [
      { key: "start", icon: ClipboardListIcon },
      { key: "shop", icon: StoreIcon },
      { key: "pickups", icon: TruckIcon },
      { key: "gst", icon: FileTextIcon },
      { key: "review", icon: ClockIcon },
    ],
  },
  pickupRequests: {
    topic: "pickups",
    icon: BellIcon,
    art: "autoPickup",
    steps: [
      { key: "see", icon: BellIcon },
      { key: "answer", icon: CircleCheckIcon },
      { key: "auto", icon: ToggleRightIcon },
      { key: "go", icon: PhoneIcon },
    ],
  },
  weighAndPay: {
    topic: "weighing",
    icon: ScaleIcon,
    art: "weighingScale",
    steps: [
      { key: "zero", icon: ScaleIcon },
      { key: "weigh", icon: LayersIcon },
      { key: "total", icon: CalculatorIcon },
      { key: "pay", icon: BanknoteIcon },
      { key: "save", icon: SaveIcon },
    ],
  },
  setPrices: {
    topic: "prices",
    icon: TagIcon,
    steps: [
      { key: "open", icon: TagIcon },
      { key: "enter", icon: PencilIcon },
      { key: "floor", icon: ShieldCheckIcon },
      { key: "blank", icon: CircleDashedIcon },
      { key: "history", icon: HistoryIcon },
    ],
  },
  stockAndSell: {
    topic: "trading",
    icon: PackageIcon,
    art: "yardBales",
    steps: [
      { key: "grows", icon: PackageIcon },
      { key: "sort", icon: SplitIcon },
      { key: "show", icon: EyeIcon },
      { key: "sell", icon: HandshakeIcon, art: "escrowShield" },
    ],
  },
  householdDisagrees: {
    topic: "disputes",
    icon: MessageCircleWarningIcon,
    steps: [
      { key: "reweigh", icon: ScaleIcon },
      { key: "show", icon: SmartphoneIcon },
      { key: "noForce", icon: HandIcon },
      { key: "call", icon: PhoneIcon },
    ],
  },

  // Yards
  buyFromKabadiwalas: {
    topic: "trading",
    icon: ShoppingCartIcon,
    art: "kabadiShop",
    steps: [
      { key: "browse", icon: SearchIcon },
      { key: "request", icon: SendIcon },
      { key: "pay", icon: ShieldCheckIcon },
      { key: "collect", icon: TruckIcon },
      { key: "confirm", icon: PackageCheckIcon },
    ],
  },
  sellToRecyclers: {
    topic: "trading",
    icon: TagIcon,
    art: "yardBales",
    steps: [
      { key: "list", icon: TagIcon },
      { key: "requests", icon: InboxIcon },
      { key: "accept", icon: CircleCheckIcon },
      { key: "dispatch", icon: TruckIcon },
      { key: "paid", icon: WalletIcon },
    ],
  },

  // Recyclers
  buyFromYards: {
    topic: "trading",
    icon: ShoppingCartIcon,
    art: "yardBales",
    steps: [
      { key: "browse", icon: SearchIcon },
      { key: "request", icon: SendIcon },
      { key: "pay", icon: ShieldCheckIcon },
      { key: "confirm", icon: PackageCheckIcon },
    ],
  },
  sellRecycled: {
    topic: "trading",
    icon: PackagePlusIcon,
    art: "recyclerMachine",
    steps: [
      { key: "list", icon: PackagePlusIcon },
      { key: "orders", icon: InboxIcon },
      { key: "load", icon: ShieldCheckIcon },
      { key: "paid", icon: WalletIcon },
    ],
  },

  // Manufacturers
  orderRecycled: {
    topic: "trading",
    icon: ShoppingCartIcon,
    art: "factory",
    steps: [
      { key: "browse", icon: SearchIcon },
      { key: "order", icon: SendIcon },
      { key: "pay", icon: ShieldCheckIcon },
      { key: "receive", icon: TruckIcon },
      { key: "confirm", icon: PackageCheckIcon },
    ],
  },
  checkDelivery: {
    topic: "weighing",
    icon: ClipboardCheckIcon,
    steps: [
      { key: "papers", icon: FileTextIcon },
      { key: "weigh", icon: ScaleIcon, art: "weighingScale" },
      { key: "look", icon: EyeIcon },
      { key: "decide", icon: CheckCheckIcon },
    ],
  },

  // Saathis
  becomeSaathi: {
    topic: "documents",
    icon: IdCardIcon,
    art: "handshake",
    steps: [
      { key: "start", icon: ClipboardListIcon },
      { key: "work", icon: BriefcaseIcon },
      { key: "area", icon: MapPinIcon },
      { key: "id", icon: IdCardIcon },
      { key: "review", icon: ClockIcon },
    ],
  },
  findJobs: {
    topic: "start",
    icon: BriefcaseIcon,
    steps: [
      { key: "home", icon: HouseIcon },
      { key: "accept", icon: CircleCheckIcon },
      { key: "arrive", icon: ClockIcon },
      { key: "done", icon: CheckCheckIcon },
    ],
  },
  homePickup: {
    topic: "pickups",
    icon: TruckIcon,
    art: "autoPickup",
    steps: [
      { key: "call", icon: PhoneIcon },
      { key: "greet", icon: UserCheckIcon },
      { key: "weigh", icon: ScaleIcon },
      { key: "record", icon: SaveIcon },
      { key: "deliver", icon: StoreIcon },
    ],
  },
  saathiPay: {
    topic: "payments",
    icon: WalletIcon,
    steps: [
      { key: "agree", icon: HandshakeIcon },
      { key: "earnings", icon: WalletIcon },
      { key: "upi", icon: SmartphoneIcon },
      { key: "problem", icon: PhoneIcon },
    ],
  },
} as const satisfies Record<string, GuideDef>;

export type GuideKey = keyof typeof GUIDES;

// --- Questions ------------------------------------------------------------------

const FAQS = {
  // Shared by several roles
  noCode: "signIn",
  newPhone: "signIn",
  deleteData: "privacy",
  verifyTime: "documents",

  // Households
  noAccount: "start",
  whatCanISell: "pickups",
  howPriceWorks: "prices",
  howPaid: "payments",
  recyclePoints: "payments",
  weightWrong: "disputes",
  canCancel: "pickups",
  kabadiwalasChecked: "documents",
  whoSeesAddress: "privacy",
  photosKept: "privacy",

  // Kabadiwalas
  whyVerify: "documents",
  gstNeeded: "documents",
  ownPrices: "prices",
  noVehicle: "pickups",
  autoAccept: "pickups",
  rejectRequest: "pickups",
  payHousehold: "payments",
  paidByYard: "payments",
  whoSeesShop: "privacy",

  // Yards, recyclers and manufacturers
  consentDocs: "documents",
  noConsentNeeded: "documents",
  consentExpiry: "documents",
  findStock: "trading",
  whoSetsPrice: "prices",
  whatIsEscrow: "payments",
  whenSellerPaid: "payments",
  shortLoad: "disputes",
  ewayBill: "trading",
  whoSeesBusiness: "privacy",
  pwpRegistration: "documents",
  buyFromAnyYard: "trading",
  eprRecords: "carbon",
  carbonCredits: "carbon",
  whatCanIBuy: "trading",
  qualityWrong: "disputes",
  recycledContent: "carbon",
  carbonClaims: "carbon",

  // Saathis
  whoCanJoin: "start",
  whichId: "documents",
  fullAadhaar: "privacy",
  needVehicle: "start",
  whoPaysMe: "payments",
  chooseHours: "start",
  safetyGear: "safety",
  whoSeesId: "privacy",
  jobWentWrong: "disputes",
} as const satisfies Record<string, HelpTopic>;

export type FaqKey = keyof typeof FAQS;

// --- Videos and training ----------------------------------------------------------

/** Tutorial videos: minutes long. The videos themselves are still being made. */
const TUTORIALS = {
  bookInTwoMinutes: 2,
  sortAtHome: 3,
  batterySafety: 2,
  firstDay: 4,
  weighAndPayVideo: 2,
  settingPrices: 3,
  buyingFromKabadiwalas: 3,
  listingBales: 3,
  escrowExplained: 2,
  buyingFromYards: 3,
  sellingOutput: 3,
  eprPlainWords: 4,
  firstOrder: 3,
  checkingDelivery: 2,
  becomingSaathi: 3,
  goodPickup: 3,
  liftingSafely: 2,
} as const satisfies Record<string, number>;

export type TutorialKey = keyof typeof TUTORIALS;

export interface ModuleDef {
  minutes: number;
  icon: LucideIcon;
  /** The guide that teaches this lesson in full. */
  guide: GuideKey;
}

const MODULES = {
  whatRecycles: { minutes: 2, icon: RecycleIcon, guide: "getReady" },
  sortOnce: { minutes: 2, icon: LayersIcon, guide: "getReady" },
  batteriesSafe: {
    minutes: 2,
    icon: BatteryWarningIcon,
    guide: "batteriesAtHome",
  },
  fairWeigh: { minutes: 2, icon: ScaleIcon, guide: "weighingAtDoor" },
  usingTheApp: { minutes: 3, icon: SmartphoneIcon, guide: "pickupRequests" },
  weighingFairly: { minutes: 3, icon: ScaleIcon, guide: "weighAndPay" },
  safeHandling: { minutes: 3, icon: HardHatIcon, guide: "safetyAtWork" },
  servingHouseholds: {
    minutes: 2,
    icon: HeartHandshakeIcon,
    guide: "householdDisagrees",
  },
  sellingToYards: { minutes: 3, icon: HandshakeIcon, guide: "stockAndSell" },
  buyingStock: {
    minutes: 3,
    icon: ShoppingCartIcon,
    guide: "buyFromKabadiwalas",
  },
  tradingWithEscrow: { minutes: 3, icon: ShieldCheckIcon, guide: "escrow" },
  papersForLoads: { minutes: 2, icon: ReceiptTextIcon, guide: "paperwork" },
  siteSafety: { minutes: 3, icon: HardHatIcon, guide: "safetyAtWork" },
  buyingInputs: { minutes: 3, icon: ShoppingCartIcon, guide: "buyFromYards" },
  eprBasics: { minutes: 4, icon: FileBadgeIcon, guide: "carbonEpr" },
  orderingRecycled: {
    minutes: 3,
    icon: ShoppingCartIcon,
    guide: "orderRecycled",
  },
  checkingDeliveries: {
    minutes: 2,
    icon: ClipboardCheckIcon,
    guide: "checkDelivery",
  },
  firstJob: { minutes: 3, icon: BriefcaseIcon, guide: "findJobs" },
  inPeoplesHomes: { minutes: 2, icon: HouseIcon, guide: "homePickup" },
  gettingPaid: { minutes: 2, icon: WalletIcon, guide: "saathiPay" },
} as const satisfies Record<string, ModuleDef>;

export type ModuleKey = keyof typeof MODULES;

// --- Each role's help -------------------------------------------------------------

export interface RoleHelp {
  art: IllustrationName;
  guides: readonly GuideKey[];
  faqs: readonly FaqKey[];
  tutorials: readonly TutorialKey[];
  training: readonly ModuleKey[];
}

export const ROLE_HELP: Record<HelpRole, RoleHelp> = {
  household: {
    art: "householdScrap",
    guides: [
      "firstPickup",
      "getReady",
      "trackPickup",
      "weighingAtDoor",
      "howPricesWork",
      "cancelBooking",
      "batteriesAtHome",
    ],
    faqs: [
      "noAccount",
      "whatCanISell",
      "howPriceWorks",
      "howPaid",
      "recyclePoints",
      "weightWrong",
      "canCancel",
      "kabadiwalasChecked",
      "noCode",
      "whoSeesAddress",
      "photosKept",
      "deleteData",
    ],
    tutorials: ["bookInTwoMinutes", "sortAtHome", "batterySafety"],
    training: ["whatRecycles", "sortOnce", "batteriesSafe", "fairWeigh"],
  },
  kabadiwala: {
    art: "kabadiShop",
    guides: [
      "signIn",
      "registerShop",
      "pickupRequests",
      "weighAndPay",
      "setPrices",
      "stockAndSell",
      "safetyAtWork",
      "householdDisagrees",
    ],
    faqs: [
      "whyVerify",
      "verifyTime",
      "gstNeeded",
      "ownPrices",
      "noVehicle",
      "autoAccept",
      "rejectRequest",
      "payHousehold",
      "paidByYard",
      "noCode",
      "newPhone",
      "whoSeesShop",
    ],
    tutorials: ["firstDay", "weighAndPayVideo", "settingPrices"],
    training: [
      "usingTheApp",
      "weighingFairly",
      "safeHandling",
      "servingHouseholds",
      "sellingToYards",
    ],
  },
  yard: {
    art: "yardBales",
    guides: [
      "signIn",
      "verifyBusiness",
      "buyFromKabadiwalas",
      "sellToRecyclers",
      "escrow",
      "paperwork",
      "tradeDisputes",
      "safetyAtWork",
    ],
    faqs: [
      "consentDocs",
      "noConsentNeeded",
      "verifyTime",
      "consentExpiry",
      "findStock",
      "whoSetsPrice",
      "whatIsEscrow",
      "whenSellerPaid",
      "shortLoad",
      "ewayBill",
      "noCode",
      "whoSeesBusiness",
    ],
    tutorials: ["buyingFromKabadiwalas", "listingBales", "escrowExplained"],
    training: [
      "buyingStock",
      "tradingWithEscrow",
      "papersForLoads",
      "siteSafety",
    ],
  },
  recycler: {
    art: "recyclerMachine",
    guides: [
      "signIn",
      "verifyBusiness",
      "buyFromYards",
      "sellRecycled",
      "escrow",
      "carbonEpr",
      "tradeDisputes",
      "safetyAtWork",
    ],
    faqs: [
      "consentDocs",
      "pwpRegistration",
      "verifyTime",
      "consentExpiry",
      "buyFromAnyYard",
      "whatIsEscrow",
      "whenSellerPaid",
      "shortLoad",
      "ewayBill",
      "eprRecords",
      "carbonCredits",
      "whoSeesBusiness",
    ],
    tutorials: ["buyingFromYards", "sellingOutput", "eprPlainWords"],
    training: ["buyingInputs", "tradingWithEscrow", "eprBasics", "siteSafety"],
  },
  manufacturer: {
    art: "factory",
    guides: [
      "signIn",
      "verifyBusiness",
      "orderRecycled",
      "checkDelivery",
      "escrow",
      "paperwork",
      "carbonEpr",
      "tradeDisputes",
    ],
    faqs: [
      "consentDocs",
      "verifyTime",
      "consentExpiry",
      "whatCanIBuy",
      "whatIsEscrow",
      "whenSellerPaid",
      "qualityWrong",
      "ewayBill",
      "recycledContent",
      "carbonClaims",
      "noCode",
      "whoSeesBusiness",
    ],
    tutorials: ["firstOrder", "checkingDelivery", "eprPlainWords"],
    training: [
      "orderingRecycled",
      "checkingDeliveries",
      "tradingWithEscrow",
      "eprBasics",
    ],
  },
  saathi: {
    art: "saathiWorker",
    guides: [
      "signIn",
      "becomeSaathi",
      "findJobs",
      "homePickup",
      "safetyAtWork",
      "saathiPay",
    ],
    faqs: [
      "whoCanJoin",
      "whichId",
      "fullAadhaar",
      "verifyTime",
      "needVehicle",
      "whoPaysMe",
      "chooseHours",
      "safetyGear",
      "whoSeesId",
      "jobWentWrong",
      "noCode",
      "newPhone",
    ],
    tutorials: ["becomingSaathi", "goodPickup", "liftingSafely"],
    training: ["firstJob", "safeHandling", "inPeoplesHomes", "gettingPaid"],
  },
};

// --- Lookups ------------------------------------------------------------------------

export interface Guide extends GuideDef {
  key: GuideKey;
  slug: string;
}

export interface Faq {
  key: FaqKey;
  topic: HelpTopic;
}

export interface Tutorial {
  key: TutorialKey;
  minutes: number;
}

export interface TrainingModule extends ModuleDef {
  key: ModuleKey;
}

/** `weighAndPay` → `weigh-and-pay`: the guide's URL segment. */
export function slugFor(key: string): string {
  return key.replaceAll(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

export function guide(key: GuideKey): Guide {
  return { key, slug: slugFor(key), ...GUIDES[key] };
}

export function guidesFor(role: HelpRole): Guide[] {
  return ROLE_HELP[role].guides.map((key) => guide(key));
}

/** The guide at `/help/<role>/<slug>`, if that role has it. */
export function findGuide(role: HelpRole, slug: string): Guide | undefined {
  return guidesFor(role).find((candidate) => candidate.slug === slug);
}

export function faq(key: FaqKey): Faq {
  return { key, topic: FAQS[key] };
}

export function faqsFor(role: HelpRole): Faq[] {
  return ROLE_HELP[role].faqs.map((key) => faq(key));
}

export function tutorialsFor(role: HelpRole): Tutorial[] {
  return ROLE_HELP[role].tutorials.map((key) => ({
    key,
    minutes: TUTORIALS[key],
  }));
}

export function trainingFor(role: HelpRole): TrainingModule[] {
  return ROLE_HELP[role].training.map((key) => ({ key, ...MODULES[key] }));
}

/** Every role whose help lists this guide, in role order. */
export function rolesWithGuide(key: GuideKey): HelpRole[] {
  return HELP_ROLES.filter((role) => ROLE_HELP[role].guides.includes(key));
}

export function rolesWithFaq(key: FaqKey): HelpRole[] {
  return HELP_ROLES.filter((role) => ROLE_HELP[role].faqs.includes(key));
}

/** Every guide and question key, each once, for search and for tests. */
export const ALL_GUIDE_KEYS = Object.keys(GUIDES) as GuideKey[];
export const ALL_FAQ_KEYS = Object.keys(FAQS) as FaqKey[];
export const ALL_TUTORIAL_KEYS = Object.keys(TUTORIALS) as TutorialKey[];
export const ALL_MODULE_KEYS = Object.keys(MODULES) as ModuleKey[];

/** The anchor a question is linked at on its role's page. */
export function faqAnchor(key: FaqKey): string {
  return `faq-${slugFor(key)}`;
}

// --- Contact ------------------------------------------------------------------------

/** The contact form's topic when someone arrives from a guide or question. */
const SUPPORT_TOPIC_FOR: Record<HelpTopic, SupportTopic> = {
  start: "account",
  signIn: "account",
  pickups: "pickup",
  prices: "prices",
  weighing: "pickup",
  payments: "payments",
  trading: "trade",
  documents: "documents",
  safety: "other",
  carbon: "other",
  disputes: "trade",
  privacy: "account",
};

export function supportTopicFor(
  topic: HelpTopic,
  role: HelpRole,
): SupportTopic {
  // A household's or a kabadiwala's disagreement is about a pickup.
  const isAboutAPickup =
    topic === "disputes" && (role === "household" || role === "kabadiwala");
  return isAboutAPickup ? "pickup" : SUPPORT_TOPIC_FOR[topic];
}

/** `/help/contact`, pre-filled with who is asking and what about. */
export function contactHref(role?: SupportRole, topic?: SupportTopic) {
  const query: Record<string, string> = {};
  if (role) query.role = role;
  if (topic) query.topic = topic;
  return { pathname: "/help/contact", query } as const;
}
