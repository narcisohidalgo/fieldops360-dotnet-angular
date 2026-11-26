import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Asset } from '../models/asset.model';
import { AssetEditForm } from './asset-edit-form';

describe('AssetEditForm', () => {
  let httpMock: HttpTestingController;

  const assetId = '00000000-0000-0000-0000-000000000001';
  const facilityId = '00000000-0000-0000-0000-000000000002';

  const asset: Asset = {
    id: assetId,
    facilityId,
    code: 'EQ-002',
    name: 'Sensor de temperatura',
    description: 'Sensor ambiental',
    isActive: true
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AssetEditForm],
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
    const fixture = TestBed.createComponent(AssetEditForm);

    fixture.componentRef.setInput('asset', asset);
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
      HTMLInputElement | HTMLTextAreaElement
    >(`#edit-asset-${field}`);

    if (!control) {
      throw new Error(`No se encontró el campo ${field}`);
    }

    control.value = value;

    control.dispatchEvent(
      new Event('input', { bubbles: true })
    );
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

  it('should populate the form with the current asset data', () => {
    const { element } = setup();

    const name = element.querySelector<HTMLInputElement>(
      '#edit-asset-name'
    );

    const description = element.querySelector<HTMLTextAreaElement>(
      '#edit-asset-description'
    );

    expect(name?.value).toBe('Sensor de temperatura');
    expect(description?.value).toBe('Sensor ambiental');

    expect(element.textContent).toContain('EQ-002');

    expect(
      element.querySelector('#edit-asset-code')
    ).toBeNull();

    expect(
      element.querySelector('#edit-asset-facility')
    ).toBeNull();
  });

  it('should update the asset using PUT and emit saved', () => {
    const { fixture, element } = setup();

    fillField(
      element,
      'name',
      '  Sensor de temperatura actualizado  '
    );

    fillField(
      element,
      'description',
      '  Sensor calibrado y operativo  '
    );

    let saved = false;

    fixture.componentInstance.saved.subscribe(() => {
      saved = true;
    });

    submitForm(element);

    const request = httpMock.expectOne(
      `/api/assets/${assetId}`
    );

    expect(request.request.method).toBe('PUT');

    expect(request.request.body).toEqual({
      name: 'Sensor de temperatura actualizado',
      description: 'Sensor calibrado y operativo'
    });

    // El contrato de edición no incluye estos campos.
    expect(request.request.body.id).toBeUndefined();
    expect(request.request.body.code).toBeUndefined();
    expect(request.request.body.facilityId).toBeUndefined();

    request.flush(null, {
      status: 204,
      statusText: 'No Content'
    });

    fixture.detectChanges();

    expect(saved).toBe(true);
  });

  it('should send null when description is blank', () => {
    const { element } = setup();

    fillField(element, 'description', '   ');

    submitForm(element);

    const request = httpMock.expectOne(
      `/api/assets/${assetId}`
    );

    expect(request.request.method).toBe('PUT');

    expect(request.request.body).toEqual({
      name: 'Sensor de temperatura',
      description: null
    });

    request.flush(null, {
      status: 204,
      statusText: 'No Content'
    });
  });

  it('should cancel without sending a PUT request', () => {
    const { fixture, element } = setup();

    let cancelled = false;

    fixture.componentInstance.cancelled.subscribe(() => {
      cancelled = true;
    });

    const cancelButton = element.querySelector<HTMLButtonElement>(
      '.cancel-button'
    );

    expect(cancelButton).not.toBeNull();

    cancelButton!.click();

    expect(cancelled).toBe(true);

    httpMock.expectNone(`/api/assets/${assetId}`);
  });

  it('should reject an empty name', () => {
    const { fixture, element } = setup();

    fillField(element, 'name', '');

    submitForm(element);
    fixture.detectChanges();

    const nameField = element.querySelector(
      '#edit-asset-name'
    );

    expect(
      nameField?.closest('.form-field')
        ?.querySelector('.field-error')
    ).not.toBeNull();

    httpMock.expectNone(`/api/assets/${assetId}`);
  });

  it('should reject a name containing only spaces', () => {
    const { fixture, element } = setup();

    fillField(element, 'name', '   ');

    submitForm(element);
    fixture.detectChanges();

    const nameField = element.querySelector(
      '#edit-asset-name'
    );

    expect(
      nameField?.closest('.form-field')
        ?.querySelector('.field-error')
    ).not.toBeNull();

    httpMock.expectNone(`/api/assets/${assetId}`);
  });

  for (const testCase of [
    { field: 'name', length: 151 },
    { field: 'description', length: 501 }
  ]) {
    it(`should reject ${testCase.field} exceeding its limit`, () => {
      const { fixture, element } = setup();

      fillField(
        element,
        testCase.field,
        'X'.repeat(testCase.length)
      );

      submitForm(element);
      fixture.detectChanges();

      const control = element.querySelector(
        `#edit-asset-${testCase.field}`
      );

      expect(
        control?.closest('.form-field')
          ?.querySelector('.field-error')
      ).not.toBeNull();

      httpMock.expectNone(`/api/assets/${assetId}`);
    });
  }

  for (const testCase of [
    {
      status: 400,
      label: 'invalid data',
      message: 'Los datos introducidos no son válidos.'
    },
    {
      status: 404,
      label: 'missing asset',
      message: 'El activo ya no existe. Actualiza el listado.'
    },
    {
      status: 500,
      label: 'server error',
      message: 'Se produjo un error al actualizar el activo.'
    },
    {
      status: 0,
      label: 'network error',
      message: 'No se pudo conectar con el servidor.'
    }
  ]) {
    it(`should handle ${testCase.label}`, () => {
      const { fixture, element } = setup();

      fillField(
        element,
        'name',
        'Sensor actualizado'
      );

      let saved = false;

      fixture.componentInstance.saved.subscribe(() => {
        saved = true;
      });

      submitForm(element);

      const request = httpMock.expectOne(
        `/api/assets/${assetId}`
      );

      expect(request.request.method).toBe('PUT');

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

      const errorMessage = element.querySelector(
        '[role="alert"]'
      );

      expect(errorMessage?.textContent).toContain(
        testCase.message
      );

      expect(saved).toBe(false);

      const nameInput = element.querySelector<HTMLInputElement>(
        '#edit-asset-name'
      );

      expect(nameInput?.value).toBe('Sensor actualizado');

      const saveButton = element.querySelector<HTMLButtonElement>(
        '.save-button'
      );

      expect(saveButton?.disabled).toBe(false);
    });
  }

  it('should prevent duplicate PUT requests while saving', () => {
    const { fixture, element } = setup();

    fillField(
      element,
      'name',
      'Sensor actualizado'
    );

    submitForm(element);

    fixture.detectChanges();

    const saveButton = element.querySelector<HTMLButtonElement>(
      '.save-button'
    );

    const cancelButton = element.querySelector<HTMLButtonElement>(
      '.cancel-button'
    );

    expect(saveButton?.disabled).toBe(true);
    expect(cancelButton?.disabled).toBe(true);

    expect(saveButton?.textContent).toContain('Guardando...');

    // Intentar enviar otra vez mientras el PUT sigue pendiente.
    submitForm(element);

    // Solo debe existir una petición PUT.
    const request = httpMock.expectOne(
      `/api/assets/${assetId}`
    );

    expect(request.request.method).toBe('PUT');

    request.flush(null, {
      status: 204,
      statusText: 'No Content'
    });

    fixture.detectChanges();

    expect(saveButton?.disabled).toBe(false);
    expect(cancelButton?.disabled).toBe(false);

    httpMock.expectNone(`/api/assets/${assetId}`);
  });

  it('should reset the form when a different asset is selected', () => {
    const { fixture, element } = setup();

    fillField(
      element,
      'name',
      'Cambio sin guardar'
    );

    const anotherAsset: Asset = {
      ...asset,
      id: '00000000-0000-0000-0000-000000000099',
      code: 'EQ-003',
      name: 'Bomba de agua',
      description: 'Sistema de riego'
    };

    fixture.componentRef.setInput('asset', anotherAsset);
    fixture.detectChanges();

    const name = element.querySelector<HTMLInputElement>(
      '#edit-asset-name'
    );

    const description = element.querySelector<HTMLTextAreaElement>(
      '#edit-asset-description'
    );

    expect(name?.value).toBe('Bomba de agua');
    expect(description?.value).toBe('Sistema de riego');

    expect(element.textContent).toContain('EQ-003');

    httpMock.expectNone('/api/assets');
  });

  it.each([true, false])(
    'locks all edit controls until the response (success=%s)',
    succeeds => {
      const { fixture, element } = setup();

      fillField(element, 'name', 'Updated audit asset');
      fillField(element, 'description', 'Updated audit description');

      const controls = Array.from(element.querySelectorAll<
        HTMLInputElement | HTMLTextAreaElement
      >('form input, form textarea'));

      expect(controls).toHaveLength(2);

      const initialValues = controls.map(control => control.value);

      const cancelButton = element.querySelector<HTMLButtonElement>(
        '.cancel-button'
      )!;

      let cancelled = false;

      fixture.componentInstance.cancelled.subscribe(() => {
        cancelled = true;
      });

      expect(controls.every(control => !control.disabled)).toBe(true);

      submitForm(element);
      fixture.detectChanges();

      expect(fixture.componentInstance.saving()).toBe(true);
      expect(controls.every(control => control.disabled)).toBe(true);
      expect(cancelButton.disabled).toBe(true);

      cancelButton.click();

      expect(cancelled).toBe(false);

      submitForm(element);

      const request = httpMock.expectOne(`/api/assets/${assetId}`);

      expect(request.request.method).toBe('PUT');

      expect(request.request.body).toEqual({
        name: 'Updated audit asset',
        description: 'Updated audit description'
      });

      if (succeeds) {
        request.flush(null, {
          status: 204,
          statusText: 'No Content'
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
      expect(cancelButton.disabled).toBe(false);

      expect(controls.map(control => control.value))
        .toEqual(initialValues);

      if (!succeeds) {
        expect(element.querySelector('[role="alert"]'))
          .not.toBeNull();
      }

      httpMock.expectNone(`/api/assets/${assetId}`);
    }
  );
});