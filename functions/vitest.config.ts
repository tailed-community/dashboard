import { defineConfig } from "vitest/config";

// Scoped to `functions/` so `npm test` here doesn't pick up the frontend's
// root `vite.config.ts` (unrelated plugins, e.g. paraglide-js) when Vitest
// walks up looking for a config file.
export default defineConfig({
  test: {
    root: __dirname,
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
