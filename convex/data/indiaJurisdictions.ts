/* eslint-disable sonarjs/no-clear-text-protocols, unicorn/prefer-https -- Preserve official directory URLs as source evidence; this module makes no network requests. */
import { INDIA_STATES_AND_UTS } from "../lib/geography";

type JurisdictionName = (typeof INDIA_STATES_AND_UTS)[number];
type AuthorityRow = readonly [
  authorityName: string,
  authorityUrl: string,
  sourceLocator: string,
];

export interface IndiaJurisdictionReference {
  readonly jurisdiction: JurisdictionName;
  readonly authorityName: string | null;
  readonly authorityUrl: string | null;
  readonly sourceUrl: string;
  readonly sourceLocator: string;
  readonly sourceAsOf: string | null;
  readonly retrievedOn: string;
  readonly reviewStatus: "directory_listed" | "needs_review";
  readonly reviewNote: string | null;
  readonly supportingSources: readonly {
    readonly url: string;
    readonly locator: string;
  }[];
}

const CPCB_WEBSITES = "https://cpcb.gov.in/spcbs-pccs/";
const CPCB_DIRECTORY = "https://cpcb.gov.in/uploads/SPCB_Directory.pdf";

// Names and URLs are source-reported references, not approved operating scopes.
const authorityRows = {
  "Andaman and Nicobar Islands": [
    "Andaman & Nicobar Islands Pollution Control Committee",
    "http://andssw1.and.nic.in/swc/depts/pcc/",
    "Pollution Control Committees website table, row 5",
  ],
  "Andhra Pradesh": [
    "Andhra Pradesh State Pollution Control Board",
    "https://pcb.ap.gov.in/",
    "State Pollution Control Boards website table, row 1",
  ],
  "Arunachal Pradesh": [
    "Arunachal Pradesh State Pollution Control Board",
    "https://apspcb.net/",
    "State Pollution Control Boards website table, row 2",
  ],
  Assam: [
    "Assam State Pollution Control Board",
    "http://www.pcbassam.org",
    "State Pollution Control Boards website table, row 3",
  ],
  Bihar: [
    "Bihar State Pollution Control Board",
    "https://bspcb.bihar.gov.in/",
    "State Pollution Control Boards website table, row 4",
  ],
  Chandigarh: [
    "Chandigarh Pollution Control Committee",
    "https://cpcc.chd.gov.in/",
    "Pollution Control Committees website table, row 3",
  ],
  Chhattisgarh: [
    "Chhattisgarh Environment Conservation Board",
    "http://www.enviscecb.org",
    "State Pollution Control Boards website table, row 5",
  ],
  "Dadra and Nagar Haveli and Daman and Diu": [
    "Daman & Diu and Dadra & Nagar Haveli Pollution Control Committee",
    "https://ddd.gov.in/pollution-control-committee/",
    "Pollution Control Committees website table, row 4",
  ],
  Delhi: [
    "Delhi Pollution Control Committee",
    "http://www.dpcc.delhigovt.nic.in/indexdup.php",
    "Pollution Control Committees website table, row 1",
  ],
  Goa: [
    "Goa State Pollution Control Board",
    "https://goaspcb.gov.in/",
    "State Pollution Control Boards website table, row 6",
  ],
  Gujarat: [
    "Gujarat State Pollution Control Board",
    "http://gpcb.gov.in",
    "State Pollution Control Boards website table, row 7",
  ],
  Haryana: [
    "Haryana State Pollution Control Board",
    "http://hspcb.gov.in",
    "State Pollution Control Boards website table, row 8",
  ],
  "Himachal Pradesh": [
    "Himachal Pradesh State Pollution Control Board",
    "http://hppcb.nic.in",
    "State Pollution Control Boards website table, row 9",
  ],
  "Jammu and Kashmir": [
    "Jammu & Kashmir State Pollution Control Board",
    "https://jkpcb.jk.gov.in/",
    "State Pollution Control Boards website table, row 10",
  ],
  Jharkhand: [
    "Jharkhand State Pollution Control Board",
    "https://jspcb.org.in/",
    "State Pollution Control Boards website table, row 11",
  ],
  Karnataka: [
    "Karnataka State Pollution Control Board",
    "https://kspcb.karnataka.gov.in",
    "State Pollution Control Boards website table, row 12",
  ],
  Kerala: [
    "Kerala State Pollution Control Board",
    "https://kspcb.kerala.gov.in/",
    "State Pollution Control Boards website table, row 13",
  ],
  Ladakh: [
    "Ladakh Pollution Control Committee",
    "https://ladakh.gov.in/document-category/ladakh-pollution-control-committee/",
    "CPCB directory PDF, entry 14, printed page 4; Ladakh administration committee page",
  ],
  Lakshadweep: [
    "Lakshadweep Pollution Control Committee",
    "https://lpcc.utl.gov.in/",
    "Pollution Control Committees website table, row 6",
  ],
  "Madhya Pradesh": [
    "Madhya Pradesh State Pollution Control Board",
    "https://www.mppcb.mp.gov.in/",
    "State Pollution Control Boards website table, row 14",
  ],
  Maharashtra: [
    "Maharashtra State Pollution Control Board",
    "http://mpcb.gov.in",
    "State Pollution Control Boards website table, row 15",
  ],
  Manipur: [
    "Manipur State Pollution Control Board",
    "https://manipcb.nic.in/",
    "State Pollution Control Boards website table, row 16",
  ],
  Meghalaya: [
    "Meghalaya State Pollution Control Board",
    "http://megspcb.gov.in",
    "State Pollution Control Boards website table, row 17",
  ],
  Mizoram: [
    "Mizoram State Pollution Control Board",
    "https://mpcb.mizoram.gov.in/",
    "State Pollution Control Boards website table, row 18",
  ],
  Nagaland: [
    "Nagaland State Pollution Control Board",
    "https://npcb.nagaland.gov.in/?cat=5",
    "State Pollution Control Boards website table, row 19",
  ],
  Odisha: [
    "Odisha State Pollution Control Board",
    "https://ospcboard.odisha.gov.in/",
    "State Pollution Control Boards website table, row 20",
  ],
  Puducherry: [
    "Puducherry Pollution Control Committee",
    "https://dste.py.gov.in/ppcc/Index.html",
    "Pollution Control Committees website table, row 2",
  ],
  Punjab: [
    "Punjab State Pollution Control Board",
    "https://ppcb.punjab.gov.in/en/",
    "State Pollution Control Boards website table, row 21",
  ],
  Rajasthan: [
    "Rajasthan State Pollution Control Board",
    "https://environment.rajasthan.gov.in/content/environment/en/rajasthan-state-pollution-control-board.html#",
    "State Pollution Control Boards website table, row 22",
  ],
  Sikkim: [
    "Sikkim State Pollution Control Board",
    "https://spcb.sikkim.gov.in/index.html",
    "State Pollution Control Boards website table, row 23",
  ],
  "Tamil Nadu": [
    "Tamil Nadu State Pollution Control Board",
    "http://www.tnpcb.gov.in",
    "State Pollution Control Boards website table, row 24",
  ],
  Telangana: [
    "Telangana Pollution Control Board",
    "https://tgpcb.cgg.gov.in/",
    "State Pollution Control Boards website table, row 25",
  ],
  Tripura: [
    "Tripura State Pollution Control Board",
    "http://tspcb.tripura.gov.in",
    "State Pollution Control Boards website table, row 26",
  ],
  "Uttar Pradesh": [
    "Uttar Pradesh State Pollution Control Board",
    "http://www.uppcb.com",
    "State Pollution Control Boards website table, row 27",
  ],
  Uttarakhand: [
    "Uttrakhand State Pollution Control Board",
    "http://ueppcb.uk.gov.in",
    "State Pollution Control Boards website table, row 28",
  ],
  "West Bengal": [
    "West Bengal State Pollution Control Board",
    "http://www.wbpcb.gov.in",
    "State Pollution Control Boards website table, row 29",
  ],
} as const satisfies Record<JurisdictionName, AuthorityRow>;

