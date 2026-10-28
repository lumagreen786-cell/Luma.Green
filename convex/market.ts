import { ConvexError, type Infer, v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  type MutationCtx,
  query,
  type QueryCtx,
} from "./_generated/server";
import {
  buyerKindFor,
  isInEscrow,
  type OrgKind,
  paymentVerificationFor,
  requiresEwayBill,
  safePaiseFor,
  sellerKindFor,
  type TradeAction,
  tradeActionsFor,
  tradeStep,
} from "./lib/chain";
import {
  requiresGatewayEvent,
  vPaymentVerification,
} from "./lib/gatewayPayments";
import { distanceKm } from "./lib/households";
import { assertOrdinaryRoute } from "./lib/industrialClassification";
import { recordInventoryMovement } from "./lib/inventoryLedger";
import { optionalReference, requiredLabel } from "./lib/lotEvidence";
import {
  requireEligibleByproduct,
  requireOrdinaryTradeMaterial,
} from "./lib/marketEligibility";
import { compareEligibleOffers } from "./lib/marketRanking";
import { isOrdinaryMaterial } from "./lib/materialEligibility";
import {
  hasOfferLotClassification,
  vOfferSpecificationInput,
} from "./lib/materialOfferSpecification";
import { requireQualityRelease } from "./lib/qualityRelease";
import {
  isListingOfferCurrent,
  OFFER_MAX_VALIDITY_MS,
} from "./lib/rateValidity";
import { heldMaterialGrams } from "./lib/returnClaims";
import { vOrgKind, vTradeStatus } from "./lib/validators";
import {
  vListingView,
  vMaterialRef,
  vTradeAction,
  vTradeView,
} from "./lib/views";
import { materialIndex, requireOrg } from "./lib/workspace";

/**
 * The business-to-business market: lots offered one step up the chain
 * (kabadiwala → yard → recycler → manufacturer), plus reviewed manufacturer
 * byproducts offered to an approved business with a matching material family.
 *
 * Historical simulated payment statuses remain readable but do not prove
 * payment. A verified gateway integration is required before new B2B trades
 * may advance past acceptance.
 */

const ORG_KINDS: readonly OrgKind[] = [
  "kabadiwala",
  "yard",
  "recycler",
  "manufacturer",
];
/** Every approved business can offer or buy an eligible byproduct. */
const SELLER_KINDS = ORG_KINDS;
const BUYER_KINDS = ORG_KINDS;

/** The most rows one screen reads. */
const PAGE = 200;
/** Fail closed when the pilot cannot account for every stock reservation. */
const RESERVATION_LIMIT = 1000;
/** Listing closure is atomic; never decline only part of its waiting queue. */
const WAITING_TRADE_LIMIT = 1000;
/** A listing's note, in characters. The sell form uses the same limit. */
const NOTE_MAX_LENGTH = 140;

type Side = "buyer" | "seller";
type Materials = Awaited<ReturnType<typeof materialIndex>>;

async function requireOfferLot(
  ctx: QueryCtx,
  lotId: Id<"materialLots">,
  orgId: Id<"orgs">,
  materialCode: string,
  grams: number,
) {
  const lot = await ctx.db.get("materialLots", lotId);
  if (
    lot?.orgId !== orgId ||
    lot.materialCode !== materialCode ||
    lot.status !== "available" ||
    lot.availableGrams < grams
  )
    throw new ConvexError("LOT_NOT_ELIGIBLE");
  assertOrdinaryRoute(lot);
  await requireQualityRelease(ctx, lot);
  if (!hasOfferLotClassification(lot))
    throw new ConvexError("LOT_NOT_ELIGIBLE");
  return lot;
}

interface Actor {
  profileId: Id<"profiles">;
  orgId: Id<"orgs">;
}

// --- Shared result shapes ----------------------------------------------------

const vStage = v.union(v.literal("scrap"), v.literal("recycled"));

const vParty = v.object({
  name: v.string(),
  kind: vOrgKind,
  address: v.string(),
  gstin: v.optional(v.string()),
});

const vTradeReceipt = v.object({
  id: v.id("trades"),
  /** No verified payment or tax-invoice number exists yet. */
  number: v.union(v.string(), v.null()),
  status: vTradeStatus,
  side: v.union(v.literal("buyer"), v.literal("seller")),
  /** No verified payment issue time exists yet. */
  issuedAt: v.union(v.number(), v.null()),
  /** No verified payment release time exists yet. */
  releasedAt: v.union(v.number(), v.null()),
  seller: vParty,
  buyer: vParty,
  line: v.object({
    material: vMaterialRef,
    grams: v.number(),
    paisePerKg: v.number(),
    paise: v.number(),
  }),
  totalPaise: v.number(),
  inEscrow: v.boolean(),
  legacyReceiptNo: v.union(v.string(), v.null()),
  legacyRecordedAt: v.union(v.number(), v.null()),
  paymentVerification: vPaymentVerification,
  needsEwayBill: v.boolean(),
});

