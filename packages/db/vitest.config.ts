import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["src/__tests__/**/*.test.ts"],
    // Timeout generoso — los tests van contra BD real
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Secuencial — evita conflictos de datos entre tests paralelos
    pool: "forks",
    poolOptions: {
      forks: { singleFork: true },
    },
  },
});
