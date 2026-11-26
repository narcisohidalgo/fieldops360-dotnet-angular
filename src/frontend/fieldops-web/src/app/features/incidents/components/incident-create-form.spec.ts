import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Asset } from '../../assets/models/asset.model';
import { Facility } from '../../facilities/models/facility.model';
import {
  Incident,
  IncidentPriority,
  IncidentStatus
} from '../models/incident.model';
import { IncidentCreateForm } from './incident-create-form';

describe('IncidentCreateForm', () => {
  let httpMock: HttpTestingController;

  const facilityId = '00000000-0000-0000-0000-000000000001';
  const otherFacilityId = '00000000-0000-0000-0000-000000000002';

  const assetId = '00000000-0000-0000-0000-000000000003';
  const inactiveAssetId = '00000000-0000-0000-0000-000000000004';
  const otherAssetId = '00000000-0000-0000-0000-000000000005';

  const incidentId = '00000000-0000-0000-0000-000000000006';

  const facilities: Facility[] = [
    {
      id: facilityId,
      code: 'FAC-001',
      name: 'Centro Logistico Cordoba',
      city: 'Cordoba',
      address: null,
      isActive: true
    },
    {
      id: otherFacilityId,
      code: 'FAC-002',
      name: 'Centro Sevilla',
      city: 'Sevilla',
      address: null,
      isActive: true
    }
  ];

  const assets: Asset[] = [
    {
      id: assetId,
      facilityId,
      code: 'EQ-001',
      name: 'Tractor agricola',
      description: null,
      isActive: true
    },
    {
      id: inactiveAssetId,
      facilityId,
      code: 'EQ-002',
      name: 'Sensor averiado',
      description: null,
      isActive: false
    },
    {
      id: otherAssetId,
      facilityId: otherFacilityId,
      code: 'EQ-003',
      name: 'Equipo Sevilla',
      description: null,
      isActive: true
    }
  ];

  const createdIncident: Incident = {
    id: incidentId,
    facilityId,
    assetId,
    title: 'Fallo de arranque del tractor',
    description: 'El motor no arranca',
    priority: IncidentPriority.High,
    status: IncidentStatus.Open,
    createdAtUtc: '2026-11-23T13:00:00+00:00',
    updatedAtUtc: '2026-11-23T13:00:00+00:00',
    resolvedAtUtc: null,
    closedAtUtc: null
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [IncidentCreateForm],
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

  function setup(
    availableFacilities: Facility[] = facilities,
    availableAssets: Asset[] = assets
  ) {
    const fixture = TestBed.createComponent(IncidentCreateForm);

    fixture.componentRef.setInput(
      'facilities',
      availableFacilities
    );

    fixture.componentRef.setInput(
      'assets',
      availableAssets
    );

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
    >(`#incident-${field}`);

    if (!control) {
      throw new Error(`No se encontro el campo: ${field}`);
    }

    control.value = value;

    control.dispatchEvent(
      new Event(
        control.tagName === 'SELECT' ? 'change' : 'input',
        { bubbles: true }
      )
    );
  }

  function fillValidForm(
    fixture: ComponentFixture<IncidentCreateForm>,
    element: HTMLElement,
    withAsset = true
  ): void {
    fillField(element, 'facility', facilityId);

    // Actualizar las opciones dependientes de la instalacion.
    fixture.detectChanges();

    if (withAsset) {
      fillField(element, 'asset', assetId);
    }

    fillField(
      element,
      'title',
      'Fallo de arranque del tractor'
    );

    fillField(
      element,
      'description',
      'El motor no arranca'
    );

    fillField(
      element,
      'priority',
      String(IncidentPriority.High)
    );
  }

  function submitForm(element: HTMLElement): void {
    const form = element.querySelector('form');

    if (!form) {
      throw new Error('No se encontro el formulario.');
    }

    form.dispatchEvent(
      new Event('submit', {
        bubbles: true,
        cancelable: true
      })
    );
  }

  it('should display facilities and default to Medium priority', () => {
    const { element } = setup();

    const facilitySelect =
      element.querySelector<HTMLSelectElement>(
        '#incident-facility'
      );

    const prioritySelect =
      element.querySelector<HTMLSelectElement>(
        '#incident-priority'
      );

    expect(facilitySelect).not.toBeNull();
    expect(prioritySelect).not.toBeNull();

    const options = Array.from(
      facilitySelect!.options
    ).map(option => option.value);

    expect(options).toContain(facilityId);
    expect(options).toContain(otherFacilityId);

    expect(prioritySelect!.value).toBe('2');
  });

  it('should filter assets by selected facility', () => {
    const { fixture, element } = setup();

    fillField(element, 'facility', facilityId);

    fixture.detectChanges();

    const assetSelect =
      element.querySelector<HTMLSelectElement>(
        '#incident-asset'
      );

    expect(assetSelect).not.toBeNull();

    const options = Array.from(
      assetSelect!.options
    ).map(option => option.value);

    expect(options).toContain(assetId);
    expect(options).toContain(inactiveAssetId);
    expect(options).not.toContain(otherAssetId);

    // Los activos inactivos tambien pueden tener incidencias.
    expect(
      assetSelect!.textContent
    ).toContain('(Inactivo)');
  });

  it('should clear selected asset when facility changes', () => {
    const { fixture, element } = setup();

    fillField(element, 'facility', facilityId);

    fixture.detectChanges();

    fillField(element, 'asset', assetId);

    const assetSelect =
      element.querySelector<HTMLSelectElement>(
        '#incident-asset'
      );

    expect(assetSelect?.value).toBe(assetId);

    fillField(element, 'facility', otherFacilityId);

    fixture.detectChanges();

    expect(assetSelect?.value).toBe('');

    const options = Array.from(
      assetSelect!.options
    ).map(option => option.value);

    expect(options).toContain(otherAssetId);
    expect(options).not.toContain(assetId);
  });

  it('should disable creation without facilities', () => {
    const { element } = setup([], []);

    const button =
      element.querySelector<HTMLButtonElement>(
        'button[type="submit"]'
      );

    expect(button?.disabled).toBe(true);

    httpMock.expectNone('/api/incidents');
  });

  it('should reject an empty form', () => {
    const { fixture, element } = setup();

    submitForm(element);

    fixture.detectChanges();

    const errors =
      element.querySelectorAll('.field-error');

    expect(errors.length).toBe(2);

    httpMock.expectNone('/api/incidents');
  });

  it('should reject a blank title', () => {
    const { fixture, element } = setup();

    fillValidForm(fixture, element);

    fillField(element, 'title', '   ');

    submitForm(element);

    fixture.detectChanges();

    expect(
      element.querySelector(
        '#incident-title'
      )?.closest('.form-field')
        ?.querySelector('.field-error')
    ).not.toBeNull();

    httpMock.expectNone('/api/incidents');
  });

  it('should reject titles exceeding 150 characters', () => {
    const { fixture, element } = setup();

    fillValidForm(fixture, element);

    fillField(
      element,
      'title',
      'X'.repeat(151)
    );

    submitForm(element);

    fixture.detectChanges();

    expect(
      element.querySelector(
        '#incident-title'
      )?.closest('.form-field')
        ?.querySelector('.field-error')
    ).not.toBeNull();

    httpMock.expectNone('/api/incidents');
  });

  it('should reject descriptions exceeding 2000 characters', () => {
    const { fixture, element } = setup();

    fillValidForm(fixture, element);

    fillField(
      element,
      'description',
      'X'.repeat(2001)
    );

    submitForm(element);

    fixture.detectChanges();

    expect(
      element.querySelector(
        '#incident-description'
      )?.closest('.form-field')
        ?.querySelector('.field-error')
    ).not.toBeNull();

    httpMock.expectNone('/api/incidents');
  });

  it('should reject an invalid priority', () => {
    const { fixture, element } = setup();

    fillValidForm(fixture, element);

    fillField(element, 'priority', '');

    submitForm(element);

    fixture.detectChanges();

    expect(
      element.querySelector(
        '#incident-priority'
      )?.closest('.form-field')
        ?.querySelector('.field-error')
    ).not.toBeNull();

    httpMock.expectNone('/api/incidents');
  });

  it('should reject a facility no longer available', () => {
    const { fixture, element } = setup();

    fillValidForm(fixture, element);

    fixture.componentRef.setInput(
      'facilities',
      [facilities[1]]
    );

    fixture.detectChanges();

    submitForm(element);

    fixture.detectChanges();

    const error = element.querySelector('[role="alert"]');

    expect(error?.textContent).toContain(
      'Selecciona una instalación válida.'
    );

    httpMock.expectNone('/api/incidents');
  });

  it('should reject an asset no longer associated with the facility', () => {
    const { fixture, element } = setup();

    fillValidForm(fixture, element);

    fixture.componentRef.setInput(
      'assets',
      [assets[2]]
    );

    fixture.detectChanges();

    submitForm(element);

    fixture.detectChanges();

    const error = element.querySelector('[role="alert"]');

    expect(error?.textContent).toContain(
      'El activo seleccionado no pertenece a la instalación.'
    );

    httpMock.expectNone('/api/incidents');
  });

  it('should create an incident and emit the created event', () => {
    const { fixture, element } = setup();

    fillValidForm(fixture, element);

    fillField(
      element,
      'title',
      '  Fallo de arranque del tractor  '
    );

    fillField(
      element,
      'description',
      '  El motor no arranca  '
    );

    let emitted: Incident | undefined;

    fixture.componentInstance.created.subscribe(
      incident => {
        emitted = incident;
      }
    );

    submitForm(element);

    const request = httpMock.expectOne(
      '/api/incidents'
    );

    expect(request.request.method).toBe('POST');

    expect(request.request.body).toEqual({
      facilityId,
      assetId,
      title: 'Fallo de arranque del tractor',
      description: 'El motor no arranca',
      priority: IncidentPriority.High
    });

    request.flush(createdIncident, {
      status: 201,
      statusText: 'Created'
    });

    fixture.detectChanges();

    expect(emitted).toEqual(createdIncident);

    const titleInput =
      element.querySelector<HTMLInputElement>(
        '#incident-title'
      );

    const assetSelect =
      element.querySelector<HTMLSelectElement>(
        '#incident-asset'
      );

    expect(titleInput?.value).toBe('');
    expect(assetSelect?.value).toBe('');
  });

  it('should create a general incident without an asset', () => {
    const { fixture, element } = setup();

    fillValidForm(fixture, element, false);

    fillField(
      element,
      'description',
      '   '
    );

    submitForm(element);

    const request = httpMock.expectOne(
      '/api/incidents'
    );

    expect(request.request.method).toBe('POST');

    expect(request.request.body.assetId).toBeNull();
    expect(request.request.body.description).toBeNull();

    request.flush({
      ...createdIncident,
      assetId: null,
      description: null
    }, {
      status: 201,
      statusText: 'Created'
    });
  });

  for (const testCase of [
    {
      status: 400,
      label: 'invalid data',
      message: 'Los datos no son válidos'
    },
    {
      status: 404,
      label: 'missing facility or asset',
      message: 'La instalación o el activo ya no existe.'
    },
    {
      status: 0,
      label: 'network error',
      message: 'No se pudo conectar con el servidor.'
    },
    {
      status: 500,
      label: 'server error',
      message: 'Se produjo un error al crear la incidencia.'
    }
  ]) {
    it(`should handle ${testCase.label}`, () => {
      const { fixture, element } = setup();

      fillValidForm(fixture, element);

      let emitted = false;

      fixture.componentInstance.created.subscribe(() => {
        emitted = true;
      });

      submitForm(element);

      const request = httpMock.expectOne(
        '/api/incidents'
      );

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

      const error =
        element.querySelector('[role="alert"]');

      expect(error?.textContent).toContain(
        testCase.message
      );

      expect(emitted).toBe(false);

      const titleInput =
        element.querySelector<HTMLInputElement>(
          '#incident-title'
        );

      expect(titleInput?.value).toBe(
        'Fallo de arranque del tractor'
      );

      const button =
        element.querySelector<HTMLButtonElement>(
          'button[type="submit"]'
        );

      expect(button?.disabled).toBe(false);
    });
  }

  it('should prevent duplicate POST requests while saving', () => {
    const { fixture, element } = setup();

    fillValidForm(fixture, element);

    submitForm(element);

    fixture.detectChanges();

    const button =
      element.querySelector<HTMLButtonElement>(
        'button[type="submit"]'
      );

    expect(button?.disabled).toBe(true);
    expect(button?.textContent).toContain(
      'Guardando...'
    );

    // Intentar enviar el formulario por segunda vez.
    submitForm(element);

    // Solo debe existir una petición POST pendiente.
    const request = httpMock.expectOne(
      '/api/incidents'
    );

    expect(request.request.method).toBe('POST');

    request.flush(createdIncident, {
      status: 201,
      statusText: 'Created'
    });

    fixture.detectChanges();

    expect(button?.disabled).toBe(false);

    httpMock.expectNone('/api/incidents');
  });

  it.each([true, false])(
    'locks create controls without clearing the selected asset (success=%s)',
    succeeds => {
      const { fixture, element } = setup();

      fillValidForm(fixture, element);

      const controls = Array.from(element.querySelectorAll<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >('form input, form select, form textarea'));

      expect(controls).toHaveLength(5);
      expect(controls.every(control => !control.disabled)).toBe(true);

      const originalValues = controls.map(control => control.value);

      const savingEvents: boolean[] = [];

      fixture.componentInstance.savingChange.subscribe(
        saving => savingEvents.push(saving)
      );

      submitForm(element);
      fixture.detectChanges();

      expect(controls.every(control => control.disabled)).toBe(true);

      expect(
        element.querySelector<HTMLSelectElement>(
          '#incident-asset'
        )!.value
      ).toBe(assetId);

      expect(savingEvents).toEqual([true]);

      // Force a second submission while the POST is pending.
      submitForm(element);

      const request = httpMock.expectOne('/api/incidents');

      expect(request.request.method).toBe('POST');

      expect(request.request.body).toEqual({
        facilityId,
        assetId,
        title: 'Fallo de arranque del tractor',
        description: 'El motor no arranca',
        priority: IncidentPriority.High
      });

      if (succeeds) {
        request.flush(createdIncident, {
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

      expect(savingEvents).toEqual([true, false]);
      expect(controls.every(control => !control.disabled)).toBe(true);

      if (succeeds) {
        expect(
          element.querySelector<HTMLInputElement>(
            '#incident-title'
          )!.value
        ).toBe('');

        expect(
          element.querySelector<HTMLSelectElement>(
            '#incident-facility'
          )!.value
        ).toBe('');

        expect(
          element.querySelector<HTMLSelectElement>(
            '#incident-asset'
          )!.value
        ).toBe('');
      } else {
        expect(controls.map(control => control.value))
          .toEqual(originalValues);

        expect(element.querySelector('.save-error'))
          .not.toBeNull();

        // Verify that the original facility/asset relationship
        // logic remains functional after the error.
        fillField(element, 'facility', otherFacilityId);
        fixture.detectChanges();

        const asset = element.querySelector<HTMLSelectElement>(
          '#incident-asset'
        )!;

        expect(asset.value).toBe('');

        const options = Array.from(asset.options)
          .map(option => option.value);

        expect(options).toContain(otherAssetId);
        expect(options).not.toContain(assetId);
      }

      httpMock.expectNone('/api/incidents');
    }
  );
});
