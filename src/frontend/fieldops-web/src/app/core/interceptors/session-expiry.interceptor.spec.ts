import {
  HttpClient,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { AuthUser } from '../models/auth-user';
import { AuthService } from '../services/auth.service';
import { CsrfService } from '../services/csrf.service';
import { csrfInterceptor } from './csrf.interceptor';
import { sessionExpiryInterceptor } from './session-expiry.interceptor';

describe('sessionExpiryInterceptor', () => {
  let auth: AuthService;
  let csrf: CsrfService;
  let http: HttpClient;
  let httpMock: HttpTestingController;

  const user: AuthUser = {
    id: 'audit-session-user',
    email: 'audit@example.invalid',
    displayName: 'Audit Administrator',
    technicianId: null,
    roles: ['Administrator']
  };

  const credentials = {
    email: user.email,
    password: 'OnlyForUnitTests123!'
  };

  const router = {
    url: '/dashboard?view=open',
    navigate: vi.fn(async () => true)
  };

  beforeEach(() => {
    vi.clearAllMocks();

    router.url = '/dashboard?view=open';

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([
          sessionExpiryInterceptor,
          csrfInterceptor
        ])),
        provideHttpClientTesting(),
        { provide: Router, useValue: router }
      ]
    });

    auth = TestBed.inject(AuthService);
    csrf = TestBed.inject(CsrfService);
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  function signIn(account: AuthUser = user): void {
    auth.login(credentials).subscribe();

    httpMock.expectOne('/api/auth/csrf').flush({
      requestToken: 'login-token'
    });

    httpMock.expectOne('/api/auth/login').flush(account);

    expect(auth.isAuthenticated()).toBe(true);
  }

  function unauthorized(request: TestRequest): void {
    request.flush(
      { title: 'Unauthorized' },
      {
        status: 401,
        statusText: 'Unauthorized'
      }
    );
  }

  function beginGet(url: string) {
    const errors: unknown[] = [];

    http.get(url).subscribe({
      error: error => errors.push(error)
    });

    return {
      errors,
      request: httpMock.expectOne(url)
    };
  }

  function expectRedirect(): void {
    expect(router.navigate).toHaveBeenCalledTimes(1);

    expect(router.navigate).toHaveBeenCalledWith(
      ['/login'],
      {
        queryParams: {
          returnUrl: '/dashboard?view=open'
        },
        replaceUrl: true
      }
    );
  }

  it.each([
    '/api/dashboard/summary',
    '/api/facilities',
    '/api/assets',
    '/api/incidents',
    '/api/technicians',
    '/api/work-orders',
    '/api/my/work-orders',
    '/api/users'
  ])('invalidates an authenticated session on 401 from %s', url => {
    signIn();

    // Cache a token associated with the authenticated user.
    csrf.getToken().subscribe();

    httpMock.expectOne('/api/auth/csrf').flush({
      requestToken: 'authenticated-token'
    });

    const operation = beginGet(url);

    unauthorized(operation.request);

    expect(auth.user()).toBeNull();
    expect(auth.isAuthenticated()).toBe(false);
    expectRedirect();

    expect(operation.errors).toHaveLength(1);
    expect(operation.errors[0]).toBeInstanceOf(HttpErrorResponse);
    expect(operation.errors[0]).toMatchObject({ status: 401 });

    // The authenticated CSRF token must not be reused.
    let freshToken: string | undefined;

    csrf.getToken().subscribe(token => {
      freshToken = token;
    });

    httpMock.expectOne('/api/auth/csrf').flush({
      requestToken: 'fresh-anonymous-token'
    });

    expect(freshToken).toBe('fresh-anonymous-token');
  });

  it('preserves CSRF protection and handles a rejected POST without retrying', () => {
    signIn();

    const errors: unknown[] = [];

    http.post('/api/incidents', {
      title: 'Test incident'
    }).subscribe({
      error: error => errors.push(error)
    });

    httpMock.expectOne('/api/auth/csrf').flush({
      requestToken: 'mutation-token'
    });

    const request = httpMock.expectOne('/api/incidents');

    expect(request.request.method).toBe('POST');

    expect(
      request.request.headers.get('X-XSRF-TOKEN')
    ).toBe('mutation-token');

    unauthorized(request);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ status: 401 });
    expect(auth.user()).toBeNull();
    expectRedirect();

    httpMock.expectNone('/api/incidents');
    httpMock.expectNone('/api/auth/logout');
  });

  it('invalidates only once for concurrent 401 responses', () => {
    signIn();

    const first = beginGet('/api/assets');
    const second = beginGet('/api/facilities');
    const third = beginGet('/api/dashboard/summary');

    unauthorized(first.request);
    unauthorized(second.request);
    unauthorized(third.request);

    expect(auth.user()).toBeNull();
    expectRedirect();

    for (const operation of [first, second, third]) {
      expect(operation.errors).toHaveLength(1);
      expect(operation.errors[0]).toMatchObject({ status: 401 });
    }
  });

  it('does not invalidate a newer login when an old request returns 401', () => {
    signIn();

    const oldRequest = beginGet('/api/assets');

    const freshUser = {
      ...user,
      displayName: 'Fresh session'
    };

    // The same user authenticates again.
    signIn(freshUser);

    unauthorized(oldRequest.request);

    expect(auth.user()).toEqual(freshUser);
    expect(auth.isAuthenticated()).toBe(true);
    expect(router.navigate).not.toHaveBeenCalled();

    expect(oldRequest.errors[0]).toMatchObject({ status: 401 });
  });

  it('does not restore an invalidated identity from a stale verification', () => {
    signIn();

    let restored: AuthUser | null | undefined;

    auth.loadSession().subscribe(value => {
      restored = value;
    });

    const oldVerification =
      httpMock.expectOne('/api/auth/me');

    const operation = beginGet('/api/assets');

    unauthorized(operation.request);

    oldVerification.flush(user);

    expect(restored).toBeNull();
    expect(auth.user()).toBeNull();
    expectRedirect();
  });

  it('does not clear a fresh login from a stale session verification error', () => {
    signIn();

    let verified: AuthUser | null | undefined;

    auth.loadSession().subscribe(value => {
      verified = value;
    });

    const oldVerification =
      httpMock.expectOne('/api/auth/me');

    const freshUser = {
      ...user,
      displayName: 'New login'
    };

    signIn(freshUser);

    unauthorized(oldVerification);

    expect(verified).toEqual(freshUser);
    expect(auth.user()).toEqual(freshUser);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('does not mask a current 401 after a successful same-user verification', () => {
    signIn();

    const operation = beginGet('/api/assets');

    auth.loadSession().subscribe();

    httpMock.expectOne('/api/auth/me').flush({
      ...user
    });

    expect(auth.isAuthenticated()).toBe(true);

    unauthorized(operation.request);

    expect(auth.user()).toBeNull();
    expectRedirect();
  });

  it.each([403, 500])(
    'preserves authentication for HTTP %s',
    status => {
      signIn();

      const operation = beginGet('/api/assets');

      operation.request.flush(
        { title: 'Request failed' },
        { status, statusText: 'Request failed' }
      );

      expect(auth.user()).toEqual(user);
      expect(router.navigate).not.toHaveBeenCalled();
      expect(operation.errors[0]).toMatchObject({ status });
    }
  );

  it('preserves authentication after a network failure', () => {
    signIn();

    const operation = beginGet('/api/assets');

    operation.request.error(new ProgressEvent('error'));

    expect(auth.user()).toEqual(user);
    expect(router.navigate).not.toHaveBeenCalled();

    expect(operation.errors[0]).toMatchObject({ status: 0 });
  });

  it.each([
    '/api/auth/login',
    '/api/auth/me',
    '/api/auth/logout',
    '/api/auth/csrf',
    '/api/system/status',
    '/weatherforecast',
    'https://external.invalid/api/assets',
    '//external.invalid/api/assets',
    '/api/assets-extra'
  ])('does not apply global invalidation to %s', url => {
    signIn();

    const operation = beginGet(url);

    unauthorized(operation.request);

    expect(auth.user()).toEqual(user);
    expect(router.navigate).not.toHaveBeenCalled();
    expect(operation.errors[0]).toMatchObject({ status: 401 });
  });

  it('leaves invalid login credentials to the authentication service', () => {
    const errors: unknown[] = [];

    auth.login(credentials).subscribe({
      error: error => errors.push(error)
    });

    httpMock.expectOne('/api/auth/csrf').flush({
      requestToken: 'anonymous-token'
    });

    unauthorized(httpMock.expectOne('/api/auth/login'));

    expect(auth.user()).toBeNull();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ status: 401 });
  });

  it('does not redirect an already anonymous user repeatedly', () => {
    const operation = beginGet('/api/assets');

    unauthorized(operation.request);

    expect(auth.user()).toBeNull();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(operation.errors[0]).toMatchObject({ status: 401 });
  });

  it('does not navigate again when already on the login page', () => {
    signIn();

    router.url = '/login?returnUrl=%2Fdashboard';

    const operation = beginGet('/api/assets');

    unauthorized(operation.request);

    expect(auth.user()).toBeNull();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(operation.errors[0]).toMatchObject({ status: 401 });
  });
});
