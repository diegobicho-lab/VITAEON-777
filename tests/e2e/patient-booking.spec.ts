import { expect, test } from "@playwright/test";

test.describe("flujo paciente VITAEON", () => {
  test("permite explorar médicos, autenticarse y preparar una cita", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "VITAEON" })).toBeVisible();
    await page.getByPlaceholder("Buscar médico, subespecialidad o servicio").fill("Medicina");
    await expect(page.getByText(/Médico verificado|No hay médicos verificados/)).toBeVisible();

    await page.getByRole("button", { name: /Iniciar sesión/ }).click();
    await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
  });
});
