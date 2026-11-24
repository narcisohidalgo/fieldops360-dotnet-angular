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
} from '../../incidents/models/incident.model';
import { Technician } from '../../technicians/models/technician.model';
import {
  WorkOrder,
  WorkOrderPriority,
  WorkOrderStatus
} from '../models/work-order.model';
import { WorkOrderCreateForm } from './work-order-create-form';

describe('WorkOrderCreateForm', () => {
  let httpMock: HttpTestingController;

  const facilityId = '00000000-0000-0000-0000-000000000001';
  const secondFacilityId = '00000000-0000-0000-0000-000000000002';
  const assetId = '00000000-0000-0000-0000-000000000003';
  const otherAssetId = '00000000-0000-0000-0000-000000000004';
  const incidentId = '00000000-0000-0000-0000-000000000005';
  const incompatibleIncidentId = '00000000-0000-0000-0000-000000000006';
  const technicianId = '00000000-0000-0000-0000-000000000007';
  const inactiveTechnicianId = '00000000-0000-0000-0000-000000000008';

  const facilities: Facility[] = [
    {
      id: facilityId,
      code: 'FAC-001',
      name: 'Centro principal',
      city: 'Cordoba',
      address: null,
      isActive: true
    },
    {
      id: secondFacilityId,
      code: 'FAC-002',
      name: 'Centro secundario',
      city: 'Sevilla',
      address: null,
      isActive: true
    }
  ];

  const assets: Asset[] = [
    {
      id: assetId,
      facilityId,
      code: 'AS-001',
      name: 'Sensor',
      description: null,
      isActive: true
    },
    {
      id: otherAssetId,
      facilityId: secondFacilityId,
      code: 'AS-002',
      name: 'Motor',
      description: null,
      isActive: true
    }
  ];

  const incidents: Incident[] = [
    {
      id: incidentId,
      facilityId,
      assetId,
      title: 'Sensor averiado',
      description: null,
      priority: IncidentPriority.High,
      status: IncidentStatus.Open,
      createdAtUtc: '2026-11-24T08:00:00Z',
      updatedAtUtc: '2026-11-24T08:00:00Z',
      resolvedAtUtc: null,
      closedAtUtc: null
    },
    {
      id: incompatibleIncidentId,
      facilityId: secondFacilityId,
      assetId: otherAssetId,
      title: 'Motor averiado',
      description: null,
      priority: IncidentPriority.High,
      status: IncidentStatus.Open,
      createdAtUtc: '2026-11-24T08:00:00Z',
      updatedAtUtc: '2026-11-24T08:00:00Z',
      resolvedAtUtc: null,
      closedAtUtc: null
    }
  ];

  const technicians: Technician[] = [
    {
      id: technicianId,
      code: 'TEC-001',
      name: 'Ana Lopez',
      email: 'ana@example.com',
      phone: null,
      specialty: 'Electricidad',
      isActive: true
    },
    {
      id: inactiveTechnicianId,
      code: 'TEC-002',
      name: 'Luis Garcia',
      email: 'luis@example.com',
      phone: null,
      specialty: null,
      isActive: false
    }
  ];

  const createdOrder: WorkOrder = {
    id: '00000000-0000-0000-0000-000000000009',
    facilityId,
    assetId,
    incidentId,
    technicianId,
    code: 'WO-001',
    title: 'Revisar sensor',
    description: 'Mantenimiento',
    priority: WorkOrderPriority.High,
    status: WorkOrderStatus.Planned,
    scheduledStartUtc: null,
    dueAtUtc: null,
    createdAtUtc: '2026-11-24T08:00:00Z',
    updatedAtUtc: '2026-11-24T08:00:00Z',
    startedAtUtc: null,
    completedAtUtc: null,
    cancelledAtUtc: null,
    cancellationReason: null
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [WorkOrderCreateForm],
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

  function setup(availableFacilities: Facility[] = facilities) {
    const fixture = TestBed.createComponent(WorkOrderCreateForm);

    fixture.componentRef.setInput('facilities', availableFacilities);
    fixture.componentRef.setInput('assets', assets);
    fixture.componentRef.setInput('incidents', incidents);
    fixture.componentRef.setInput('technicians', technicians);

    fixture.detectChanges();

    return {
      fixture,
      element: fixture.nativeElement as HTMLElement
    };
  }

  function fill(
    element: HTMLElement,
    field: string,
    value: string
  ): void {
    const control = element.querySelector<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >(`#work-order-${field}`);

    if (!control) {
      throw new Error(`Campo no encontrado: ${field}`);
    }

    control.value = value;

    control.dispatchEvent(new Event(
      control.tagName === 'SELECT' ? 'change' : 'input',
      { bubbles: true }
    ));
  }

  function submit(element: HTMLElement): void {
    const form = element.querySelector('form');

    if (!form) {
      throw new Error('Formulario no encontrado');
    }

    form.dispatchEvent(new Event('submit', {
      bubbles: true,
      cancelable: true
    }));
  }

  function fillValid(
    fixture: ComponentFixture<WorkOrderCreateForm>,
    element: HTMLElement
  ): void {
    fill(element, 'facility', facilityId);
    fixture.detectChanges();

    fill(element, 'asset', assetId);
    fixture.detectChanges();

    fill(element, 'incident', incidentId);
    fill(element, 'technician', technicianId);
    fill(element, 'code', 'WO-001');
    fill(element, 'title', 'Revisar sensor');
    fill(element, 'description', 'Mantenimiento');
    fill(element, 'priority', '3');
  }

  it('shows facilities and defaults to Medium priority', () => {
    const { element } = setup();

    const facility = element.querySelector<HTMLSelectElement>(
      '#work-order-facility'
    );
    const priority = element.querySelector<HTMLSelectElement>(
      '#work-order-priority'
    );

    expect(facility?.options.length).toBe(3);
    expect(priority?.value).toBe('2');
  });

  it('shows only active technicians', () => {
    const { element } = setup();

    const select = element.querySelector<HTMLSelectElement>(
      '#work-order-technician'
    );

    const values = Array.from(select!.options).map(x => x.value);

    expect(values).toContain(technicianId);
    expect(values).not.toContain(inactiveTechnicianId);
  });

  it('filters assets and incidents by facility', () => {
    const { fixture, element } = setup();

    fill(element, 'facility', facilityId);
    fixture.detectChanges();

    const assetValues = Array.from(
      element.querySelector<HTMLSelectElement>(
        '#work-order-asset'
      )!.options
    ).map(x => x.value);

    const incidentValues = Array.from(
      element.querySelector<HTMLSelectElement>(
        '#work-order-incident'
      )!.options
    ).map(x => x.value);

    expect(assetValues).toContain(assetId);
    expect(assetValues).not.toContain(otherAssetId);
    expect(incidentValues).toContain(incidentId);
    expect(incidentValues).not.toContain(incompatibleIncidentId);
  });

  it('clears asset and incident when facility changes', () => {
    const { fixture, element } = setup();

    fillValid(fixture, element);

    fill(element, 'facility', secondFacilityId);
    fixture.detectChanges();

    expect(
      element.querySelector<HTMLSelectElement>(
        '#work-order-asset'
      )?.value
    ).toBe('');

    expect(
      element.querySelector<HTMLSelectElement>(
        '#work-order-incident'
      )?.value
    ).toBe('');
  });

  it('clears incident when asset selection changes', () => {
    const { fixture, element } = setup();

    fillValid(fixture, element);

    fill(element, 'asset', '');
    fixture.detectChanges();

    expect(
      element.querySelector<HTMLSelectElement>(
        '#work-order-incident'
      )?.value
    ).toBe('');
  });

  it('disables creation when no facilities exist', () => {
    const { element } = setup([]);

    expect(
      element.querySelector<HTMLButtonElement>(
        'button[type="submit"]'
      )?.disabled
    ).toBe(true);

    httpMock.expectNone('/api/work-orders');
  });

  it('rejects an empty form', () => {
    const { fixture, element } = setup();

    submit(element);
    fixture.detectChanges();

    expect(
      element.querySelectorAll('.field-error').length
    ).toBe(3);

    httpMock.expectNone('/api/work-orders');
  });

  for (const field of ['code', 'title']) {
    it(`rejects blank ${field}`, () => {
      const { fixture, element } = setup();

      fillValid(fixture, element);
      fill(element, field, '   ');

      submit(element);
      fixture.detectChanges();

      expect(
        element.querySelector(`#work-order-${field}`)
          ?.closest('.form-field')
          ?.querySelector('.field-error')
      ).not.toBeNull();

      httpMock.expectNone('/api/work-orders');
    });
  }

  for (const testCase of [
    { field: 'code', length: 31 },
    { field: 'title', length: 151 },
    { field: 'description', length: 2001 }
  ]) {
    it(`rejects overlong ${testCase.field}`, () => {
      const { fixture, element } = setup();

      fillValid(fixture, element);
      fill(element, testCase.field, 'X'.repeat(testCase.length));

      submit(element);
      fixture.detectChanges();

      expect(
        element.querySelector(`#work-order-${testCase.field}`)
          ?.closest('.form-field')
          ?.querySelector('.field-error')
      ).not.toBeNull();

      httpMock.expectNone('/api/work-orders');
    });
  }

  it('rejects a due date earlier than the start', () => {
    const { fixture, element } = setup();

    fillValid(fixture, element);

    fill(element, 'start-date', '2026-12-10T10:00');
    fill(element, 'due-date', '2026-12-10T09:00');

    submit(element);
    fixture.detectChanges();

    expect(
      element.textContent
    ).toContain('no puede ser anterior');

    httpMock.expectNone('/api/work-orders');
  });

  it('creates an order, converts dates to UTC and resets', () => {
    const { fixture, element } = setup();

    fillValid(fixture, element);

    fill(element, 'code', '  WO-001  ');
    fill(element, 'title', '  Revisar sensor  ');
    fill(element, 'description', '  Mantenimiento  ');
    fill(element, 'start-date', '2026-12-01T09:00');
    fill(element, 'due-date', '2026-12-01T12:00');

    let emitted: WorkOrder | undefined;

    fixture.componentInstance.created.subscribe(order => {
      emitted = order;
    });

    submit(element);

    const request = httpMock.expectOne('/api/work-orders');

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      facilityId,
      assetId,
      incidentId,
      technicianId,
      code: 'WO-001',
      title: 'Revisar sensor',
      description: 'Mantenimiento',
      priority: WorkOrderPriority.High,
      scheduledStartUtc: new Date(
        '2026-12-01T09:00'
      ).toISOString(),
      dueAtUtc: new Date(
        '2026-12-01T12:00'
      ).toISOString()
    });

    fixture.detectChanges();

    expect(
      element.querySelector<HTMLButtonElement>(
        'button[type="submit"]'
      )?.disabled
    ).toBe(true);

    request.flush(createdOrder, {
      status: 201,
      statusText: 'Created'
    });

    fixture.detectChanges();

    expect(emitted).toEqual(createdOrder);

    expect(
      element.querySelector<HTMLInputElement>(
        '#work-order-code'
      )?.value
    ).toBe('');
  });

  it('sends null for unselected optional fields', () => {
    const { fixture, element } = setup();

    fill(element, 'facility', facilityId);
    fixture.detectChanges();

    fill(element, 'code', 'WO-001');
    fill(element, 'title', 'Revisar sensor');

    submit(element);

    const request = httpMock.expectOne('/api/work-orders');

    expect(request.request.body.assetId).toBeNull();
    expect(request.request.body.incidentId).toBeNull();
    expect(request.request.body.technicianId).toBeNull();
    expect(request.request.body.description).toBeNull();
    expect(request.request.body.scheduledStartUtc).toBeNull();
    expect(request.request.body.dueAtUtc).toBeNull();

    request.flush(createdOrder);
  });

  for (const testCase of [
    { status: 400, text: 'Datos inválidos' },
    { status: 404, text: 'ya no existe' },
    { status: 409, text: 'El código ya existe' },
    { status: 0, text: 'No se pudo conectar' },
    { status: 500, text: 'No se pudo crear' }
  ]) {
    it(`handles HTTP ${testCase.status}`, () => {
      const { fixture, element } = setup();

      fillValid(fixture, element);

      submit(element);

      const request = httpMock.expectOne('/api/work-orders');

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
      ).toContain(testCase.text);

      expect(
        element.querySelector<HTMLInputElement>(
          '#work-order-code'
        )?.value
      ).toBe('WO-001');

      expect(
        element.querySelector<HTMLButtonElement>(
          'button[type="submit"]'
        )?.disabled
      ).toBe(false);
    });
  }

  it('prevents duplicate POST requests while saving', () => {
    const { fixture, element } = setup();

    fillValid(fixture, element);

    submit(element);
    fixture.detectChanges();

    const button = element.querySelector<HTMLButtonElement>(
      'button[type="submit"]'
    );

    const fieldset = element.querySelector<HTMLFieldSetElement>(
      'fieldset'
    );

    expect(button?.disabled).toBe(true);
    expect(fieldset?.disabled).toBe(true);

    submit(element);

    const request = httpMock.expectOne('/api/work-orders');

    expect(request.request.method).toBe('POST');

    request.flush(createdOrder, {
      status: 201,
      statusText: 'Created'
    });

    fixture.detectChanges();

    expect(button?.disabled).toBe(false);
    expect(fieldset?.disabled).toBe(false);

    httpMock.expectNone('/api/work-orders');
  });
});
