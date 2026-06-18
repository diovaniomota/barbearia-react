import { expect, test } from '@playwright/test';

test('client entry, home layout, and booking stepper match the Flutter flow', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('button', { name: 'Cliente' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Admin' })).toBeVisible();
  await expect(page.locator('.role-page')).toHaveCSS('padding-left', '32px');

  await page.getByRole('button', { name: 'Cliente' }).click();
  await expect(page).toHaveURL(/\/agendamentocliente$/);

  const firstService = page.locator('.service-photo-card').first();
  await expect(firstService).toBeVisible();
  await expect(firstService).toHaveCSS('height', '150px');
  await expect(page.locator('.count-badge b')).toBeVisible();
  await expect(page.locator('.count-badge b')).toHaveCSS('width', '17px');
  await expect(page.getByRole('button', { name: /Agendar/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Histórico/ })).toBeVisible();

  await firstService.click();
  await expect(page.locator('.screen-modal')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Agendar Horário' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Escolha o Serviço' })).toBeVisible();
  await expect(page.getByText('Selecione um ou mais serviços:')).toBeVisible();
  await expect(page.locator('.step-box.active')).toHaveCount(1);
  await expect(page.locator('.step-box').first()).toHaveClass(/active/);

  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByRole('heading', { name: 'Escolha a Data' })).toBeVisible();
  await expect(page.getByText('Selecione o dia desejado:')).toBeVisible();
});
