import { test, expect } from '@playwright/test';

test('technician can only access and complete assigned work orders',
  async ({ page }) => {
    const email = process.env.FIELDOPS_E2E_TECHNICIAN_EMAIL;
    const password = process.env.FIELDOPS_E2E_TECHNICIAN_PASSWORD;
    const ownId = process.env.FIELDOPS_E2E_OWN_ORDER_ID;
    const foreignId = process.env.FIELDOPS_E2E_FOREIGN_ORDER_ID;

    if (!email || !password || !ownId || !foreignId) {
      throw new Error('Missing isolated technician environment.');
    }

    const route = '/api/my/work-orders';
    const ownCode = 'E2E-WO-001';
    const foreignCode = 'E2E-WO-002';

    // 1. Autenticacion real como Technician.
    await page.goto('/my-work-orders');

    await expect(page).toHaveURL(url =>
      url.pathname === '/login'
    );

    await page.locator('#login-email').fill(email);
    await page.locator('#login-password').fill(password);

    await page.getByRole('button', {
      name: 'Acceder a FieldOps 360'
    }).click();

    await expect(page).toHaveURL(/\/my-work-orders$/);

    await expect(page.getByRole('heading', {
      name: 'Mis órdenes de trabajo',
      exact: true
    })).toBeVisible();

    // 2. Verificar la navegacion segun el rol.
    const navigation = page.getByRole('navigation', {
      name: 'Navegación principal'
    });

    for (const name of [
      'Instalaciones',
      'Activos',
      'Mis órdenes'
    ]) {
      await expect(navigation.getByRole('link', {
        name,
        exact: true
      })).toBeVisible();
    }

    for (const name of [
      'Dashboard',
      'Incidencias',
      'Técnicos',
      'Órdenes de trabajo',
      'Usuarios'
    ]) {
      await expect(navigation.getByRole('link', {
        name,
        exact: true
      })).toHaveCount(0);
    }

    // 3. Comprobar el aislamiento de las ordenes.
    const row = page.getByRole('row').filter({
      has: page.getByText(ownCode, { exact: true })
    });

    await expect(row).toBeVisible();

    await expect(page.getByText(foreignCode, {
      exact: true
    })).toHaveCount(0);

    await expect(row.getByRole('cell', {
      name: 'Planificada',
      exact: true
    })).toBeVisible();

    const listResponse = await page.request.get(route);

    expect(listResponse.status()).toBe(200);

    const orders = await listResponse.json();

    expect(orders).toHaveLength(1);
    expect(orders[0].id).toBe(ownId);

    const foreignResponse = await page.request.get(
      `${route}/${foreignId}`
    );

    expect(foreignResponse.status()).toBe(404);

    const forbiddenResponse = await page.request.get(
      '/api/work-orders'
    );

    expect(forbiddenResponse.status()).toBe(403);

    // Intentar modificar una orden ajena con CSRF valido.
    const csrfResponse = await page.request.get(
      '/api/auth/csrf'
    );

    expect(csrfResponse.status()).toBe(200);

    const csrf = await csrfResponse.json();

    const deniedStart = await page.request.patch(
      `${route}/${foreignId}/start`,
      {
        headers: {
          'X-XSRF-TOKEN': csrf.requestToken
        }
      }
    );

    expect(deniedStart.status()).toBe(404);

    // 4. Iniciar una orden propia desde Angular.
    await row.getByRole('button', {
      name: `Iniciar orden ${ownCode}`,
      exact: true
    }).click();

    const [started] = await Promise.all([
      page.waitForResponse(response =>
        response.request().method() === 'PATCH' &&
        new URL(response.url()).pathname ===
          `${route}/${ownId}/start`
      ),

      page.getByRole('button', {
        name: 'Confirmar iniciar',
        exact: true
      }).click()
    ]);

    expect(started.status()).toBe(204);

    await expect(row.getByRole('cell', {
      name: 'En curso',
      exact: true
    })).toBeVisible();

    // 5. Completar la orden propia desde Angular.
    await row.getByRole('button', {
      name: `Completar orden ${ownCode}`,
      exact: true
    }).click();

    const [completed] = await Promise.all([
      page.waitForResponse(response =>
        response.request().method() === 'PATCH' &&
        new URL(response.url()).pathname ===
          `${route}/${ownId}/complete`
      ),

      page.getByRole('button', {
        name: 'Confirmar completar',
        exact: true
      }).click()
    ]);

    expect(completed.status()).toBe(204);

    await expect(row.getByRole('cell', {
      name: 'Completada',
      exact: true
    })).toBeVisible();

    await expect(row.getByText(
      'Sin acciones disponibles',
      { exact: true }
    )).toBeVisible();

    // 6. Verificar la persistencia.
    await page.reload();

    await expect(row.getByRole('cell', {
      name: 'Completada',
      exact: true
    })).toBeVisible();

    const persistedResponse = await page.request.get(
      `${route}/${ownId}`
    );

    expect(persistedResponse.status()).toBe(200);

    const persisted = await persistedResponse.json();

    expect(persisted.id).toBe(ownId);
    expect(persisted.startedAtUtc).toBeTruthy();
    expect(persisted.completedAtUtc).toBeTruthy();
    expect(persisted.cancelledAtUtc).toBeNull();

    // 7. Acceso directo a rutas no autorizadas.
    for (const path of [
      '/users',
      '/dashboard',
      '/work-orders'
    ]) {
      await page.goto(path);

      await expect(page).toHaveURL(url =>
        url.pathname === '/access-denied'
      );
    }

    // 8. Confirmar el modo de solo lectura.
    await page.goto('/facilities');

    await expect(page.getByText(
      'Modo consulta: no tienes permisos para modificar instalaciones.'
    )).toBeVisible();

    await expect(page.getByRole('button', {
      name: '+ Nueva instalación',
      exact: true
    })).toHaveCount(0);
  }
);
