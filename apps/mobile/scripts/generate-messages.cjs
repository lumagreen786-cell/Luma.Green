const { readFileSync, writeFileSync } = require("node:fs");
const path = require("node:path");

const { locales } = require("../../../src/i18n/locales.ts");

const outputPath = path.resolve(__dirname, "../src/messages.json");
const namespaces = [
  "native",
  "common",
  "brand",
  "notifications",
  "homeReminder",
];

/** The root catalogues remain the sole editable source of translated copy. */
function createShellCatalogue() {
  return Object.fromEntries(
    locales.map((locale) => {
      const source = JSON.parse(
        readFileSync(
          path.resolve(__dirname, `../../../messages/${locale}.json`),
          "utf8",
        ),
      );
      return [
        locale,
        Object.fromEntries(
          namespaces.map((namespace) => {
            if (
              namespace === "homeReminder" &&
              !Object.hasOwn(source, namespace)
            )
              return [
                namespace,
                require("../../../messages/en.json").homeReminder,
              ];
            if (!Object.hasOwn(source, namespace))
              throw new Error(`Missing ${locale}.${namespace}`);
            return [namespace, source[namespace]];
          }),
        ),
      ];
    }),
  );
}

if (require.main === module) {
  writeFileSync(
    outputPath,
    `${JSON.stringify(createShellCatalogue(), undefined, 2)}\n`,
  );
}

module.exports = { createShellCatalogue, outputPath };
