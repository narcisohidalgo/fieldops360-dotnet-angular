import { test, expect } from '@playwright/test';

test('anonymous user is redirected to login', async ({ page }) => {
  // Aislar esta prueba del backend y de SQL Server.
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());

    if (url.pathname === '/api/auth/me') {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 401,
          title: 'Unauthorized'
        })
      });

      return;
    }

    await route.abort();
  });

  await page.route('**/hubs/**', route => route.abort());

  await page.goto('/facilities');

  await expect(page).toHaveURL(url =>
    url.pathname === '/login' &&
    url.searchParams.get('returnUrl') === '/facilities'
  );

  await expect(
    page.getByRole('heading', { name: 'Iniciar sesión' })
  ).toBeVisible();

  await expect(
    page.locator('#login-email')
  ).toBeVisible();

  await expect(
    page.locator('#login-password')
  ).toBeVisible();

  await expect(
    page.getByRole('button', {
      name: 'Acceder a FieldOps 360'
    })
  ).toBeDisabled();
});
