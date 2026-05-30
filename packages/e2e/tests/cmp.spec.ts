import { test, expect } from "@playwright/test";
import { CMP_URL, CMP_ADMIN } from "./fixtures";

// Helper para login del CMP — usa locator por id para evitar ambigüedades
async function loginCmp(page: import("@playwright/test").Page) {
  await page.goto(`${CMP_URL}/login`);
  await page.locator("#email").fill(CMP_ADMIN.email);
  await page.locator("#password").fill(CMP_ADMIN.password);
  await page.getByRole("button", { name: /iniciar sesión/i }).click();
  await expect(page).toHaveURL(`${CMP_URL}/dashboard`, { timeout: 15_000 });
}

test.describe("CMP — smoke", () => {
  test("redirige a /login cuando no hay sesión", async ({ page }) => {
    await page.goto(`${CMP_URL}/dashboard`);
    await expect(page).toHaveURL(/\/login/);
  });

  test("login exitoso → dashboard", async ({ page }) => {
    await loginCmp(page);
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();
  });

  test("login fallido muestra error", async ({ page }) => {
    await page.goto(`${CMP_URL}/login`);
    await page.locator("#email").fill(CMP_ADMIN.email);
    await page.locator("#password").fill("contraseña-incorrecta");
    await page.getByRole("button", { name: /iniciar sesión/i }).click();
    await expect(page.getByText(/email o contraseña incorrectos/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("sidebar muestra link a Tenants", async ({ page }) => {
    await loginCmp(page);
    await expect(page.getByRole("link", { name: /tenants/i })).toBeVisible();
  });

  test("página /tenants lista tenants existentes", async ({ page }) => {
    await loginCmp(page);
    await page.getByRole("link", { name: /tenants/i }).click();
    await expect(page).toHaveURL(`${CMP_URL}/tenants`);
    await expect(page.getByRole("heading", { name: /tenants/i })).toBeVisible();
    await expect(page.locator("table tbody tr").first()).toBeVisible();
  });

  test("logout redirige a /login", async ({ page }) => {
    await loginCmp(page);
    await page.getByRole("button", { name: /cerrar sesión/i }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});
