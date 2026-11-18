import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:https";
import { tmpdir } from "node:os";
import path from "node:path";

import next from "next";

// Real production Next routing, including canonical HTTPS redirects. The browser
// maps this hostname to loopback; the disposable certificate is test-only.
const port = Number(process.env.DOMAIN_TEST_PORT ?? 3112);
const directory = mkdtempSync(path.join(tmpdir(), "luma-domain-tls-"));
const key = path.join(directory, "key.pem");
const cert = path.join(directory, "cert.pem");
execFileSync(
  "/usr/bin/openssl",
  [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-keyout",
    key,
    "-out",
    cert,
    "-days",
    "1",
    "-subj",
    "/CN=business.luma.green",
  ],
  { stdio: "ignore" },
);
process.on("exit", () => rmSync(directory, { recursive: true, force: true }));
const app = next({ dev: false, hostname: "business.luma.green", port: 443 });
await app.prepare();
createServer(
  { key: readFileSync(key), cert: readFileSync(cert) },
  app.getRequestHandler(),
).listen(port, "127.0.0.1");
