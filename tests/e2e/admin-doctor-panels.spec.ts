import { expect, test } from "@playwright/test";

test.describe("paneles protegidos VITAEON", () => {
  test("redirige rutas privadas si no existe sesión", async ({ page }) => {
    await page.goto("/dashboard/admin", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("button", { name: /Iniciar sesión/ })).toBeVisible();
  });

  test("mantiene disponible la navegación principal hacia paneles y especialidades", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("link", { name: /Especialistas/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Áreas|Áreas médicas/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Médicos privados verificados en León/ })).toBeVisible();
  });
});
