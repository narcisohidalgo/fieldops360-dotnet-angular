import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Technician } from '../models/technician.model';
import { TechnicianEditForm } from './technician-edit-form';

describe('TechnicianEditForm', () => {
  let httpMock: HttpTestingController;

  const technician: Technician = {
    id: '00000000-0000-0000-0000-000000000002',
    code: 'TEC-002',
    name: 'Ana Lopez',
    email: 'ana@example.com',
    phone: '600123456',
    specialty: 'Electricidad',
    isActive: true
  };

  const apiUrl = `/api/technicians/${technician.id}`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TechnicianEditForm],
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

  function setup(): {
    fixture: ComponentFixture<TechnicianEditForm>;
    element: HTMLElement;
  } {
    const fixture = TestBed.createComponent(TechnicianEditForm);
    fixture.componentRef.setInput('technician', technician);
    fixture.detectChanges();

    return {
      fixture,
      element: fixture.nativeElement as HTMLElement
    };
  }

  function fillField(
    element: HTMLElement,
    field: string,
    value: string
  ): void {
    const input = element.querySelector<HTMLInputElement>(
      `#edit-technician-${field}`
    );

    if (!input) {
      throw new Error(`Input ${field} not found`);
    }

    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function submitForm(element: HTMLElement): void {
    const form = element.querySelector('form');

    if (!form) {
      throw new Error('Form not found');
    }

    form.dispatchEvent(new Event('submit', {
      bubbles: true,
      cancelable: true
    }));
  }

  it('should populate the form with technician data', () => {
    const { element } = setup();

    expect(
      element.querySelector('.technician-code')?.textContent
    ).toContain('TEC-002');

    for (const field of [
      'name', 'email', 'phone', 'specialty'
    ] as const) {
      const input = element.querySelector<HTMLInputElement>(
        `#edit-technician-${field}`
      );

      expect(input?.value).toBe(technician[field]);
    }

    expect(
      element.querySelector<HTMLInputElement>(
        '#edit-technician-code'
      )
    ).toBeNull();

    httpMock.expectNone(apiUrl);
  });

  it('should update technician and emit saved event', () => {
    const { fixture, element } = setup();

    fillField(element, 'name', '  Luis Garcia  ');
    fillField(element, 'email', '  luis@example.com  ');
    fillField(element, 'phone', '  699123456  ');
    fillField(element, 'specialty', '  Mecanica  ');

    let savedCount = 0;

    fixture.componentInstance.saved.subscribe(() => {
      savedCount++;
    });

    submitForm(element);

    const request = httpMock.expectOne(apiUrl);

    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({
      name: 'Luis Garcia',
      email: 'luis@example.com',
      phone: '699123456',
      specialty: 'Mecanica'
    });

    expect(request.request.body.code).toBeUndefined();
    expect(request.request.body.id).toBeUndefined();

    request.flush(null, {
      status: 204,
      statusText: 'No Content'
    });

    fixture.detectChanges();

    expect(savedCount).toBe(1);
    expect(
      element.querySelector('.technician-code')?.textContent
    ).toContain('TEC-002');
  });

  it('should send null for blank optional fields', () => {
    const { element } = setup();

    fillField(element, 'phone', '   ');
    fillField(element, 'specialty', '   ');

    submitForm(element);

    const request = httpMock.expectOne(apiUrl);

    expect(request.request.body.phone).toBeNull();
    expect(request.request.body.specialty).toBeNull();

    request.flush(null, {
      status: 204,
      statusText: 'No Content'
    });
  });

  for (const field of ['name', 'email']) {
    it(`should reject blank ${field}`, () => {
      const { fixture, element } = setup();

      fillField(element, field, '   ');
      submitForm(element);
      fixture.detectChanges();

      expect(
        element.querySelector(`#edit-technician-${field}`)
          ?.closest('.form-field')
          ?.querySelector('.field-error')
      ).not.toBeNull();

      httpMock.expectNone(apiUrl);
    });
  }

  for (const testCase of [
    { field: 'name', length: 151 },
    { field: 'email', length: 255 },
    { field: 'phone', length: 31 },
    { field: 'specialty', length: 101 }
  ]) {
    it(`should reject overlong ${testCase.field}`, () => {
      const { fixture, element } = setup();

      fillField(
        element,
        testCase.field,
        'X'.repeat(testCase.length)
      );

      submitForm(element);
      fixture.detectChanges();

      expect(
        element.querySelector(
          `#edit-technician-${testCase.field}`
        )?.closest('.form-field')
          ?.querySelector('.field-error')
      ).not.toBeNull();

      httpMock.expectNone(apiUrl);
    });
  }

  it('should reject invalid email', () => {
    const { fixture, element } = setup();

    fillField(element, 'email', 'invalid-email');

    submitForm(element);
    fixture.detectChanges();

    expect(
      element.querySelector('#edit-technician-email')
        ?.closest('.form-field')
        ?.querySelector('.field-error')
    ).not.toBeNull();

    httpMock.expectNone(apiUrl);
  });

  for (const testCase of [
    {
      status: 400,
      message: 'Los datos introducidos no son válidos.'
    },
    {
      status: 404,
      message: 'El técnico ya no existe.'
    },
    {
      status: 0,
      message: 'No se pudo conectar con el servidor.'
    },
    {
      status: 500,
      message: 'Se produjo un error al actualizar el técnico.'
    }
  ]) {
    it(`should handle HTTP ${testCase.status}`, () => {
      const { fixture, element } = setup();

      fillField(element, 'name', 'Luis Garcia');

      let savedCount = 0;

      fixture.componentInstance.saved.subscribe(() => {
        savedCount++;
      });

      submitForm(element);

      const request = httpMock.expectOne(apiUrl);

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

      expect(
        element.querySelector('[role="alert"]')?.textContent
      ).toContain(testCase.message);

      expect(savedCount).toBe(0);

      const nameInput = element.querySelector<HTMLInputElement>(
        '#edit-technician-name'
      );

      expect(nameInput?.value).toBe('Luis Garcia');

      const button = element.querySelector<HTMLButtonElement>(
        'button[type="submit"]'
      );

      expect(button?.disabled).toBe(false);
    });
  }

  it('should cancel editing without HTTP request', () => {
    const { fixture, element } = setup();

    let cancelledCount = 0;
    let savedCount = 0;

    fixture.componentInstance.cancelled.subscribe(() => {
      cancelledCount++;
    });

    fixture.componentInstance.saved.subscribe(() => {
      savedCount++;
    });

    const button = element.querySelector<HTMLButtonElement>(
      '.cancel-button'
    );

    button?.click();

    expect(cancelledCount).toBe(1);
    expect(savedCount).toBe(0);

    httpMock.expectNone(apiUrl);
  });

  it('should prevent duplicate PUT requests while saving', () => {
    const { fixture, element } = setup();

    submitForm(element);
    fixture.detectChanges();

    const submitButton = element.querySelector<HTMLButtonElement>(
      'button[type="submit"]'
    );

    const cancelButton = element.querySelector<HTMLButtonElement>(
      '.cancel-button'
    );

    expect(submitButton?.disabled).toBe(true);
    expect(cancelButton?.disabled).toBe(true);
    expect(submitButton?.textContent).toContain('Guardando...');

    submitForm(element);

    const requests = httpMock.match(apiUrl);

    expect(requests.length).toBe(1);
    expect(requests[0].request.method).toBe('PUT');

    requests[0].flush(null, {
      status: 204,
      statusText: 'No Content'
    });

    fixture.detectChanges();

    expect(submitButton?.disabled).toBe(false);
  });

  it('should refresh fields when technician input changes', () => {
    const { fixture, element } = setup();

    fillField(element, 'name', 'Cambio sin guardar');

    const anotherTechnician: Technician = {
      ...technician,
      id: '00000000-0000-0000-0000-000000000003',
      code: 'TEC-003',
      name: 'Maria Ruiz',
      email: 'maria@example.com',
      phone: null,
      specialty: null
    };

    fixture.componentRef.setInput(
      'technician',
      anotherTechnician
    );

    fixture.detectChanges();

    expect(
      element.querySelector('.technician-code')?.textContent
    ).toContain('TEC-003');

    expect(
      element.querySelector<HTMLInputElement>(
        '#edit-technician-name'
      )?.value
    ).toBe('Maria Ruiz');

    expect(
      element.querySelector<HTMLInputElement>(
        '#edit-technician-email'
      )?.value
    ).toBe('maria@example.com');

    expect(
      element.querySelector<HTMLInputElement>(
        '#edit-technician-phone'
      )?.value
    ).toBe('');

    expect(
      element.querySelector<HTMLInputElement>(
        '#edit-technician-specialty'
      )?.value
    ).toBe('');

    httpMock.expectNone(apiUrl);
  });
});
