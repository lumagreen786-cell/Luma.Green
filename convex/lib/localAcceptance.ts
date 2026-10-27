import type { Doc } from "../_generated/dataModel";

export const LOCAL_ACCEPTANCE_PHONE_NUMBERS = {
  household: "+919000008001",
  "household-coordinator": "+919000008002",
  applicant: "+919000008003",
  kabadiwala: "+919000008004",
  preprocessor: "+919000008005",
  recycler: "+919000008006",
  manufacturer: "+919000008007",
  "fibre-maker": "+919000008008",
  "textile-maker": "+919000008009",
  "garment-maker": "+919000008010",
  saathi: "+919000008011",
  apartment: "+919000008012",
  office: "+919000008013",
  hotel: "+919000008014",
  resort: "+919000008015",
  "other-generator": "+919000008016",
  "city-official": "+919000008017",
  "csr-sponsor": "+919000008018",
  lender: "+919000008019",
  auditor: "+919000008020",
  union: "+919000008021",
  "apparel-brand": "+919000008022",
  "packaging-brand": "+919000008023",
  "team-admin": "+919000008024",
  "team-member": "+919000008025",
  "team-viewer": "+919000008026",
  "invite-recipient": "+919000008027",
  "unrelated-owner": "+919000008028",
} as const;

type Access =
  | { kind: "personal" }
  | { kind: "saathi" }
  | { kind: "org"; orgKind: Doc<"orgs">["kind"] }
  | {
      kind: "stakeholder";
      stakeholderKind: Doc<"stakeholderAccounts">["kind"];
      siteType?: NonNullable<Doc<"stakeholderAccounts">["siteType"]>;
    };

interface Persona {
  key: string;
  name: string;
  email: string;
  phone: string;
  access: Access;
}

const persona = (
  key: keyof typeof LOCAL_ACCEPTANCE_PHONE_NUMBERS,
  name: string,
  access: Access,
): Persona => ({
  key,
  name: `Local test ${name}`,
  email: `${key}@luma.test`,
  phone: LOCAL_ACCEPTANCE_PHONE_NUMBERS[key],
  access,
});

/** Synthetic identities only. Passwords and sessions never belong in this file. */
export const LOCAL_ACCEPTANCE_PERSONAS: readonly Persona[] = [
  persona("household", "household", { kind: "personal" }),
  // Coordinator permissions remain ungranted until the business scope is defined.
  persona("household-coordinator", "household coordinator", {
    kind: "personal",
  }),
  persona("applicant", "applicant", { kind: "personal" }),
  persona("kabadiwala", "kabadiwala owner", {
    kind: "org",
    orgKind: "kabadiwala",
  }),
  persona("preprocessor", "preprocessor owner", {
    kind: "org",
    orgKind: "yard",
  }),
  persona("recycler", "recycler owner", { kind: "org", orgKind: "recycler" }),
  persona("manufacturer", "manufacturer owner", {
    kind: "org",
    orgKind: "manufacturer",
  }),
  persona("fibre-maker", "fibre manufacturer", {
    kind: "org",
    orgKind: "manufacturer",
  }),
  persona("textile-maker", "textile manufacturer", {
    kind: "org",
    orgKind: "manufacturer",
  }),
  persona("garment-maker", "garment manufacturer", {
    kind: "org",
    orgKind: "manufacturer",
  }),
  persona("saathi", "Saathi", { kind: "saathi" }),
  persona("apartment", "apartment community", {
    kind: "stakeholder",
    stakeholderKind: "material_generator",
    siteType: "apartment_community",
  }),
  persona("office", "office", {
    kind: "stakeholder",
    stakeholderKind: "material_generator",
    siteType: "office",
  }),
  persona("hotel", "hotel", {
    kind: "stakeholder",
    stakeholderKind: "material_generator",
    siteType: "hotel",
  }),
  persona("resort", "resort", {
    kind: "stakeholder",
    stakeholderKind: "material_generator",
    siteType: "resort",
  }),
  persona("other-generator", "other material generator", {
    kind: "stakeholder",
    stakeholderKind: "material_generator",
    siteType: "other",
  }),
  persona("city-official", "city official", {
    kind: "stakeholder",
    stakeholderKind: "city_official",
  }),
  persona("csr-sponsor", "CSR sponsor", {
    kind: "stakeholder",
    stakeholderKind: "csr_sponsor",
  }),
  persona("lender", "lender", {
    kind: "stakeholder",
    stakeholderKind: "lender",
  }),
  persona("auditor", "independent auditor", {
    kind: "stakeholder",
    stakeholderKind: "independent_auditor",
  }),
  persona("union", "waste-picker union", {
    kind: "stakeholder",
    stakeholderKind: "waste_picker_union",
  }),
  persona("apparel-brand", "apparel brand", {
    kind: "stakeholder",
    stakeholderKind: "apparel_brand",
  }),
  persona("packaging-brand", "packaging brand", {
    kind: "stakeholder",
    stakeholderKind: "packaging_brand",
  }),
  // Grant these roles through the real invitation flow during acceptance.
  persona("team-admin", "workspace administrator candidate", {
    kind: "personal",
  }),
  persona("team-member", "workspace member candidate", { kind: "personal" }),
  persona("team-viewer", "workspace viewer candidate", { kind: "personal" }),
  persona("invite-recipient", "invitation recipient", { kind: "personal" }),
  persona("unrelated-owner", "unrelated business owner", {
    kind: "org",
    orgKind: "kabadiwala",
  }),
];

export function isLoopbackHttpOrigin(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
      !url.username &&
      !url.password &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}
