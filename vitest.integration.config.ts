import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "tests/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 30_000,
    env: {
      NODE_ENV: "test",
      APP_URL: "http://localhost:3000",
      AUTH_SECRET: "test-secret-for-konnekt-integration-only-0123456789",
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ?? "postgresql://postgres@127.0.0.1:55432/konnekt_test",
      TURNSTILE_BYPASS: "1",
      SESSION_TTL_DAYS: "30",
    },
  },
});