// --- Helpers -----------------------------------------------------------------

function isPositiveInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function materialRef(materials: Materials, code: string) {
  const material = materials.get(code);
  return {
    code,
    names: material?.names ?? { en: code },
    family: material?.family ?? ("other" as const),
  };
}

/** Looks each business up once per request. */
function orgLookup(ctx: QueryCtx) {
  const cache = new Map<Id<"orgs">, Promise<Doc<"orgs"> | null>>();
  return (id: Id<"orgs">) => {
    let org = cache.get(id);
    if (!org) {
      org = ctx.db.get("orgs", id);
      cache.set(id, org);
    }
    return org;
  };
}

function sideOf(trade: Doc<"trades">, orgId: Id<"orgs">): Side | null {
  if (trade.buyerOrgId === orgId) return "buyer";
  return trade.sellerOrgId === orgId ? "seller" : null;
}

function newestFirst<T extends { createdAt: number }>(a: T, b: T): number {
  return b.createdAt - a.createdAt;
}

/** Open lots sort before sold and withdrawn ones. */
function openRank(listing: Doc<"listings">): number {
  return listing.status === "open" ? 0 : 1;
}

function partyOf(business: Doc<"orgs">) {
  return {
    name: business.name,
    kind: business.kind,
    address: business.address,
    gstin: business.gstin,
  };
}

function toListingView(
  listing: Doc<"listings">,
  seller: Doc<"orgs">,
  materials: Materials,
  myOrgId: Id<"orgs">,
) {
  return {
    id: listing._id,
    origin: listing.origin,
    seller: { name: seller.name, area: seller.area, kind: seller.kind },
    material: materialRef(materials, listing.materialCode),
    grams: listing.grams,
    askPaisePerKg: listing.askPaisePerKg,
    ...(listing.freightPaisePerKg !== undefined && {
      freightPaisePerKg: listing.freightPaisePerKg,
    }),
    ...(listing.deliveryAvailableAt !== undefined && {
      deliveryAvailableAt: listing.deliveryAvailableAt,
    }),
    note: listing.note,
    specification: listing.specification,
    status: listing.status,
    isMine: listing.orgId === myOrgId,
    createdAt: listing.createdAt,
    ...(listing.expiresAt !== undefined && { expiresAt: listing.expiresAt }),
  };
}

function toTradeView(
  trade: Doc<"trades">,
  side: Side,
  counterparty: Doc<"orgs">,
  materials: Materials,
) {
  return {
    id: trade._id,
    material: materialRef(materials, trade.materialCode),
    grams: trade.grams,
    paisePerKg: trade.paisePerKg,
    totalPaise: trade.totalPaise,
    ...(trade.freightPaisePerKg !== undefined && {
      freightPaisePerKg: trade.freightPaisePerKg,
    }),
    ...(trade.deliveryAvailableAt !== undefined && {
      deliveryAvailableAt: trade.deliveryAvailableAt,
    }),
    specification: trade.specification,
    status: trade.status,
    timeline: trade.timeline,
    counterparty: {
      name: counterparty.name,
      area: counterparty.area,
      kind: counterparty.kind,
    },
    // Old LG numbers were issued by a simulated transition, not by GST.
    invoiceNo: undefined,
    legacyReceiptNo: trade.invoiceNo,
    paymentVerification: paymentVerificationFor(trade.status),
    needsEwayBill: requiresEwayBill(trade.totalPaise),
    inEscrow: isInEscrow(trade.status),
    actions: tradeActionsFor(trade.status, side),
    createdAt: trade.createdAt,
  };
}

async function audit(
  ctx: MutationCtx,
  entry: {
    orgId: Id<"orgs">;
    actorProfileId: Id<"profiles">;
    action: string;
    entityTable: string;
    entityId: string;
    metadata?: Record<string, unknown>;
  },
) {
  await ctx.db.insert("auditLog", { ...entry, createdAt: Date.now() });
}

/**
 * Grams of each material a business has already promised: on open listings,
 * or sold and not yet dispatched. What's left of its stock is free to list,
 * so the same grams are never offered twice.
 */
