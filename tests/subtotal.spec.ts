import { test, expect } from '@playwright/test';

test.describe('Order Modal - Subtotal', () => {

  test('Combo B arranca en qty 1 con $14.500', async ({ page }) => {
    await page.goto('/');
    await page.locator('#combos').scrollIntoViewIfNeeded();
    await page.locator('#combos button.mp-open-btn').nth(1).click();
    await expect(page.locator('#order-modal-overlay')).toBeVisible();

    await expect(page.locator('#qty-value')).toHaveText('1');
    await expect(page.locator('#modal-subtotal')).toHaveText('$14.500');
  });

  test('Combo A subtotal 1 → 3 sumando de a 1', async ({ page }) => {
    await page.goto('/');
    await page.locator('#combos').scrollIntoViewIfNeeded();
    await page.locator('#combos button.mp-open-btn').first().click();
    await expect(page.locator('#order-modal-overlay')).toBeVisible();

    await expect(page.locator('#modal-subtotal')).toHaveText('$10.000');

    await page.locator('#qty-plus').click();
    await expect(page.locator('#qty-value')).toHaveText('2');
    await expect(page.locator('#modal-subtotal')).toHaveText('$20.000');

    await page.locator('#qty-plus').click();
    await expect(page.locator('#qty-value')).toHaveText('3');
    await expect(page.locator('#modal-subtotal')).toHaveText('$30.000');
  });

  test('Combo B no baja de 1', async ({ page }) => {
    await page.goto('/');
    await page.locator('#combos').scrollIntoViewIfNeeded();
    await page.locator('#combos button.mp-open-btn').nth(1).click();
    await expect(page.locator('#order-modal-overlay')).toBeVisible();

    await expect(page.locator('#qty-value')).toHaveText('1');
    await page.locator('#qty-minus').click();
    await expect(page.locator('#qty-value')).toHaveText('1');
    await expect(page.locator('#modal-subtotal')).toHaveText('$14.500');
  });

  test('Empanaditas arranca en qty 10 con $15.000', async ({ page }) => {
    await page.goto('/');
    await page.locator('#productos').scrollIntoViewIfNeeded();
    await page.locator('#productos button.mp-open-btn').first().click();
    await expect(page.locator('#order-modal-overlay')).toBeVisible();

    await expect(page.locator('#qty-value')).toHaveText('10');
    await expect(page.locator('#modal-subtotal')).toHaveText('$15.000');
  });

  test('Productos suman de a 5 y no bajan de 10', async ({ page }) => {
    await page.goto('/');
    await page.locator('#productos').scrollIntoViewIfNeeded();
    await page.locator('#productos button.mp-open-btn').first().click();
    await expect(page.locator('#order-modal-overlay')).toBeVisible();

    await expect(page.locator('#qty-value')).toHaveText('10');

    await page.locator('#qty-minus').click();
    await expect(page.locator('#qty-value')).toHaveText('10');

    await page.locator('#qty-plus').click();
    await expect(page.locator('#qty-value')).toHaveText('15');
    await expect(page.locator('#modal-subtotal')).toHaveText('$22.500');

    await page.locator('#qty-plus').click();
    await expect(page.locator('#qty-value')).toHaveText('20');
    await expect(page.locator('#modal-subtotal')).toHaveText('$30.000');
  });

  test('Pastelitos subtotal correcto a qty 10', async ({ page }) => {
    await page.goto('/');
    await page.locator('#productos').scrollIntoViewIfNeeded();
    await page.locator('#productos button.mp-open-btn').nth(2).click();
    await expect(page.locator('#order-modal-overlay')).toBeVisible();

    await expect(page.locator('#modal-subtotal')).toHaveText('$18.000');
  });

  test('Combo C con qty 5 da $90.000', async ({ page }) => {
    await page.goto('/');
    await page.locator('#combos').scrollIntoViewIfNeeded();
    await page.locator('#combos button.mp-open-btn').nth(2).click();
    await expect(page.locator('#order-modal-overlay')).toBeVisible();

    for (let i = 0; i < 4; i++) {
      await page.locator('#qty-plus').click();
    }
    await expect(page.locator('#qty-value')).toHaveText('5');
    await expect(page.locator('#modal-subtotal')).toHaveText('$90.000');
  });

});
