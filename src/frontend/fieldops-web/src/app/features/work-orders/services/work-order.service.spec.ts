import {
  HttpErrorResponse,
  provideHttpClient
} from '@angular/common/http';

import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';

import { TestBed } from '@angular/core/testing';

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it
} from 'vitest';

import {
  WorkOrder,
  WorkOrderPriority,
  WorkOrderStatus,
  CreateWorkOrderRequest,
  UpdateWorkOrderRequest
} from '../models/work-order.model';

import { WorkOrderService } from './work-order.service';

describe('WorkOrderService', () => {
  let service: WorkOrderService;
  let httpMock: HttpTestingController;

  const apiUrl = '/api/work-orders';

  const facilityId = '00000000-0000-0000-0000-000000000001';
  const assetId = '00000000-0000-0000-0000-000000000002';
  const incidentId = '00000000-0000-0000-0000-000000000003';
  const technicianId = '00000000-0000-0000-0000-000000000004';
  const workOrderId = '00000000-0000-0000-0000-000000000005';

  const example: WorkOrder = {
    id: workOrderId,
    facilityId,
    assetId,
    incidentId,
    technicianId,
    code: 'WO-001',
    title: 'Revisar sensor',
    description: 'Inspeccion preventiva',
    priority: WorkOrderPriority.High,
    status: WorkOrderStatus.Planned,
    scheduledStartUtc: '2026-12-01T09:00:00+00:00',
    dueAtUtc: '2026-12-01T12:00:00+00:00',
    createdAtUtc: '2026-11-24T08:00:00+00:00',
    updatedAtUtc: '2026-11-24T08:00:00+00:00',
    startedAtUtc: null,
    completedAtUtc: null,
    cancelledAtUtc: null,
    cancellationReason: null
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        WorkOrderService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });

    service = TestBed.inject(WorkOrderService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should retrieve work orders using GET', () => {
    let actual: WorkOrder[] | undefined;

    service.getAll().subscribe(orders => {
      actual = orders;
    });

    const request = httpMock.expectOne(apiUrl);

    expect(request.request.method).toBe('GET');
    expect(request.request.params.keys()).toEqual([]);

    request.flush([example]);

    expect(actual).toEqual([example]);
  });

  it('should send all six filters as query parameters', () => {
    service.getAll({
      facilityId,
      assetId,
      incidentId,
      technicianId,
      status: WorkOrderStatus.InProgress,
      priority: WorkOrderPriority.Critical
    }).subscribe();

    const request = httpMock.expectOne(req =>
      req.url === apiUrl
    );

    expect(request.request.method).toBe('GET');

    expect(request.request.params.get('facilityId')).toBe(facilityId);
    expect(request.request.params.get('assetId')).toBe(assetId);
    expect(request.request.params.get('incidentId')).toBe(incidentId);
    expect(request.request.params.get('technicianId')).toBe(technicianId);
    expect(request.request.params.get('status')).toBe('2');
    expect(request.request.params.get('priority')).toBe('4');

    request.flush([]);
  });

  it('should support filtering only by status', () => {
    service.getAll({
      status: WorkOrderStatus.Planned
    }).subscribe();

    const request = httpMock.expectOne(req =>
      req.url === apiUrl
    );

    expect(request.request.params.get('status')).toBe('1');
    expect(request.request.params.keys()).toEqual(['status']);

    request.flush([]);
  });

  it('should retrieve a work order by ID', () => {
    let actual: WorkOrder | undefined;

    service.getById(workOrderId).subscribe(order => {
      actual = order;
    });

    const request = httpMock.expectOne(
      `${apiUrl}/${workOrderId}`
    );

    expect(request.request.method).toBe('GET');

    request.flush(example);

    expect(actual).toEqual(example);
  });

  it('should create a work order using POST', () => {
    const body: CreateWorkOrderRequest = {
      facilityId,
      assetId,
      incidentId,
      technicianId,
      code: 'WO-001',
      title: 'Revisar sensor',
      description: 'Inspeccion preventiva',
      priority: WorkOrderPriority.High,
      scheduledStartUtc: example.scheduledStartUtc,
      dueAtUtc: example.dueAtUtc
    };

    let actual: WorkOrder | undefined;

    service.create(body).subscribe(order => {
      actual = order;
    });

    const request = httpMock.expectOne(apiUrl);

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(body);

    request.flush(example, {
      status: 201,
      statusText: 'Created'
    });

    expect(actual).toEqual(example);
  });

  it('should update a work order using PUT', () => {
    const body: UpdateWorkOrderRequest = {
      title: 'Revision actualizada',
      description: null,
      priority: WorkOrderPriority.Medium,
      scheduledStartUtc: null,
      dueAtUtc: null
    };

    let completed = false;

    service.update(workOrderId, body).subscribe(() => {
      completed = true;
    });

    const request = httpMock.expectOne(
      `${apiUrl}/${workOrderId}`
    );

    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(body);

    request.flush(null, {
      status: 204,
      statusText: 'No Content'
    });

    expect(completed).toBe(true);
  });

  it('should assign a technician using PATCH', () => {
    service.assignTechnician(workOrderId, technicianId).subscribe();

    const request = httpMock.expectOne(
      `${apiUrl}/${workOrderId}/assign-technician`
    );

    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ technicianId });

    request.flush(null, {
      status: 204,
      statusText: 'No Content'
    });
  });

  it('should remove a technician assignment using null', () => {
    service.assignTechnician(workOrderId, null).subscribe();

    const request = httpMock.expectOne(
      `${apiUrl}/${workOrderId}/assign-technician`
    );

    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ technicianId: null });

    request.flush(null, {
      status: 204,
      statusText: 'No Content'
    });
  });

  it('should start a work order using PATCH', () => {
    service.start(workOrderId).subscribe();

    const request = httpMock.expectOne(
      `${apiUrl}/${workOrderId}/start`
    );

    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({});

    request.flush(null, {
      status: 204,
      statusText: 'No Content'
    });
  });

  it('should complete a work order using PATCH', () => {
    service.complete(workOrderId).subscribe();

    const request = httpMock.expectOne(
      `${apiUrl}/${workOrderId}/complete`
    );

    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({});

    request.flush(null, {
      status: 204,
      statusText: 'No Content'
    });
  });

  it('should cancel a work order with a reason', () => {
    service.cancel(
      workOrderId,
      'Equipo fuera de servicio'
    ).subscribe();

    const request = httpMock.expectOne(
      `${apiUrl}/${workOrderId}/cancel`
    );

    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({
      reason: 'Equipo fuera de servicio'
    });

    request.flush(null, {
      status: 204,
      statusText: 'No Content'
    });
  });

  it('should propagate HTTP 409 conflict errors', () => {
    let errorStatus: number | undefined;

    service.start(workOrderId).subscribe({
      error: (error: HttpErrorResponse) => {
        errorStatus = error.status;
      }
    });

    const request = httpMock.expectOne(
      `${apiUrl}/${workOrderId}/start`
    );

    request.flush(
      { title: 'Invalid work order operation.' },
      { status: 409, statusText: 'Conflict' }
    );

    expect(errorStatus).toBe(409);
  });

  it('should propagate HTTP 404 for missing references', () => {
    let errorStatus: number | undefined;

    service.assignTechnician(
      workOrderId,
      technicianId
    ).subscribe({
      error: (error: HttpErrorResponse) => {
        errorStatus = error.status;
      }
    });

    const request = httpMock.expectOne(
      `${apiUrl}/${workOrderId}/assign-technician`
    );

    request.flush(
      { title: 'Referenced resource not found.' },
      { status: 404, statusText: 'Not Found' }
    );

    expect(errorStatus).toBe(404);
  });

  it('should propagate HTTP 400 validation errors', () => {
    let errorStatus: number | undefined;

    service.cancel(workOrderId, '').subscribe({
      error: (error: HttpErrorResponse) => {
        errorStatus = error.status;
      }
    });

    const request = httpMock.expectOne(
      `${apiUrl}/${workOrderId}/cancel`
    );

    request.flush(
      { title: 'Invalid work order data.' },
      { status: 400, statusText: 'Bad Request' }
    );

    expect(errorStatus).toBe(400);
  });
});
