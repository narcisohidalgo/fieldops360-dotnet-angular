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

import { CsrfService } from './csrf.service';

describe('CsrfService', () => {
  let service: CsrfService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });

    service = TestBed.inject(CsrfService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('obtains a CSRF token from the backend', () => {
    let actual: string | undefined;

    service.getToken().subscribe(token => {
      actual = token;
    });

    const request = httpMock.expectOne('/api/auth/csrf');

    expect(request.request.method).toBe('GET');

    request.flush({
      requestToken: 'server-token'
    });

    expect(actual).toBe('server-token');
  });

  it('shares one request between concurrent subscribers', () => {
    const tokens: string[] = [];

    service.getToken().subscribe(token => {
      tokens.push(token);
    });

    service.getToken().subscribe(token => {
      tokens.push(token);
    });

    const requests = httpMock.match('/api/auth/csrf');

    expect(requests).toHaveLength(1);

    requests[0].flush({
      requestToken: 'shared-token'
    });

    expect(tokens).toEqual([
      'shared-token',
      'shared-token'
    ]);
  });

  it('reuses a successfully cached token', () => {
    let first: string | undefined;
    let second: string | undefined;

    service.getToken().subscribe(token => {
      first = token;
    });

    httpMock.expectOne('/api/auth/csrf').flush({
      requestToken: 'cached-token'
    });

    service.getToken().subscribe(token => {
      second = token;
    });

    httpMock.expectNone('/api/auth/csrf');

    expect(first).toBe('cached-token');
    expect(second).toBe('cached-token');
  });

  it('requests a new token after clearing the cache', () => {
    let renewed: string | undefined;

    service.getToken().subscribe();

    httpMock.expectOne('/api/auth/csrf').flush({
      requestToken: 'old-token'
    });

    service.clear();

    service.getToken().subscribe(token => {
      renewed = token;
    });

    httpMock.expectOne('/api/auth/csrf').flush({
      requestToken: 'new-token'
    });

    expect(renewed).toBe('new-token');
  });

  it('rejects an empty token and allows a new attempt', () => {
    let receivedError: unknown;
    let recovered: string | undefined;

    service.getToken().subscribe({
      error: error => {
        receivedError = error;
      }
    });

    httpMock.expectOne('/api/auth/csrf').flush({
      requestToken: ''
    });

    expect(receivedError).toBeInstanceOf(Error);
    expect((receivedError as Error).message)
      .toBe('CSRF token is missing.');

    service.getToken().subscribe(token => {
      recovered = token;
    });

    httpMock.expectOne('/api/auth/csrf').flush({
      requestToken: 'recovered-token'
    });

    expect(recovered).toBe('recovered-token');
  });

  it('retries after a backend failure', () => {
    let errorStatus: number | undefined;
    let recovered: string | undefined;

    service.getToken().subscribe({
      error: error => {
        errorStatus = error.status;
      }
    });

    httpMock.expectOne('/api/auth/csrf').flush(
      { title: 'Service unavailable' },
      {
        status: 503,
        statusText: 'Service Unavailable'
      }
    );

    expect(errorStatus).toBe(503);

    service.getToken().subscribe(token => {
      recovered = token;
    });

    httpMock.expectOne('/api/auth/csrf').flush({
      requestToken: 'retry-token'
    });

    expect(recovered).toBe('retry-token');
  });
});