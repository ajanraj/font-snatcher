import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { URL } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["src/test/**/*.test.ts", "src/test/**/*.test.tsx"],
    globals: true,
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
    clearMocks: true,
  },
});
