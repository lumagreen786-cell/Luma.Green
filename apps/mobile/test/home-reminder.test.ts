import assert from "node:assert/strict";
import test from "node:test";

import {
  isHouseholdSettings,
  nextReminderState,
} from "../src/home-reminder-policy.ts";

void test("only notifies for an exit after a matching enter", () => {
  assert.deepEqual(nextReminderState(false, "exit"), {
    armed: false,
    notify: false,
  });
  assert.deepEqual(nextReminderState(false, "enter"), {
    armed: true,
    notify: false,
  });
  assert.deepEqual(nextReminderState(true, "exit"), {
    armed: false,
    notify: true,
  });
});

void test("shows the device control only in the trusted household settings route", () => {
  const origin = "https://luma.green";
  assert.equal(isHouseholdSettings(`${origin}/sell/settings`, origin), true);
  assert.equal(isHouseholdSettings(`${origin}/ar/sell/settings`, origin), true);
  assert.equal(
    isHouseholdSettings(`${origin}/xx/sell/settings`, origin),
    false,
  );
  assert.equal(
    isHouseholdSettings("https://luma.green.example/sell/settings", origin),
    false,
  );
  assert.equal(
    isHouseholdSettings(`${origin}/sell/settings/other`, origin),
    false,
  );
});
