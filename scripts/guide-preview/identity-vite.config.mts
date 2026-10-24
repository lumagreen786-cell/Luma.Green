import path from "node:path";
import { fileURLToPath } from "node:url";

import { mergeConfig } from "vite";

import base from "./vite.config.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
export default mergeConfig(base, {
  plugins: [
    {
      name: "identity-fixture-entry",
      transformIndexHtml(html: string) {
        return html.replace(
          /src="\/main\.tsx(?:\?[^"]*)?"/u,
          'src="/identity-main.tsx"',
        );
      },
    },
  ],
  resolve: {
    alias: [
      {
        find: "convex/react",
        replacement: path.resolve(directory, "identity-queries.ts"),
      },
    ],
  },
  server: { port: 3218 },
});