export async function promisedGrams(
  ctx: QueryCtx,
  orgId: Id<"orgs">,
): Promise<Map<string, number>> {
  const promised = new Map<string, number>();
  const add = (code: string, grams: number) => {
    const total = (promised.get(code) ?? 0) + grams;
    if (
      !Number.isSafeInteger(total) ||
      !Number.isSafeInteger(grams) ||
      grams < 0
    )
      throw new ConvexError("INVALID_WEIGHT");
    promised.set(code, total);
  };
  const listings = await ctx.db
    .query("listings")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .filter((q) => q.eq(q.field("status"), "open"))
    .take(RESERVATION_LIMIT + 1);
  if (listings.length > RESERVATION_LIMIT) {
    throw new ConvexError("TOO_MANY_RESERVATIONS");
  }
  for (const listing of listings) {
    if (listing.status === "open" && isListingOfferCurrent(listing))
      add(listing.materialCode, listing.grams);
  }
  const sales = await ctx.db
    .query("trades")
    .withIndex("by_seller", (q) => q.eq("sellerOrgId", orgId))
    .filter((q) =>
      q.or(
        q.eq(q.field("status"), "accepted"),
        q.eq(q.field("status"), "paid_to_escrow"),
      ),
    )
    .take(RESERVATION_LIMIT + 1);
  if (sales.length > RESERVATION_LIMIT) {
    throw new ConvexError("TOO_MANY_RESERVATIONS");
  }
  for (const trade of sales) {
    if (trade.status === "accepted" || trade.status === "paid_to_escrow") {
      add(trade.materialCode, trade.grams);
    }
  }
  const held = await heldMaterialGrams(ctx, orgId);
  for (const [code, grams] of held) add(code, grams);
  return promised;
}

/** Stock per material, and how much of it is free to list. */
async function stockFor(ctx: QueryCtx, orgId: Id<"orgs">) {
  const rows = await ctx.db
    .query("inventory")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .take(PAGE);
  const promised = await promisedGrams(ctx, orgId);
  return new Map(
    rows.map((row) => [
      row.materialCode,
      {
        stockGrams: row.grams,
        availableGrams: Math.max(
          0,
          row.grams - (promised.get(row.materialCode) ?? 0),
        ),
      },
    ]),
  );
}

async function isListingStockBacked(
  ctx: QueryCtx,
  listing: Doc<"listings">,
  grams = listing.grams,
) {
  const stock = await ctx.db
    .query("inventory")
    .withIndex("by_org_material", (q) =>
      q.eq("orgId", listing.orgId).eq("materialCode", listing.materialCode),
    )
    .unique();
  const promises = await promisedGrams(ctx, listing.orgId);
  const balance = stock?.grams ?? 0,
    reserved = promises.get(listing.materialCode) ?? 0;
  if (
    !Number.isSafeInteger(balance) ||
    balance < 0 ||
    !Number.isSafeInteger(listing.grams) ||
    !Number.isSafeInteger(grams)
  )
    throw new ConvexError("INVALID_WEIGHT");
  return (
    BigInt(balance) - BigInt(reserved) + BigInt(listing.grams) >= BigInt(grams)
  );
}

/** Adds (or, negative, takes) grams of one material to a business's stock. */
async function moveStock(
  ctx: MutationCtx,
  actor: Actor,
  trade: Doc<"trades">,
  deltaGrams: number,
  now: number,
) {
  if (!isPositiveInteger(trade.grams)) throw new ConvexError("INVALID_WEIGHT");
  await recordInventoryMovement(ctx, {
    orgId: actor.orgId,
    actorProfileId: actor.profileId,
    materialCode: trade.materialCode,
    deltaGrams,
    addedCostPaise: deltaGrams > 0 ? trade.totalPaise : null,
    sourceKey: `trade:${trade._id}:${deltaGrams > 0 ? "receipt" : "dispatch"}`,
    createdAt: now,
  });
}

/**
 * Declines every request still waiting on a listing that has closed — all
 * but `keep`, the request whose acceptance just sold the lot out.
 */
async function declineWaiting(
  ctx: MutationCtx,
  actor: Actor,
  listingId: Id<"listings">,
  now: number,
  keep?: Id<"trades">,
) {
  const trades = await ctx.db
    .query("trades")
    .withIndex("by_listing", (q) => q.eq("listingId", listingId))
    .filter((q) => q.eq(q.field("status"), "requested"))
    .take(WAITING_TRADE_LIMIT + 1);
  if (trades.length > WAITING_TRADE_LIMIT) {
    throw new ConvexError("TOO_MANY_TRADE_REQUESTS");
  }
  for (const trade of trades) {
    if (trade.status !== "requested" || trade._id === keep) continue;
    await ctx.db.patch("trades", trade._id, {
      status: "declined",
      timeline: [...trade.timeline, { status: "declined", at: now }],
      updatedAt: now,
    });
    await audit(ctx, {
      orgId: actor.orgId,
      actorProfileId: actor.profileId,
      action: "trade.declined",
      entityTable: "trades",
      entityId: trade._id,
      metadata: { from: "requested", reason: "listing_closed", listingId },
    });
  }
}

