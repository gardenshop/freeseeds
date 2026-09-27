import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@gfs/core": path.resolve("packages/core/src/index.ts") } },
  test: { environment: "node", include: ["tests/**/*.test.ts"] }
});
