import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.{ts,tsx,mjs}"],
    environment: "jsdom",
    setupFiles: ["tests/setup.ts"],
    globals: true,
  },
});
