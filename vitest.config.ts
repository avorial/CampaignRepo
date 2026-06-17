import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") }
  },
  test: {
    environment: "node",
    // Force an isolated in-memory database when lib/db.ts is imported.
    env: { CAMPAIGNREPO_DB: ":memory:" },
    include: ["tests/**/*.test.ts"]
  }
});
