import {
  HttpClient,
  provideHttpClient,
  withInterceptors
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

import { CsrfService } from '../services/csrf.service';
import { csrfInterceptor } from './csrf.interceptor';

describe('csrfInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let csrf: CsrfService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(
          withInterceptors([csrfInterceptor])
        ),
        provideHttpClientTesting()
      ]
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    csrf = TestBed.inject(CsrfService);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('does not add CSRF headers to GET requests', () => {
    http.get('/api/users').subscribe();

    const request = httpMock.expectOne('/api/users');

    expect(request.request.method).toBe('GET');
    expect(
      request.request.headers.has('X-XSRF-TOKEN')
    ).toBe(false);

    httpMock.expectNone('/api/auth/csrf');

    request.flush([]);
  });

  it('adds a server-issued CSRF token to POST requests', () => {
    http.post('/api/users', {}).subscribe();

    const tokenRequest = httpMock.expectOne('/api/auth/csrf');

    expect(tokenRequest.request.method).toBe('GET');

    tokenRequest.flush({
      requestToken: 'csrf-test-token'
    });

    const postRequest = httpMock.expectOne('/api/users');

    expect(postRequest.request.method).toBe('POST');
    expect(
      postRequest.request.headers.get('X-XSRF-TOKEN')
    ).toBe('csrf-test-token');

    postRequest.flush({});
  });

  it('does not attach CSRF tokens to external requests', () => {
    const url = 'https://example.invalid/external';

    http.post(url, {}).subscribe();

    const request = httpMock.expectOne(url);

    expect(
      request.request.headers.has('X-XSRF-TOKEN')
    ).toBe(false);

    httpMock.expectNone('/api/auth/csrf');

    request.flush({});
  });

  it('preserves an explicitly supplied CSRF header', () => {
    http.post(
      '/api/users',
      {},
      {
        headers: {
          'X-XSRF-TOKEN': 'explicit-token'
        }
      }
    ).subscribe();

    const request = httpMock.expectOne('/api/users');

    expect(
      request.request.headers.get('X-XSRF-TOKEN')
    ).toBe('explicit-token');

    httpMock.expectNone('/api/auth/csrf');

    request.flush({});
  });

  it('reuses the token and fetches a new one after clear', () => {
    http.post('/api/users', {}).subscribe();

    httpMock.expectOne('/api/auth/csrf').flush({
      requestToken: 'first-token'
    });

    const first = httpMock.expectOne('/api/users');

    expect(
      first.request.headers.get('X-XSRF-TOKEN')
    ).toBe('first-token');

    first.flush({});

    http.post('/api/users', {}).subscribe();

    httpMock.expectNone('/api/auth/csrf');

    const second = httpMock.expectOne('/api/users');

    expect(
      second.request.headers.get('X-XSRF-TOKEN')
    ).toBe('first-token');

    second.flush({});

    csrf.clear();

    http.post('/api/users', {}).subscribe();

    httpMock.expectOne('/api/auth/csrf').flush({
      requestToken: 'renewed-token'
    });

    const third = httpMock.expectOne('/api/users');

    expect(
      third.request.headers.get('X-XSRF-TOKEN')
    ).toBe('renewed-token');

    third.flush({});
  });
});