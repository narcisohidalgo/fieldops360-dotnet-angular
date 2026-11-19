import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { SystemStatus } from '../models/system-status';
import { SystemService } from './system.service';

describe('SystemService', () => {
  let service: SystemService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });

    service = TestBed.inject(SystemService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should request and return the backend status', () => {
    const expectedStatus: SystemStatus = {
      application: 'FieldOps 360',
      status: 'online',
      framework: '.NET 10',
      timestampUtc: '2026-11-19T15:44:44Z'
    };

    let actualStatus: SystemStatus | undefined;

    service.getStatus().subscribe(status => {
      actualStatus = status;
    });

    const request = httpTesting.expectOne('/api/system/status');

    expect(request.request.method).toBe('GET');

    request.flush(expectedStatus);

    expect(actualStatus).toEqual(expectedStatus);
  });
});
