/// <reference types="vite/client" />
// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";

import { api } from "./_generated/api";
import {
  convexModules,
  registerAuth,
  seedDemo,
  signIn,
  signInAs,
} from "./lib/auth.testing";
import schema from "./schema";

const modules = convexModules(import.meta.glob("./**/*.*s"));
const materialCode = "PLASTIC-PET";
const grams = 1000;
const amountPaise = 2500;
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

async function world() {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-07T00:00:00Z"));
  vi.stubEnv("AUTH_DEV_MODE", "true");
  vi.stubEnv("ADMIN_EMAIL", "admin@luma.test");
  const t = convexTest(schema, modules);
  registerAuth(t);
  await seedDemo(t);
  const admin = await signIn(t, {
    email: "admin@luma.test",
    twoFactorEnabled: true,
  });
  const seller = await signInAs(t, "+919000000101");
  const buyer = await signInAs(t, "+919000000102");
  const siteFor = async (party: typeof seller, name: string) => {
    const facilityId = await party.mutation(api.industrialProfiles.save, {
      name,
      siteReference: name + " reference",
      capabilities: ["sorting"],
    });
    const registrationId = await party.mutation(
      api.industrialProfiles.recordRegistration,
      {
        facilityId,
        kind: "consent_to_operate",
        reference: name + " consent",
        issuedAt: "2026-01-01",
        validUntil: "2027-01-01",
      },
    );
    return { facilityId, registrationId };
  };
  const ship = await siteFor(seller, "Seller test site");
  const intake = await siteFor(buyer, "Buyer test site");
  const approve = (site: typeof ship) =>
    admin.mutation(api.complianceReview.reviewFacility, {
      ...site,
      materialCodes: [materialCode],
      processes: ["sorting"],
      decision: "approved",
      ordinaryTradeCustody: true,
      evidenceReference: "Issuer evidence verified for test",
      validUntil: "2026-12-31",
    });
  const lotId = await seller.mutation(api.traceability.declareLot, {
    materialCode,
    state: "Sorted test PET",
    grams,
    streamClass: "recoverable_waste",
    handlingClass: "non_hazardous",
  });
  const requestOfferForLot = async () => {
    const listingId = await seller.mutation(api.market.createListing, {
      materialCode,
      grams,
      askPaisePerKg: amountPaise,
      specification: {
        grade: "Test PET",
        specification: "Synthetic sorted quality",
        lotId,
      },
    });
    return buyer.mutation(api.market.requestTrade, {
      listingId,
      grams,
    });
  };
  const tradeId = await requestOfferForLot();
  await seller.mutation(api.market.act, { tradeId, action: "accept" });
  const revokeIntake = () =>
    admin.mutation(api.complianceReview.reviewFacility, {
      ...intake,
      materialCodes: [materialCode],
      processes: ["sorting"],
      decision: "revoked",
      evidenceReference: "Issuer scope revoked for test",
      validUntil: "2026-12-31",
    });
  return {
    t,
    seller,
    buyer,
    lotId,
    ship,
    intake,
    tradeId,
    approve,
    revokeIntake,
    requestOfferForLot,
  };
}

