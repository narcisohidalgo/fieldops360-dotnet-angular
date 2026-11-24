import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Technician } from '../models/technician.model';
import { TechnicianCreateForm } from './technician-create-form';

describe('TechnicianCreateForm', () => {
  let httpMock: HttpTestingController;

  const createdTechnician: Technician = {
    id: '00000000-0000-0000-0000-000000000001',
    code: 'TEC-001',
    name: 'Ana Lopez',
    email: 'ana@example.com',
    phone: '600123456',
    specialty: 'Electricidad',
    isActive: true
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TechnicianCreateForm],
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
    fixture: ComponentFixture<TechnicianCreateForm>;
    element: HTMLElement;
  } {
    const fixture = TestBed.createComponent(TechnicianCreateForm);
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
      `#technician-${field}`
    );

    if (!input) {
      throw new Error(`Input ${field} not found`);
    }

    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function fillValidForm(element: HTMLElement): void {
    fillField(element, 'code', 'TEC-001');
    fillField(element, 'name', 'Ana Lopez');
    fillField(element, 'email', 'ana@example.com');
    fillField(element, 'phone', '600123456');
    fillField(element, 'specialty', 'Electricidad');
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

  it('should create a technician, emit event and reset form', () => {
    const { fixture, element } = setup();

    fillValidForm(element);
    fillField(element, 'code', '  TEC-001  ');
    fillField(element, 'name', '  Ana Lopez  ');
    fillField(element, 'email', '  ana@example.com  ');
    fillField(element, 'phone', '  600123456  ');
    fillField(element, 'specialty', '  Electricidad  ');

    let emitted: Technician | undefined;

    fixture.componentInstance.created.subscribe(value => {
      emitted = value;
    });

    submitForm(element);

    const request = httpMock.expectOne('/api/technicians');

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      code: 'TEC-001',
      name: 'Ana Lopez',
      email: 'ana@example.com',
      phone: '600123456',
      specialty: 'Electricidad'
    });

    request.flush(createdTechnician, {
      status: 201,
      statusText: 'Created'
    });

    fixture.detectChanges();

    expect(emitted).toEqual(createdTechnician);

    const code = element.querySelector<HTMLInputElement>(
      '#technician-code'
    );

    expect(code?.value).toBe('');
  });

  it('should send null for blank optional fields', () => {
    const { element } = setup();

    fillValidForm(element);
    fillField(element, 'phone', '   ');
    fillField(element, 'specialty', '   ');

    submitForm(element);

    const request = httpMock.expectOne('/api/technicians');

    expect(request.request.body.phone).toBeNull();
    expect(request.request.body.specialty).toBeNull();

    request.flush({
      ...createdTechnician,
      phone: null,
      specialty: null
    });
  });

  it('should reject an empty form', () => {
    const { fixture, element } = setup();

    submitForm(element);
    fixture.detectChanges();

    expect(element.querySelectorAll('.field-error').length).toBe(3);
    httpMock.expectNone('/api/technicians');
  });

  for (const field of ['code', 'name', 'email']) {
    it(`should reject blank ${field}`, () => {
      const { fixture, element } = setup();

      fillValidForm(element);
      fillField(element, field, '   ');

      submitForm(element);
      fixture.detectChanges();

      const control = element.querySelector(
        `#technician-${field}`
      );

      expect(
        control?.closest('.form-field')
          ?.querySelector('.field-error')
      ).not.toBeNull();

      httpMock.expectNone('/api/technicians');
    });
  }

  for (const testCase of [
    { field: 'code', length: 31 },
    { field: 'name', length: 151 },
    { field: 'email', length: 255 },
    { field: 'phone', length: 31 },
    { field: 'specialty', length: 101 }
  ]) {
    it(`should reject ${testCase.field} exceeding its limit`, () => {
      const { fixture, element } = setup();

      fillValidForm(element);
      fillField(
        element,
        testCase.field,
        'X'.repeat(testCase.length)
      );

      submitForm(element);
      fixture.detectChanges();

      const control = element.querySelector(
        `#technician-${testCase.field}`
      );

      expect(
        control?.closest('.form-field')
          ?.querySelector('.field-error')
      ).not.toBeNull();

      httpMock.expectNone('/api/technicians');
    });
  }

  it('should reject an invalid email address', () => {
    const { fixture, element } = setup();

    fillValidForm(element);
    fillField(element, 'email', 'invalid-email');

    submitForm(element);
    fixture.detectChanges();

    expect(
      element.querySelector('#technician-email')
        ?.closest('.form-field')
        ?.querySelector('.field-error')
    ).not.toBeNull();

    httpMock.expectNone('/api/technicians');
  });

  for (const testCase of [
    {
      status: 400,
      message: 'Los datos introducidos no son válidos.'
    },
    {
      status: 409,
      message: 'Ya existe un técnico con ese código.'
    },
    {
      status: 0,
      message: 'No se pudo conectar con el servidor.'
    },
    {
      status: 500,
      message: 'Se produjo un error al crear el técnico.'
    }
  ]) {
    it(`should handle HTTP ${testCase.status}`, () => {
      const { fixture, element } = setup();

      fillValidForm(element);

      let emitted = false;

      fixture.componentInstance.created.subscribe(() => {
        emitted = true;
      });

      submitForm(element);

      const request = httpMock.expectOne('/api/technicians');

      if (testCase.status === 0) {
        request.error(new ProgressEvent('error'));
      } else {
        request.flush(
          { title: 'Request failed' },
          {
            status: testCase.status,
            statusText: 'Request failed'
          }
        );
      }

      fixture.detectChanges();

      expect(
        element.querySelector('[role="alert"]')?.textContent
      ).toContain(testCase.message);

      expect(emitted).toBe(false);

      const code = element.querySelector<HTMLInputElement>(
        '#technician-code'
      );

      expect(code?.value).toBe('TEC-001');

      const button = element.querySelector<HTMLButtonElement>(
        'button[type="submit"]'
      );

      expect(button?.disabled).toBe(false);
    });
  }

  it('should prevent duplicate requests while saving', () => {
    const { fixture, element } = setup();

    fillValidForm(element);
    submitForm(element);

    fixture.detectChanges();

    const button = element.querySelector<HTMLButtonElement>(
      'button[type="submit"]'
    );

    expect(button?.disabled).toBe(true);
    expect(button?.textContent).toContain('Guardando...');

    submitForm(element);

    const request = httpMock.expectOne('/api/technicians');

    expect(request.request.method).toBe('POST');

    request.flush(createdTechnician, {
      status: 201,
      statusText: 'Created'
    });

    fixture.detectChanges();

    expect(button?.disabled).toBe(false);
    httpMock.expectNone('/api/technicians');
  });
});
