import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/unit/**/*.test.ts"]
  },
  resolve: {
    alias: {
      "@": new URL(".", import.meta.url).pathname,
      "server-only": new URL("./tests/unit/server-only-stub.ts", import.meta.url).pathname
    }
  }
});
