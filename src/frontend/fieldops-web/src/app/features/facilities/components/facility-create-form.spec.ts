import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FacilityCreateForm } from './facility-create-form';

describe('FacilityCreateForm', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [FacilityCreateForm],
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

  it('should create a facility and emit the created event', () => {
    // Arrange
    const fixture = TestBed.createComponent(FacilityCreateForm);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    const fillField = (id: string, value: string) => {
      const input = compiled.querySelector<HTMLInputElement>(
        `#facility-${id}`
      );

      if (!input) {
        throw new Error(`Input ${id} not found`);
      }

      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };

    fillField('code', 'FAC-TEST-005');
    fillField('name', 'Centro de operaciones');
    fillField('city', 'Sevilla');
    fillField('address', 'Avenida Industria 20');

    let emittedFacility: unknown;

    fixture.componentInstance.created.subscribe(facility => {
      emittedFacility = facility;
    });

    // Act
    const form = compiled.querySelector('form') as HTMLFormElement;

    form.dispatchEvent(
      new Event('submit', {
        bubbles: true,
        cancelable: true
      })
    );

    // Assert: comprobar los datos enviados
    const request = httpMock.expectOne('/api/facilities');

    expect(request.request.method).toBe('POST');

    expect(request.request.body).toEqual({
      code: 'FAC-TEST-005',
      name: 'Centro de operaciones',
      city: 'Sevilla',
      address: 'Avenida Industria 20',
      latitude: null,
      longitude: null
    });

    // Simular la respuesta de ASP.NET Core
    const createdFacility = {
      id: '00000000-0000-0000-0000-000000000005',
      code: 'FAC-TEST-005',
      name: 'Centro de operaciones',
      city: 'Sevilla',
      address: 'Avenida Industria 20',
      isActive: true
    };

    request.flush(createdFacility, {
      status: 201,
      statusText: 'Created'
    });

    fixture.detectChanges();

    // Comprobar que se notificó la creación
    expect(emittedFacility).toEqual(createdFacility);

    // Comprobar que el formulario se limpió
    const codeInput = compiled.querySelector<HTMLInputElement>(
      '#facility-code'
    );

    expect(codeInput?.value).toBe('');
  });
  it('should display an error when the facility code already exists', () => {
    // Arrange
    const fixture = TestBed.createComponent(FacilityCreateForm);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    const fillField = (id: string, value: string) => {
      const input = compiled.querySelector<HTMLInputElement>(
        `#facility-${id}`
      );

      if (!input) {
        throw new Error(`Input ${id} not found`);
      }

      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };

    fillField('code', 'FAC-001');
    fillField('name', 'Instalación duplicada');
    fillField('city', 'Córdoba');

    let createdEventEmitted = false;

    fixture.componentInstance.created.subscribe(() => {
      createdEventEmitted = true;
    });

    // Act: enviar el formulario
    const form = compiled.querySelector('form') as HTMLFormElement;

    form.dispatchEvent(
      new Event('submit', {
        bubbles: true,
        cancelable: true
      })
    );

    // Comprobar la petición HTTP
    const request = httpMock.expectOne('/api/facilities');

    expect(request.request.method).toBe('POST');
    expect(request.request.body.code).toBe('FAC-001');

    // Simular el error 409 devuelto por ASP.NET Core
    request.flush(
      {
        title: 'Facility code already exists.'
      },
      {
        status: 409,
        statusText: 'Conflict'
      }
    );

    fixture.detectChanges();

    // Assert: mostrar el mensaje adecuado
    const errorMessage = compiled.querySelector('[role="alert"]');

    expect(errorMessage?.textContent).toContain(
      'Ya existe una instalación con ese código.'
    );

    // No debe emitirse el evento de creación
    expect(createdEventEmitted).toBe(false);

    // Los datos deben permanecer en el formulario
    const codeInput = compiled.querySelector<HTMLInputElement>(
      '#facility-code'
    );

    expect(codeInput?.value).toBe('FAC-001');

    // El usuario debe poder corregir y reenviar el formulario
    const submitButton = compiled.querySelector<HTMLButtonElement>(
      'button[type="submit"]'
    );

    expect(submitButton?.disabled).toBe(false);
  });
  it('should display an error when the backend is unavailable', () => {
    // Arrange
    const fixture = TestBed.createComponent(FacilityCreateForm);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    const fillField = (id: string, value: string) => {
      const input = compiled.querySelector<HTMLInputElement>(
        `#facility-${id}`
      );

      if (!input) {
        throw new Error(`Input ${id} not found`);
      }

      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };

    fillField('code', 'FAC-TEST-006');
    fillField('name', 'Centro de mantenimiento');
    fillField('city', 'Málaga');

    let createdEventEmitted = false;

    fixture.componentInstance.created.subscribe(() => {
      createdEventEmitted = true;
    });

    // Act: enviar el formulario
    const form = compiled.querySelector('form') as HTMLFormElement;

    form.dispatchEvent(
      new Event('submit', {
        bubbles: true,
        cancelable: true
      })
    );

    // Comprobar que se intenta realizar el POST
    const request = httpMock.expectOne('/api/facilities');

    expect(request.request.method).toBe('POST');

    // Simular un fallo de conexión con el backend
    request.error(new ProgressEvent('error'));

    fixture.detectChanges();

    // Assert: comprobar el mensaje de conexión
    const errorMessage = compiled.querySelector('[role="alert"]');

    expect(errorMessage?.textContent).toContain(
      'No se pudo conectar con el servidor.'
    );

    // No debe notificarse ninguna creación
    expect(createdEventEmitted).toBe(false);

    // Deben conservarse los datos introducidos
    const codeInput = compiled.querySelector<HTMLInputElement>(
      '#facility-code'
    );

    expect(codeInput?.value).toBe('FAC-TEST-006');

    // Debe ser posible volver a intentarlo
    const submitButton = compiled.querySelector<HTMLButtonElement>(
      'button[type="submit"]'
    );

    expect(submitButton?.disabled).toBe(false);
  });
  for (const testCase of [
    { field: 'code', length: 31 },
    { field: 'name', length: 151 },
    { field: 'city', length: 101 },
    { field: 'address', length: 251 }
  ]) {
    it(`should reject ${testCase.field} when exceeding its maximum length`, () => {
      // Arrange
      const fixture = TestBed.createComponent(FacilityCreateForm);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;

      const fillField = (id: string, value: string) => {
        const input = compiled.querySelector<HTMLInputElement>(
          `#facility-${id}`
        );

        if (!input) {
          throw new Error(`Input ${id} not found`);
        }

        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      };

      // Primero rellenamos el formulario con datos validos.
      fillField('code', 'FAC-TEST-007');
      fillField('name', 'Centro de mantenimiento');
      fillField('city', 'Cordoba');
      fillField('address', 'Calle Industria 10');

      // Introducimos un valor que supera el limite del campo.
      fillField(testCase.field, 'X'.repeat(testCase.length));

      // Act: intentar enviar el formulario.
      const form = compiled.querySelector('form') as HTMLFormElement;

      form.dispatchEvent(
        new Event('submit', {
          bubbles: true,
          cancelable: true
        })
      );

      fixture.detectChanges();

      // Assert: el campo debe mostrar un error.
      const invalidInput = compiled.querySelector<HTMLInputElement>(
        `#facility-${testCase.field}`
      );

      const fieldContainer = invalidInput?.closest('.form-field');

      expect(
        fieldContainer?.querySelector('.field-error')
      ).not.toBeNull();

      // No debe realizarse ninguna peticion POST.
      httpMock.expectNone('/api/facilities');
    });
  }
  it('should reject an empty form without sending a POST request', () => {
    // Arrange
    const fixture = TestBed.createComponent(FacilityCreateForm);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const form = compiled.querySelector('form') as HTMLFormElement;

    // Act: intentar enviar el formulario vacío
    form.dispatchEvent(
      new Event('submit', {
        bubbles: true,
        cancelable: true
      })
    );

    fixture.detectChanges();

    // Assert: deben aparecer los tres errores obligatorios
    const errors = compiled.querySelectorAll('.field-error');

    expect(errors.length).toBe(3);

    // No debe enviarse ninguna petición HTTP
    httpMock.expectNone('/api/facilities');
  });
  it('envia coordenadas validas al crear una instalacion', () => {
    const fixture = TestBed.createComponent(FacilityCreateForm);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    const values: Record<string, string> = {
      code: 'FAC-GIS-01',
      name: 'Centro GIS',
      city: 'Cordoba',
      latitude: '37.888200',
      longitude: '-4.779400'
    };

    for (const [field, value] of Object.entries(values)) {
      const input = element.querySelector<HTMLInputElement>(
        `#facility-${field}`
      );

      if (!input) throw new Error(`Missing input ${field}`);

      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    element.querySelector('form')!.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true })
    );

    const request = httpMock.expectOne('/api/facilities');

    expect(request.request.method).toBe('POST');
    expect(request.request.body.latitude).toBe(37.8882);
    expect(request.request.body.longitude).toBe(-4.7794);

    request.flush({
      id: '00000000-0000-0000-0000-000000000099',
      ...request.request.body,
      isActive: true
    });
  });

  for (const invalid of [
    { title: 'latitud fuera de rango', lat: '95', lon: '0' },
    { title: 'una sola coordenada', lat: '37', lon: '' },
    { title: 'mas de seis decimales', lat: '37.1234567', lon: '-4' }
  ]) {
    it(`rechaza ${invalid.title}`, () => {
      const fixture = TestBed.createComponent(FacilityCreateForm);
      fixture.detectChanges();

      const element = fixture.nativeElement as HTMLElement;

      const values: Record<string, string> = {
        code: 'FAC-GIS-02',
        name: 'Centro GIS',
        city: 'Cordoba',
        latitude: invalid.lat,
        longitude: invalid.lon
      };

      for (const [field, value] of Object.entries(values)) {
        const input = element.querySelector<HTMLInputElement>(
          `#facility-${field}`
        );

        if (!input) throw new Error(`Missing input ${field}`);

        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }

      element.querySelector('form')!.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true })
      );

      fixture.detectChanges();

      expect(element.querySelector('.field-error')).not.toBeNull();
      httpMock.expectNone('/api/facilities');
    });
  }

  it.each([true, false])(
    'locks all create fields including coordinates (success=%s)',
    succeeds => {
      const fixture = TestBed.createComponent(FacilityCreateForm);
      fixture.detectChanges();

      const element = fixture.nativeElement as HTMLElement;

      const fields: Record<string, string> = {
        code: 'FAC-AUD006',
        name: 'Audit facility',
        city: 'Sevilla',
        address: 'Audit address',
        latitude: '0',
        longitude: '-4.779400'
      };

      for (const [field, value] of Object.entries(fields)) {
        const input = element.querySelector<HTMLInputElement>(
          `#facility-${field}`
        )!;

        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }

      const controls = Array.from(
        element.querySelectorAll<HTMLInputElement>('form input')
      );

      expect(controls).toHaveLength(6);

      const originalValues = controls.map(control => control.value);

      const form = element.querySelector('form')!;

      const submit = () => form.dispatchEvent(
        new Event('submit', {
          bubbles: true,
          cancelable: true
        })
      );

      expect(controls.every(control => !control.disabled)).toBe(true);

      submit();
      fixture.detectChanges();

      expect(fixture.componentInstance.saving()).toBe(true);
      expect(controls.every(control => control.disabled)).toBe(true);

      submit();

      const request = httpMock.expectOne('/api/facilities');

      expect(request.request.method).toBe('POST');

      expect(request.request.body).toEqual({
        code: 'FAC-AUD006',
        name: 'Audit facility',
        city: 'Sevilla',
        address: 'Audit address',
        latitude: 0,
        longitude: -4.7794
      });

      if (succeeds) {
        request.flush({
          id: '00000000-0000-0000-0000-000000000099',
          ...request.request.body,
          isActive: true
        }, {
          status: 201,
          statusText: 'Created'
        });
      } else {
        request.flush(
          { title: 'Save failed' },
          { status: 500, statusText: 'Server Error' }
        );
      }

      fixture.detectChanges();

      expect(fixture.componentInstance.saving()).toBe(false);
      expect(controls.every(control => !control.disabled)).toBe(true);

      if (succeeds) {
        expect(controls.map(control => control.value))
          .toEqual(['', '', '', '', '', '']);
      } else {
        expect(controls.map(control => control.value))
          .toEqual(originalValues);

        expect(element.querySelector('.save-error'))
          .not.toBeNull();

        // Coordinate pair validation must still work
        // after re-enabling the form.
        const longitude = element.querySelector<HTMLInputElement>(
          '#facility-longitude'
        )!;

        longitude.value = '';
        longitude.dispatchEvent(new Event('input', { bubbles: true }));

        submit();
        fixture.detectChanges();

        expect(element.querySelector('.field-error'))
          .not.toBeNull();
      }

      httpMock.expectNone('/api/facilities');
    }
  );
});
