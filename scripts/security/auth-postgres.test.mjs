// Explicit integration gate: requires an isolated local PostgreSQL database.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import test, { before } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";

import { drizzle } from "drizzle-orm/node-postgres";
import { bigint, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import pg from "pg";

const require = createRequire(import.meta.url);
const authRequire = createRequire(require.resolve("better-auth"));
const host = process.env.LUMA_TEST_PG_HOST;
const port = Number(process.env.LUMA_TEST_PG_PORT ?? 5432);
before(() => {
  assert.ok(
    host === "127.0.0.1" ||
      (host &&
        [os.tmpdir(), "/tmp"].some((root) =>
          realpathSync(host).startsWith(realpathSync(root) + path.sep),
        )),
    "Set LUMA_TEST_PG_HOST to an isolated local fixture",
  );
  assert.ok(Number.isSafeInteger(port) && port > 0 && port < 65_536);
});
const config = {
  host,
  port,
  user: "postgres",
  database: "luma_security_test",
  max: 24,
  connectionTimeoutMillis: 5000,
  statement_timeout: 10_000,
};
const artifact = process.env.LUMA_AUTH_TEST_ARTIFACTS;
async function loadAdapter(name) {
  const file = artifact
    ? path.join(artifact, name.replaceAll("/", "_"), "patched/dist/index.mjs")
    : authRequire.resolve(name);
  return import(pathToFileURL(file).href);
}
async function waitFor(predicate) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await delay(10);
  }
  throw new Error("Timed out waiting for PostgreSQL row contention");
}
async function fixture(kind, hasMapping = false) {
  const schema = "security_" + randomUUID().replaceAll("-", "");
  const application = "luma_guard_" + schema;
  const control = new pg.Pool({
    ...config,
    max: 2,
    application_name: application + "_control",
  });
  // eslint-disable-next-line sonarjs/sql-queries -- Schema is a generated UUID, never user input.
  await control.query(`CREATE SCHEMA "${schema}"`);
  const pool = new pg.Pool({
    ...config,
    application_name: application,
    options: `-c search_path=${schema}`,
  });
  const quotaName = hasMapping ? "mappedQuota" : "rateLimit";
  const key = hasMapping ? "lookup_key" : "key";
  const count = hasMapping ? "used_count" : "count";
  const last = hasMapping ? "last_seen" : "lastRequest";
  // eslint-disable-next-line sonarjs/sql-queries -- Identifiers are fixed fixture constants.
  await pool.query(
    `CREATE TABLE "${quotaName}" (id text primary key, "${key}" text unique not null, "${count}" integer not null, "${last}" bigint not null)`,
  );
  await pool.query(
    'CREATE TABLE verification (id text primary key, identifier text not null, value text not null, "expiresAt" timestamp not null, "createdAt" timestamp not null, "updatedAt" timestamp not null)',
  );
  const options = {
    rateLimit: {
      storage: "database",
      modelName: quotaName,
      ...(hasMapping && { fields: { key, count, lastRequest: last } }),
    },
    advanced: { database: { generateId: false } },
  };
  let adapter, destroy;
  if (kind === "drizzle") {
    const quota = pgTable(quotaName, {
      id: text("id").primaryKey(),
      [key]: text(key),
      [count]: integer(count),
      [last]: bigint(last, { mode: "number" }),
    });
    const verification = pgTable("verification", {
      id: text("id").primaryKey(),
      identifier: text("identifier"),
      value: text("value"),
      expiresAt: timestamp("expiresAt"),
      createdAt: timestamp("createdAt"),
      updatedAt: timestamp("updatedAt"),
    });
    const { drizzleAdapter } = await loadAdapter(
      "@better-auth/drizzle-adapter",
    );
    adapter = drizzleAdapter(drizzle(pool), {
      provider: "pg",
      schema: { [quotaName]: quota, verification },
    })(options);
  } else {
    const { Kysely, PostgresDialect } = await import(
      pathToFileURL(
        createRequire(
          authRequire.resolve("@better-auth/kysely-adapter"),
        ).resolve("kysely"),
      ).href
    );
    const db = new Kysely({ dialect: new PostgresDialect({ pool }) });
    const { kyselyAdapter } = await loadAdapter("@better-auth/kysely-adapter");
    adapter = kyselyAdapter(db, { type: "postgres" })(options);
    destroy = () => db.destroy();
  }
  const reset = async () => {
    // eslint-disable-next-line sonarjs/sql-queries -- Table is one of two fixed fixture constants.
    await pool.query(`TRUNCATE "${quotaName}",verification`);
    // eslint-disable-next-line sonarjs/sql-queries -- Table is one of two fixed fixture constants.
    await pool.query(
      `INSERT INTO "${quotaName}" VALUES ('quota','fixture',0,0)`,
    );
  };
  await reset();
  return {
    adapter,
    pool,
    control,
    application,
    quotaName,
    count,
    reset,
    async close() {
      if (destroy) await destroy();
      else await pool.end();
      // eslint-disable-next-line sonarjs/sql-queries -- Only the generated fixture schema is dropped.
      await control.query(`DROP SCHEMA "${schema}" CASCADE`);
      await control.end();
    },
    async hold(table = quotaName) {
      const client = await control.connect();
      await client.query("BEGIN");
      await client.query(`SELECT id FROM "${schema}"."${table}" FOR UPDATE`);
      return client;
    },
    async blocked(number) {
      await waitFor(async () => {
        const r = await control.query(
          "SELECT count(*)::int AS n FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock'",
          [application],
        );
        return r.rows[0].n === number;
      });
    },
  };
}
for (const kind of ["drizzle", "kysely"]) {
  for (const hasMapping of [false, true])
    test(
      `${kind} guarded increments admit exactly five concurrent callers (mapping=${hasMapping})`,
      { timeout: 15_000 },
      async () => {
        const f = await fixture(kind, hasMapping);
        let lock;
        try {
          lock = await f.hold();
          const requests = Array.from({ length: 20 }, () =>
            f.adapter.incrementOne({
              model: "rateLimit",
              where: [
                { field: "key", value: "fixture" },
                { field: "count", operator: "lt", value: 5 },
              ],
              increment: { count: 1 },
            }),
          );
          await f.blocked(20);
          await lock.query("COMMIT");
          lock.release();
          lock = null;
          const results = await Promise.all(requests);
          assert.equal(results.filter(Boolean).length, 5);
          const row = await f.pool.query(
            `SELECT "${f.count}" AS n FROM "${f.quotaName}"`,
          );
          assert.equal(row.rows[0].n, 5);
        } finally {
          if (lock) {
            await lock.query("ROLLBACK");
            lock.release();
          }
          await f.close();
        }
      },
    );
  test(
    `${kind} a held update rechecks the changed guard before applying`,
    { timeout: 15_000 },
    async () => {
      const f = await fixture(kind);
      let lock;
      try {
        lock = await f.hold();
        const pending = f.adapter.incrementOne({
          model: "rateLimit",
          where: [
            { field: "key", value: "fixture" },
            { field: "count", operator: "lt", value: 5 },
          ],
          increment: { count: 1 },
        });
        await f.blocked(1);
        // The same locking transaction invalidates the waiting statement's guard.
        const schemaResult = await f.pool.query(
          "SELECT current_schema() AS name",
        );
        const schema = schemaResult.rows[0].name;
        await lock.query(`UPDATE "${schema}"."rateLimit" SET count=5`);
        await lock.query("COMMIT");
        lock.release();
        lock = null;
        assert.equal(await pending, null);
        const result = await f.pool.query('SELECT count FROM "rateLimit"');
        assert.equal(result.rows[0].count, 5);
      } finally {
        if (lock) {
          await lock.query("ROLLBACK");
          lock.release();
        }
        await f.close();
      }
    },
  );
  test(
    `${kind} pending state has only one claimant`,
    { timeout: 15_000 },
    async () => {
      const f = await fixture(kind);
      let lock;
      try {
        await f.pool.query(
          "INSERT INTO verification VALUES ('claim','local-claim','pending',now()+interval '1 minute',now(),now())",
        );
        lock = await f.hold("verification");
        const requests = Array.from({ length: 20 }, () =>
          f.adapter.incrementOne({
            model: "verification",
            where: [
              { field: "identifier", value: "local-claim" },
              { field: "value", value: "pending" },
            ],
            increment: {},
            set: { value: "accepted" },
          }),
        );
        await f.blocked(20);
        await lock.query("COMMIT");
        lock.release();
        lock = null;
        const results = await Promise.all(requests);
        assert.equal(results.filter(Boolean).length, 1);
      } finally {
        if (lock) {
          await lock.query("ROLLBACK");
          lock.release();
        }
        await f.close();
      }
    },
  );
  test(`${kind} ordinary increment and failed comparison preserve the row`, async () => {
    const f = await fixture(kind);
    try {
      const result = await f.adapter.incrementOne({
        model: "rateLimit",
        where: [{ field: "key", value: "fixture" }],
        increment: { count: 1 },
        set: { lastRequest: 123 },
      });
      assert.equal(result.count, 1);
      assert.equal(String(result.lastRequest), "123");
      assert.equal(
        await f.adapter.incrementOne({
          model: "rateLimit",
          where: [{ field: "count", operator: "lt", value: 1 }],
          increment: { count: 1 },
        }),
        null,
      );
    } finally {
      await f.close();
    }
  });
}
