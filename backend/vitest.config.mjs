import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.js"],
    testTimeout: 30000,
    hookTimeout: 120000,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["app.js", "controllers/**", "middlewares/**", "models/**", "routes/**", "utils/**"],
      // See TESTING.md for the baseline these sit under.
      thresholds: { lines: 88, statements: 88, functions: 80, branches: 85 },
    },
  },
});