const reviewNotes: Partial<Record<JurisdictionName, string>> = {
  "Dadra and Nagar Haveli and Daman and Diu":
    "One merged jurisdiction. CPCB reports the former territory names in a different order; no separate former-territory authorities are inferred.",
  "Jammu and Kashmir":
    "CPCB reports State Pollution Control Board, but the J&K government's Order 10 JKPCC of 2022 uses Pollution Control Committee. The current authority designation needs review; the listed site timed out during retrieval.",
  Ladakh:
    "The CPCB website table omits Ladakh. Its linked directory PDF and the Ladakh administration identify a separate committee; another jurisdiction's authority is not inferred.",
  Uttarakhand:
    "The authority name preserves CPCB's reported spelling Uttrakhand; the jurisdiction uses the existing canonical geography name Uttarakhand.",
};

const supportingSources: Partial<
  Record<JurisdictionName, IndiaJurisdictionReference["supportingSources"]>
> = {
  "Dadra and Nagar Haveli and Daman and Diu": [
    {
      url: "https://ddd.gov.in/pollution-control-committee/",
      locator:
        "Merged Union Territory administration, Pollution Control Committee page",
    },
  ],
  "Jammu and Kashmir": [
    {
      url: "https://singlewindow.jk.gov.in/uploads/files/act_0528476001658560319.pdf",
      locator: "Order 10 JKPCC of 2022, dated 19 July 2022, page 1 heading",
    },
  ],
  Ladakh: [
    {
      url: "https://ladakh.gov.in/document-category/ladakh-pollution-control-committee/",
      locator: "Ladakh administration, committee document category heading",
    },
  ],
};

/** Directory references never authorize a facility, material route or dispatch. */
export const INDIA_JURISDICTIONS: readonly IndiaJurisdictionReference[] =
  INDIA_STATES_AND_UTS.map((jurisdiction) => {
    const [authorityName, authorityUrl, sourceLocator] =
      authorityRows[jurisdiction];
    return {
      jurisdiction,
      authorityName,
      authorityUrl,
      sourceUrl: jurisdiction === "Ladakh" ? CPCB_DIRECTORY : CPCB_WEBSITES,
      sourceLocator,
      sourceAsOf: jurisdiction === "Ladakh" ? "2026-04-01" : "2026-04-27",
      retrievedOn: "2026-11-18",
      reviewStatus:
        jurisdiction === "Jammu and Kashmir"
          ? "needs_review"
          : "directory_listed",
      reviewNote: reviewNotes[jurisdiction] ?? null,
      supportingSources: supportingSources[jurisdiction] ?? [],
    };
  });

export const INDIA_JURISDICTION_COVERAGE = {
  total: INDIA_JURISDICTIONS.length,
  directoryListed: INDIA_JURISDICTIONS.filter(
    (entry) => entry.reviewStatus === "directory_listed",
  ).length,
  needsReview: INDIA_JURISDICTIONS.filter(
    (entry) => entry.reviewStatus === "needs_review",
  ).length,
};

export function getIndiaJurisdiction(
  name: string,
): IndiaJurisdictionReference | null {
  return (
    INDIA_JURISDICTIONS.find((entry) => entry.jurisdiction === name) ?? null
  );
}