/** Accepting takes the trade's grams off the listing; at zero it's sold. */
async function takeFromListing(
  ctx: MutationCtx,
  actor: Actor,
  trade: Doc<"trades">,
  now: number,
) {
  const listing = await ctx.db.get("listings", trade.listingId);
  if (listing?.status !== "open") throw new ConvexError("LISTING_NOT_OPEN");
  if (!isListingOfferCurrent(listing, now))
    throw new ConvexError("LISTING_EXPIRED");
  if (
    listing.orgId !== trade.sellerOrgId ||
    listing.materialCode !== trade.materialCode
  )
    throw new ConvexError("INVALID_LISTING");
  if (listing.origin === "manufacturer_byproduct") {
    const seller = await ctx.db.get("orgs", trade.sellerOrgId);
    const buyer = await ctx.db.get("orgs", trade.buyerOrgId);
    await requireEligibleByproduct(ctx, listing, seller, buyer);
  } else {
    await requireOrdinaryTradeMaterial(ctx, listing, trade.buyerOrgId);
  }
  if (listing.grams < trade.grams) throw new ConvexError("NOT_ENOUGH_LEFT");
  if (!(await isListingStockBacked(ctx, listing, trade.grams)))
    throw new ConvexError("NOT_ENOUGH_STOCK");
  if (listing.specification?.lotId)
    await requireOfferLot(
      ctx,
      listing.specification.lotId,
      listing.orgId,
      listing.materialCode,
      trade.grams,
    );
  const grams = listing.grams - trade.grams;
  await ctx.db.patch("listings", listing._id, {
    grams,
    status: grams === 0 ? "sold" : "open",
    updatedAt: now,
  });
  if (grams === 0) {
    await declineWaiting(ctx, actor, listing._id, now, trade._id);
  }
}

/** What a step moves besides the trade itself: the listing or the stock. */
async function applyStep(
  ctx: MutationCtx,
  actor: Actor,
  trade: Doc<"trades">,
  action: TradeAction,
  now: number,
): Promise<void> {
  switch (action) {
    case "accept": {
      await takeFromListing(ctx, actor, trade, now);
      break;
    }
    case "dispatch": {
      await moveStock(ctx, actor, trade, -trade.grams, now);
      break;
    }
    case "confirm": {
      // Delivered: the load joins the buyer's stock.
      await moveStock(ctx, actor, trade, trade.grams, now);
      break;
    }
    case "decline":
    case "pay": {
      break;
    }
  }
}

// --- Buying ------------------------------------------------------------------

/**
 * Open lots from the fixed chain tier below mine, plus approved non-hazardous
 * manufacturer byproducts for any matching active buyer, including other cities.
 */
function matchesBuyerScope(
  listing: Doc<"listings">,
  material: Doc<"materials">,
  org: Doc<"orgs">,
  materialCode?: string,
) {
  const isByproduct =
    listing.sellerKind === "manufacturer" &&
    listing.origin === "manufacturer_byproduct" &&
    isOrdinaryMaterial(material) &&
    material.stage === "scrap" &&
    material.byproductEligibility?.hazardStatus === "non_hazardous" &&
    org.families.includes(material.family);
  const isRegular =
    listing.origin === undefined &&
    isOrdinaryMaterial(material) &&
    org.families.includes(material.family) &&
    buyerKindFor(listing.sellerKind) === org.kind;
  return (
    listing.grams > 0 &&
    listing.orgId !== org._id &&
    (isByproduct || listing.city === org.city) &&
    (isRegular || isByproduct) &&
    (materialCode === undefined || listing.materialCode === materialCode) &&
    isListingOfferCurrent(listing)
  );
}
async function hasOfferEvidence(ctx: QueryCtx, listing: Doc<"listings">) {
  if (!listing.specification?.lotId) return true;
  try {
    await requireOfferLot(
      ctx,
      listing.specification.lotId,
      listing.orgId,
      listing.materialCode,
      listing.grams,
    );
    return true;
  } catch (error) {
    if (error instanceof ConvexError) return false;
    throw error;
  }
}
async function eligibleListingView(
  ctx: QueryCtx,
  listing: Doc<"listings">,
  org: Doc<"orgs">,
  materials: Materials,
  orgOf: ReturnType<typeof orgLookup>,
  materialCode?: string,
) {
  const material = materials.get(listing.materialCode);
  if (!material || !matchesBuyerScope(listing, material, org, materialCode))
    return null;
  const seller = await orgOf(listing.orgId);
  if (
    seller?.status !== "active" ||
    !seller.families.includes(material.family) ||
    !(await isListingStockBacked(ctx, listing)) ||
    !(await hasOfferEvidence(ctx, listing))
  )
    return null;
  const distance =
    seller.location && org.location
      ? distanceKm(seller.location, org.location)
      : undefined;
  return {
    ...toListingView(listing, seller, materials, org._id),
    ...(distance !== undefined &&
      Number.isFinite(distance) && { distanceKm: distance }),
  };
}

