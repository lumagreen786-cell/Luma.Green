// Exercise the installed Windows formatter with an inert shell adapter. No OS
// command runs; these controls do not claim Windows device acceptance.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";

const require = createRequire(import.meta.url);
const sdkRequire = createRequire(require.resolve("@trigger.dev/sdk"));
const coreRequire = createRequire(sdkRequire.resolve("@trigger.dev/core"));
const metricsRequire = createRequire(
  coreRequire.resolve("@opentelemetry/host-metrics"),
);
const shadcnRequire = createRequire(require.resolve("shadcn"));
const dotenvRequire = createRequire(shadcnRequire.resolve("@dotenvx/dotenvx"));

function windowsFormatter(root) {
  const consumer = createRequire(path.join(root, "index.js"));
  const util = consumer("./util");
  const childProcess = consumer("node:child_process");
  const commands = [];
  const powerShell = util.powerShell;
  const exec = childProcess.exec;
  const execSync = childProcess.execSync;
  const descriptor = Object.getOwnPropertyDescriptor(process, "platform");
  const filename = consumer.resolve("./processes");
  const cached = consumer.cache[filename];
  const restore = () => {
    util.powerShell = powerShell;
    childProcess.exec = exec;
    childProcess.execSync = execSync;
    if (descriptor) Object.defineProperty(process, "platform", descriptor);
    if (cached) consumer.cache[filename] = cached;
    else Reflect.deleteProperty(consumer.cache, filename);
  };
  try {
    util.powerShell = (command) => {
      commands.push(command);
      return Promise.resolve("");
    };
    childProcess.exec = () => {
      throw new Error("OS commands are forbidden in this test");
    };
    childProcess.execSync = childProcess.exec;
    // Node isolates test files in separate processes. Capture the vendor's
    // Windows branch at module load, then restore the real platform immediately.
    Object.defineProperty(process, "platform", { value: "win32" });
    Reflect.deleteProperty(consumer.cache, filename);
    const { services } = consumer("./processes");
    if (descriptor) Object.defineProperty(process, "platform", descriptor);
    return { services, commands, restore };
  } catch (error) {
    restore();
    throw error;
  }
}

for (const [name, consumer] of [
  ["Trigger host metrics", metricsRequire],
  ["shadcn dotenv", dotenvRequire],
]) {
  test(`${name}: Windows service names cannot retain Unicode quotation syntax`, async (context) => {
    const root =
      process.env.LUMA_SYSTEM_TEST_ARTIFACT ??
      path.dirname(consumer.resolve("systeminformation"));
    const { services, commands, restore } = windowsFormatter(root);
    context.after(restore);
    for (const glyph of ["‘", "’", "‚", "‛", "“", "”", "„", "–", "—", "―"]) {
      await services(`fixture${glyph}(ordinary name)`);
      const command = commands.at(-1);
      const names = command
        .matchAll(/Name='([^']*)'/g)
        .map((match) => match[1])
        .toArray();
      assert.equal(names.length, 1);
      assert.match(names[0], /^[a-z\d _.@-]+$/i);
      assert.equal(command.includes(glyph), false);
    }
    await services("Spooler, Windows Search");
    assert.match(commands.at(-1), /Name='spooler' or Name='windows search'/);
    await services("*");
    assert.equal(commands.at(-1).includes("-Filter"), false);
  });
}
