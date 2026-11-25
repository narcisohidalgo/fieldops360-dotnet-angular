import { test, expect } from '@playwright/test';

test('real login, session restoration and logout', async ({
  page,
  context
}) => {
  const email = process.env.FIELDOPS_E2E_ADMIN_EMAIL;
  const password = process.env.FIELDOPS_E2E_ADMIN_PASSWORD;
  const facilityCode = process.env.FIELDOPS_E2E_FACILITY_CODE;

  if (!email || !password || !facilityCode) {
    throw new Error('Missing isolated E2E environment.');
  }

  // Comprobar el acceso anonimo contra la API real.
  const anonymous = await page.request.get('/api/auth/me');

  expect(anonymous.status()).toBe(401);

  await page.goto('/facilities');

  await expect(page).toHaveURL(url =>
    url.pathname === '/login' &&
    url.searchParams.get('returnUrl') === '/facilities'
  );

  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);

  await page.getByRole('button', {
    name: 'Acceder a FieldOps 360'
  }).click();

  await expect(page).toHaveURL(/\/facilities$/);

  await expect(page.getByRole('heading', {
    name: 'Gestión de instalaciones'
  })).toBeVisible();

  // El registro unico demuestra que se usa la base temporal.
  await expect(
    page.getByRole('cell', {
      name: facilityCode,
      exact: true
    })
  ).toBeVisible();

  await expect(
    page.getByRole('button', {
      name: '+ Nueva instalación',
      exact: true
    })
  ).toBeVisible();

  const cookies = await context.cookies();

  const authCookie = cookies.find(
    cookie => cookie.name === 'FieldOps.Auth'
  );

  expect(authCookie).toBeDefined();
  expect(authCookie?.httpOnly).toBe(true);

  // Recargar Angular y restaurar la sesion desde Identity.
  await page.reload();

  await expect(
    page.getByRole('cell', {
      name: facilityCode,
      exact: true
    })
  ).toBeVisible();

  const current = await page.request.get('/api/auth/me');

  expect(current.status()).toBe(200);

  const user = await current.json();

  expect(user.email).toBe(email);
  expect(user.roles).toEqual(['Administrator']);

  // Esperar a que el servidor confirme el cierre de sesion.
  const [logoutResponse] = await Promise.all([
    page.waitForResponse(response =>
      new URL(response.url()).pathname === '/api/auth/logout' &&
      response.request().method() === 'POST'
    ),

    page.getByRole('button', {
      name: 'Cerrar sesión',
      exact: true
    }).click()
  ]);

  expect(logoutResponse.status()).toBe(204);

  // Esperar a que Angular procese la respuesta y navegue al login.
  await expect(page).toHaveURL(url =>
    url.pathname === '/login'
  );

  await expect(page.getByRole('heading', {
    name: 'Iniciar sesión'
  })).toBeVisible();

  // Confirmar que la cookie de autenticacion ha desaparecido.
  const remainingCookies = await context.cookies();

  expect(
    remainingCookies.some(cookie =>
      cookie.name === 'FieldOps.Auth'
    )
  ).toBe(false);


  const afterLogout = await page.request.get('/api/auth/me');

  expect(afterLogout.status()).toBe(401);

  await page.goto('/facilities');

  await expect(page).toHaveURL(url =>
    url.pathname === '/login' &&
    url.searchParams.get('returnUrl') === '/facilities'
  );
});
