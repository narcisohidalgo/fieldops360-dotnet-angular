import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
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
  Incident,
  IncidentPriority,
  IncidentStatus,
  CreateIncidentRequest,
  UpdateIncidentRequest
} from '../models/incident.model';

import { IncidentService } from './incident.service';

describe('IncidentService', () => {
  let service: IncidentService;
  let httpMock: HttpTestingController;

  const facilityId = '00000000-0000-0000-0000-000000000001';
  const assetId = '00000000-0000-0000-0000-000000000002';
  const incidentId = '00000000-0000-0000-0000-000000000003';

  const exampleIncident: Incident = {
    id: incidentId,
    facilityId,
    assetId,
    title: 'Fallo de arranque del tractor',
    description: 'El motor no arranca',
    priority: IncidentPriority.High,
    status: IncidentStatus.Open,
    createdAtUtc: '2026-11-23T12:00:00+00:00',
    updatedAtUtc: '2026-11-23T12:00:00+00:00',
    resolvedAtUtc: null,
    closedAtUtc: null
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        IncidentService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });

    service = TestBed.inject(IncidentService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should retrieve all incidents using GET', () => {
    let actual: Incident[] | undefined;

    service.getAll().subscribe(items => {
      actual = items;
    });

    const request = httpMock.expectOne('/api/incidents');

    expect(request.request.method).toBe('GET');
    expect(request.request.params.keys()).toEqual([]);

    request.flush([exampleIncident]);

    expect(actual).toEqual([exampleIncident]);
  });

  it('should send all incident filters as query parameters', () => {
    service.getAll({
      facilityId,
      assetId,
      status: IncidentStatus.InProgress,
      priority: IncidentPriority.Critical
    }).subscribe();

    const request = httpMock.expectOne(req =>
      req.url === '/api/incidents'
    );

    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('facilityId')).toBe(facilityId);
    expect(request.request.params.get('assetId')).toBe(assetId);
    expect(request.request.params.get('status')).toBe('2');
    expect(request.request.params.get('priority')).toBe('4');

    request.flush([]);
  });

  it('should support filtering by status only', () => {
    service.getAll({
      status: IncidentStatus.Open
    }).subscribe();

    const request = httpMock.expectOne(req =>
      req.url === '/api/incidents'
    );

    expect(request.request.params.get('status')).toBe('1');
    expect(request.request.params.has('facilityId')).toBe(false);
    expect(request.request.params.has('assetId')).toBe(false);
    expect(request.request.params.has('priority')).toBe(false);

    request.flush([]);
  });

  it('should retrieve an incident by ID', () => {
    let actual: Incident | undefined;

    service.getById(incidentId).subscribe(item => {
      actual = item;
    });

    const request = httpMock.expectOne(
      `/api/incidents/${incidentId}`
    );

    expect(request.request.method).toBe('GET');

    request.flush(exampleIncident);

    expect(actual).toEqual(exampleIncident);
  });

  it('should create an incident using POST', () => {
    const body: CreateIncidentRequest = {
      facilityId,
      assetId,
      title: 'Fallo de arranque del tractor',
      description: 'El motor no arranca',
      priority: IncidentPriority.High
    };

    let actual: Incident | undefined;

    service.create(body).subscribe(item => {
      actual = item;
    });

    const request = httpMock.expectOne('/api/incidents');

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(body);

    request.flush(exampleIncident, {
      status: 201,
      statusText: 'Created'
    });

    expect(actual).toEqual(exampleIncident);
  });

  it('should update an incident using PUT', () => {
    const body: UpdateIncidentRequest = {
      title: 'Tractor revisado',
      description: 'Pendiente de nueva comprobacion',
      priority: IncidentPriority.Medium
    };

    let completed = false;

    service.update(incidentId, body).subscribe(() => {
      completed = true;
    });

    const request = httpMock.expectOne(
      `/api/incidents/${incidentId}`
    );

    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(body);

    request.flush(null, {
      status: 204,
      statusText: 'No Content'
    });

    expect(completed).toBe(true);
  });

  it('should start an incident using PATCH', () => {
    let completed = false;

    service.startProgress(incidentId).subscribe(() => {
      completed = true;
    });

    const request = httpMock.expectOne(
      `/api/incidents/${incidentId}/start`
    );

    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({});

    request.flush(null, {
      status: 204,
      statusText: 'No Content'
    });

    expect(completed).toBe(true);
  });

  it('should resolve an incident using PATCH', () => {
    service.resolve(incidentId).subscribe();

    const request = httpMock.expectOne(
      `/api/incidents/${incidentId}/resolve`
    );

    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({});

    request.flush(null, {
      status: 204,
      statusText: 'No Content'
    });
  });

  it('should close an incident using PATCH', () => {
    service.close(incidentId).subscribe();

    const request = httpMock.expectOne(
      `/api/incidents/${incidentId}/close`
    );

    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({});

    request.flush(null, {
      status: 204,
      statusText: 'No Content'
    });
  });

  it('should reopen an incident using PATCH', () => {
    service.reopen(incidentId).subscribe();

    const request = httpMock.expectOne(
      `/api/incidents/${incidentId}/reopen`
    );

    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({});

    request.flush(null, {
      status: 204,
      statusText: 'No Content'
    });
  });

  it('should propagate HTTP 409 conflicts to the caller', () => {
    let receivedStatus: number | undefined;

    service.resolve(incidentId).subscribe({
      error: (error: HttpErrorResponse) => {
        receivedStatus = error.status;
      }
    });

    const request = httpMock.expectOne(
      `/api/incidents/${incidentId}/resolve`
    );

    request.flush(
      { title: 'Invalid incident status transition.' },
      {
        status: 409,
        statusText: 'Conflict'
      }
    );

    expect(receivedStatus).toBe(409);
  });
});
