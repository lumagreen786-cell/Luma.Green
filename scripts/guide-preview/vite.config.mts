import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import { themeBootstrap } from "../../src/components/theme/theme";

const directory = path.dirname(fileURLToPath(import.meta.url));
const repository = path.resolve(directory, "../..");
const staticDirectory = path.resolve(repository, ".next/static");
// Webpack emits static/css; Turbopack emits static/chunks. Preserve the
// relative path so both stylesheet URLs and their font references resolve.
const styles = readdirSync(staticDirectory, {
  recursive: true,
  encoding: "utf8",
  withFileTypes: false,
})
  .filter((file) => file.endsWith(".css"))
  .toSorted((left, right) => left.localeCompare(right));
if (styles.length === 0)
  throw new Error(
    "No built CSS found. Build the app before starting review fixtures.",
  );
// Reuse the exact font classes emitted for each locale by this build.
// This includes its script face, rather than relying on the host OS fallback.
const builtPages = path.resolve(repository, ".next/server/app");
const fontClasses = Object.fromEntries(
  readdirSync(builtPages)
    .filter((file) => /^[a-z]{2}\.html$/u.test(file))
    .map((file) => {
      const html = readFileSync(path.join(builtPages, file), "utf8");
      const classes = /<html[^>]* class="([^"]+)"/u.exec(html)?.[1];
      if (!classes)
        throw new Error(`Built locale has no font classes: ${file}`);
      return [file.slice(0, -5), classes];
    }),
);

export default defineConfig({
  root: directory,
  publicDir: staticDirectory,
  envDir: directory,
  define: { "process.env": JSON.stringify({ NODE_ENV: "development" }) },
  plugins: [
    react(),
    {
      name: "documentation-build-style",
      transformIndexHtml(html) {
        return html
          .replace(
            "<!-- APP_THEME -->",
            () => `<script>${themeBootstrap}</script>`,
          )
          .replace("<!-- APP_STYLES -->", () =>
            styles
              .map(
                (file) =>
                  `<link rel="stylesheet" href="/${file.split(path.sep).join("/")}">`,
              )
              .join("\n"),
          )
          .replace("APP_LOCALE_FONTS", () =>
            JSON.stringify(fontClasses).replaceAll('"', "&quot;"),
          );
      },
      configureServer(server) {
        server.middlewares.use((request, _response, next) => {
          if (request.url?.startsWith("/_next/static/")) {
            // Connect requires a mutable URL to map local build assets; no remote proxy is used.
            // eslint-disable-next-line no-param-reassign
            request.url = request.url.replace("/_next/static/", "/");
          }
          next();
        });
      },
    },
  ],
  resolve: {
    alias: [
      {
        find: "@/components/providers/convex-provider",
        replacement: path.resolve(directory, "provider.tsx"),
      },
      { find: "next/image", replacement: path.resolve(directory, "image.tsx") },
      {
        find: "next-intl/server",
        replacement: path.resolve(directory, "translations.ts"),
      },
      {
        find: "@/lib/auth-client",
        replacement: path.resolve(directory, "auth.ts"),
      },
      {
        find: "@/i18n/navigation",
        replacement: path.resolve(directory, "navigation.tsx"),
      },
      {
        find: "convex/react",
        replacement: path.resolve(directory, "queries.ts"),
      },
      {
        find: "next/link",
        replacement: path.resolve(directory, "navigation.tsx"),
      },
      {
        find: "next/navigation",
        replacement: path.resolve(directory, "navigation.tsx"),
      },
      { find: "@", replacement: path.resolve(repository, "src") },
    ],
  },
  server: {
    host: "127.0.0.1",
    port: 3202,
    strictPort: true,
    fs: { allow: [repository] },
  },
});
