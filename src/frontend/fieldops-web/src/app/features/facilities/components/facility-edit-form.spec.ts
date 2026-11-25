import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Facility } from '../models/facility.model';
import { FacilityEditForm } from './facility-edit-form';

describe('FacilityEditForm', () => {
  let httpMock: HttpTestingController;

  const existingFacility: Facility = {
    id: '00000000-0000-0000-0000-000000000002',
    code: 'FAC-002',
    name: 'Centro de Operaciones Sevilla',
    city: 'Sevilla',
    address: 'Avenida de la Innovación 15',
    isActive: true
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [FacilityEditForm],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  for (const field of ['name', 'city'] as const) {
    it(`should reject blank ${field} without sending PUT`, () => {
      // Arrange
      const fixture = TestBed.createComponent(FacilityEditForm);

      fixture.componentRef.setInput('facility', existingFacility);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;

      const input = compiled.querySelector<HTMLInputElement>(
        `#edit-facility-${field}`
      );

      if (!input) {
        throw new Error(`Input ${field} not found`);
      }

      // Introducir un valor compuesto solo por espacios.
      input.value = '   ';
      input.dispatchEvent(new Event('input', { bubbles: true }));

      let savedEventCount = 0;

      fixture.componentInstance.saved.subscribe(() => {
        savedEventCount++;
      });

      // Act: intentar guardar el formulario.
      const form = compiled.querySelector('form') as HTMLFormElement;

      form.dispatchEvent(
        new Event('submit', {
          bubbles: true,
          cancelable: true
        })
      );

      fixture.detectChanges();

      // Assert: debe aparecer el mensaje de validacion.
      const fieldContainer = input.closest('.form-field');

      expect(
        fieldContainer?.querySelector('.field-error')
      ).not.toBeNull();

      // No debe realizarse ninguna peticion PUT.
      httpMock.expectNone(
        `/api/facilities/${existingFacility.id}`
      );

      // Tampoco debe notificarse una actualizacion.
      expect(savedEventCount).toBe(0);
    });
  }
  for (const testCase of [
    { field: 'name', maxLength: 150 },
    { field: 'city', maxLength: 100 },
    { field: 'address', maxLength: 250 }
  ] as const) {
    it(`should reject overlong edit field ${testCase.field}`, () => {
      // Arrange
      const fixture = TestBed.createComponent(FacilityEditForm);

      fixture.componentRef.setInput('facility', existingFacility);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;

      const input = compiled.querySelector<HTMLInputElement>(
        `#edit-facility-${testCase.field}`
      );

      if (!input) {
        throw new Error(`Input ${testCase.field} not found`);
      }

      // Introducir mediante codigo un valor demasiado largo.
      input.value = 'X'.repeat(testCase.maxLength + 1);
      input.dispatchEvent(new Event('input', { bubbles: true }));

      let savedEventCount = 0;

      fixture.componentInstance.saved.subscribe(() => {
        savedEventCount++;
      });

      // Act: intentar guardar.
      const form = compiled.querySelector('form') as HTMLFormElement;

      form.dispatchEvent(
        new Event('submit', {
          bubbles: true,
          cancelable: true
        })
      );

      fixture.detectChanges();

      // Assert: debe mostrarse un error de validacion.
      const fieldContainer = input.closest('.form-field');

      expect(
        fieldContainer?.querySelector('.field-error')
      ).not.toBeNull();

      // No debe enviarse ninguna peticion PUT.
      httpMock.expectNone(
        `/api/facilities/${existingFacility.id}`
      );

      // No debe notificarse una actualizacion.
      expect(savedEventCount).toBe(0);
    });
  }
  for (const testCase of [
    {
      name: '400 Bad Request',
      status: 400,
      message: 'Los datos introducidos no son válidos.'
    },
    {
      name: '404 Not Found',
      status: 404,
      message: 'La instalación ya no existe.'
    },
    {
      name: 'network error',
      status: 0,
      message: 'No se pudo conectar con el servidor.'
    }
  ]) {
    it(`should handle ${testCase.name} when updating a facility`, () => {
      // Arrange
      const fixture = TestBed.createComponent(FacilityEditForm);

      fixture.componentRef.setInput('facility', existingFacility);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;

      const nameInput = compiled.querySelector<HTMLInputElement>(
        '#edit-facility-name'
      );

      if (!nameInput) {
        throw new Error('Name input not found');
      }

      nameInput.value = 'Centro actualizado';
      nameInput.dispatchEvent(
        new Event('input', { bubbles: true })
      );

      let savedEventCount = 0;

      fixture.componentInstance.saved.subscribe(() => {
        savedEventCount++;
      });

      // Act: intentar guardar los cambios.
      const form = compiled.querySelector('form') as HTMLFormElement;

      form.dispatchEvent(
        new Event('submit', {
          bubbles: true,
          cancelable: true
        })
      );

      const request = httpMock.expectOne(
        `/api/facilities/${existingFacility.id}`
      );

      expect(request.request.method).toBe('PUT');
      expect(request.request.body.name).toBe('Centro actualizado');

      // Simular la respuesta de error.
      if (testCase.status === 0) {
        request.error(new ProgressEvent('error'));
      } else {
        request.flush(
          { title: 'Update failed' },
          {
            status: testCase.status,
            statusText: 'Error'
          }
        );
      }

      fixture.detectChanges();

      // Assert: comprobar el mensaje mostrado.
      const errorMessage = compiled.querySelector('[role="alert"]');

      expect(errorMessage?.textContent).toContain(
        testCase.message
      );

      // No debe notificarse una actualización correcta.
      expect(savedEventCount).toBe(0);

      // Los datos introducidos deben conservarse.
      expect(nameInput.value).toBe('Centro actualizado');

      // El botón debe volver a estar habilitado.
      const submitButton = compiled.querySelector<HTMLButtonElement>(
        'button[type="submit"]'
      );

      expect(submitButton?.disabled).toBe(false);
    });
  }
  it('should emit cancelled without sending an HTTP request', () => {
    // Arrange
    const fixture = TestBed.createComponent(FacilityEditForm);

    fixture.componentRef.setInput('facility', existingFacility);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    let cancelledEventCount = 0;
    let savedEventCount = 0;

    fixture.componentInstance.cancelled.subscribe(() => {
      cancelledEventCount++;
    });

    fixture.componentInstance.saved.subscribe(() => {
      savedEventCount++;
    });

    // Act: pulsar el boton Cancelar.
    const cancelButton = compiled.querySelector<HTMLButtonElement>(
      '.cancel-button'
    );

    expect(cancelButton).not.toBeNull();

    cancelButton!.click();

    fixture.detectChanges();

    // Assert: comprobar el evento de cancelacion.
    expect(cancelledEventCount).toBe(1);

    // No debe notificarse ninguna actualizacion.
    expect(savedEventCount).toBe(0);

    // No debe enviarse ninguna peticion PUT.
    httpMock.expectNone(
      `/api/facilities/${existingFacility.id}`
    );

    // Los datos originales deben mantenerse.
    expect(existingFacility.code).toBe('FAC-002');
    expect(existingFacility.name).toBe(
      'Centro de Operaciones Sevilla'
    );
  });
  it('should update a facility and emit the saved event', () => {
    // Arrange
    const fixture = TestBed.createComponent(FacilityEditForm);

    fixture.componentRef.setInput('facility', existingFacility);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    const nameInput = compiled.querySelector<HTMLInputElement>(
      '#edit-facility-name'
    );

    expect(nameInput?.value).toBe(
      'Centro de Operaciones Sevilla'
    );

    const fillField = (id: string, value: string) => {
      const input = compiled.querySelector<HTMLInputElement>(
        `#edit-facility-${id}`
      );

      if (!input) {
        throw new Error(`Input ${id} not found`);
      }

      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };

    fillField('name', 'Centro de Operaciones Sevilla Este');
    fillField('city', 'Sevilla');
    fillField('address', 'Avenida de la Innovación 25');

    let savedEventCount = 0;

    fixture.componentInstance.saved.subscribe(() => {
      savedEventCount++;
    });

    // Act: enviar el formulario
    const form = compiled.querySelector('form') as HTMLFormElement;

    form.dispatchEvent(
      new Event('submit', {
        bubbles: true,
        cancelable: true
      })
    );

    // Assert: comprobar la petición HTTP
    const request = httpMock.expectOne(
      `/api/facilities/${existingFacility.id}`
    );

    expect(request.request.method).toBe('PUT');

    expect(request.request.body).toEqual({
      name: 'Centro de Operaciones Sevilla Este',
      city: 'Sevilla',
      address: 'Avenida de la Innovación 25',
      latitude: null,
      longitude: null
    });

    // El código empresarial no debe enviarse para modificarlo.
    expect(request.request.body.code).toBeUndefined();

    // Simular la respuesta 204 de ASP.NET Core
    request.flush(null, {
      status: 204,
      statusText: 'No Content'
    });

    fixture.detectChanges();

    // Comprobar que se notificó la actualización
    expect(savedEventCount).toBe(1);

    // El código original debe permanecer visible.
    expect(compiled.querySelector('.facility-code')?.textContent)
      .toContain('FAC-002');
  });
});
