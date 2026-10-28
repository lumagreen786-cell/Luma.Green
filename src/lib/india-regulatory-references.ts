/** Dated research references. This catalogue is not a facility approval engine. */
export interface RegulatoryReference {
  id: string;
  stream: string;
  title: string;
  publisher: string;
  url: string;
  documentDate: string;
  effectiveDate?: string;
  reviewedOn: string;
  status: "notified" | "guidance" | "draft" | "portal";
  applicability: string;
  evidence: readonly string[];
  limits: string;
}

const OFFICIAL_HOSTS = new Set([
  "mpcb.gov.in",
  "egazette.gov.in",
  "eprplastic.cpcb.gov.in",
  "epr.cpcb.gov.in",
  "eprewaste.cpcb.gov.in",
  "eprbattery.cpcb.gov.in",
  "eprtyres.cpcb.gov.in",
  "eprusedoil.cpcb.gov.in",
  "eprelv.cpcb.gov.in",
  "beeindia.gov.in",
  "www.beeindia.gov.in",
  "indiancarbonmarket.gov.in",
  "cercind.gov.in",
  "www.cercind.gov.in",
]);

export function isOfficialReferenceUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      OFFICIAL_HOSTS.has(url.hostname) &&
      url.username === "" &&
      url.password === "" &&
      url.port === ""
    );
  } catch {
    return false;
  }
}

