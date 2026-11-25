import { test, expect } from '@playwright/test';

test('Docker production redirects anonymous users to login', async ({ page }) => {
  await page.goto('/facilities');

  await expect(page).toHaveURL(url =>
    url.pathname === '/login' &&
    url.searchParams.get('returnUrl') === '/facilities'
  );

  await expect(
    page.getByRole('heading', { name: 'Iniciar sesión' })
  ).toBeVisible();

  await expect(page.locator('#login-email')).toBeVisible();
  await expect(page.locator('#login-password')).toBeVisible();

  await expect(
    page.getByRole('button', {
      name: 'Acceder a FieldOps 360'
    })
  ).toBeDisabled();
});

test('Docker production initializes Leaflet and renders facility markers', async ({ page }) => {
  const errors: string[] = [];

  page.on('pageerror', error => {
    errors.push(error.message);
  });

  const user = {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'docker-browser@example.invalid',
    displayName: 'Docker Browser Test',
    technicianId: null,
    roles: ['Supervisor']
  };

  const facilities = [
    {
      id: '22222222-2222-4222-8222-222222222222',
      code: 'DOCKER-E2E-001',
      name: 'Docker E2E Facility',
      city: 'Cordoba',
      address: 'Browser regression fixture',
      isActive: true,
      latitude: 37.8882,
      longitude: -4.7794
    }
  ];

  // Mock only API data, not Angular or Leaflet.
  await page.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

    if (request.method() === 'GET') {
      if (path === '/api/auth/me') {
        await route.fulfill({ json: user });
        return;
      }

      if (path === '/api/facilities') {
        await route.fulfill({ json: facilities });
        return;
      }
    }

    await route.abort();
  });

  await page.route('**/hubs/**', route => route.abort());

  // Keep the map regression independent from external tile services.
  await page.route(
    'https://tile.openstreetmap.org/**',
    route => route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL9sAAAAASUVORK5CYII=',
        'base64'
      )
    })
  );

  const response = await page.goto('/facilities');

  expect(response?.status()).toBe(200);

  await expect(
    page.getByRole('heading', {
      name: 'Gestión de instalaciones'
    })
  ).toBeVisible();

  await expect(
    page.getByRole('cell', {
      name: 'DOCKER-E2E-001',
      exact: true
    })
  ).toBeVisible();

  await expect(
    page.getByRole('heading', {
      name: 'Mapa de instalaciones'
    })
  ).toBeVisible();

  await expect(
    page.locator('app-facilities-map .map-count')
  ).toHaveText('1 de 1 ubicadas');

  const map = page.getByRole('region', {
    name: 'Mapa interactivo de instalaciones'
  });

  await expect(map).toHaveClass(/leaflet-container/);
  await expect(map).toBeVisible();

  const marker = map.locator(
    '.leaflet-overlay-pane path.leaflet-interactive'
  );

  await expect(marker).toHaveCount(1);
  await expect(marker).toBeVisible();

  await marker.click();

  const popup = map.locator('.leaflet-popup-content');

  await expect(popup).toBeVisible();

  await expect(
    popup.getByText('Docker E2E Facility', {
      exact: true
    })
  ).toBeVisible();

  await expect(popup).toContainText('DOCKER-E2E-001');
  await expect(popup).toContainText('Cordoba');
  await expect(popup).toContainText('Activa');

  await expect(
    page.locator('app-facilities-map .map-error')
  ).toHaveCount(0);

  expect(errors).toEqual([]);
});
