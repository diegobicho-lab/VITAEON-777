import { expect, test } from "@playwright/test";

test.describe("flujo paciente VITAEON", () => {
  test("permite explorar médicos, autenticarse y preparar una cita", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: /Médicos privados verificados en León/ })).toBeVisible();
    await page.getByPlaceholder(/dolor de cadera|diabetes|Susana|nutrición/).fill("Medicina");
    await expect(page.getByText(/Cargando red médica|Médico verificado|No hay médicos verificados|Sin selección médica|Selecciona una especialidad/)).toBeVisible();

    await page.getByRole("button", { name: /Iniciar sesión/ }).click();
    await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
  });
});
