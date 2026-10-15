import { convexTest } from "convex-test";

import { api } from "../_generated/api";
import schema from "../schema";
import { registerAuth, signIn } from "./auth.testing";

/** Minimal approved-site fixture; does not seed unrelated inventory or trades. */
export async function teamWorld(
  modules: Record<string, () => Promise<unknown>>,
) {
  const t = convexTest(schema, modules);
  registerAuth(t);
  const owner = await signIn(t, {
    email: "owner@example.test",
    phoneNumber: "+919000000102",
  });
  const other = await signIn(t, {
    email: "other@example.test",
    phoneNumber: "+919000000103",
  });
  const ownerId = await owner.mutation(api.identity.ensureProfile, {
    locale: "en",
  });
  const otherId = await other.mutation(api.identity.ensureProfile, {
    locale: "en",
  });
  const [orgId, otherOrgId] = await t.run(async (ctx) => {
    const ids = [];
    for (const profileId of [ownerId, otherId]) {
      const id = await ctx.db.insert("orgs", {
        kind: "yard",
        name: "Demo site",
        slug: `demo-${profileId}`,
        status: "active",
        ownerProfileId: profileId,
        city: "Demo",
        area: "Demo",
        address: "Demo",
        phones: [],
        weeklyOff: [],
        families: [],
        offersPickup: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("memberships", {
        profileId,
        orgId: id,
        role: "owner",
        createdAt: Date.now(),
      });
      ids.push(id);
    }
    return ids;
  });
  if (!orgId || !otherOrgId) throw new Error("Missing fixture sites");
  return { t, owner, other, orgId, otherOrgId, ownerId, otherId };
}
