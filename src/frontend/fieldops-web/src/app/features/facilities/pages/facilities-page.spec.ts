import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../../core/services/auth.service';
import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Facility } from '../models/facility.model';
import { FacilitiesPage } from './facilities-page';

describe('FacilitiesPage', () => {
  let httpMock: HttpTestingController;
  let grantedRoles: Set<string>;

  const activeFacility: Facility = {
    id: '00000000-0000-0000-0000-000000000002',
    code: 'FAC-002',
    name: 'Centro de Operaciones Sevilla Este',
    city: 'Sevilla',
    address: 'Avenida de la Innovación 25',
    isActive: true
  };

  const inactiveFacility: Facility = {
    id: '00000000-0000-0000-0000-000000000001',
    code: 'FAC-001',
    name: 'Centro Logístico Córdoba Norte',
    city: 'Córdoba',
    address: 'Calle Innovación 25',
    isActive: false
  };

  beforeEach(() => {
    grantedRoles = new Set(['Administrator']);

    TestBed.configureTestingModule({
      imports: [FacilitiesPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            hasRole: (role: string) => grantedRoles.has(role)
          }
        }
      ]
    });

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should confirm deactivation with PATCH and refresh the list', () => {
    // Arrange: crear la pagina.
    const fixture = TestBed.createComponent(FacilitiesPage);

    fixture.detectChanges();

    // Simular la carga inicial de instalaciones.
    const initialRequest = httpMock.expectOne('/api/facilities');

    expect(initialRequest.request.method).toBe('GET');

    initialRequest.flush([
      inactiveFacility,
      activeFacility
    ]);

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    // Localizar el boton Desactivar de FAC-002.
    const deactivateButton =
      compiled.querySelector<HTMLButtonElement>(
        '.deactivate-button'
      );

    expect(deactivateButton).not.toBeNull();

    // Act: solicitar la desactivacion.
    deactivateButton!.click();

    fixture.detectChanges();

    // El panel debe aparecer antes de enviar el PATCH.
    expect(
      compiled.querySelector('.deactivation-panel')
    ).not.toBeNull();

    httpMock.expectNone(
      `/api/facilities/${activeFacility.id}/deactivate`
    );

    // Confirmar la desactivacion.
    const confirmButton =
      compiled.querySelector<HTMLButtonElement>(
        '.confirm-deactivation'
      );

    expect(confirmButton).not.toBeNull();

    confirmButton!.click();

    // Assert: comprobar la peticion PATCH.
    const patchRequest = httpMock.expectOne(
      `/api/facilities/${activeFacility.id}/deactivate`
    );

    expect(patchRequest.request.method).toBe('PATCH');

    // Simular la respuesta correcta de ASP.NET Core.
    patchRequest.flush(null, {
      status: 204,
      statusText: 'No Content'
    });

    // Angular debe consultar nuevamente las instalaciones.
    const refreshRequest = httpMock.expectOne('/api/facilities');

    expect(refreshRequest.request.method).toBe('GET');

    refreshRequest.flush([
      inactiveFacility,
      {
        ...activeFacility,
        isActive: false
      }
    ]);

    fixture.detectChanges();

    // El panel de confirmacion debe desaparecer.
    expect(
      compiled.querySelector('.deactivation-panel')
    ).toBeNull();

    // Debe aparecer el mensaje de exito.
    const successMessage = compiled.querySelector(
      '.success-message'
    );

    expect(successMessage?.textContent).toContain(
      'Instalación FAC-002 desactivada correctamente.'
    );

    // FAC-002 debe aparecer como Inactiva.
    const rows = Array.from(
      compiled.querySelectorAll<HTMLTableRowElement>('tbody tr')
    );

    const updatedRow = rows.find(
      row => row.textContent?.includes('FAC-002')
    );

    expect(updatedRow).toBeDefined();
    expect(updatedRow?.textContent).toContain('Inactiva');

    // Ninguna instalacion inactiva debe mostrar Desactivar.
    expect(
      compiled.querySelectorAll('.deactivate-button').length
    ).toBe(0);
  });
  for (const testCase of [
    {
      label: '404 Not Found',
      status: 404,
      message: 'La instalación ya no existe. Actualiza el listado.'
    },
    {
      label: 'network error',
      status: 0,
      message: 'No se pudo conectar con el servidor.'
    }
  ]) {
    it(`should handle ${testCase.label} during deactivation`, () => {
      // Arrange: crear la pagina.
      const fixture = TestBed.createComponent(FacilitiesPage);

      fixture.detectChanges();

      // Simular una instalacion activa en el listado.
      const initialRequest = httpMock.expectOne('/api/facilities');

      expect(initialRequest.request.method).toBe('GET');

      initialRequest.flush([
        inactiveFacility,
        activeFacility
      ]);

      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;

      // Solicitar la desactivacion de FAC-002.
      const deactivateButton =
        compiled.querySelector<HTMLButtonElement>(
          '.deactivate-button'
        );

      expect(deactivateButton).not.toBeNull();

      deactivateButton!.click();

      fixture.detectChanges();

      // El panel de confirmacion debe aparecer.
      expect(
        compiled.querySelector('.deactivation-panel')
      ).not.toBeNull();

      // Confirmar la operacion.
      const confirmButton =
        compiled.querySelector<HTMLButtonElement>(
          '.confirm-deactivation'
        );

      expect(confirmButton).not.toBeNull();

      confirmButton!.click();

      // Comprobar la peticion PATCH.
      const patchRequest = httpMock.expectOne(
        `/api/facilities/${activeFacility.id}/deactivate`
      );

      expect(patchRequest.request.method).toBe('PATCH');

      // Simular el error correspondiente.
      if (testCase.status === 0) {
        patchRequest.error(new ProgressEvent('error'));
      } else {
        patchRequest.flush(
          { title: 'Facility not found' },
          {
            status: 404,
            statusText: 'Not Found'
          }
        );
      }

      fixture.detectChanges();

      // Assert: el panel debe seguir abierto.
      expect(
        compiled.querySelector('.deactivation-panel')
      ).not.toBeNull();

      // Debe mostrarse el mensaje de error adecuado.
      const errorMessage = compiled.querySelector(
        '.deactivation-error'
      );

      expect(errorMessage?.textContent).toContain(
        testCase.message
      );

      // No debe mostrarse un mensaje de exito.
      expect(
        compiled.querySelector('.success-message')
      ).toBeNull();

      // El boton debe volver a estar habilitado.
      const confirmButtonAfterError =
        compiled.querySelector<HTMLButtonElement>(
          '.confirm-deactivation'
        );

      expect(confirmButtonAfterError?.disabled).toBe(false);

      expect(confirmButtonAfterError?.textContent)
        .toContain('Confirmar desactivación');

      // El usuario debe poder cancelar despues del error.
      const cancelButton =
        compiled.querySelector<HTMLButtonElement>(
          '.cancel-action'
        );

      expect(cancelButton?.disabled).toBe(false);

      // No debe recargarse el listado tras un error.
      httpMock.expectNone('/api/facilities');

      // La instalacion debe seguir apareciendo como activa.
      expect(
        compiled.querySelectorAll('.deactivate-button').length
      ).toBe(1);
    });
  }
  it('should prevent duplicate PATCH requests during deactivation', () => {
    // Arrange: crear la página y cargar las instalaciones.
    const fixture = TestBed.createComponent(FacilitiesPage);

    fixture.detectChanges();

    const initialRequest = httpMock.expectOne('/api/facilities');

    initialRequest.flush([
      inactiveFacility,
      activeFacility
    ]);

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    // Solicitar la desactivación de FAC-002.
    const deactivateButton =
      compiled.querySelector<HTMLButtonElement>(
        '.deactivate-button'
      );

    expect(deactivateButton).not.toBeNull();

    deactivateButton!.click();

    fixture.detectChanges();

    // Localizar el botón de confirmación.
    const confirmDebugElement = fixture.debugElement.query(
      By.css('.confirm-deactivation')
    );

    expect(confirmDebugElement).not.toBeNull();

    const confirmButton =
      confirmDebugElement.nativeElement as HTMLButtonElement;

    expect(confirmButton.disabled).toBe(false);

    // Act: confirmar la desactivación por primera vez.
    confirmButton.click();

    fixture.detectChanges();

    // Mientras el PATCH está pendiente, el botón debe bloquearse.
    expect(confirmButton.disabled).toBe(true);

    expect(confirmButton.textContent)
      .toContain('Desactivando...');

    // El botón Cancelar también debe estar bloqueado.
    const cancelButton =
      compiled.querySelector<HTMLButtonElement>(
        '.cancel-action'
      );

    expect(cancelButton?.disabled).toBe(true);

    // Simular una segunda activación del manejador,
    // incluso saltándonos el bloqueo visual del botón.
    confirmDebugElement.triggerEventHandler(
      'click',
      new MouseEvent('click')
    );

    // Assert: debe existir exactamente una petición PATCH.
    const patchRequest = httpMock.expectOne(
      `/api/facilities/${activeFacility.id}/deactivate`
    );

    expect(patchRequest.request.method).toBe('PATCH');

    // Todavía no debe haberse recargado el listado.
    httpMock.expectNone('/api/facilities');

    // Simular que ASP.NET Core completa la operación.
    patchRequest.flush(null, {
      status: 204,
      statusText: 'No Content'
    });

    // La aplicación debe actualizar el listado una sola vez.
    const refreshRequest = httpMock.expectOne(
      '/api/facilities'
    );

    refreshRequest.flush([
      inactiveFacility,
      {
        ...activeFacility,
        isActive: false
      }
    ]);

    fixture.detectChanges();

    // El panel debe cerrarse al finalizar correctamente.
    expect(
      compiled.querySelector('.deactivation-panel')
    ).toBeNull();

    // Debe mostrarse el mensaje de éxito.
    expect(
      compiled.querySelector('.success-message')?.textContent
    ).toContain(
      'Instalación FAC-002 desactivada correctamente.'
    );

    // Ya no deben aparecer botones Desactivar.
    expect(
      compiled.querySelectorAll('.deactivate-button').length
    ).toBe(0);
  });
  it('should confirm activation with PATCH and refresh the list', () => {
    // Arrange: crear la pagina y cargar instalaciones.
    const fixture = TestBed.createComponent(FacilitiesPage);

    fixture.detectChanges();

    const initialRequest = httpMock.expectOne('/api/facilities');

    expect(initialRequest.request.method).toBe('GET');

    initialRequest.flush([
      inactiveFacility,
      activeFacility
    ]);

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    // Solo FAC-001 esta inactiva.
    const activateButtons =
      compiled.querySelectorAll<HTMLButtonElement>(
        '.activate-button'
      );

    expect(activateButtons.length).toBe(1);

    expect(
      activateButtons[0].getAttribute('aria-label')
    ).toContain('FAC-001');

    // Act: solicitar la activacion.
    activateButtons[0].click();

    fixture.detectChanges();

    // Comprobar el panel de confirmacion.
    const panel = compiled.querySelector(
      '.activation-panel'
    );

    expect(panel).not.toBeNull();
    expect(panel?.textContent).toContain('FAC-001');

    // Todavia no debe existir una peticion PATCH.
    httpMock.expectNone(
      `/api/facilities/${inactiveFacility.id}/activate`
    );

    // Confirmar la activacion.
    const confirmButton =
      compiled.querySelector<HTMLButtonElement>(
        '.confirm-activation'
      );

    expect(confirmButton).not.toBeNull();

    confirmButton!.click();

    // Assert: comprobar la peticion HTTP.
    const patchRequest = httpMock.expectOne(
      `/api/facilities/${inactiveFacility.id}/activate`
    );

    expect(patchRequest.request.method).toBe('PATCH');

    // Simular la respuesta correcta del backend.
    patchRequest.flush(null, {
      status: 204,
      statusText: 'No Content'
    });

    // Angular debe volver a consultar las instalaciones.
    const refreshRequest = httpMock.expectOne('/api/facilities');

    expect(refreshRequest.request.method).toBe('GET');

    refreshRequest.flush([
      {
        ...inactiveFacility,
        isActive: true
      },
      activeFacility
    ]);

    fixture.detectChanges();

    // El panel de confirmacion debe cerrarse.
    expect(
      compiled.querySelector('.activation-panel')
    ).toBeNull();

    // Debe mostrarse el mensaje de exito.
    expect(
      compiled.querySelector('.success-message')?.textContent
    ).toContain(
      'Instalación FAC-001 activada correctamente.'
    );

    // FAC-001 debe aparecer como Activa.
    const rows = Array.from(
      compiled.querySelectorAll<HTMLTableRowElement>('tbody tr')
    );

    const updatedRow = rows.find(
      row => row.textContent?.includes('FAC-001')
    );

    expect(updatedRow).toBeDefined();
    expect(updatedRow?.textContent).toContain('Activa');

    // FAC-001 ya no debe mostrar el boton Activar.
    expect(
      compiled.querySelectorAll('.activate-button').length
    ).toBe(0);

    // Ambas instalaciones ahora pueden desactivarse.
    expect(
      compiled.querySelectorAll('.deactivate-button').length
    ).toBe(2);
  });
  for (const testCase of [
    {
      label: '404 Not Found',
      status: 404,
      message: 'La instalación ya no existe. Actualiza el listado.'
    },
    {
      label: 'network error',
      status: 0,
      message: 'No se pudo conectar con el servidor.'
    }
  ]) {
    it(`should handle ${testCase.label} during activation`, () => {
      // Arrange: crear la pagina.
      const fixture = TestBed.createComponent(FacilitiesPage);

      fixture.detectChanges();

      // Simular una instalacion inactiva.
      const initialRequest = httpMock.expectOne('/api/facilities');

      expect(initialRequest.request.method).toBe('GET');

      initialRequest.flush([
        inactiveFacility,
        activeFacility
      ]);

      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;

      // Solicitar la activacion de FAC-001.
      const activateButton =
        compiled.querySelector<HTMLButtonElement>(
          '.activate-button'
        );

      expect(activateButton).not.toBeNull();

      activateButton!.click();

      fixture.detectChanges();

      // Comprobar que aparece el panel.
      expect(
        compiled.querySelector('.activation-panel')
      ).not.toBeNull();

      // Confirmar la operacion.
      const confirmButton =
        compiled.querySelector<HTMLButtonElement>(
          '.confirm-activation'
        );

      expect(confirmButton).not.toBeNull();

      confirmButton!.click();

      // Comprobar la peticion PATCH.
      const patchRequest = httpMock.expectOne(
        `/api/facilities/${inactiveFacility.id}/activate`
      );

      expect(patchRequest.request.method).toBe('PATCH');

      // Simular el error correspondiente.
      if (testCase.status === 0) {
        patchRequest.error(new ProgressEvent('error'));
      } else {
        patchRequest.flush(
          { title: 'Facility not found' },
          {
            status: 404,
            statusText: 'Not Found'
          }
        );
      }

      fixture.detectChanges();

      // Assert: el panel debe permanecer abierto.
      expect(
        compiled.querySelector('.activation-panel')
      ).not.toBeNull();

      // Debe aparecer el mensaje de error adecuado.
      const errorMessage = compiled.querySelector(
        '.activation-error'
      );

      expect(errorMessage?.textContent).toContain(
        testCase.message
      );

      // No debe aparecer un mensaje de exito.
      expect(
        compiled.querySelector('.success-message')
      ).toBeNull();

      // El boton Confirmar debe volver a habilitarse.
      const confirmButtonAfterError =
        compiled.querySelector<HTMLButtonElement>(
          '.confirm-activation'
        );

      expect(confirmButtonAfterError?.disabled).toBe(false);

      expect(confirmButtonAfterError?.textContent)
        .toContain('Confirmar activación');

      // El boton Cancelar tambien debe habilitarse.
      const cancelButton =
        compiled.querySelector<HTMLButtonElement>(
          '.cancel-activation'
        );

      expect(cancelButton?.disabled).toBe(false);

      // No debe recargarse el listado tras el error.
      httpMock.expectNone('/api/facilities');

      // FAC-001 debe continuar apareciendo como inactiva.
      const rows = Array.from(
        compiled.querySelectorAll<HTMLTableRowElement>('tbody tr')
      );

      const facilityRow = rows.find(
        row => row.textContent?.includes('FAC-001')
      );

      expect(facilityRow).toBeDefined();
      expect(facilityRow?.textContent).toContain('Inactiva');

      // La accion Activar debe seguir disponible.
      expect(
        compiled.querySelectorAll('.activate-button').length
      ).toBe(1);
    });
  }

  it('should prevent duplicate PATCH requests during activation', () => {
    // Arrange: crear la pagina.
    const fixture = TestBed.createComponent(FacilitiesPage);

    fixture.detectChanges();

    // Simular la carga inicial de instalaciones.
    const initialRequest = httpMock.expectOne('/api/facilities');

    initialRequest.flush([
      inactiveFacility,
      activeFacility
    ]);

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    // Solicitar la activacion de FAC-001.
    const activateButton =
      compiled.querySelector<HTMLButtonElement>(
        '.activate-button'
      );

    expect(activateButton).not.toBeNull();

    activateButton!.click();

    fixture.detectChanges();

    // Localizar el boton de confirmacion.
    const confirmDebugElement = fixture.debugElement.query(
      By.css('.confirm-activation')
    );

    expect(confirmDebugElement).not.toBeNull();

    const confirmButton =
      confirmDebugElement.nativeElement as HTMLButtonElement;

    expect(confirmButton.disabled).toBe(false);

    // Act: confirmar la activacion por primera vez.
    confirmButton.click();

    fixture.detectChanges();

    // Durante el PATCH, el boton debe estar bloqueado.
    expect(confirmButton.disabled).toBe(true);

    expect(confirmButton.textContent)
      .toContain('Activando...');

    // El boton Cancelar tambien debe bloquearse.
    const cancelButton =
      compiled.querySelector<HTMLButtonElement>(
        '.cancel-activation'
      );

    expect(cancelButton?.disabled).toBe(true);

    // Simular una segunda invocacion del manejador,
    // incluso evitando la proteccion visual del boton.
    confirmDebugElement.triggerEventHandler(
      'click',
      new MouseEvent('click')
    );

    // Assert: debe existir exactamente una peticion PATCH.
    const patchRequest = httpMock.expectOne(
      `/api/facilities/${inactiveFacility.id}/activate`
    );

    expect(patchRequest.request.method).toBe('PATCH');

    // El listado todavia no debe haberse actualizado.
    httpMock.expectNone('/api/facilities');

    // Simular una respuesta correcta de ASP.NET Core.
    patchRequest.flush(null, {
      status: 204,
      statusText: 'No Content'
    });

    // La aplicacion debe consultar nuevamente las instalaciones.
    const refreshRequest = httpMock.expectOne(
      '/api/facilities'
    );

    expect(refreshRequest.request.method).toBe('GET');

    refreshRequest.flush([
      {
        ...inactiveFacility,
        isActive: true
      },
      activeFacility
    ]);

    fixture.detectChanges();

    // El panel de confirmacion debe desaparecer.
    expect(
      compiled.querySelector('.activation-panel')
    ).toBeNull();

    // Debe aparecer el mensaje de exito.
    expect(
      compiled.querySelector('.success-message')?.textContent
    ).toContain(
      'Instalación FAC-001 activada correctamente.'
    );

    // No deben quedar instalaciones inactivas.
    expect(
      compiled.querySelectorAll('.activate-button').length
    ).toBe(0);

    // Ambas instalaciones deben permitir la desactivacion.
    expect(
      compiled.querySelectorAll('.deactivate-button').length
    ).toBe(2);
  });

  it('should cancel activation without sending a PATCH request', () => {
    // Arrange: crear la pagina.
    const fixture = TestBed.createComponent(FacilitiesPage);

    fixture.detectChanges();

    // Simular la carga de instalaciones.
    const initialRequest = httpMock.expectOne('/api/facilities');

    expect(initialRequest.request.method).toBe('GET');

    initialRequest.flush([
      inactiveFacility,
      activeFacility
    ]);

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    // Solo FAC-001 debe mostrar el boton Activar.
    const activateButtons =
      compiled.querySelectorAll<HTMLButtonElement>(
        '.activate-button'
      );

    expect(activateButtons.length).toBe(1);

    expect(
      activateButtons[0].getAttribute('aria-label')
    ).toContain('FAC-001');

    // Act: abrir el panel de activacion.
    activateButtons[0].click();

    fixture.detectChanges();

    const confirmationPanel = compiled.querySelector(
      '.activation-panel'
    );

    expect(confirmationPanel).not.toBeNull();

    expect(confirmationPanel?.textContent)
      .toContain('FAC-001');

    // Todavia no debe haberse enviado ningun PATCH.
    httpMock.expectNone(
      `/api/facilities/${inactiveFacility.id}/activate`
    );

    // Act: cancelar la activacion.
    const cancelButton =
      compiled.querySelector<HTMLButtonElement>(
        '.cancel-activation'
      );

    expect(cancelButton).not.toBeNull();

    cancelButton!.click();

    fixture.detectChanges();

    // Assert: el panel debe desaparecer.
    expect(
      compiled.querySelector('.activation-panel')
    ).toBeNull();

    // FAC-001 debe seguir teniendo disponible Activar.
    expect(
      compiled.querySelectorAll('.activate-button').length
    ).toBe(1);

    // No debe enviarse ninguna peticion PATCH.
    httpMock.expectNone(
      `/api/facilities/${inactiveFacility.id}/activate`
    );

    // No debe recargarse el listado.
    httpMock.expectNone('/api/facilities');

    // No debe aparecer un mensaje de exito.
    expect(
      compiled.querySelector('.success-message')
    ).toBeNull();

    // FAC-001 debe continuar inactiva.
    const rows = Array.from(
      compiled.querySelectorAll<HTMLTableRowElement>('tbody tr')
    );

    const facilityRow = rows.find(
      row => row.textContent?.includes('FAC-001')
    );

    expect(facilityRow).toBeDefined();
    expect(facilityRow?.textContent).toContain('Inactiva');
  });

  it('should cancel deactivation without sending a PATCH request', () => {
    // Arrange: crear la pagina.
    const fixture = TestBed.createComponent(FacilitiesPage);

    fixture.detectChanges();

    // Simular la carga inicial de instalaciones.
    const getRequest = httpMock.expectOne('/api/facilities');

    expect(getRequest.request.method).toBe('GET');

    getRequest.flush([
      inactiveFacility,
      activeFacility
    ]);

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    // Solo la instalacion activa puede desactivarse.
    const deactivateButtons =
      compiled.querySelectorAll<HTMLButtonElement>(
        '.deactivate-button'
      );

    expect(deactivateButtons.length).toBe(1);

    expect(
      deactivateButtons[0].getAttribute('aria-label')
    ).toContain('FAC-002');

    // Act: pulsar Desactivar.
    deactivateButtons[0].click();

    fixture.detectChanges();

    // Debe mostrarse el panel de confirmacion.
    const confirmationPanel = compiled.querySelector(
      '.deactivation-panel'
    );

    expect(confirmationPanel).not.toBeNull();

    expect(confirmationPanel?.textContent)
      .toContain('FAC-002');

    // Act: cancelar la operacion.
    const cancelButton =
      compiled.querySelector<HTMLButtonElement>(
        '.cancel-action'
      );

    expect(cancelButton).not.toBeNull();

    cancelButton!.click();

    fixture.detectChanges();

    // Assert: el panel debe desaparecer.
    expect(
      compiled.querySelector('.deactivation-panel')
    ).toBeNull();

    // El boton Desactivar debe seguir disponible.
    expect(
      compiled.querySelectorAll('.deactivate-button').length
    ).toBe(1);

    // No debe enviarse ninguna peticion PATCH.
    httpMock.expectNone(
      `/api/facilities/${activeFacility.id}/deactivate`
    );
  });
  for (const role of ['Supervisor', 'Technician']) {
    it(`should display facilities as read-only for ${role}`, () => {
      grantedRoles = new Set([role]);

      const fixture = TestBed.createComponent(FacilitiesPage);
      fixture.detectChanges();

      httpMock.expectOne('/api/facilities').flush([
        inactiveFacility,
        activeFacility
      ]);

      fixture.detectChanges();

      const element = fixture.nativeElement as HTMLElement;

      expect(element.querySelectorAll('tbody tr').length).toBe(2);
      expect(element.querySelector('.create-button')).toBeNull();
      expect(element.querySelector('.edit-button')).toBeNull();
      expect(element.querySelector('.activate-button')).toBeNull();
      expect(element.querySelector('.deactivate-button')).toBeNull();
      expect(element.textContent).toContain('Modo consulta');
    });
  }
});
