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

import { AuthUser } from '../models/auth-user';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let auth: AuthService;
  let httpMock: HttpTestingController;

  const user: AuthUser = {
    id: '00000000-0000-0000-0000-000000000101',
    email: 'administrator@example.invalid',
    displayName: 'Administrator de prueba',
    technicianId: null,
    roles: ['Administrator']
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });

    auth = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  function signIn(): void {
    auth.login({
      email: user.email,
      password: 'OnlyForUnitTests123!'
    }).subscribe();

    httpMock.expectOne('/api/auth/csrf').flush({
      requestToken: 'login-csrf-token'
    });

    httpMock.expectOne('/api/auth/login').flush(user);
  }

  it('restores a valid session from the backend', () => {
    let result: AuthUser | null | undefined;

    auth.loadSession().subscribe(value => {
      result = value;
    });

    const request = httpMock.expectOne('/api/auth/me');

    expect(request.request.method).toBe('GET');

    request.flush(user);

    expect(result).toEqual(user);
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.hasRole('Administrator')).toBe(true);
    expect(auth.hasRole('Technician')).toBe(false);
  });

  it('treats HTTP 401 as an anonymous session', () => {
    let result: AuthUser | null | undefined;

    auth.loadSession().subscribe(value => {
      result = value;
    });

    httpMock.expectOne('/api/auth/me').flush(
      { title: 'Unauthorized' },
      {
        status: 401,
        statusText: 'Unauthorized'
      }
    );

    expect(result).toBeNull();
    expect(auth.user()).toBeNull();
    expect(auth.isAuthenticated()).toBe(false);
  });

  it('logs in using a server-issued CSRF token', () => {
    let result: AuthUser | undefined;

    const credentials = {
      email: user.email,
      password: 'OnlyForUnitTests123!'
    };

    auth.login(credentials).subscribe(value => {
      result = value;
    });

    const csrfRequest = httpMock.expectOne(
      '/api/auth/csrf'
    );

    expect(csrfRequest.request.method).toBe('GET');

    csrfRequest.flush({
      requestToken: 'anonymous-csrf-token'
    });

    const loginRequest = httpMock.expectOne(
      '/api/auth/login'
    );

    expect(loginRequest.request.method).toBe('POST');
    expect(loginRequest.request.body).toEqual(credentials);
    expect(
      loginRequest.request.headers.get('X-XSRF-TOKEN')
    ).toBe('anonymous-csrf-token');

    loginRequest.flush(user);

    expect(result).toEqual(user);
    expect(auth.user()).toEqual(user);
    expect(auth.isAuthenticated()).toBe(true);
  });

  it('renews CSRF and clears the session after logout', () => {
    signIn();

    expect(auth.isAuthenticated()).toBe(true);

    let completed = false;

    auth.logout().subscribe(() => {
      completed = true;
    });

    const csrfRequest = httpMock.expectOne(
      '/api/auth/csrf'
    );

    csrfRequest.flush({
      requestToken: 'authenticated-csrf-token'
    });

    const logoutRequest = httpMock.expectOne(
      '/api/auth/logout'
    );

    expect(logoutRequest.request.method).toBe('POST');

    expect(
      logoutRequest.request.headers.get('X-XSRF-TOKEN')
    ).toBe('authenticated-csrf-token');

    logoutRequest.flush(null, {
      status: 204,
      statusText: 'No Content'
    });

    expect(completed).toBe(true);
    expect(auth.user()).toBeNull();
    expect(auth.isAuthenticated()).toBe(false);
  });

  it('clears stale identity after a session server error', () => {
    signIn();

    expect(auth.isAuthenticated()).toBe(true);

    let receivedError: unknown;

    auth.loadSession().subscribe({
      error: error => {
        receivedError = error;
      }
    });

    httpMock.expectOne('/api/auth/me').flush(
      { title: 'Service unavailable' },
      {
        status: 503,
        statusText: 'Service Unavailable'
      }
    );

    expect(receivedError).toBeInstanceOf(
      HttpErrorResponse
    );

    expect(auth.user()).toBeNull();
    expect(auth.isAuthenticated()).toBe(false);
  });

  it('clears local identity when logout returns HTTP 401', () => {
    signIn();

    let completed = false;

    auth.logout().subscribe(() => {
      completed = true;
    });

    httpMock.expectOne('/api/auth/csrf').flush({
      requestToken: 'logout-csrf-token'
    });

    const logoutRequest = httpMock.expectOne(
      '/api/auth/logout'
    );

    expect(
      logoutRequest.request.headers.get('X-XSRF-TOKEN')
    ).toBe('logout-csrf-token');

    logoutRequest.flush(
      { title: 'Unauthorized' },
      {
        status: 401,
        statusText: 'Unauthorized'
      }
    );

    expect(completed).toBe(true);
    expect(auth.user()).toBeNull();
    expect(auth.isAuthenticated()).toBe(false);
  });
});