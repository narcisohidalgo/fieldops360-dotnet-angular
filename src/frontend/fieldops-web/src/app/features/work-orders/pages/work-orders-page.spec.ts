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
import { WorkOrdersPage } from './work-orders-page';

describe('WorkOrdersPage', () => {
  let httpMock: HttpTestingController;

  const facilityId = '00000000-0000-0000-0000-000000000001';
  const otherFacilityId = '00000000-0000-0000-0000-000000000002';

  const assetId = '00000000-0000-0000-0000-000000000003';
  const otherAssetId = '00000000-0000-0000-0000-000000000004';

  const incidentId = '00000000-0000-0000-0000-000000000005';
  const otherIncidentId = '00000000-0000-0000-0000-000000000006';

  const technicianId = '00000000-0000-0000-0000-000000000007';
  const inactiveTechnicianId = '00000000-0000-0000-0000-000000000008';
  const secondTechnicianId = '00000000-0000-0000-0000-000000000009';

  const orderId = '00000000-0000-0000-0000-000000000011';
  const inProgressId = '00000000-0000-0000-0000-000000000012';
  const completedId = '00000000-0000-0000-0000-000000000013';
  const cancelledId = '00000000-0000-0000-0000-000000000014';

  const facilities: Facility[] = [
    {
      id: facilityId,
      code: 'FAC-001',
      name: 'Centro Córdoba',
      city: 'Córdoba',
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
      name: 'Sensor',
      description: null,
      isActive: true
    },
    {
      id: otherAssetId,
      facilityId: otherFacilityId,
      code: 'EQ-002',
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
      id: otherIncidentId,
      facilityId: otherFacilityId,
      assetId: otherAssetId,
      title: 'Motor averiado',
      description: null,
      priority: IncidentPriority.Medium,
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
      name: 'Ana López',
      email: 'ana@example.com',
      phone: null,
      specialty: 'Electricidad',
      isActive: true
    },
    {
      id: inactiveTechnicianId,
      code: 'TEC-002',
      name: 'Luis García',
      email: 'luis@example.com',
      phone: null,
      specialty: null,
      isActive: false
    },
    {
      id: secondTechnicianId,
      code: 'TEC-003',
      name: 'Marta Ruiz',
      email: 'marta@example.com',
      phone: null,
      specialty: null,
      isActive: true
    }
  ];

  const planned: WorkOrder = {
    id: orderId,
    facilityId,
    assetId,
    incidentId,
    technicianId,
    code: 'WO-001',
    title: 'Revisar sensor',
    description: 'Mantenimiento preventivo',
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

  const inProgress: WorkOrder = {
    ...planned,
    id: inProgressId,
    code: 'WO-002',
    title: 'Reparar instalación',
    status: WorkOrderStatus.InProgress,
    startedAtUtc: '2026-11-24T09:00:00Z'
  };

  const completed: WorkOrder = {
    ...planned,
    id: completedId,
    code: 'WO-003',
    title: 'Inspección terminada',
    status: WorkOrderStatus.Completed,
    completedAtUtc: '2026-11-24T10:00:00Z'
  };

  const cancelled: WorkOrder = {
    ...planned,
    id: cancelledId,
    code: 'WO-004',
    title: 'Intervención cancelada',
    status: WorkOrderStatus.Cancelled,
    cancelledAtUtc: '2026-11-24T10:00:00Z',
    cancellationReason: 'Intervención no necesaria'
  };

  const allOrders = [planned, inProgress, completed, cancelled];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [WorkOrdersPage],
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
    const fixture = TestBed.createComponent(WorkOrdersPage);
    fixture.detectChanges();

    return {
      fixture,
      element: fixture.nativeElement as HTMLElement
    };
  }

  function flushLoad(
    fixture: ComponentFixture<WorkOrdersPage>,
    orders: WorkOrder[] = allOrders,
    availableFacilities: Facility[] = facilities,
    expectedFilters: Record<string, string> = {}
  ): void {
    const workOrdersRequest = httpMock.expectOne(
      request => request.url === '/api/work-orders'
    );

    expect(workOrdersRequest.request.method).toBe('GET');

    expect(
      workOrdersRequest.request.params.keys().sort()
    ).toEqual(Object.keys(expectedFilters).sort());

    for (const [key, value] of Object.entries(expectedFilters)) {
      expect(workOrdersRequest.request.params.get(key)).toBe(value);
    }

    const facilityRequest = httpMock.expectOne('/api/facilities');
    const assetRequest = httpMock.expectOne('/api/assets');
    const incidentRequest = httpMock.expectOne('/api/incidents');
    const technicianRequest = httpMock.expectOne('/api/technicians');

    expect(facilityRequest.request.method).toBe('GET');
    expect(assetRequest.request.method).toBe('GET');
    expect(incidentRequest.request.method).toBe('GET');
    expect(technicianRequest.request.method).toBe('GET');

    workOrdersRequest.flush(orders);
    facilityRequest.flush(availableFacilities);
    assetRequest.flush(assets);
    incidentRequest.flush(incidents);
    technicianRequest.flush(technicians);

    fixture.detectChanges();
  }

  function click(
    element: HTMLElement,
    selector: string
  ): void {
    const button = element.querySelector<HTMLButtonElement>(selector);

    if (!button) {
      throw new Error(`Boton no encontrado: ${selector}`);
    }

    button.click();
  }

  function changeSelect(
    element: HTMLElement,
    selector: string,
    value: string
  ): void {
    const select = element.querySelector<HTMLSelectElement>(selector);

    if (!select) {
      throw new Error(`Selector no encontrado: ${selector}`);
    }

    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function fillInput(
    element: HTMLElement,
    selector: string,
    value: string
  ): void {
    const input = element.querySelector<
      HTMLInputElement | HTMLTextAreaElement
    >(selector);

    if (!input) {
      throw new Error(`Campo no encontrado: ${selector}`);
    }

    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function submitForm(
    element: HTMLElement,
    selector: string
  ): void {
    const form = element.querySelector<HTMLFormElement>(selector);

    if (!form) {
      throw new Error(`Formulario no encontrado: ${selector}`);
    }

    form.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true })
    );
  }

  function openStatus(
    fixture: ComponentFixture<WorkOrdersPage>,
    element: HTMLElement,
    row: number,
    action: 'main' | 'cancel' = 'main'
  ): void {
    const selector = action === 'cancel'
      ? `tbody tr:nth-child(${row}) .status-button.cancel-action`
      : `tbody tr:nth-child(${row}) .status-button:not(.cancel-action)`;

    click(element, selector);
    fixture.detectChanges();
  }

  it('loads orders and their related names', () => {
    const { fixture, element } = setup();

    flushLoad(fixture);

    expect(element.querySelectorAll('tbody tr').length).toBe(4);
    expect(element.textContent).toContain('WO-001');
    expect(element.textContent).toContain('Centro Córdoba');
    expect(element.textContent).toContain('Sensor averiado');
    expect(element.textContent).toContain('Ana López');
    expect(element.textContent).toContain('Planificada');
    expect(element.textContent).toContain('Completada');
    expect(element.textContent).toContain('Cancelada');
  });

  it('shows an empty state when no orders exist', () => {
    const { fixture, element } = setup();

    flushLoad(fixture, []);

    expect(element.querySelectorAll('tbody tr').length).toBe(0);
    expect(element.textContent).toContain(
      'No hay órdenes que coincidan'
    );
  });

  it('disables creation when no facilities exist', () => {
    const { fixture, element } = setup();

    flushLoad(fixture, [], []);

    expect(
      element.querySelector<HTMLButtonElement>(
        '.create-button'
      )?.disabled
    ).toBe(true);
  });

  it('shows a loading error and supports retry', () => {
    const { fixture, element } = setup();

    const ordersRequest = httpMock.expectOne('/api/work-orders');
    const facilityRequest = httpMock.expectOne('/api/facilities');
    const assetRequest = httpMock.expectOne('/api/assets');
    const incidentRequest = httpMock.expectOne('/api/incidents');
    const technicianRequest = httpMock.expectOne('/api/technicians');

    ordersRequest.flush(allOrders);
    facilityRequest.flush(facilities);
    assetRequest.flush(assets);
    incidentRequest.flush(incidents);

    technicianRequest.flush(
      { title: 'Error de carga' },
      { status: 500, statusText: 'Server Error' }
    );

    fixture.detectChanges();

    expect(element.textContent).toContain(
      'No se pudieron cargar las órdenes'
    );

    click(element, '.error button');
    flushLoad(fixture);

    expect(element.querySelectorAll('tbody tr').length).toBe(4);
  });

  for (const testCase of [
    {
      name: 'asset',
      selector: '#filter-work-order-asset',
      value: assetId,
      parameter: 'assetId'
    },
    {
      name: 'incident',
      selector: '#filter-work-order-incident',
      value: incidentId,
      parameter: 'incidentId'
    },
    {
      name: 'technician',
      selector: '#filter-work-order-technician',
      value: technicianId,
      parameter: 'technicianId'
    },
    {
      name: 'status',
      selector: '#filter-work-order-status',
      value: '2',
      parameter: 'status'
    },
    {
      name: 'priority',
      selector: '#filter-work-order-priority',
      value: '3',
      parameter: 'priority'
    }
  ]) {
    it(`applies the ${testCase.name} filter`, () => {
      const { fixture, element } = setup();

      flushLoad(fixture);

      changeSelect(
        element,
        testCase.selector,
        testCase.value
      );

      flushLoad(
        fixture,
        [planned],
        facilities,
        { [testCase.parameter]: testCase.value }
      );
    });
  }

  it('filters by facility and resets dependent filters', () => {
    const { fixture, element } = setup();

    flushLoad(fixture);

    changeSelect(element, '#filter-work-order-asset', assetId);
    flushLoad(fixture, [planned], facilities, { assetId });

    changeSelect(element, '#filter-work-order-incident', incidentId);
    flushLoad(fixture, [planned], facilities, {
      assetId,
      incidentId
    });

    changeSelect(
      element,
      '#filter-work-order-facility',
      otherFacilityId
    );

    flushLoad(fixture, [], facilities, {
      facilityId: otherFacilityId
    });

    expect(
      element.querySelector<HTMLSelectElement>(
        '#filter-work-order-asset'
      )?.value
    ).toBe('');

    expect(
      element.querySelector<HTMLSelectElement>(
        '#filter-work-order-incident'
      )?.value
    ).toBe('');
  });

  it('opens and closes the creation form', () => {
    const { fixture, element } = setup();

    flushLoad(fixture);

    click(element, '.create-button');
    fixture.detectChanges();

    expect(
      element.querySelector('app-work-order-create-form')
    ).not.toBeNull();

    click(element, '.create-button');
    fixture.detectChanges();

    expect(
      element.querySelector('app-work-order-create-form')
    ).toBeNull();
  });

  it('creates an order and reloads the table', () => {
    const { fixture, element } = setup();

    flushLoad(fixture);

    click(element, '.create-button');
    fixture.detectChanges();

    changeSelect(element, '#work-order-facility', facilityId);
    fixture.detectChanges();

    fillInput(element, '#work-order-code', 'WO-NEW');
    fillInput(element, '#work-order-title', 'Nueva orden');

    submitForm(
      element,
      'app-work-order-create-form form'
    );

    const request = httpMock.expectOne('/api/work-orders');

    expect(request.request.method).toBe('POST');
    expect(request.request.body.code).toBe('WO-NEW');
    expect(request.request.body.facilityId).toBe(facilityId);
    expect(request.request.body.priority).toBe(2);

    const created: WorkOrder = {
      ...planned,
      id: '00000000-0000-0000-0000-000000000099',
      code: 'WO-NEW',
      title: 'Nueva orden',
      assetId: null,
      incidentId: null,
      technicianId: null,
      description: null,
      priority: WorkOrderPriority.Medium
    };

    request.flush(created, {
      status: 201,
      statusText: 'Created'
    });

    flushLoad(fixture, [created]);

    expect(element.textContent).toContain('WO-NEW');
    expect(element.textContent).toContain('creada correctamente');
    expect(
      element.querySelector('app-work-order-create-form')
    ).toBeNull();
  });

  it('blocks closing the creation form while saving', () => {
    const { fixture, element } = setup();

    flushLoad(fixture);

    click(element, '.create-button');
    fixture.detectChanges();

    changeSelect(element, '#work-order-facility', facilityId);
    fixture.detectChanges();

    fillInput(element, '#work-order-code', 'WO-TEST');
    fillInput(element, '#work-order-title', 'Prueba de error');

    submitForm(element, 'app-work-order-create-form form');
    fixture.detectChanges();

    const button = element.querySelector<HTMLButtonElement>(
      '.create-button'
    );

    expect(button?.disabled).toBe(true);

    button?.dispatchEvent(
      new MouseEvent('click', { bubbles: true })
    );

    fixture.detectChanges();

    expect(
      element.querySelector('app-work-order-create-form')
    ).not.toBeNull();

    const request = httpMock.expectOne('/api/work-orders');

    request.flush(
      { title: 'Duplicate code' },
      { status: 409, statusText: 'Conflict' }
    );

    fixture.detectChanges();

    expect(button?.disabled).toBe(false);
    expect(element.textContent).toContain('El código ya existe');

    click(element, '.create-button');
    fixture.detectChanges();

    expect(
      element.querySelector('app-work-order-create-form')
    ).toBeNull();
  });

  it('only offers editing for planned orders', () => {
    const { fixture, element } = setup();

    flushLoad(fixture);

    expect(
      element.querySelectorAll('tbody .edit-button').length
    ).toBe(1);

    expect(
      element.querySelectorAll('tbody .assign-button').length
    ).toBe(1);
  });

  it('updates a planned order and reloads the table', () => {
    const { fixture, element } = setup();

    flushLoad(fixture);

    click(element, 'tbody .edit-button');
    fixture.detectChanges();

    fillInput(
      element,
      '#edit-work-order-title',
      'Orden actualizada'
    );

    submitForm(element, 'app-work-order-edit-form form');

    const request = httpMock.expectOne(
      `/api/work-orders/${orderId}`
    );

    expect(request.request.method).toBe('PUT');
    expect(request.request.body.title).toBe('Orden actualizada');

    request.flush(null, {
      status: 204,
      statusText: 'No Content'
    });

    flushLoad(fixture, [{
      ...planned,
      title: 'Orden actualizada'
    }]);

    expect(element.textContent).toContain(
      'actualizada correctamente'
    );

    expect(element.textContent).toContain('Orden actualizada');
    expect(element.querySelector('app-work-order-edit-form')).toBeNull();
  });

  it('cancels edition without a PUT request', () => {
    const { fixture, element } = setup();

    flushLoad(fixture);

    click(element, 'tbody .edit-button');
    fixture.detectChanges();

    click(element, 'app-work-order-edit-form .cancel-button');
    fixture.detectChanges();

    expect(element.querySelector('app-work-order-edit-form')).toBeNull();

    httpMock.expectNone(
      `/api/work-orders/${orderId}`
    );
  });

  it('assigns a different active technician', () => {
    const { fixture, element } = setup();

    flushLoad(fixture);

    click(element, 'tbody .assign-button');
    fixture.detectChanges();

    const select = element.querySelector<HTMLSelectElement>(
      '#work-order-assignment-technician'
    );

    const values = Array.from(select!.options).map(x => x.value);

    expect(values).toContain(secondTechnicianId);
    expect(values).not.toContain(inactiveTechnicianId);

    changeSelect(
      element,
      '#work-order-assignment-technician',
      secondTechnicianId
    );

    click(element, '.action-panel .primary-button');

    const request = httpMock.expectOne(
      `/api/work-orders/${orderId}/assign-technician`
    );

    expect(request.request.method).toBe('PATCH');

    expect(request.request.body).toEqual({
      technicianId: secondTechnicianId
    });

    request.flush(null, {
      status: 204,
      statusText: 'No Content'
    });

    flushLoad(fixture, [{
      ...planned,
      technicianId: secondTechnicianId
    }]);

    expect(element.textContent).toContain('Marta Ruiz');
    expect(element.textContent).toContain('actualizada');
  });

  it('unassigns a technician using null', () => {
    const { fixture, element } = setup();

    flushLoad(fixture);

    click(element, 'tbody .assign-button');
    fixture.detectChanges();

    changeSelect(
      element,
      '#work-order-assignment-technician',
      ''
    );

    click(element, '.action-panel .primary-button');

    const request = httpMock.expectOne(
      `/api/work-orders/${orderId}/assign-technician`
    );

    expect(request.request.body).toEqual({
      technicianId: null
    });

    request.flush(null, {
      status: 204,
      statusText: 'No Content'
    });

    flushLoad(fixture, [{
      ...planned,
      technicianId: null
    }]);

    expect(element.textContent).toContain('Sin asignar');
  });

  it('shows assignment conflicts and supports refresh', () => {
    const { fixture, element } = setup();

    flushLoad(fixture);

    click(element, 'tbody .assign-button');
    fixture.detectChanges();

    click(element, '.action-panel .primary-button');

    const request = httpMock.expectOne(
      `/api/work-orders/${orderId}/assign-technician`
    );

    request.flush(
      { title: 'Order already started' },
      { status: 409, statusText: 'Conflict' }
    );

    fixture.detectChanges();

    expect(element.textContent).toContain(
      'La operación no está permitida'
    );

    click(element, '.action-panel .refresh-button');

    flushLoad(fixture);

    expect(element.querySelector('.action-panel')).toBeNull();
  });

  it('starts a planned order', () => {
    const { fixture, element } = setup();

    flushLoad(fixture);
    openStatus(fixture, element, 1);

    expect(element.textContent).toContain('Confirmar cambio de estado');

    click(element, '.action-panel .primary-button');

    const request = httpMock.expectOne(
      `/api/work-orders/${orderId}/start`
    );

    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({});

    request.flush(null, {
      status: 204,
      statusText: 'No Content'
    });

    flushLoad(fixture, [{
      ...planned,
      status: WorkOrderStatus.InProgress,
      startedAtUtc: '2026-11-24T09:00:00Z'
    }]);

    expect(element.textContent).toContain('En curso');
    expect(element.querySelector('.action-panel')).toBeNull();
  });

  it('shows status conflicts and supports refresh', () => {
    const { fixture, element } = setup();

    flushLoad(fixture);
    openStatus(fixture, element, 1);

    click(element, '.action-panel .primary-button');

    const request = httpMock.expectOne(
      `/api/work-orders/${orderId}/start`
    );

    request.flush(
      { title: 'Invalid status transition' },
      { status: 409, statusText: 'Conflict' }
    );

    fixture.detectChanges();

    expect(element.textContent).toContain(
      'La operación no está permitida'
    );

    click(element, '.action-panel .refresh-button');

    flushLoad(fixture);

    expect(element.querySelector('.action-panel')).toBeNull();
  });

  it('completes an in-progress order', () => {
    const { fixture, element } = setup();

    flushLoad(fixture);
    openStatus(fixture, element, 2);

    click(element, '.action-panel .primary-button');

    const request = httpMock.expectOne(
      `/api/work-orders/${inProgressId}/complete`
    );

    expect(request.request.method).toBe('PATCH');

    request.flush(null, {
      status: 204,
      statusText: 'No Content'
    });

    flushLoad(fixture, [{
      ...inProgress,
      status: WorkOrderStatus.Completed,
      completedAtUtc: '2026-11-24T10:00:00Z'
    }]);

    expect(element.textContent).toContain('Completada');
  });

  it('requires a cancellation reason', () => {
    const { fixture, element } = setup();

    flushLoad(fixture);
    openStatus(fixture, element, 1, 'cancel');

    const confirm = element.querySelector<HTMLButtonElement>(
      '.action-panel .primary-button'
    );

    expect(confirm?.disabled).toBe(true);

    fillInput(
      element,
      '#work-order-cancellation-reason',
      '   '
    );

    fixture.detectChanges();

    expect(confirm?.disabled).toBe(true);

    httpMock.expectNone(
      `/api/work-orders/${orderId}/cancel`
    );
  });

  it('cancels an order and trims the reason', () => {
    const { fixture, element } = setup();

    flushLoad(fixture);
    openStatus(fixture, element, 1, 'cancel');

    fillInput(
      element,
      '#work-order-cancellation-reason',
      '  Trabajo no necesario  '
    );

    fixture.detectChanges();

    click(element, '.action-panel .primary-button');

    const request = httpMock.expectOne(
      `/api/work-orders/${orderId}/cancel`
    );

    expect(request.request.method).toBe('PATCH');

    expect(request.request.body).toEqual({
      reason: 'Trabajo no necesario'
    });

    request.flush(null, {
      status: 204,
      statusText: 'No Content'
    });

    flushLoad(fixture, [{
      ...planned,
      status: WorkOrderStatus.Cancelled,
      cancelledAtUtc: '2026-11-24T11:00:00Z',
      cancellationReason: 'Trabajo no necesario'
    }]);

    expect(element.textContent).toContain('Cancelada');
    expect(element.querySelector('.action-panel')).toBeNull();
  });

  it('does not offer status actions for terminal orders', () => {
    const { fixture, element } = setup();

    flushLoad(fixture);

    expect(
      element.querySelectorAll(
        'tbody tr:nth-child(3) .status-button'
      ).length
    ).toBe(0);

    expect(
      element.querySelectorAll(
        'tbody tr:nth-child(4) .status-button'
      ).length
    ).toBe(0);
  });

  it('prevents duplicate status requests', () => {
    const { fixture, element } = setup();

    flushLoad(fixture);
    openStatus(fixture, element, 1);

    const confirm = element.querySelector<HTMLButtonElement>(
      '.action-panel .primary-button'
    );

    confirm!.click();
    fixture.detectChanges();

    expect(confirm?.disabled).toBe(true);

    confirm!.dispatchEvent(
      new MouseEvent('click', { bubbles: true })
    );

    const request = httpMock.expectOne(
      `/api/work-orders/${orderId}/start`
    );

    httpMock.expectNone(
      `/api/work-orders/${orderId}/start`
    );

    request.flush(null, {
      status: 204,
      statusText: 'No Content'
    });

    flushLoad(fixture, [inProgress]);
  });

  it('preserves facility filters after a status transition', () => {
    const { fixture, element } = setup();

    flushLoad(fixture);

    changeSelect(
      element,
      '#filter-work-order-facility',
      facilityId
    );

    flushLoad(fixture, [planned], facilities, {
      facilityId
    });

    openStatus(fixture, element, 1);

    click(element, '.action-panel .primary-button');

    const request = httpMock.expectOne(
      `/api/work-orders/${orderId}/start`
    );

    request.flush(null, {
      status: 204,
      statusText: 'No Content'
    });

    flushLoad(fixture, [{
      ...planned,
      status: WorkOrderStatus.InProgress
    }], facilities, {
      facilityId
    });

    expect(
      element.querySelector<HTMLSelectElement>(
        '#filter-work-order-facility'
      )?.value
    ).toBe(facilityId);
  });
});
