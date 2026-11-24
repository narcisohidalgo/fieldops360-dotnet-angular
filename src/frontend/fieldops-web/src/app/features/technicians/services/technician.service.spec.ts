import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  Technician,
  CreateTechnicianRequest,
  UpdateTechnicianRequest
} from '../models/technician.model';

import { TechnicianService } from './technician.service';

describe('TechnicianService', () => {
  let service: TechnicianService;
  let httpMock: HttpTestingController;

  const technicianId = '00000000-0000-0000-0000-000000000001';

  const technician: Technician = {
    id: technicianId,
    code: 'TEC-001',
    name: 'Ana Lopez',
    email: 'ana@example.com',
    phone: '600123456',
    specialty: 'Electricidad',
    isActive: true
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        TechnicianService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });

    service = TestBed.inject(TechnicianService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should retrieve technicians using GET', () => {
    let result: Technician[] | undefined;

    service.getAll().subscribe(data => {
      result = data;
    });

    const request = httpMock.expectOne('/api/technicians');

    expect(request.request.method).toBe('GET');

    request.flush([technician]);

    expect(result).toEqual([technician]);
  });

  it('should retrieve technician by ID using GET', () => {
    let result: Technician | undefined;

    service.getById(technicianId).subscribe(data => {
      result = data;
    });

    const request = httpMock.expectOne(
      `/api/technicians/${technicianId}`
    );

    expect(request.request.method).toBe('GET');

    request.flush(technician);

    expect(result).toEqual(technician);
  });

  it('should create technician using POST', () => {
    const createRequest: CreateTechnicianRequest = {
      code: 'TEC-001',
      name: 'Ana Lopez',
      email: 'ana@example.com',
      phone: '600123456',
      specialty: 'Electricidad'
    };

    let result: Technician | undefined;

    service.create(createRequest).subscribe(data => {
      result = data;
    });

    const request = httpMock.expectOne('/api/technicians');

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(createRequest);

    request.flush(technician, {
      status: 201,
      statusText: 'Created'
    });

    expect(result).toEqual(technician);
  });

  it('should update technician using PUT', () => {
    const updateRequest: UpdateTechnicianRequest = {
      name: 'Ana Lopez Garcia',
      email: 'ana.garcia@example.com',
      phone: null,
      specialty: 'Mecanica'
    };

    let completed = false;

    service.update(technicianId, updateRequest).subscribe({
      next: () => {
        completed = true;
      }
    });

    const request = httpMock.expectOne(
      `/api/technicians/${technicianId}`
    );

    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(updateRequest);

    request.flush(null, {
      status: 204,
      statusText: 'No Content'
    });

    expect(completed).toBe(true);
  });

  it('should activate technician using PATCH', () => {
    let completed = false;

    service.activate(technicianId).subscribe({
      next: () => {
        completed = true;
      }
    });

    const request = httpMock.expectOne(
      `/api/technicians/${technicianId}/activate`
    );

    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({});

    request.flush(null, {
      status: 204,
      statusText: 'No Content'
    });

    expect(completed).toBe(true);
  });

  it('should deactivate technician using PATCH', () => {
    let completed = false;

    service.deactivate(technicianId).subscribe({
      next: () => {
        completed = true;
      }
    });

    const request = httpMock.expectOne(
      `/api/technicians/${technicianId}/deactivate`
    );

    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({});

    request.flush(null, {
      status: 204,
      statusText: 'No Content'
    });

    expect(completed).toBe(true);
  });

  it('should propagate HTTP 409 for duplicate code', () => {
    const createRequest: CreateTechnicianRequest = {
      code: 'TEC-001',
      name: 'Ana Lopez',
      email: 'ana@example.com',
      phone: null,
      specialty: null
    };

    let errorStatus: number | undefined;

    service.create(createRequest).subscribe({
      error: error => {
        errorStatus = error.status;
      }
    });

    const request = httpMock.expectOne('/api/technicians');

    request.flush(
      { title: 'Technician code already exists.' },
      {
        status: 409,
        statusText: 'Conflict'
      }
    );

    expect(errorStatus).toBe(409);
  });
});
