import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const mobileRequire = createRequire(
  new URL("../../apps/mobile/package.json", import.meta.url),
);
const expoRequire = createRequire(mobileRequire.resolve("expo/package.json"));
const cliRequire = createRequire(expoRequire.resolve("@expo/cli/package.json"));
const packageRoot = process.env.LUMA_ZOD_ARTIFACT
  ? path.resolve(process.env.LUMA_ZOD_ARTIFACT)
  : path.dirname(cliRequire.resolve("zod/package.json"));
const artifactRequire = createRequire(path.join(packageRoot, "package.json"));
const families = ["", "v3", "v4", "v4-mini", "v4/mini", "v4/core"];

function watchedArray() {
  let reads = 0;
  // eslint-disable-next-line unicorn/no-new-array -- A sparse array proves rejection before element reads.
  const input = new Proxy(new Array(100_000), {
    get(target, key, receiver) {
      if (key === Symbol.iterator || /^\d+$/.test(String(key))) reads++;
      return Reflect.get(target, key, receiver);
    },
  });
  return { input, reads: () => reads };
}
function watchedSet() {
  let reads = 0;
  class WatchedSet extends Set {
    values() {
      reads++;
      return super.values();
    }
    [Symbol.iterator]() {
      reads++;
      return super[Symbol.iterator]();
    }
  }
  return {
    input: new WatchedSet(Array.from({ length: 10_000 }, (_, i) => i)),
    reads: () => reads,
  };
}

const custom = (fn) => ({
  _zod: { def: { check: "custom" }, onattach: [], check: fn },
});

