import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Facility } from '../models/facility.model';
import { FacilityService } from './facility.service';

describe('FacilityService', () => {
  let service: FacilityService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        FacilityService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });

    service = TestBed.inject(FacilityService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should retrieve a facility by ID using GET', () => {
    // Arrange
    const facilityId = '00000000-0000-0000-0000-000000000001';

    const expectedFacility: Facility = {
      id: facilityId,
      code: 'FAC-001',
      name: 'Centro Logístico Córdoba',
      city: 'Córdoba',
      address: 'Calle Industria 10',
      isActive: true
    };

    let actualFacility: Facility | undefined;

    // Act
    service.getById(facilityId).subscribe(facility => {
      actualFacility = facility;
    });

    // Assert
    const request = httpMock.expectOne(
      `/api/facilities/${facilityId}`
    );

    expect(request.request.method).toBe('GET');

    request.flush(expectedFacility);

    expect(actualFacility).toEqual(expectedFacility);
  });
  it('should create a facility using POST', () => {
    // Arrange
    const createRequest = {
      code: 'FAC-002',
      name: 'Centro Logístico Sevilla',
      city: 'Sevilla',
      address: 'Avenida de la Industria 20'
    };

    const expectedFacility: Facility = {
      id: '00000000-0000-0000-0000-000000000002',
      ...createRequest,
      isActive: true
    };

    let actualFacility: Facility | undefined;

    // Act
    service.create(createRequest).subscribe(facility => {
      actualFacility = facility;
    });

    // Assert: comprobar la petición enviada
    const request = httpMock.expectOne('/api/facilities');

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(createRequest);

    // Simular la respuesta del backend
    request.flush(expectedFacility);

    // Comprobar la respuesta recibida
    expect(actualFacility).toEqual(expectedFacility);
  });
  it('should update a facility using PUT', () => {
    // Arrange
    const facilityId = '00000000-0000-0000-0000-000000000001';

    const updateRequest = {
      name: 'Centro Logístico Córdoba Norte',
      city: 'Córdoba',
      address: 'Calle Innovación 25'
    };

    let completed = false;

    // Act
    service.update(facilityId, updateRequest).subscribe({
      next: () => {
        completed = true;
      }
    });

    // Assert: comprobar la petición HTTP
    const request = httpMock.expectOne(
      `/api/facilities/${facilityId}`
    );

    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(updateRequest);

    // Simular la respuesta 204 del backend
    request.flush(null, {
      status: 204,
      statusText: 'No Content'
    });

    expect(completed).toBe(true);
  });
  it('should activate a facility using PATCH', () => {
    // Arrange
    const facilityId = '00000000-0000-0000-0000-000000000001';

    let completed = false;

    // Act
    service.activate(facilityId).subscribe({
      next: () => {
        completed = true;
      }
    });

    // Assert: comprobar la peticion HTTP.
    const request = httpMock.expectOne(
      `/api/facilities/${facilityId}/activate`
    );

    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({});

    // Simular la respuesta 204 de ASP.NET Core.
    request.flush(null, {
      status: 204,
      statusText: 'No Content'
    });

    expect(completed).toBe(true);
  });
  it('should deactivate a facility using PATCH', () => {
    // Arrange
    const facilityId = '00000000-0000-0000-0000-000000000001';

    let completed = false;

    // Act
    service.deactivate(facilityId).subscribe({
      next: () => {
        completed = true;
      }
    });

    // Assert: comprobar la petición HTTP
    const request = httpMock.expectOne(
      `/api/facilities/${facilityId}/deactivate`
    );

    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({});

    // Simular la respuesta 204 del backend
    request.flush(null, {
      status: 204,
      statusText: 'No Content'
    });

    expect(completed).toBe(true);
  });
  it('should retrieve facilities using GET', () => {
    // Arrange
    const expectedFacilities: Facility[] = [
      {
        id: '00000000-0000-0000-0000-000000000001',
        code: 'FAC-001',
        name: 'Centro Logístico Córdoba',
        city: 'Córdoba',
        address: 'Calle Industria 10',
        isActive: true
      }
    ];

    let actualFacilities: Facility[] | undefined;

    // Act
    service.getAll().subscribe(facilities => {
      actualFacilities = facilities;
    });

    // Assert: comprobar la petición HTTP
    const request = httpMock.expectOne('/api/facilities');

    expect(request.request.method).toBe('GET');

    // Simular la respuesta del backend
    request.flush(expectedFacilities);

    // Comprobar los datos recibidos
    expect(actualFacilities).toEqual(expectedFacilities);
  });
});
