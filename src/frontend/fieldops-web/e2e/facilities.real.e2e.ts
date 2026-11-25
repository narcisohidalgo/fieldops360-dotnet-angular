import { test, expect, type Page } from '@playwright/test';

async function mutate(
  page: Page,
  method: string,
  path: string,
  expectedStatus: number,
  action: () => Promise<void>
) {
  const [response] = await Promise.all([
    page.waitForResponse(item =>
      item.request().method() === method &&
      new URL(item.url()).pathname === path
    ),
    action()
  ]);

  expect(response.status()).toBe(expectedStatus);

  return response;
}

test('administrator manages the facility lifecycle through Angular',
  async ({ page }) => {
    const email = process.env.FIELDOPS_E2E_ADMIN_EMAIL;
    const password = process.env.FIELDOPS_E2E_ADMIN_PASSWORD;
    const seedCode = process.env.FIELDOPS_E2E_FACILITY_CODE;

    if (!email || !password || !seedCode) {
      throw new Error('Missing isolated E2E environment.');
    }

    const code = `${seedCode}-NEW`;
    const name = 'E2E Maintenance Facility';
    const updatedName = 'E2E Updated Facility';

    // 1. Autenticacion real.
    await page.goto('/facilities');

    await expect(page).toHaveURL(url =>
      url.pathname === '/login'
    );

    await page.locator('#login-email').fill(email);
    await page.locator('#login-password').fill(password);

    await page.getByRole('button', {
      name: 'Acceder a FieldOps 360'
    }).click();

    await expect(page).toHaveURL(/\/facilities$/);

    await expect(page.getByRole('cell', {
      name: seedCode,
      exact: true
    })).toBeVisible();

    // 2. Abrir el formulario de creacion.
    await page.getByRole('button', {
      name: '+ Nueva instalación',
      exact: true
    }).click();

    await expect(page.getByRole('heading', {
      name: 'Nueva instalación',
      exact: true
    })).toBeVisible();

    const submit = page.getByRole('button', {
      name: 'Crear instalación',
      exact: true
    });

    // Comprobar la validacion de campos obligatorios.
    await submit.click();

    await expect(page.getByText(
      'Introduce un código válido de hasta 30 caracteres.'
    )).toBeVisible();

    await expect(page.getByText(
      'Introduce un nombre válido de hasta 150 caracteres.'
    )).toBeVisible();

    await expect(page.getByText(
      'Introduce una ciudad válida de hasta 100 caracteres.'
    )).toBeVisible();

    // 3. Crear la instalacion mediante la interfaz.
    await page.locator('#facility-code').fill(code);
    await page.locator('#facility-name').fill(name);
    await page.locator('#facility-city').fill('Cordoba');
    await page.locator('#facility-address').fill('E2E Test Address');

    const created = await mutate(
      page,
      'POST',
      '/api/facilities',
      201,
      () => submit.click()
    );

    const facility = await created.json();

    expect(facility.id).toBeTruthy();
    expect(facility.code).toBe(code);
    expect(facility.name).toBe(name);
    expect(facility.isActive).toBe(true);

    const apiUrl = `/api/facilities/${facility.id}`;

    const row = page.getByRole('row').filter({
      has: page.getByRole('cell', {
        name: code,
        exact: true
      })
    });

    await expect(row).toBeVisible();

    await expect(row.getByRole('cell', {
      name,
      exact: true
    })).toBeVisible();

    await expect(row.getByRole('cell', {
      name: 'Activa',
      exact: true
    })).toBeVisible();

    // 4. Modificar la instalacion.
    await row.getByRole('button', {
      name: `Editar instalación ${code}`,
      exact: true
    }).click();

    await expect(page.getByRole('heading', {
      name: 'Editar instalación',
      exact: true
    })).toBeVisible();

    await expect(
      page.locator('#edit-facility-name')
    ).toHaveValue(name);

    await page.locator('#edit-facility-name')
      .fill(updatedName);

    await page.locator('#edit-facility-city')
      .fill('Sevilla');

    await page.locator('#edit-facility-address')
      .fill('Updated E2E Address');

    await mutate(
      page,
      'PUT',
      apiUrl,
      204,
      () => page.getByRole('button', {
        name: 'Guardar cambios',
        exact: true
      }).click()
    );

    await expect(row.getByRole('cell', {
      name: updatedName,
      exact: true
    })).toBeVisible();

    await expect(row.getByRole('cell', {
      name: 'Sevilla',
      exact: true
    })).toBeVisible();

    // 5. Desactivar la instalacion.
    await row.getByRole('button', {
      name: `Desactivar instalación ${code}`,
      exact: true
    }).click();

    await mutate(
      page,
      'PATCH',
      `${apiUrl}/deactivate`,
      204,
      () => page.getByRole('button', {
        name: 'Confirmar desactivación',
        exact: true
      }).click()
    );

    await expect(row.getByRole('cell', {
      name: 'Inactiva',
      exact: true
    })).toBeVisible();

    // Comprobar que el estado persiste al recargar.
    await page.reload();

    await expect(row.getByRole('cell', {
      name: 'Inactiva',
      exact: true
    })).toBeVisible();

    // 6. Reactivar la instalacion.
    await row.getByRole('button', {
      name: `Activar instalación ${code}`,
      exact: true
    }).click();

    await mutate(
      page,
      'PATCH',
      `${apiUrl}/activate`,
      204,
      () => page.getByRole('button', {
        name: 'Confirmar activación',
        exact: true
      }).click()
    );

    await expect(row.getByRole('cell', {
      name: 'Activa',
      exact: true
    })).toBeVisible();

    // 7. Verificar los datos finales desde la API real.
    const response = await page.request.get(apiUrl);

    expect(response.status()).toBe(200);

    const persisted = await response.json();

    expect(persisted).toMatchObject({
      id: facility.id,
      code,
      name: updatedName,
      city: 'Sevilla',
      address: 'Updated E2E Address',
      isActive: true
    });

    await page.reload();

    await expect(row.getByRole('cell', {
      name: updatedName,
      exact: true
    })).toBeVisible();

    await expect(row.getByRole('cell', {
      name: 'Activa',
      exact: true
    })).toBeVisible();
  }
);
