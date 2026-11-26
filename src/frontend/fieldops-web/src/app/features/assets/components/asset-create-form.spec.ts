import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Asset } from '../models/asset.model';
import { Facility } from '../../facilities/models/facility.model';
import { AssetCreateForm } from './asset-create-form';

describe('AssetCreateForm', () => {
  let httpMock: HttpTestingController;

  const facilityId = '00000000-0000-0000-0000-000000000001';
  const inactiveFacilityId = '00000000-0000-0000-0000-000000000002';

  const facilities: Facility[] = [
    {
      id: facilityId,
      code: 'FAC-001',
      name: 'Centro Logístico Córdoba Norte',
      city: 'Córdoba',
      address: null,
      isActive: true
    },
    {
      id: inactiveFacilityId,
      code: 'FAC-002',
      name: 'Centro inactivo',
      city: 'Sevilla',
      address: null,
      isActive: false
    }
  ];

  const createdAsset: Asset = {
    id: '00000000-0000-0000-0000-000000000003',
    facilityId,
    code: 'EQ-002',
    name: 'Sensor de temperatura',
    description: 'Sensor ambiental',
    isActive: true
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AssetCreateForm],
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

  function setup() {
    const fixture = TestBed.createComponent(AssetCreateForm);

    fixture.componentRef.setInput('facilities', facilities);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    return { fixture, element };
  }

  function fillField(
    element: HTMLElement,
    field: string,
    value: string
  ): void {
    const control = element.querySelector<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >(`#asset-${field}`);

    if (!control) {
      throw new Error(`No se encontró el campo ${field}`);
    }

    control.value = value;

    control.dispatchEvent(
      new Event(
        control.tagName === 'SELECT' ? 'change' : 'input',
        { bubbles: true }
      )
    );
  }

  function fillValidForm(element: HTMLElement): void {
    fillField(element, 'facility', facilityId);
    fillField(element, 'code', 'EQ-002');
    fillField(element, 'name', 'Sensor de temperatura');
    fillField(element, 'description', 'Sensor ambiental');
  }

  function submitForm(element: HTMLElement): void {
    const form = element.querySelector('form');

    if (!form) {
      throw new Error('No se encontró el formulario');
    }

    form.dispatchEvent(
      new Event('submit', {
        bubbles: true,
        cancelable: true
      })
    );
  }

  it('should create an asset and emit the created event', () => {
    const { fixture, element } = setup();

    fillValidForm(element);

    fillField(element, 'code', '  EQ-002  ');
    fillField(element, 'name', '  Sensor de temperatura  ');
    fillField(element, 'description', '  Sensor ambiental  ');

    let emittedAsset: Asset | undefined;

    fixture.componentInstance.created.subscribe(asset => {
      emittedAsset = asset;
    });

    submitForm(element);

    const request = httpMock.expectOne('/api/assets');

    expect(request.request.method).toBe('POST');

    expect(request.request.body).toEqual({
      facilityId,
      code: 'EQ-002',
      name: 'Sensor de temperatura',
      description: 'Sensor ambiental'
    });

    request.flush(createdAsset, {
      status: 201,
      statusText: 'Created'
    });

    fixture.detectChanges();

    expect(emittedAsset).toEqual(createdAsset);

    const codeInput = element.querySelector<HTMLInputElement>(
      '#asset-code'
    );

    expect(codeInput?.value).toBe('');
  });

  it('should send null when description is empty', () => {
    const { element } = setup();

    fillValidForm(element);
    fillField(element, 'description', '   ');

    submitForm(element);

    const request = httpMock.expectOne('/api/assets');

    expect(request.request.method).toBe('POST');
    expect(request.request.body.description).toBeNull();

    request.flush({
      ...createdAsset,
      description: null
    }, {
      status: 201,
      statusText: 'Created'
    });
  });

  it('should reject an empty form without sending POST', () => {
    const { fixture, element } = setup();

    submitForm(element);

    fixture.detectChanges();

    const errors = element.querySelectorAll('.field-error');

    expect(errors.length).toBe(3);

    httpMock.expectNone('/api/assets');
  });

  for (const field of ['code', 'name']) {
    it(`should reject a blank ${field}`, () => {
      const { fixture, element } = setup();

      fillValidForm(element);
      fillField(element, field, '   ');

      submitForm(element);

      fixture.detectChanges();

      const input = element.querySelector(`#asset-${field}`);

      expect(
        input?.closest('.form-field')
          ?.querySelector('.field-error')
      ).not.toBeNull();

      httpMock.expectNone('/api/assets');
    });
  }

  for (const testCase of [
    { field: 'code', length: 51 },
    { field: 'name', length: 151 },
    { field: 'description', length: 501 }
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
        `#asset-${testCase.field}`
      );

      expect(
        control?.closest('.form-field')
          ?.querySelector('.field-error')
      ).not.toBeNull();

      httpMock.expectNone('/api/assets');
    });
  }

  it('should exclude inactive facilities from the selector', () => {
    const { fixture, element } = setup();

    const selector = element.querySelector<HTMLSelectElement>(
      '#asset-facility'
    );

    expect(selector).not.toBeNull();

    const optionValues = Array.from(
      selector!.options
    ).map(option => option.value);

    expect(optionValues).toContain(facilityId);
    expect(optionValues).not.toContain(inactiveFacilityId);

    submitForm(element);

    fixture.detectChanges();

    httpMock.expectNone('/api/assets');
  });

  for (const testCase of [
    {
      status: 400,
      label: 'invalid data',
      message: 'Los datos introducidos no son válidos.'
    },
    {
      status: 404,
      label: 'missing facility',
      message: 'La instalación seleccionada ya no existe.'
    },
    {
      status: 409,
      label: 'duplicate code',
      message: 'Ya existe un activo con ese código en la instalación.'
    },
    {
      status: 0,
      label: 'network error',
      message: 'No se pudo conectar con el servidor.'
    }
  ]) {
    it(`should handle ${testCase.label}`, () => {
      const { fixture, element } = setup();

      fillValidForm(element);

      let emitted = false;

      fixture.componentInstance.created.subscribe(() => {
        emitted = true;
      });

      submitForm(element);

      const request = httpMock.expectOne('/api/assets');

      expect(request.request.method).toBe('POST');

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

      const errorMessage = element.querySelector('[role="alert"]');

      expect(errorMessage?.textContent).toContain(
        testCase.message
      );

      expect(emitted).toBe(false);

      const codeInput = element.querySelector<HTMLInputElement>(
        '#asset-code'
      );

      expect(codeInput?.value).toBe('EQ-002');

      const submitButton = element.querySelector<HTMLButtonElement>(
        'button[type="submit"]'
      );

      expect(submitButton?.disabled).toBe(false);
    });
  }

  it('should prevent duplicate POST requests while saving', () => {
    const { fixture, element } = setup();

    fillValidForm(element);

    submitForm(element);

    fixture.detectChanges();

    const button = element.querySelector<HTMLButtonElement>(
      'button[type="submit"]'
    );

    expect(button?.disabled).toBe(true);
    expect(button?.textContent).toContain('Guardando...');

    // Intentar enviar de nuevo antes de recibir la respuesta.
    submitForm(element);

    // Solo debe existir una petición POST.
    const request = httpMock.expectOne('/api/assets');

    expect(request.request.method).toBe('POST');

    request.flush(createdAsset, {
      status: 201,
      statusText: 'Created'
    });

    fixture.detectChanges();

    expect(button?.disabled).toBe(false);

    httpMock.expectNone('/api/assets');
  });

  it.each([true, false])(
    'locks all create controls until the response (success=%s)',
    succeeds => {
      const { fixture, element } = setup();

      fillValidForm(element);

      const controls = Array.from(element.querySelectorAll<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >('form input, form select, form textarea'));

      expect(controls).toHaveLength(4);

      const initialValues = controls.map(control => control.value);

      expect(controls.every(control => !control.disabled)).toBe(true);

      submitForm(element);
      fixture.detectChanges();

      expect(controls.every(control => control.disabled)).toBe(true);
      expect(fixture.componentInstance.saving()).toBe(true);

      // A second submission must not create another request.
      submitForm(element);

      const request = httpMock.expectOne('/api/assets');

      expect(request.request.method).toBe('POST');

      expect(request.request.body).toEqual({
        facilityId,
        code: 'EQ-002',
        name: 'Sensor de temperatura',
        description: 'Sensor ambiental'
      });

      if (succeeds) {
        request.flush(createdAsset, {
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
          .toEqual(['', '', '', '']);
      } else {
        expect(controls.map(control => control.value))
          .toEqual(initialValues);

        expect(element.querySelector('[role="alert"]'))
          .not.toBeNull();
      }

      httpMock.expectNone('/api/assets');
    }
  );
});