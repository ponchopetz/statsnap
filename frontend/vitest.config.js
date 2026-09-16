import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.js"],
    css: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.{js,jsx}"],
      exclude: [
        "src/main.jsx",
        "src/test/**",
        "src/**/__tests__/**",
        "src/**/*.test.{js,jsx}",
        "src/vendor/**",
      ],
      // A few points under the measured baseline (see TESTING.md) so a real
      // regression fails CI without inviting assertions written for the number.
      thresholds: { lines: 85, statements: 83, functions: 82, branches: 77 },
    },
  },
});
