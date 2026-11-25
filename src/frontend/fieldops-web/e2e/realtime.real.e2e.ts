import { test, expect, type Page } from '@playwright/test';

async function login(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto('/incidents');

  await expect(page).toHaveURL(url =>
    url.pathname === '/login'
  );

  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);

  await page.getByRole('button', {
    name: 'Acceder a FieldOps 360'
  }).click();

  await expect(page).toHaveURL(/\/incidents$/);

  await expect(page.getByRole('heading', {
    name: 'Gestión de incidencias',
    exact: true
  })).toBeVisible();
}

test('real WebSocket updates another session and its notifications',
  async ({ browser, page: observer }) => {
    test.setTimeout(60_000);

    const email = process.env.FIELDOPS_E2E_ADMIN_EMAIL;
    const password = process.env.FIELDOPS_E2E_ADMIN_PASSWORD;
    const seedCode = process.env.FIELDOPS_E2E_FACILITY_CODE;

    if (!email || !password || !seedCode) {
      throw new Error('Missing isolated realtime environment.');
    }

    const title = `Realtime incident ${seedCode}`;

    let handshakeReceived = false;
    let incidentEventReceived = false;

    // Observar el protocolo SignalR real sobre WebSocket.
    observer.on('websocket', socket => {
      if (
        new URL(socket.url()).pathname !== '/hubs/operations'
      ) {
        return;
      }

      socket.on('framereceived', frame => {
        const messages = frame.payload.toString()
          .split('\u001e')
          .filter(Boolean);

        for (const message of messages) {
          try {
            const data = JSON.parse(message);

            if (Object.keys(data).length === 0) {
              handshakeReceived = true;
            }

            if (
              data.type === 1 &&
              data.target === 'IncidentsChanged'
            ) {
              incidentEventReceived = true;
            }
          } catch {
            // Ignorar mensajes ajenos al protocolo JSON.
          }
        }
      });
    });

    // 2. Abrir la primera sesion independiente.
    await login(observer, email, password);

    await expect.poll(
      () => handshakeReceived,
      {
        message: 'SignalR WebSocket handshake was not received.',
        timeout: 15_000
      }
    ).toBe(true);

    const notificationButton = observer.getByRole('button', {
      name: /^Notificaciones,/
    });

    await expect(notificationButton).toHaveAccessibleName(
      'Notificaciones, 0 sin leer'
    );

    const facilityFilter = observer.locator(
      '#filter-incident-facility'
    );

    const seedOption = facilityFilter.getByText(
      `${seedCode} \u2014 Isolated E2E Facility`,
      { exact: true }
    );

    await expect(seedOption).toHaveCount(1);

    const facilityId = await seedOption.getAttribute('value');

    expect(facilityId).toBeTruthy();

    await facilityFilter.selectOption(facilityId!);

    await expect(observer.getByText(
      'No hay incidencias que coincidan con los filtros seleccionados.',
      { exact: true }
    )).toBeVisible();

    await expect(observer.getByText(title, {
      exact: true
    })).toHaveCount(0);

    // 3. Crear una segunda sesion con cookies independientes.
    const actorContext = await browser.newContext();

    try {
      const actor = await actorContext.newPage();

      // El contexto creado manualmente necesita una URL absoluta.
      await actor.goto('http://127.0.0.1:4292/incidents');

      await expect(actor).toHaveURL(url =>
        url.pathname === '/login'
      );

      await actor.locator('#login-email').fill(email);
      await actor.locator('#login-password').fill(password);

      await actor.getByRole('button', {
        name: 'Acceder a FieldOps 360'
      }).click();

      await expect(actor).toHaveURL(/\/incidents$/);

      // 4. Crear una incidencia mediante Angular y la API real.
      await actor.getByRole('button', {
        name: '+ Nueva incidencia',
        exact: true
      }).click();

      await actor.locator('#incident-facility')
        .selectOption(facilityId!);

      await actor.locator('#incident-title')
        .fill(title);

      await actor.locator('#incident-description')
        .fill('Created from an independent browser session.');

      await actor.locator('#incident-priority')
        .selectOption('3');

      const [created] = await Promise.all([
        actor.waitForResponse(response =>
          response.request().method() === 'POST' &&
          new URL(response.url()).pathname === '/api/incidents'
        ),

        actor.getByRole('button', {
          name: 'Crear incidencia',
          exact: true
        }).click()
      ]);

      expect(created.status()).toBe(201);

      const incident = await created.json();

      expect(incident.title).toBe(title);
      expect(incident.facilityId).toBe(facilityId);

      // 5. Confirmar la recepcion del evento WebSocket.
      await expect.poll(
        () => incidentEventReceived,
        {
          message: 'IncidentsChanged was not received over WebSocket.',
          timeout: 15_000
        }
      ).toBe(true);

      // 6. Verificar la actualizacion automatica de la primera sesion.
      // No se realiza reload ni se pulsa un boton de refresco.
      await expect(observer.getByText(title, {
        exact: true
      })).toBeVisible();

      // El filtro seleccionado debe conservarse.
      await expect(facilityFilter).toHaveValue(facilityId!);

      // 7. Comprobar el centro de notificaciones.
      await expect(notificationButton).toHaveAccessibleName(
        'Notificaciones, 1 sin leer'
      );

      await notificationButton.click();

      const panel = observer.getByRole('region', {
        name: 'Notificaciones operativas'
      });

      await expect(panel).toBeVisible();

      // Ensure the notification panel stays inside the viewport.
      const bounds = await panel.boundingBox();
      const viewport = observer.viewportSize();

      expect(bounds).not.toBeNull();
      expect(viewport).not.toBeNull();

      expect(
        bounds!.x,
        'Notification panel overflows the left viewport edge.'
      ).toBeGreaterThanOrEqual(0);

      expect(
        bounds!.x + bounds!.width,
        'Notification panel overflows the right viewport edge.'
      ).toBeLessThanOrEqual(viewport!.width);

      await expect(panel.getByText(
        'Incidencias actualizadas',
        { exact: true }
      )).toBeVisible();

      await expect(panel.getByText(
        'Se han registrado cambios en las incidencias.',
        { exact: true }
      )).toBeVisible();

      // 8. Marcar las notificaciones como leidas.
      const markAsRead = panel.getByRole('button', {
        name: 'Marcar todas como leídas',
        exact: true
      });

      await expect(markAsRead).toBeEnabled();
      await markAsRead.click({ timeout: 10_000 });

      await expect(notificationButton).toHaveAccessibleName(
        'Notificaciones, 0 sin leer'
      );

      await expect(markAsRead).toBeDisabled();

      // 9. Vaciar el centro de notificaciones.
      await panel.getByRole('button', {
        name: 'Vaciar',
        exact: true
      }).click();

      await expect(panel.getByText(
        'Todavía no hay avisos recientes.',
        { exact: true }
      )).toBeVisible();

      await panel.getByRole('button', {
        name: 'Cerrar notificaciones',
        exact: true
      }).click();

      await expect(panel).toHaveCount(0);

      // 10. Verificar la persistencia mediante la API real.
      const persistedResponse = await observer.request.get(
        `/api/incidents/${incident.id}`
      );

      expect(persistedResponse.status()).toBe(200);

      const persisted = await persistedResponse.json();

      expect(persisted.title).toBe(title);
      expect(persisted.facilityId).toBe(facilityId);
    }
    finally {
      await actorContext.close();
    }
  }
);
