import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Convex's runtime resolves @react-email/render via the "convex" export
// condition to the edge build; mirror that in tests so scheduled email
// actions load the same code as production.
export default defineConfig({
  resolve: {
    alias: {
      "@react-email/render": fileURLToPath(
        new URL("./node_modules/@react-email/render/dist/edge/index.mjs", import.meta.url)
      ),
    },
  },
  test: {
    environment: "edge-runtime",
    include: ["convex/**/*.test.ts"],
  },
});
