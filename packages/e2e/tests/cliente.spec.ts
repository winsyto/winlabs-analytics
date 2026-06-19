import { test, expect } from "@playwright/test";
import { CLIENTE_URL, ACME_ADMIN } from "./fixtures";

// Helper para login del cliente — usa locator por id para evitar ambigüedades
async function loginCliente(page: import("@playwright/test").Page) {
  await page.goto(`${CLIENTE_URL}/login`);
  await page.locator("#tenantSlug").fill(ACME_ADMIN.tenantSlug);
  await page.locator("#email").fill(ACME_ADMIN.email);
  await page.locator("#password").fill(ACME_ADMIN.password);
  await page.getByRole("button", { name: /entrar/i }).click();
  await expect(page).toHaveURL(`${CLIENTE_URL}/dashboard`, { timeout: 15_000 });
}

test.describe("Cliente — smoke", () => {
  test("redirige a /login cuando no hay sesión", async ({ page }) => {
    await page.goto(`${CLIENTE_URL}/dashboard`);
    await expect(page).toHaveURL(/\/login/);
  });

  test("login exitoso → dashboard", async ({ page }) => {
    await loginCliente(page);
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();
  });

  test("login fallido muestra error", async ({ page }) => {
    await page.goto(`${CLIENTE_URL}/login`);
    await page.locator("#tenantSlug").fill(ACME_ADMIN.tenantSlug);
    await page.locator("#email").fill(ACME_ADMIN.email);
    await page.locator("#password").fill("contraseña-incorrecta");
    await page.getByRole("button", { name: /entrar/i }).click();
    await expect(page.getByText(/email o contraseña incorrectos/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("tenant slug inválido muestra error", async ({ page }) => {
    await page.goto(`${CLIENTE_URL}/login`);
    await page.locator("#tenantSlug").fill("tenant-que-no-existe");
    await page.locator("#email").fill(ACME_ADMIN.email);
    await page.locator("#password").fill(ACME_ADMIN.password);
    await page.getByRole("button", { name: /entrar/i }).click();
    await expect(page.getByText(/email o contraseña incorrectos/i)).toBeVisible();
  });

  test("topbar muestra nombre del tenant", async ({ page }) => {
    await loginCliente(page);
    // El nombre del tenant aparece en el topbar (header)
    await expect(page.locator("header").getByText(ACME_ADMIN.tenantName)).toBeVisible();
  });

  test("logout redirige a /login", async ({ page }) => {
    await loginCliente(page);
    // El logout vive dentro del dropdown del user menu en el topbar
    await page.locator("header").getByRole("button").last().click();
    await page.getByRole("button", { name: /cerrar sesión/i }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});