it("moves an eligible reviewed whole lot once per side and prevents separate receipt", async () => {
  const {
    t,
    seller,
    buyer,
    lotId,
    ship,
    intake,
    tradeId,
    approve,
    revokeIntake,
  } = await world();
  const dispatch = {
    tradeId,
    movement: {
      kind: "dispatch" as const,
      sellerFacilityId: ship.facilityId,
      buyerFacilityId: intake.facilityId,
      reference: "Dispatch TEST-1",
      grams,
    },
  };
  const receipt = {
    tradeId,
    movement: { kind: "receive" as const, reference: "Receipt TEST-1", grams },
  };
  await expect(
    seller.mutation(api.market.moveDirectCashTrade, dispatch),
  ).rejects.toThrow("CUSTODY_REVIEW_REQUIRED");
  await approve(ship);
  await approve(intake);
  const cash = { tradeId, amountPaise, reference: "Synthetic receipt 1" };
  await expect(
    seller.mutation(api.market.recordDirectCash, cash),
  ).rejects.toThrow("CASH_RECEIPT_NOT_AVAILABLE");
  await expect(
    buyer.mutation(api.market.moveDirectCashTrade, dispatch),
  ).rejects.toThrow("NOT_FOUND");
  await expect(
    seller.mutation(api.market.moveDirectCashTrade, {
      ...dispatch,
      movement: { ...dispatch.movement, grams: grams - 1 },
    }),
  ).rejects.toThrow("WEIGHT_DISPUTE");
  const out = await seller.mutation(api.market.moveDirectCashTrade, dispatch);
  expect(await seller.mutation(api.market.moveDirectCashTrade, dispatch)).toBe(
    out,
  );
  await expect(
    buyer.mutation(api.traceability.receive, { lotId, receivedGrams: grams }),
  ).rejects.toThrow("USE_TRADE_RECEIPT");
  expect(
    await buyer.query(api.market.directCashFulfillment, { tradeId }),
  ).toEqual({ action: "receive" });
  await revokeIntake();
  expect(
    await buyer.query(api.market.directCashFulfillment, { tradeId }),
  ).toEqual({ action: "renewScope" });
  await expect(
    buyer.mutation(api.market.moveDirectCashTrade, receipt),
  ).rejects.toThrow("CUSTODY_REVIEW_REQUIRED");
  expect(await buyer.query(api.market.receipt, { tradeId })).toMatchObject({
    status: "dispatched",
  });
  await approve(intake);
  const incoming = await buyer.mutation(
    api.market.moveDirectCashTrade,
    receipt,
  );
  expect(await buyer.mutation(api.market.moveDirectCashTrade, receipt)).toBe(
    incoming,
  );
  await revokeIntake();
  await expect(
    buyer.mutation(api.market.recordDirectCash, cash),
  ).rejects.toThrow("NOT_FOUND");
  await expect(
    seller.mutation(api.market.recordDirectCash, {
      ...cash,
      amountPaise: amountPaise - 1,
    }),
  ).rejects.toThrow("INVALID_PAYMENT_AMOUNT");
  const cashReceipt = await seller.mutation(api.market.recordDirectCash, cash);
  expect(await seller.mutation(api.market.recordDirectCash, cash)).toEqual(
    cashReceipt,
  );
  await expect(
    seller.mutation(api.market.recordDirectCash, {
      ...cash,
      reference: "Different reported cash",
    }),
  ).rejects.toThrow("CASH_RECEIPT_CONFLICT");
  expect(await buyer.query(api.market.receipt, { tradeId })).toMatchObject({
    status: "completed",
    number: null,
    directCashReceipt: cashReceipt,
    paymentVerification: "reported_direct_cash",
  });
  expect(
    await t.run((ctx) =>
      ctx.db
        .query("businessBillingUsage")
        .withIndex("by_trade", (q) => q.eq("tradeId", tradeId))
        .take(2),
    ),
  ).toMatchObject([
    { materialPaise: amountPaise, recordedAt: cashReceipt.recordedAt },
  ]);
  const saved = await t.run(async (ctx) => {
    const trade = await ctx.db.get("trades", tradeId);
    const lot = await ctx.db.get("materialLots", lotId);
    const events = await ctx.db
      .query("lotCustodyEvents")
      .withIndex("by_lot_created", (q) => q.eq("lotId", lotId))
      .take(3);
    const stock = trade
      ? await Promise.all(
          [trade.sellerOrgId, trade.buyerOrgId].map((orgId, side) =>
            ctx.db
              .query("inventoryMovements")
              .withIndex("by_org_source", (q) =>
                q
                  .eq("orgId", orgId)
                  .eq(
                    "sourceKey",
                    `trade:${tradeId}:${side === 0 ? "dispatch" : "receipt"}`,
                  ),
              )
              .unique(),
          ),
        )
      : [];
    return { trade, lot, events, stock };
  });
  expect(saved.trade?.status).toBe("completed");
  expect(saved.lot?.orgId).toBe(saved.trade?.buyerOrgId);
  expect(saved.events).toMatchObject([
    { kind: "dispatched", tradeId },
    { kind: "received", tradeId },
  ]);
  expect(saved.stock).toMatchObject([
    { deltaGrams: -grams },
    { deltaGrams: grams, costDeltaPaise: amountPaise },
  ]);
});

it("reserves the exact lot until the accepted trade is cancelled", async () => {
  const { t, seller, buyer, lotId, tradeId, requestOfferForLot } =
    await world();
  const competingTradeId = await requestOfferForLot();
  await expect(
    seller.mutation(api.market.act, {
      tradeId: competingTradeId,
      action: "accept",
    }),
  ).rejects.toThrow("LOT_RESERVED");
  const accepted = await t.run((ctx) => ctx.db.get("trades", tradeId));
  if (!accepted) throw new Error("Expected the accepted trade");
  await expect(
    seller.mutation(api.traceability.dispatch, {
      lotId,
      receiverOrgId: accepted.buyerOrgId,
    }),
  ).rejects.toThrow("LOT_RESERVED");
  await expect(
    seller.mutation(api.traceability.transform, {
      inputLotId: lotId,
      inputGrams: grams,
      contaminationGrams: 0,
      processLossGrams: 0,
      outputs: [{ materialCode, state: "Sorted again", grams }],
    }),
  ).rejects.toThrow("LOT_RESERVED");
  await buyer.mutation(api.cashfreeLifecycle.requestCancellation, {
    tradeId,
    reason: "Cancel before custody",
  });
  await seller.mutation(api.market.act, {
    tradeId: competingTradeId,
    action: "accept",
  });
  const competingReceipt = await buyer.query(api.market.receipt, {
    tradeId: competingTradeId,
  });
  expect(competingReceipt?.status).toBe("accepted");
  expect(competingReceipt?.directCashReceipt).toBeUndefined();
});

it("keeps a completed sale reserved while custody still belongs to the seller", async () => {
  const { t, seller, lotId, tradeId, requestOfferForLot } = await world();
  await t.run((ctx) =>
    ctx.db.patch("trades", tradeId, { status: "completed" }),
  );
  const competingTradeId = await requestOfferForLot();
  await expect(
    seller.mutation(api.market.act, {
      tradeId: competingTradeId,
      action: "accept",
    }),
  ).rejects.toThrow("LOT_RESERVED");
  await expect(
    seller.mutation(api.traceability.transform, {
      inputLotId: lotId,
      inputGrams: grams,
      contaminationGrams: 0,
      processLossGrams: 0,
      outputs: [{ materialCode, state: "Already sold", grams }],
    }),
  ).rejects.toThrow("LOT_RESERVED");
});