for (const format of ["cjs", "esm"]) {
  for (const family of families) {
    const entry = path.join(
      packageRoot,
      family || ".",
      `index.${format === "cjs" ? "cjs" : "js"}`,
    );
    const z =
      format === "cjs"
        ? artifactRequire(entry)
        : await import(pathToFileURL(entry));
    const isV3 = family === "" || family === "v3";
    const isCore = family === "v4/core";
    let c = null;
    if (!isV3) {
      const coreEntry = path.join(
        packageRoot,
        `v4/core/index.${format === "cjs" ? "cjs" : "js"}`,
      );
      c =
        format === "cjs"
          ? artifactRequire(coreEntry)
          : await import(pathToFileURL(coreEntry));
    }
    const clone = (schema, check) =>
      c.clone(schema, {
        ...schema._zod.def,
        checks: [...(schema._zod.def.checks ?? []), check],
      });
    const array = (child) =>
      isCore
        ? new c.$ZodArray({ type: "array", element: child })
        : z.array(child);
    const set = (child) =>
      isCore ? new c.$ZodSet({ type: "set", valueType: child }) : z.set(child);
    const any = () => (isCore ? new c.$ZodAny({ type: "any" }) : z.any());
    const string = () =>
      isCore ? new c.$ZodString({ type: "string" }) : z.string();
    const bound = (schema, kind, amount, message) => {
      if (isV3) return schema[kind](amount, message);
      const isSet = schema._zod.def.type === "set";
      const suffix = isSet ? "Size" : "Length";
      const keys = {
        max: "maximum",
        min: "minimum",
        length: "length",
        size: "size",
      };
      const checks = {
        max: `Max${suffix}`,
        min: `Min${suffix}`,
        length: "LengthEquals",
        size: "SizeEquals",
      };
      const check = checks[kind];
      const key = keys[kind];
      const checkName = check.replaceAll(
        /[A-Z]/g,
        (letter, i) => `${i ? "_" : ""}${letter.toLowerCase()}`,
      );
      return clone(
        schema,
        new c[`$ZodCheck${check}`]({
          check: checkName,
          [key]: amount,
          ...(message && { error: () => message }),
        }),
      );
    };
    const refine = (schema, fn) =>
      isV3
        ? schema.refine(() => {
            fn();
            return true;
          })
        : clone(
            schema,
            custom(() => fn()),
          );
    const parse = (schema, value, isAsync = false, params) => {
      const method = isAsync ? "safeParseAsync" : "safeParse";
      return isCore
        ? c[method](schema, value, params)
        : schema[method](value, params);
    };
    const boundedArray = (kind, amount) => bound(array(string()), kind, amount);
    const boundedSet = (kind, amount) => bound(set(string()), kind, amount);
    const name = `${format} ${family || "root/v3"}`;

    for (const isAsync of [false, true]) {
      for (const kind of ["max", "length", "set-max", "size"]) {
        test(`${name}: ${kind} ${isAsync ? "async" : "sync"} stops traversal, child work and outer checks`, async () => {
          let children = 0;
          let outer = 0;
          const child = any();
          if (isV3) {
            const original = child._parse.bind(child);
            child._parse = (...args) => {
              children++;
              return original(...args);
            };
          } else {
            const original = child._zod.run.bind(child._zod);
            child._zod.run = (...args) => {
              children++;
              return original(...args);
            };
          }
          const isSet = kind.startsWith("set") || kind === "size";
          const watched = isSet ? watchedSet() : watchedArray();
          const schema = refine(
            bound(
              isSet ? set(child) : array(child),
              kind === "set-max" ? "max" : kind,
              2,
              "collection limit",
            ),
            () => outer++,
          );
          const result = await parse(schema, watched.input, isAsync);
          assert.equal(result.success, false);
          assert.deepEqual(
            result.error.issues.map(({ code, path, message }) => ({
              code,
              path,
              message,
            })),
            [{ code: "too_big", path: [], message: "collection limit" }],
          );
          assert.equal(watched.reads(), 0, `${kind}: input traversal`);
          assert.equal(children, 0, `${kind}: child work`);
          assert.equal(outer, 0, `${kind}: outer checks`);
        });
      }
    }

    test(`${name}: bounds preserve accepted values and normal diagnostics`, async () => {
      for (const isAsync of [false, true]) {
        const valid = ["a", "b"];
        const maximumResult = await parse(
          boundedArray("max", 2),
          valid,
          isAsync,
        );
        const lengthResult = await parse(
          boundedArray("length", 2),
          valid,
          isAsync,
        );
        const setResult = await parse(
          boundedSet("size", 2),
          new Set(valid),
          isAsync,
        );
        assert.deepEqual(maximumResult.data, valid);
        assert.deepEqual(lengthResult.data, valid);
        assert.deepEqual(setResult.data, new Set(valid));
        const wrong = await parse(boundedArray("max", 2), "wrong", isAsync);
        assert.equal(wrong.error.issues[0].code, "invalid_type");
        const badChild = await parse(boundedArray("max", 2), [42], isAsync);
        assert.equal(badChild.error.issues[0].code, "invalid_type");
        assert.deepEqual(badChild.error.issues[0].path, [0]);
        for (const kind of ["min", "length"]) {
          const small = await parse(boundedArray(kind, 2), [42], isAsync);
          assert.deepEqual(
            small.error.issues
              .map((issue) => issue.code)
              .toSorted((left, right) => left.localeCompare(right)),
            ["invalid_type", "too_small"],
          );
        }
        const smallSet = await parse(
          boundedSet("min", 2),
          new Set([42]),
          isAsync,
        );
        assert.deepEqual(
          smallSet.error.issues
            .map((issue) => issue.code)
            .toSorted((left, right) => left.localeCompare(right)),
          ["invalid_type", "too_small"],
        );
      }
    });

    test(`${name}: nested paths, error maps and unconstrained contracts remain intact`, async () => {
      const capped = boundedArray("max", 1);
      const nested = isCore
        ? new c.$ZodObject({ type: "object", shape: { items: capped } })
        : z.object({ items: capped });
      const params = isV3
        ? { errorMap: () => ({ message: "mapped bound" }) }
        : { error: () => "mapped bound" };
      const failure = await parse(nested, { items: ["a", "b"] }, true, params);
      assert.deepEqual(
        failure.error.issues.map(({ path, message }) => ({ path, message })),
        [{ path: ["items"], message: "mapped bound" }],
      );
      let record;
      if (isCore)
        record = new c.$ZodRecord({
          type: "record",
          keyType: string(),
          valueType: string(),
        });
      else if (isV3) record = z.record(string());
      else record = z.record(string(), string());
      const map = isCore
        ? new c.$ZodMap({ type: "map", keyType: string(), valueType: string() })
        : z.map(string(), string());
      const recordResult = await parse(record, { a: "b" }, true);
      const mapResult = await parse(map, new Map([["a", "b"]]), true);
      const arrayResult = await parse(array(string()), [42, 43], true);
      assert.deepEqual(recordResult.data, { a: "b" });
      assert.deepEqual(mapResult.data, new Map([["a", "b"]]));
      assert.deepEqual(
        arrayResult.error.issues.map((issue) => issue.path),
        [[0], [1]],
      );
    });

    test(`${name}: unconstrained and min-only collections still walk their children`, async () => {
      let children = 0;
      const child = any();
      if (isV3) {
        const original = child._parse.bind(child);
        child._parse = (...args) => {
          children++;
          return original(...args);
        };
      } else {
        const original = child._zod.run.bind(child._zod);
        child._zod.run = (...args) => {
          children++;
          return original(...args);
        };
      }
      for (const schema of [array(child), bound(array(child), "min", 1)]) {
        const result = await parse(schema, [1, 2, 3], true);
        assert.equal(result.success, true);
      }
      for (const schema of [set(child), bound(set(child), "min", 1)]) {
        const result = await parse(schema, new Set([1, 2, 3]), true);
        assert.equal(result.success, true);
      }
      assert.equal(children, 12);
      const wrongSet = await parse(boundedSet("max", 1), [], true);
      const wrongLength = await parse(
        boundedArray("length", 1),
        ["a", "b"],
        true,
      );
      assert.equal(wrongSet.error.issues[0].code, "invalid_type");
      assert.equal(wrongLength.error.issues[0].exact, true);
    });

    if (!isV3) {
      test(`${name}: an early skipped bound reevaluates its predicate after child parsing`, async () => {
        for (const isAsync of [false, true]) {
          let calls = 0;
          let children = 0;
          const events = [];
          const child = any();
          const original = child._zod.run.bind(child._zod);
          child._zod.run = (...args) => {
            children++;
            events.push("child");
            return original(...args);
          };
          const schema = clone(
            array(child),
            new c.$ZodCheckMaxLength({
              check: "max_length",
              maximum: 1,
              when: () => {
                events.push(`when:${++calls}`);
                return calls > 1;
              },
            }),
          );
          // Match upstream: false at the raw gate permits child parsing. The normal
          // check then evaluates when against parsed output and can reject it.
          const first = await parse(schema, [1, 2], isAsync);
          assert.equal(first.success, false);
          assert.deepEqual(
            first.error.issues.map((issue) => issue.code),
            ["too_big"],
          );
          assert.deepEqual([calls, children], [2, 2]);
          assert.deepEqual(events, ["when:1", "child", "child", "when:2"]);
          const second = await parse(schema, [1, 2], isAsync);
          assert.equal(second.success, false);
          assert.deepEqual(
            second.error.issues.map((issue) => issue.code),
            ["too_big"],
          );
          assert.deepEqual([calls, children], [3, 2]);
          assert.deepEqual(events, [
            "when:1",
            "child",
            "child",
            "when:2",
            "when:3",
          ]);
        }
      });
    }

    if (!isV3) {
      test(`${name}: a preceding rewrite keeps its order and constrained maps use size gates`, async () => {
        const rewriteCheck = custom((payload) => {
          // eslint-disable-next-line no-param-reassign -- A Zod overwrite check intentionally updates its parse payload.
          payload.value = payload.value.slice(0, 2);
        });
        const source = array(string());
        const rewritten = bound(clone(source, rewriteCheck), "max", 2);
        const rewrittenResult = await parse(rewritten, ["a", "b", "c"], true);
        assert.deepEqual(rewrittenResult.data, ["a", "b"]);
        const mapped = new c.$ZodMap({
          type: "map",
          keyType: string(),
          valueType: string(),
          checks: [new c.$ZodCheckMaxSize({ check: "max_size", maximum: 1 })],
        });
        const mappedResult = await c.safeParseAsync(
          mapped,
          new Map([
            [1, 1],
            [2, 2],
          ]),
        );
        assert.deepEqual(
          mappedResult.error.issues.map((issue) => issue.code),
          ["too_big"],
        );
      });
    }
    if (family === "v4-mini" || family === "v4/mini") {
      test(`${name}: public mini bounds and transformations remain compatible`, async () => {
        const child = z.pipe(
          z.string(),
          z.transform(async (value) => value.toUpperCase()),
        );
        const transformedResult = await z
          .array(child)
          .check(z.maxLength(2))
          .safeParseAsync(["a", "b"]);
        assert.deepEqual(transformedResult.data, ["A", "B"]);
        assert.equal(
          z.array(z.string()).check(z.length(1)).safeParse(["a", "b"]).error
            .issues.length,
          1,
        );
        assert.equal(
          z
            .set(z.string())
            .check(z.size(1))
            .safeParse(new Set(["a", "b"])).error.issues.length,
          1,
        );
      });
    }

    if (isV3 || family === "v4") {
      test(`${name}: transforms, preprocessing and async callbacks retain order`, async () => {
        const transformed = z
          .array(z.string().transform(async (value) => value.toUpperCase()))
          .max(2);
        const transformedResult = await transformed.safeParseAsync(["a", "b"]);
        assert.deepEqual(transformedResult.data, ["A", "B"]);
        const preprocessing = z.preprocess(
          (input) => input.slice(0, 2),
          z.array(z.string()).max(2),
        );
        assert.deepEqual(preprocessing.parse(["a", "b", "c"]), ["a", "b"]);
        let childCalls = 0;
        let outerCalls = 0;
        const rejected = z
          .array(
            z.any().transform(async () => {
              childCalls++;
              return "value";
            }),
          )
          .max(1)
          .refine(async () => {
            outerCalls++;
            return true;
          });
        const rejectedResult = await rejected.safeParseAsync([1, 2, 3]);
        assert.equal(rejectedResult.success, false);
        assert.deepEqual([childCalls, outerCalls], [0, 0]);
        if (isV3) return;
        const rewrite = z
          .array(z.string())
          .overwrite((values) => values.slice(0, 2))
          .max(2);
        assert.deepEqual(rewrite.parse(["a", "b", "c"]), ["a", "b"]);
      });
    }
  }
}
