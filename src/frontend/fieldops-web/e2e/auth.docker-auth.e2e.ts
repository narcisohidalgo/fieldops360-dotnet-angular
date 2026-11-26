import { test, expect, type Page } from '@playwright/test';

// Use Chromium's network stack and the configured TLS certificate pin.
// Direct fetch calls deliberately bypass Angular's CSRF interceptor.
async function browserApi(
  page: Page,
  path: string,
  method: 'GET' | 'POST' = 'GET',
  data?: { email: string; password: string }
) {
  return page.evaluate(async ({ path, method, data }) => {
    const response = await fetch(path, {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
      headers: data === undefined
        ? undefined
        : { 'Content-Type': 'application/json' },
      body: data === undefined
        ? undefined
        : JSON.stringify(data)
    });

    return {
      status: response.status,
      body: method === 'GET' && response.status === 200
        ? await response.json()
        : null
    };
  }, { path, method, data });
}

// Do not retain artifacts containing temporary authentication credentials.
test.use({
  trace: 'off',
  screenshot: 'off',
  video: 'off'
});

test('Docker production authenticates a real administrator over HTTPS',
  async ({ page, context }) => {

    const email = process.env.FIELDOPS_DOCKER_ADMIN_EMAIL;
    const password = process.env.FIELDOPS_DOCKER_ADMIN_PASSWORD;

    if (
      process.env.FIELDOPS_DOCKER_AUTH_REQUIRED !== '1' ||
      !email ||
      !password
    ) {
      throw new Error('Missing isolated Docker authentication environment.');
    }

    // Establish the production origin before issuing browser HTTP requests.
    await page.goto('/');

    expect(new URL(page.url()).origin).toBe(
      'https://localhost:8443'
    );

    // 1. Anonymous access must be rejected by the real backend.
    for (const endpoint of ['/api/auth/me', '/api/facilities']) {
      const response = await browserApi(page, endpoint);

      expect(response.status).toBe(401);
    }

    // 2. The login endpoint must reject requests without CSRF.
    const rejectedLogin = await browserApi(
      page,
      '/api/auth/login',
      'POST',
      { email, password }
    );

    expect(rejectedLogin.status).toBe(400);

    expect(
      (await context.cookies()).some(cookie =>
        cookie.name === 'FieldOps.Auth'
      )
    ).toBe(false);

    // 3. Navigate through Angular's real authentication guard.
    await page.goto('/facilities');

    await expect(page).toHaveURL(url =>
      url.protocol === 'https:' &&
      url.pathname === '/login' &&
      url.searchParams.get('returnUrl') === '/facilities'
    );

    await expect(
      page.getByRole('heading', { name: 'Iniciar sesión' })
    ).toBeVisible();

    await page.locator('#login-email').fill(email);
    await page.locator('#login-password').fill(password);

    // 4. Perform a real login through the production Angular application.
    const [loginResponse] = await Promise.all([
      page.waitForResponse(response =>
        new URL(response.url()).pathname === '/api/auth/login' &&
        response.request().method() === 'POST'
      ),

      page.getByRole('button', {
        name: 'Acceder a FieldOps 360'
      }).click()
    ]);

    expect(loginResponse.status()).toBe(200);

    expect(
      await loginResponse.request().headerValue('x-xsrf-token')
    ).toBeTruthy();

    await expect(page).toHaveURL(url =>
      url.protocol === 'https:' &&
      url.pathname === '/facilities'
    );

    await expect(
      page.getByRole('heading', {
        name: 'Gestión de instalaciones'
      })
    ).toBeVisible();

    await expect(
      page.getByRole('button', {
        name: '+ Nueva instalación',
        exact: true
      })
    ).toBeVisible();

    // 5. Verify authentication and antiforgery cookie attributes.
    const cookies = await context.cookies();

    for (const name of ['FieldOps.Auth', 'FieldOps.Antiforgery']) {
      const cookie = cookies.find(item => item.name === name);

      expect(cookie).toBeDefined();
      expect(cookie?.httpOnly).toBe(true);
      expect(cookie?.secure).toBe(true);
      expect(cookie?.sameSite).toBe('Lax');
      expect(cookie?.path).toBe('/');
    }

    const visibleCookies = await page.evaluate(() => document.cookie);

    expect(visibleCookies).not.toContain('FieldOps.Auth=');
    expect(visibleCookies).not.toContain('FieldOps.Antiforgery=');

    // 6. Verify Identity and access to protected real API data.
    const currentSession = await browserApi(page, '/api/auth/me');

    expect(currentSession.status).toBe(200);

    const user = currentSession.body;

    expect(user.email).toBe(email);
    expect(user.roles).toEqual(['Administrator']);

    const facilities = await browserApi(page, '/api/facilities');

    expect(facilities.status).toBe(200);
    expect(Array.isArray(facilities.body)).toBe(true);

    // 7. Restore the authenticated session after a full page reload.
    await page.reload();

    await expect(page).toHaveURL(url =>
      url.protocol === 'https:' &&
      url.pathname === '/facilities'
    );

    await expect(
      page.getByRole('heading', {
        name: 'Gestión de instalaciones'
      })
    ).toBeVisible();

    await expect(
      page.getByRole('button', {
        name: '+ Nueva instalación',
        exact: true
      })
    ).toBeVisible();

    const restoredSession = await browserApi(page, '/api/auth/me');

    expect(restoredSession.status).toBe(200);

    const restoredUser = restoredSession.body;

    expect(restoredUser.id).toBe(user.id);
    expect(restoredUser.roles).toEqual(['Administrator']);

    // 8. Missing CSRF must prevent logout without losing the session.
    const rejectedLogout = await browserApi(page, '/api/auth/logout', 'POST');

    expect(rejectedLogout.status).toBe(400);

    expect(
      (await browserApi(page, '/api/auth/me')).status
    ).toBe(200);

    // 9. Perform the real CSRF-protected logout through Angular.
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

    expect(
      await logoutResponse.request().headerValue('x-xsrf-token')
    ).toBeTruthy();

    await expect(page).toHaveURL(url =>
      url.protocol === 'https:' &&
      url.pathname === '/login'
    );

    const remainingCookies = await context.cookies();

    expect(
      remainingCookies.some(cookie =>
        cookie.name === 'FieldOps.Auth'
      )
    ).toBe(false);

    // 10. The browser must no longer access protected API resources.
    for (const endpoint of ['/api/auth/me', '/api/facilities']) {
      const response = await browserApi(page, endpoint);

      expect(response.status).toBe(401);
    }

    await page.goto('/facilities');

    await expect(page).toHaveURL(url =>
      url.pathname === '/login' &&
      url.searchParams.get('returnUrl') === '/facilities'
    );
  }
);