export const browse = query({
  args: { materialCode: v.optional(v.string()) },
  returns: v.array(vListingView),
  handler: async (ctx, args) => {
    const { org } = await requireOrg(ctx, BUYER_KINDS, "read");
    if (org.status !== "active") return [];
    const sellerKind = sellerKindFor(org.kind);
    const regular = sellerKind
      ? await ctx.db
          .query("listings")
          .withIndex("by_status_kind", (q) =>
            q.eq("status", "open").eq("sellerKind", sellerKind),
          )
          .order("desc")
          .take(PAGE)
      : [];
    const byproducts = await ctx.db
      .query("listings")
      .withIndex("by_status_kind", (q) =>
        q.eq("status", "open").eq("sellerKind", "manufacturer"),
      )
      .order("desc")
      .take(PAGE);
    const materials = await materialIndex(ctx);
    const orgOf = orgLookup(ctx);
    const views = [];
    for (const listing of [...regular, ...byproducts].toSorted(newestFirst)) {
      const view = await eligibleListingView(
        ctx,
        listing,
        org,
        materials,
        orgOf,
        args.materialCode,
      );
      if (view) views.push(view);
    }
    return views.toSorted(compareEligibleOffers);
  },
});

/**
 * Asks to buy part (or all) of a lot at its asking price. Nothing is held
 * yet: the seller accepts first. Payment waits for a verified gateway.
 */
export const requestTrade = mutation({
  args: { listingId: v.id("listings"), grams: v.number() },
  returns: v.id("trades"),
  handler: async (ctx, args) => {
    const { profile, org } = await requireOrg(ctx, BUYER_KINDS);
    const listing = await ctx.db.get("listings", args.listingId);
    if (
      listing?.city !== org.city &&
      listing?.origin !== "manufacturer_byproduct"
    ) {
      throw new ConvexError("NOT_FOUND");
    }
    if (listing.orgId === org._id) throw new ConvexError("OWN_LISTING");
    const seller = await ctx.db.get("orgs", listing.orgId);
    if (seller?.status !== "active") throw new ConvexError("NOT_FOUND");
    if (seller.kind !== listing.sellerKind) {
      throw new ConvexError("INVALID_LISTING");
    }
    if (listing.origin === "manufacturer_byproduct") {
      await requireEligibleByproduct(ctx, listing, seller, org);
    } else if (buyerKindFor(listing.sellerKind) === org.kind) {
      await requireOrdinaryTradeMaterial(ctx, listing, org._id);
    } else {
      throw new ConvexError("WRONG_ROLE");
    }
    if (listing.status !== "open") throw new ConvexError("LISTING_NOT_OPEN");
    if (!isListingOfferCurrent(listing))
      throw new ConvexError("LISTING_EXPIRED");
    if (!isPositiveInteger(args.grams)) throw new ConvexError("INVALID_WEIGHT");
    if (args.grams > listing.grams) throw new ConvexError("NOT_ENOUGH_LEFT");
    if (!(await isListingStockBacked(ctx, listing, args.grams)))
      throw new ConvexError("NOT_ENOUGH_STOCK");
    if (listing.specification?.lotId)
      await requireOfferLot(
        ctx,
        listing.specification.lotId,
        listing.orgId,
        listing.materialCode,
        args.grams,
      );

    const now = Date.now();
    const totalPaise = safePaiseFor(args.grams, listing.askPaisePerKg);
    if (totalPaise === null) throw new ConvexError("INVALID_PRICE");
    const tradeId = await ctx.db.insert("trades", {
      listingId: listing._id,
      sellerOrgId: listing.orgId,
      buyerOrgId: org._id,
      materialCode: listing.materialCode,
      grams: args.grams,
      paisePerKg: listing.askPaisePerKg,
      freightPaisePerKg: listing.freightPaisePerKg,
      deliveryAvailableAt: listing.deliveryAvailableAt,
      totalPaise,
      specification: listing.specification,
      status: "requested",
      timeline: [{ status: "requested", at: now }],
      createdAt: now,
      updatedAt: now,
    });
    await audit(ctx, {
      orgId: org._id,
      actorProfileId: profile._id,
      action: "trade.requested",
      entityTable: "trades",
      entityId: tradeId,
      metadata: {
        listingId: listing._id,
        grams: args.grams,
        paisePerKg: listing.askPaisePerKg,
        totalPaise,
      },
    });
    return tradeId;
  },
});

