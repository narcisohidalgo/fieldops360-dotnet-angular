import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DashboardSummary } from '../models/dashboard-summary.model';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let httpMock: HttpTestingController;

  const summary: DashboardSummary = {
    facilities: { total: 3, active: 2 },
    assets: { total: 2, active: 2 },
    technicians: { total: 4, active: 1 },
    incidents: {
      total: 2,
      open: 1,
      inProgress: 1,
      resolved: 0,
      closed: 0
    },
    workOrders: {
      total: 5,
      planned: 2,
      inProgress: 1,
      completed: 1,
      cancelled: 1,
      overdue: 0,
      unassignedPlanned: 1
    },
    generatedAtUtc: '2026-11-25T10:00:00Z'
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });

    service = TestBed.inject(DashboardService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('obtiene los KPIs mediante GET', () => {
    let result: DashboardSummary | undefined;

    service.getSummary().subscribe(value => {
      result = value;
    });

    const request = httpMock.expectOne(
      '/api/dashboard/summary'
    );

    expect(request.request.method).toBe('GET');

    request.flush(summary);

    expect(result).toEqual(summary);
    expect(result?.workOrders.unassignedPlanned).toBe(1);
  });

  it('propaga los errores de autenticacion', () => {
    let errorStatus: number | undefined;

    service.getSummary().subscribe({
      error: error => {
        errorStatus = error.status;
      }
    });

    httpMock.expectOne('/api/dashboard/summary').flush(
      { title: 'Unauthorized' },
      { status: 401, statusText: 'Unauthorized' }
    );

    expect(errorStatus).toBe(401);
  });
});