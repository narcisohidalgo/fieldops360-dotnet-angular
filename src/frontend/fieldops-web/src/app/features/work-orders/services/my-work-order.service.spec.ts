import { provideHttpClient } from '@angular/common/http';
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

import { MyWorkOrderService } from './my-work-order.service';

describe('MyWorkOrderService', () => {
  let service: MyWorkOrderService;
  let httpMock: HttpTestingController;

  const baseUrl = '/api/my/work-orders';
  const orderId = '00000000-0000-0000-0000-000000000101';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        MyWorkOrderService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });

    service = TestBed.inject(MyWorkOrderService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should retrieve only from the technician endpoint', () => {
    service.getAll().subscribe(orders => {
      expect(orders).toEqual([]);
    });

    const request = httpMock.expectOne(baseUrl);

    expect(request.request.method).toBe('GET');
    expect(request.request.params.keys()).toEqual([]);

    request.flush([]);
  });

  it('should retrieve one assigned order by ID', () => {
    service.getById(orderId).subscribe();

    const request = httpMock.expectOne(
      `${baseUrl}/${orderId}`
    );

    expect(request.request.method).toBe('GET');

    request.flush({});
  });

  for (const action of ['start', 'complete'] as const) {
    it(`should send ${action} to the technician endpoint`, () => {
      service[action](orderId).subscribe();

      const request = httpMock.expectOne(
        `${baseUrl}/${orderId}/${action}`
      );

      expect(request.request.method).toBe('PATCH');
      expect(request.request.body).toEqual({});

      request.flush(null, {
        status: 204,
        statusText: 'No Content'
      });
    });
  }
});
