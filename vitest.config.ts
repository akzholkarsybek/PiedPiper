import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 20000,
    hookTimeout: 30000,
  },
  // fileURLToPath handles Windows drive letters and spaces in the path.
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
});
