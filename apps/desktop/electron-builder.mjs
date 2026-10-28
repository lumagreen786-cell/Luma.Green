import { readFileSync } from "node:fs";

const config = JSON.parse(
  readFileSync(new URL("generated/config.json", import.meta.url), "utf8"),
);
const messages = JSON.parse(
  readFileSync(new URL("generated/messages.json", import.meta.url), "utf8"),
);
/** @type {import('electron-builder').Configuration} */
const builder = {
  appId: config.demo ? "green.luma.desktop.demo" : "green.luma.desktop",
  productName: config.demo ? "Luma.Green Demo" : "Luma.Green",
  asar: true,
  directories: { output: config.demo ? "release/demo" : "release" },
  icon: "generated/app-icon.png",
  files: [
    "src/**/*.mjs",
    "!src/**/*.test.mjs",
    "generated/*.json",
    "generated/*.mjs",
    "package.json",
  ],
  forceCodeSigning: config.release,
  publish: config.updateUrl
    ? [{ provider: "generic", url: config.updateUrl }]
    : null,
  mac: {
    icon: "generated/app-icon.icns",
    target: [
      { target: "dmg", arch: ["arm64", "x64"] },
      { target: "zip", arch: ["arm64", "x64"] },
    ],
    category: "public.app-category.utilities",
    hardenedRuntime: true,
    notarize: config.release,
    identity: config.release ? process.env.CSC_NAME : null,
    extendInfo: { NSLocationUsageDescription: messages.en.native.locationBody },
  },
  win: {
    icon: "generated/app-icon.ico",
    target: [{ target: "nsis", arch: ["x64", "arm64"] }],
    signtoolOptions: config.windowsPublisher
      ? { publisherName: config.windowsPublisher }
      : undefined,
    verifyUpdateCodeSignature: true,
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
  },
};
export default builder;