// --- Selling -----------------------------------------------------------------

/** My lots on the market: open ones first, then sold and withdrawn. */
export const myListings = query({
  args: {},
  returns: v.array(vListingView),
  handler: async (ctx) => {
    const { org } = await requireOrg(ctx, SELLER_KINDS, "read");
    const rows = await ctx.db
      .query("listings")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .order("desc")
      .take(PAGE);
    const materials = await materialIndex(ctx);
    return rows
      .toSorted((a, b) => openRank(a) - openRank(b) || newestFirst(a, b))
      .map((listing) => toListingView(listing, org, materials, org._id));
  },
});

/**
 * What I can put on sale: each material in stock, with the grams not already
 * listed or sold. Feeds the sell form.
 */
export const listingLotOptions = query({
  args: { materialCode: v.string() },
  returns: v.array(
    v.object({
      id: v.id("materialLots"),
      state: v.string(),
      grams: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const { org } = await requireOrg(ctx, SELLER_KINDS, "read");
    const material = await ctx.db
      .query("materials")
      .withIndex("by_code", (q) => q.eq("code", args.materialCode))
      .unique();
    if (
      !material ||
      !isOrdinaryMaterial(material) ||
      !org.families.includes(material.family)
    )
      return [];
    const rows = await ctx.db
      .query("materialLots")
      .withIndex("by_org_material_created", (q) =>
        q.eq("orgId", org._id).eq("materialCode", args.materialCode),
      )
      .order("desc")
      .take(100);
    return rows
      .filter(
        (row) =>
          row.materialCode === args.materialCode &&
          row.status === "available" &&
          row.availableGrams > 0 &&
          hasOfferLotClassification(row),
      )
      .map((row) => ({
        id: row._id,
        state: row.state,
        grams: row.availableGrams,
      }));
  },
});

export const sellable = query({
  args: {},
  returns: v.array(
    v.object({
      material: vMaterialRef,
      stage: vStage,
      stockGrams: v.number(),
      availableGrams: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const { org } = await requireOrg(ctx, SELLER_KINDS, "read");
    const stock = await stockFor(ctx, org._id);
    const materials = await materialIndex(ctx);
    // The material index is in catalogue order, so the form is too.
    const items = [];
    for (const material of materials.values()) {
      const held = stock.get(material.code);
      if (
        !held ||
        held.stockGrams <= 0 ||
        !isOrdinaryMaterial(material) ||
        !org.families.includes(material.family)
      )
        continue;
      if (
        org.kind === "manufacturer" &&
        (material.stage !== "scrap" ||
          material.byproductEligibility?.hazardStatus !== "non_hazardous" ||
          !org.families.includes(material.family))
      ) {
        continue;
      }
      items.push({
        material: materialRef(materials, material.code),
        stage: material.stage,
        stockGrams: held.stockGrams,
        availableGrams: held.availableGrams,
      });
    }
    return items;
  },
});

async function offerSpecification(
  ctx: QueryCtx,
  input: Infer<typeof vOfferSpecificationInput> | undefined,
  orgId: Id<"orgs">,
  materialCode: string,
  grams: number,
): Promise<Doc<"listings">["specification"]> {
  if (!input) return undefined;
  const grade = requiredLabel(input.grade);
  const detail = optionalReference(input.specification);
  if (!detail) throw new ConvexError("INVALID_SPECIFICATION");
  const lot = input.lotId
    ? await requireOfferLot(ctx, input.lotId, orgId, materialCode, grams)
    : null;
  return {
    grade,
    specification: detail,
    lotId: lot?._id,
    lotState: lot?.state,
    source: "seller_declared",
  };
}

function validatedOfferTerms(
  args: {
    contractValidUntil?: number;
    freightPaisePerKg?: number;
    deliveryAvailableAt?: number;
    askPaisePerKg: number;
  },
  now: number,
) {
  const expiresAt = args.contractValidUntil ?? now + 24 * 60 * 60 * 1000;
  if (
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= now ||
    expiresAt > now + OFFER_MAX_VALIDITY_MS
  )
    throw new ConvexError("INVALID_OFFER_VALIDITY");
  if (
    args.freightPaisePerKg !== undefined &&
    (!Number.isSafeInteger(args.freightPaisePerKg) ||
      args.freightPaisePerKg < 0 ||
      !Number.isSafeInteger(args.askPaisePerKg + args.freightPaisePerKg))
  )
    throw new ConvexError("INVALID_PRICE");
  if (
    args.deliveryAvailableAt !== undefined &&
    (!Number.isSafeInteger(args.deliveryAvailableAt) ||
      args.deliveryAvailableAt < 0 ||
      args.deliveryAvailableAt > expiresAt)
  )
    throw new ConvexError("INVALID_OFFER_VALIDITY");
  return expiresAt;
}

/** Offers a lot to the next business up the chain. */
// eslint-disable-next-line unicorn/no-non-function-verb-prefix -- a registered Convex mutation is a const, and its name is the public API (api.market.createListing)
export const createListing = mutation({
  args: {
    materialCode: v.string(),
    grams: v.number(),
    askPaisePerKg: v.number(),
    contractValidUntil: v.optional(v.number()),
    freightPaisePerKg: v.optional(v.number()),
    deliveryAvailableAt: v.optional(v.number()),
    note: v.optional(v.string()),
    specification: v.optional(vOfferSpecificationInput),
  },
  returns: v.id("listings"),
  handler: async (ctx, args) => {
    const { profile, org } = await requireOrg(ctx, SELLER_KINDS);
    const now = Date.now();
    const expiresAt = validatedOfferTerms(args, now);
    if (!isPositiveInteger(args.grams)) throw new ConvexError("INVALID_WEIGHT");
    if (
      !isPositiveInteger(args.askPaisePerKg) ||
      safePaiseFor(args.grams, args.askPaisePerKg) === null
    ) {
      throw new ConvexError("INVALID_PRICE");
    }
    const trimmed = args.note?.trim();
    const note = trimmed === "" ? undefined : trimmed;
    if (note !== undefined && note.length > NOTE_MAX_LENGTH) {
      throw new ConvexError("NOTE_TOO_LONG");
    }
    const material = await ctx.db
      .query("materials")
      .withIndex("by_code", (q) => q.eq("code", args.materialCode))
      .first();
    if (!material?.active) throw new ConvexError("UNKNOWN_MATERIAL");
    if (
      !isOrdinaryMaterial(material) ||
      !org.families.includes(material.family)
    )
      throw new ConvexError("MATERIAL_NOT_ELIGIBLE");
    if (
      org.kind === "manufacturer" &&
      (material.stage !== "scrap" ||
        material.byproductEligibility?.hazardStatus !== "non_hazardous" ||
        !org.families.includes(material.family))
    ) {
      throw new ConvexError("BYPRODUCT_NOT_ELIGIBLE");
    }
    const stock = await stockFor(ctx, org._id);
    const available = stock.get(args.materialCode)?.availableGrams ?? 0;
    if (args.grams > available) throw new ConvexError("NOT_ENOUGH_STOCK");

    const specification = await offerSpecification(
      ctx,
      args.specification,
      org._id,
      args.materialCode,
      args.grams,
    );

    const listingId = await ctx.db.insert("listings", {
      orgId: org._id,
      sellerKind: org.kind,
      materialCode: args.materialCode,
      grams: args.grams,
      askPaisePerKg: args.askPaisePerKg,
      freightPaisePerKg: args.freightPaisePerKg,
      deliveryAvailableAt: args.deliveryAvailableAt,
      city: org.city,
      note,
      specification,
      origin:
        org.kind === "manufacturer" ? "manufacturer_byproduct" : undefined,
      status: "open",
      expiresAt,
      createdAt: now,
      updatedAt: now,
    });
    await audit(ctx, {
      orgId: org._id,
      actorProfileId: profile._id,
      action: "listing.created",
      entityTable: "listings",
      entityId: listingId,
      metadata: {
        materialCode: args.materialCode,
        grams: args.grams,
        askPaisePerKg: args.askPaisePerKg,
        expiresAt,
      },
    });
    return listingId;
  },
});

/** Takes an open lot off the market; requests waiting on it are declined. */
export const withdraw = mutation({
  args: { listingId: v.id("listings") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { profile, org } = await requireOrg(ctx);
    const listing = await ctx.db.get("listings", args.listingId);
    if (listing?.orgId !== org._id) throw new ConvexError("NOT_FOUND");
    if (listing.status !== "open") throw new ConvexError("LISTING_NOT_OPEN");
    const now = Date.now();
    const actor = { profileId: profile._id, orgId: org._id };
    await ctx.db.patch("listings", listing._id, {
      status: "withdrawn",
      updatedAt: now,
    });
    await declineWaiting(ctx, actor, listing._id, now);
    await audit(ctx, {
      orgId: org._id,
      actorProfileId: profile._id,
      action: "listing.withdrawn",
      entityTable: "listings",
      entityId: listing._id,
      metadata: { gramsLeft: listing.grams },
    });
    return null;
  },
});

// --- Trades --------------------------------------------------------------------

/** My trades, newest first, with the steps open to me on each. */
export const trades = query({
  args: {},
  returns: v.object({
    buying: v.array(vTradeView),
    selling: v.array(vTradeView),
  }),
  handler: async (ctx) => {
    const { org, role } = await requireOrg(ctx, undefined, "read");
    const bought = await ctx.db
      .query("trades")
      .withIndex("by_buyer", (q) => q.eq("buyerOrgId", org._id))
      .order("desc")
      .take(PAGE);
    const sold = await ctx.db
      .query("trades")
      .withIndex("by_seller", (q) => q.eq("sellerOrgId", org._id))
      .order("desc")
      .take(PAGE);
    const materials = await materialIndex(ctx);
    const orgOf = orgLookup(ctx);

    const views = async (rows: Doc<"trades">[], side: Side) => {
      const result = [];
      for (const trade of rows.toSorted(newestFirst)) {
        const counterparty = await orgOf(
          side === "buyer" ? trade.sellerOrgId : trade.buyerOrgId,
        );
        if (!counterparty) continue;
        const view = toTradeView(trade, side, counterparty, materials);
        if (trade.status === "requested") {
          const listing = await ctx.db.get("listings", trade.listingId);
          if (!listing || !isListingOfferCurrent(listing))
            view.actions = view.actions.filter((action) => action !== "accept");
        }
        result.push(role === "viewer" ? { ...view, actions: [] } : view);
      }
      return result;
    };
    return {
      buying: await views(bought, "buyer"),
      selling: await views(sold, "seller"),
    };
  },
});

/**
 * One current trade step: the seller accepts or declines. Payment, dispatch
 * and completion are unavailable until a gateway event can be verified.
 */
export const act = mutation({
  args: { tradeId: v.id("trades"), action: vTradeAction },
  returns: v.object({
    status: vTradeStatus,
    invoiceNo: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const { profile, org } = await requireOrg(ctx);
    const trade = await ctx.db.get("trades", args.tradeId);
    const side = trade ? sideOf(trade, org._id) : null;
    if (!trade || !side) throw new ConvexError("NOT_FOUND");
    if (requiresGatewayEvent(args.action)) {
      throw new ConvexError("GATEWAY_REQUIRED");
    }
    const next = tradeStep(trade.status, args.action, side);
    if (!next) throw new ConvexError("WRONG_STEP");

    const now = Date.now();
    const actor = { profileId: profile._id, orgId: org._id };
    await applyStep(ctx, actor, trade, args.action, now);
    await ctx.db.patch("trades", trade._id, {
      status: next,
      timeline: [...trade.timeline, { status: next, at: now }],
      updatedAt: now,
    });
    await audit(ctx, {
      orgId: org._id,
      actorProfileId: profile._id,
      action: `trade.${next}`,
      entityTable: "trades",
      entityId: trade._id,
      metadata: {
        from: trade.status,
        to: next,
        side,
        grams: trade.grams,
        totalPaise: trade.totalPaise,
      },
    });
    return { status: next };
  },
});

/**
 * A read-only record for either trade party. It retains old numbers as
 * unverified legacy references, not as payment or tax-invoice proof.
 */
export const receipt = query({
  args: { tradeId: v.string() },
  returns: v.union(v.null(), vTradeReceipt),
  handler: async (ctx, args) => {
    const { org } = await requireOrg(ctx, undefined, "read");
    const tradeId = ctx.db.normalizeId("trades", args.tradeId);
    const trade = tradeId ? await ctx.db.get("trades", tradeId) : null;
    const side = trade ? sideOf(trade, org._id) : null;
    if (!trade || !side) return null;
    const seller = await ctx.db.get("orgs", trade.sellerOrgId);
    const buyer = await ctx.db.get("orgs", trade.buyerOrgId);
    if (!seller || !buyer) return null;
    const materials = await materialIndex(ctx);
    return {
      id: trade._id,
      number: null,
      legacyReceiptNo: trade.invoiceNo ?? null,
      legacyRecordedAt: trade.invoiceNo
        ? (trade.timeline.find((entry) => entry.status === "paid_to_escrow")
            ?.at ?? trade.updatedAt)
        : null,
      paymentVerification: paymentVerificationFor(trade.status),
      status: trade.status,
      side,
      issuedAt: null,
      releasedAt: null,
      seller: partyOf(seller),
      buyer: partyOf(buyer),
      line: {
        material: materialRef(materials, trade.materialCode),
        grams: trade.grams,
        paisePerKg: trade.paisePerKg,
        paise: trade.totalPaise,
      },
      totalPaise: trade.totalPaise,
      inEscrow: isInEscrow(trade.status),
      needsEwayBill: requiresEwayBill(trade.totalPaise),
    };
  },
});
