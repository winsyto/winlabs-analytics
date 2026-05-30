import { defineConfig, devices } from "@playwright/test";

const CI = !!process.env.CI;

// En local podés sobrescribir las URLs si corrés en puertos distintos
const CMP_URL = process.env.CMP_URL ?? "http://localhost:3001";
const CLIENTE_URL = process.env.CLIENTE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,   // secuencial — menos carga en máquinas lentas
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  workers: 1,             // un worker siempre — evita que dos tests compitan por CPU
  reporter: CI ? "github" : [["list"], ["html", { open: "never" }]],

  timeout: 60_000,           // 60s por test (era 30s)
  expect: { timeout: 15_000 }, // 15s para cada expect/assertion

  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Levanta las apps si no están ya corriendo (tanto en CI como en local)
  webServer: [
    {
      command: "pnpm --filter @wla/cmp dev",
      url: CMP_URL,
      reuseExistingServer: true,   // si ya está corriendo, la reutiliza
      timeout: 180_000,            // 3 min para que Next compile
      env: {
        DATABASE_URL: process.env.DATABASE_URL ?? "",
        DIRECT_URL: process.env.DIRECT_URL ?? "",
        AUTH_SECRET: process.env.AUTH_SECRET ?? "dev-secret-change-in-production",
        AUTH_URL: CMP_URL,
        APP_BASE_URL: CMP_URL,
        TENANT_ROUTING_MODE: "session",
      },
    },
    {
      command: "pnpm --filter @wla/cliente dev",
      url: CLIENTE_URL,
      reuseExistingServer: true,
      timeout: 180_000,
      env: {
        DATABASE_URL: process.env.DATABASE_URL ?? "",
        DIRECT_URL: process.env.DIRECT_URL ?? "",
        AUTH_SECRET: process.env.AUTH_SECRET ?? "dev-secret-change-in-production",
        AUTH_URL: CLIENTE_URL,
        APP_BASE_URL: CLIENTE_URL,
        TENANT_ROUTING_MODE: "session",
      },
    },
  ],
});