export const INDIA_REGULATORY_REFERENCES: readonly RegulatoryReference[] = [
  {
    id: "common-epr-current",
    stream: "Plastic",
    title: "Common EPR portal · current official destination",
    publisher: "Central Pollution Control Board",
    url: "https://epr.cpcb.gov.in/",
    documentDate: "Undated destination linked by CPCB migration notice",
    reviewedOn: "2026-10-28",
    status: "portal",
    applicability:
      "CPCB's legacy plastics portal directs stakeholders to this Common EPR destination after the 28 June 2026 migration.",
    evidence: [
      "Current account, registration and applicable portal records",
      "Authorized interface documentation and integration access before automation",
    ],
    limits:
      "Homepage retrieval timed out. Operation and API status were not independently verified; the destination is supported by CPCB's migration notice.",
  },
  {
    id: "carbon-trading-regulation-2026",
    stream: "Carbon",
    title: "CERC final Carbon Credit Certificate trading regulations, 2026",
    publisher: "Central Electricity Regulatory Commission",
    url: "https://cercind.gov.in/regulations/205-Noti.pdf",
    documentDate: "2026-02-27 notification",
    reviewedOn: "2026-10-28",
    status: "notified",
    applicability:
      "Final regulations designate Grid India registry and BEE transaction-procedure roles. CCC dealing uses approved Power Exchanges unless separately permitted, with separate compliance/offset segments and official registry balances.",
    evidence: [
      "Applicable approved exchange rules, operational channel and legal authority",
      "Official registry identifiers, ownership, certificate quantity and transaction evidence",
    ],
    limits:
      "Commencement is from Official Gazette publication; its exact date was not established. This notification does not authorize a Luma CCC exchange, establish operational contracts or grant API access.",
  },
  {
    id: "carbon-trading-proceedings-2026-10-23",
    stream: "Carbon",
    title: "CERC proceedings, 23 October 2026 · not market approval",
    publisher: "Central Electricity Regulatory Commission",
    url: "https://www.cercind.gov.in/2026/ROP/453-MP-2026-Ors_231026.pdf",
    documentDate: "2026-10-23 hearing; publication date not established",
    reviewedOn: "2026-10-28",
    status: "guidance",
    applicability:
      "The record admits exchange-contract petitions and directs stakeholder consultation. It records that BEE's transaction procedure remained to be formulated and sets the next hearing for 12 January 2027.",
    evidence: [
      "Subsequent final orders and approved operational exchange contracts",
      "Current official procedure, channel access and registry evidence before any transaction implementation",
    ],
    limits:
      "Procedural record only: not market approval. It concerns these petitions at the hearing date, not every possible later order. No Luma trading authority or public transaction API was established.",
  },
  {
    id: "swm-2026",
    stream: "Solid waste",
    title: "Solid Waste Management Rules, 2026",
    publisher: "MoEFCC · Gazette copy hosted by MPCB",
    url: "https://mpcb.gov.in/sites/default/files/standing_orders/SWM_2026.pdf",
    documentDate: "2026-01-27",
    effectiveDate: "2026-04-01",
    reviewedOn: "2026-10-28",
    status: "notified",
    applicability:
      "Replaces SWM 2016. Covers general solid waste and four source streams: wet, dry, sanitary and special care. Separately regulated waste keeps its own route.",
    evidence: [
      "Local-body permission and actual facility/site scope",
      "Waste stream, measured quantities and authorized destination",
    ],
    limits:
      "Local bye-laws and facility conditions still require review. A household booking is not processing evidence.",
  },
  {
    id: "pwm-2026",
    stream: "Plastic",
    title: "Plastic Waste Management (Amendment) Rules, 2026",
    publisher: "MoEFCC · Gazette of India",
    url: "https://egazette.gov.in/WriteReadData/2026/271465.pdf",
    documentDate: "2026-03-31",
    effectiveDate: "2026-03-31",
    reviewedOn: "2026-10-28",
    status: "notified",
    applicability:
      "G.S.R. 237(E) amends PWM 2016. Distinguishes reuse, recycling and end-of-life disposal, with category/year requirements for recycled content and reuse.",
    evidence: [
      "Packaging category, material and actual processing route",
      "Relevant registration, invoices and official certificate evidence",
    ],
    limits:
      "The June 2025 text was a draft. This amendment must be read with the base rules and other amendments; it does not approve a product or site.",
  },
  {
    id: "common-epr",
    stream: "Plastic",
    title: "Common EPR portal migration notice",
    publisher: "Central Pollution Control Board",
    url: "https://eprplastic.cpcb.gov.in/",
    documentDate: "Undated portal notice; migration 2026-06-28",
    reviewedOn: "2026-10-28",
    status: "portal",
    applicability:
      "The legacy plastics portal says operations ended on 28 June 2026 and points to https://epr.cpcb.gov.in for current work.",
    evidence: [
      "Current official portal registration and status",
      "Authorized access and current interface specification before integration",
    ],
    limits:
      "Common EPR homepage retrieval timed out. Migration and public links do not establish Luma API access. Legacy descriptions can lag.",
  },
  {
    id: "ewaste",
    stream: "E-waste",
    title: "E-Waste Management System under the 2022 rules",
    publisher: "Central Pollution Control Board",
    url: "https://eprewaste.cpcb.gov.in/",
    documentDate: "Undated current portal",
    reviewedOn: "2026-10-28",
    status: "portal",
    applicability:
      "Manufacturer, producer, refurbisher and recycler registrations have distinct roles under the 2022 rules and amendments.",
    evidence: [
      "Current CPCB registration and facility consent",
      "Equipment category, actual processing, invoices and official EPR records",
    ],
    limits:
      "Some state consent-verification services are reported unavailable. A scrap collector or app receipt is not a registered recycler or official certificate.",
  },
  {
    id: "battery",
    stream: "Battery",
    title: "Battery Waste Management Amendment Rules, 2025",
    publisher: "MoEFCC · Gazette copy hosted by CPCB",
    url: "https://eprbattery.cpcb.gov.in/upload/adminDoc/Battery_Waste_Management_(Amendment)_Rules,_2025.pdf",
    documentDate: "2025-02-24",
    effectiveDate: "2025-02-24",
    reviewedOn: "2026-10-28",
    status: "notified",
    applicability:
      "S.O. 958(E) changes labelling under the 2022 battery regime. Battery chemistry and recycling/refurbishing routes remain distinct from generic e-waste.",
    evidence: [
      "Battery chemistry, applicable registration and site authorization",
      "Actual collection, processing and official certificate evidence",
    ],
    limits:
      "Not a replacement of all battery rules. Later handling guidance and product-specific conditions require review; avoid double counting battery mass.",
  },
  {
    id: "tyres",
    stream: "Tyre",
    title: "Waste tyre EPR portal · Schedule IX",
    publisher: "Central Pollution Control Board",
    url: "https://eprtyres.cpcb.gov.in/",
    documentDate: "Undated portal; references 2022 HOWM amendment",
    reviewedOn: "2026-10-28",
    status: "portal",
    applicability:
      "Waste tyre EPR separates producer, recycler and retreader roles under Schedule IX of the 2022 HOWM amendment.",
    evidence: [
      "Current recycler or retreader registration and allowed process",
      "Measured inputs, outputs and official certificate or retreading records",
    ],
    limits:
      "Portal dashboard zeroes do not establish registration counts. A Luma transfer is not an EPR certificate.",
  },
  {
    id: "used-oil",
    stream: "Used oil",
    title: "Used oil EPR portal · HOWM Chapter VII",
    publisher: "Central Pollution Control Board",
    url: "https://eprusedoil.cpcb.gov.in/",
    documentDate: "Undated portal; notification 2023-09-18",
    effectiveDate: "2024-04-01",
    reviewedOn: "2026-10-28",
    status: "portal",
    applicability:
      "CPCB confirms G.S.R. 677(E), adding used-oil EPR for base/lubrication oil producers and used-oil importers, effective 1 April 2024.",
    evidence: [
      "Waste characterization, authorized collection/storage/transport route",
      "Registered recycler, quantities and official processing/certificate records",
    ],
    limits:
      "Effective date refers to the underlying amendment, not the webpage. Signed orders control deadline changes. Oil is not ordinary dry scrap.",
  },
  {
    id: "elv",
    stream: "End-of-life vehicles",
    title: "Environment Protection (End-of-Life Vehicles) Rules, 2025",
    publisher: "MoEFCC · Gazette copy hosted by CPCB",
    url: "https://eprelv.cpcb.gov.in/static/doc/ELV_Rules_2025.pdf",
    documentDate: "2025-01-06",
    effectiveDate: "2025-04-01",
    reviewedOn: "2026-10-28",
    status: "notified",
    applicability:
      "S.O. 98(E) governs the vehicle-scrapping chain. Batteries, packaging, tyres, used oil and e-waste keep separate regimes.",
    evidence: [
      "Registered vehicle scrapping facility and legal vehicle handover",
      "Depollution, component weights and authorized downstream destinations",
    ],
    limits:
      "GST registration alone gives no vehicle-scrapping authority. No actual vehicle or facility was checked.",
  },
  {
    id: "hazardous",
    stream: "Hazardous waste",
    title: "Hazardous and Other Wastes Rules, 2016 · base text",
    publisher: "MoEFCC · Gazette copy hosted by MPCB",
    url: "https://mpcb.gov.in/sites/default/files/hazardous-waste/rules/HWMRules2016_English.pdf",
    documentDate: "2016-04-04",
    reviewedOn: "2026-10-28",
    status: "notified",
    applicability:
      "Waste schedules, authorizations, storage, transport and manifest duties apply with subsequent amendments and permit conditions.",
    evidence: [
      "Current order: site, waste codes, activity, capacity, validity and conditions",
      "Applicable Form 3 records, Form 8/9 information, Form 10 manifest and interstate permissions",
    ],
    limits:
      "Base text is not consolidated to 2026. Check amendments and issuing-board orders. A directory entry is not verified permission.",
  },
  {
    id: "carbon-methodologies",
    stream: "Carbon",
    title: "BEE approved offset methodologies catalogue",
    publisher: "Bureau of Energy Efficiency · Ministry of Power",
    url: "https://beeindia.gov.in/view_content.php?lang=1&lid=571",
    documentDate: "Page updated 2026-07-07",
    reviewedOn: "2026-10-28",
    status: "guidance",
    applicability:
      "The reviewed catalogue lists landfill methane methods and BM WA03.003 compressed biogas. Each method has its own version, date and eligibility conditions.",
    evidence: [
      "Applicable approved method/version, project boundary, baseline and additionality",
      "Claim ownership, monitoring, validation and no-double-counting evidence",
    ],
    limits:
      "No generic dry-scrap method was established by this review. Catalogue absence does not prove all possible projects ineligible. Page update is not a methodology effective date.",
  },
  {
    id: "carbon-issuance",
    stream: "Carbon",
    title: "BEE offset procedure · registration and issuance",
    publisher: "Bureau of Energy Efficiency · Ministry of Power",
    url: "https://beeindia.gov.in/WriteReadData/RTF1984/RTF-PDF-c5651ba32f446171_1776060237.pdf",
    documentDate: "March 2025 · Version 1.0",
    effectiveDate: "2025-03-27",
    reviewedOn: "2026-10-28",
    status: "guidance",
    applicability:
      "Published procedure separates project registration, ACVA validation, monitoring, a different ACVA's verification and official issuance review.",
    evidence: [
      "External project registration, method and validation/verification reports",
      "Official issuance, registry identifiers, ownership and certificate quantities",
    ],
    limits:
      "Selected procedure pages were reviewed, not all annexes. A Luma administrator cannot replace BEE or ACVA decisions. Impact estimates are not issued CCCs.",
  },
  {
    id: "carbon-transactions-draft",
    stream: "Carbon",
    title: "Draft carbon transaction procedure · October 2026",
    publisher: "Bureau of Energy Efficiency · Indian Carbon Market portal",
    url: "https://indiancarbonmarket.gov.in/storage/bee-docs/uploads/announcements/1792999111_pdf",
    documentDate: "2026-10-19 cover letter · October 2026 draft",
    reviewedOn: "2026-10-28",
    status: "draft",
    applicability:
      "Consultation on proposed compliance-mechanism transactions closes 2 November 2026, before submission to CERC for approval.",
    evidence: [
      "Final approved procedure and operational channel evidence before implementation",
      "Explicit integration authority and current official registry records",
    ],
    limits:
      "Not a final procedure, public API authorization or offset retirement contract. No Luma exchange/registry access established. Full draft was not audited.",
  },
];
