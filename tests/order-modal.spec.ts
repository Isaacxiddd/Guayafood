import { test, expect } from '@playwright/test';

test.describe('Order Modal', () => {

  test('no hay botón de datos de prueba visible en producción', async ({ page }) => {
    await page.goto('/');
    const testBtn = page.locator('#btn-test-data');
    await expect(testBtn).toHaveCount(0);
  });

  test('el título de la página no tiene emoji de corazón', async ({ page }) => {
    await page.goto('/');
    const title = await page.title();
    expect(title).not.toMatch(/[❤♥]/u);
    expect(title).toContain('Guayafood');
  });

  test('modal se abre al hacer click en Comprar de un producto', async ({ page }) => {
    await page.goto('/');
    await page.locator('#productos').scrollIntoViewIfNeeded();
    await page.locator('#productos button.mp-open-btn').first().click();
    await expect(page.locator('#order-modal-overlay')).toBeVisible();
  });

  test('modal se cierra con el botón X', async ({ page }) => {
    await page.goto('/');
    await page.locator('#productos').scrollIntoViewIfNeeded();
    await page.locator('#productos button.mp-open-btn').first().click();
    await expect(page.locator('#order-modal-overlay')).toBeVisible();
    await page.locator('#modal-close').click();
    await expect(page.locator('#order-modal-overlay')).toBeHidden();
  });

  test('modal se cierra con ESC', async ({ page }) => {
    await page.goto('/');
    await page.locator('#productos').scrollIntoViewIfNeeded();
    await page.locator('#productos button.mp-open-btn').first().click();
    await expect(page.locator('#order-modal-overlay')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#order-modal-overlay')).toBeHidden();
  });

  test('modal de producto arranca con qty 10', async ({ page }) => {
    await page.goto('/');
    await page.locator('#productos').scrollIntoViewIfNeeded();
    await page.locator('#productos button.mp-open-btn').first().click();
    await expect(page.locator('#qty-value')).toHaveText('10');
  });

  test('modal de combo arranca con qty 1', async ({ page }) => {
    await page.goto('/');
    await page.locator('#combos').scrollIntoViewIfNeeded();
    await page.locator('#combos button.mp-open-btn').first().click();
    await expect(page.locator('#qty-value')).toHaveText('1');
  });

  test('subtotal se actualiza al cambiar cantidad en combo', async ({ page }) => {
    await page.goto('/');
    await page.locator('#combos').scrollIntoViewIfNeeded();
    await page.locator('#combos button.mp-open-btn').first().click();
    await expect(page.locator('#modal-subtotal')).toHaveText('$10.000');
    await page.locator('#qty-plus').click();
    await expect(page.locator('#modal-subtotal')).toHaveText('$20.000');
  });

  test('botón WhatsApp del modal no navega sin datos', async ({ page }) => {
    await page.goto('/');
    await page.locator('#productos').scrollIntoViewIfNeeded();
    await page.locator('#productos button.mp-open-btn').first().click();
    // Click WhatsApp sin llenar el formulario — modal debe seguir visible
    await page.locator('#btn-wa-order').click();
    await expect(page.locator('#order-modal-overlay')).toBeVisible();
  });

  test('precios de productos coinciden con el catálogo', async ({ page }) => {
    await page.goto('/');
    await page.locator('#productos').scrollIntoViewIfNeeded();

    const btns = page.locator('#productos button.mp-open-btn');

    // Empanaditas — $1.500
    await btns.nth(0).click();
    await expect(page.locator('#modal-subtotal')).toHaveText('$15.000'); // qty 10 × 1500
    await page.locator('#modal-close').click();

    // Tequeños — $1.000
    await btns.nth(1).click();
    await expect(page.locator('#modal-subtotal')).toHaveText('$10.000'); // qty 10 × 1000
    await page.locator('#modal-close').click();

    // Pastelitos — $1.800
    await btns.nth(2).click();
    await expect(page.locator('#modal-subtotal')).toHaveText('$18.000'); // qty 10 × 1800
    await page.locator('#modal-close').click();
  });

  test('precios de combos coinciden con el catálogo', async ({ page }) => {
    await page.goto('/');
    await page.locator('#combos').scrollIntoViewIfNeeded();

    const btns = page.locator('#combos button.mp-open-btn');

    await btns.nth(0).click();
    await expect(page.locator('#modal-subtotal')).toHaveText('$10.000');
    await page.locator('#modal-close').click();

    await btns.nth(1).click();
    await expect(page.locator('#modal-subtotal')).toHaveText('$14.500');
    await page.locator('#modal-close').click();

    await btns.nth(2).click();
    await expect(page.locator('#modal-subtotal')).toHaveText('$18.000');
    await page.locator('#modal-close').click();
  });

});
