import { describe, expect, it } from "vitest";

import {
  isLoopbackHttpOrigin,
  LOCAL_ACCEPTANCE_PERSONAS,
} from "./localAcceptance";
import { STAKEHOLDER_KINDS } from "./stakeholderKinds";

describe("local acceptance targets", () => {
  it.each([
    "http://localhost:3100",
    "http://127.0.0.1:3210",
    "http://[::1]:3210",
  ])("accepts the loopback origin %s", (url) => {
    expect(isLoopbackHttpOrigin(url)).toBe(true);
  });
  it.each([
    undefined,
    "",
    "invalid",
    "https://localhost:3100",
    // eslint-disable-next-line unicorn/prefer-https -- Reject this hostile non-loopback target; no request is sent.
    "http://localhost.attacker.test",
    "http://user:secret@localhost:3100",
    "http://127.0.0.1:3100/path",
    "http://127.0.0.1:3100?target=prod",
    // eslint-disable-next-line sonarjs/no-clear-text-protocols -- Reject this non-loopback target; no request is sent.
    "http://192.168.1.1",
    "https://outstanding-buzzard-942.convex.cloud",
  ])("refuses a non-local or ambiguous target %s", (url) => {
    expect(isLoopbackHttpOrigin(url)).toBe(false);
  });
});

it("covers the stakeholder groups with unique reserved-domain identities", () => {
  expect(new Set(LOCAL_ACCEPTANCE_PERSONAS.map(({ key }) => key)).size).toBe(
    LOCAL_ACCEPTANCE_PERSONAS.length,
  );
  expect(
    new Set(LOCAL_ACCEPTANCE_PERSONAS.map(({ email }) => email)).size,
  ).toBe(LOCAL_ACCEPTANCE_PERSONAS.length);
  expect(
    LOCAL_ACCEPTANCE_PERSONAS.every(({ email }) =>
      email.endsWith("@luma.test"),
    ),
  ).toBe(true);
  const covered = new Set(
    LOCAL_ACCEPTANCE_PERSONAS.flatMap(({ access }) =>
      access.kind === "stakeholder" ? [access.stakeholderKind] : [],
    ),
  );
  expect([...covered].toSorted((a, b) => a.localeCompare(b))).toEqual(
    [...STAKEHOLDER_KINDS].toSorted((a, b) => a.localeCompare(b)),
  );
});

it("binds every persona to one distinct fixed Indian phone instead of caller-supplied privilege", () => {
  const phones = LOCAL_ACCEPTANCE_PERSONAS.map(({ phone }) => phone);
  expect(new Set(phones).size).toBe(LOCAL_ACCEPTANCE_PERSONAS.length);
  expect(phones.every((phone) => /^\+919000008\d{3}$/.test(phone))).toBe(true);
});
