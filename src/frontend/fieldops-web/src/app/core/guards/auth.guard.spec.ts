import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree
} from '@angular/router';
import {
  firstValueFrom,
  Observable,
  of,
  throwError
} from 'rxjs';
import {
  beforeEach,
  describe,
  expect,
  it
} from 'vitest';

import { authGuard } from './auth.guard';
import {
  AuthUser,
  FieldOpsRole
} from '../models/auth-user';
import { AuthService } from '../services/auth.service';

describe('authGuard', () => {
  let router: Router;
  let sessionResult: Observable<AuthUser | null>;

  const administrator: AuthUser = {
    id: 'test-admin',
    email: 'admin@example.invalid',
    displayName: 'Administrador de prueba',
    technicianId: null,
    roles: ['Administrator']
  };

  const supervisor: AuthUser = {
    id: 'test-supervisor',
    email: 'supervisor@example.invalid',
    displayName: 'Supervisor de prueba',
    technicianId: null,
    roles: ['Supervisor']
  };

  const technician: AuthUser = {
    id: 'test-technician',
    email: 'technician@example.invalid',
    displayName: 'Tecnico de prueba',
    technicianId: 'test-technician-record',
    roles: ['Technician']
  };

  beforeEach(() => {
    sessionResult = of(null);

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            loadSession: () => sessionResult
          }
        }
      ]
    });

    router = TestBed.inject(Router);
  });

  function evaluate(
    roles: readonly FieldOpsRole[] | undefined,
    url: string
  ): Promise<boolean | UrlTree> {
    const route = {
      data: roles === undefined ? {} : { roles }
    } as unknown as ActivatedRouteSnapshot;

    const state = {
      url
    } as RouterStateSnapshot;

    const result = TestBed.runInInjectionContext(
      () => authGuard(route, state)
    ) as Observable<boolean | UrlTree>;

    return firstValueFrom(result);
  }

  it('redirects anonymous users to login with returnUrl', async () => {
    const result = await evaluate(
      ['Administrator'],
      '/users'
    );

    expect(result).toBeInstanceOf(UrlTree);

    if (result instanceof UrlTree) {
      expect(router.serializeUrl(result))
        .toContain('/login?');

      expect(result.queryParams['returnUrl'])
        .toBe('/users');
    }
  });

  it('allows Administrator to access user management', async () => {
    sessionResult = of(administrator);

    const result = await evaluate(
      ['Administrator'],
      '/users'
    );

    expect(result).toBe(true);
  });

  it('denies Supervisor access to user management', async () => {
    sessionResult = of(supervisor);

    const result = await evaluate(
      ['Administrator'],
      '/users'
    );

    expect(result instanceof UrlTree).toBe(true);

    if (result instanceof UrlTree) {
      expect(router.serializeUrl(result))
        .toBe('/access-denied');
    }
  });

  it('allows Technician to access assigned orders page', async () => {
    sessionResult = of(technician);

    const result = await evaluate(
      ['Technician'],
      '/my-work-orders'
    );

    expect(result).toBe(true);
  });

  it('denies Technician access to general work orders', async () => {
    sessionResult = of(technician);

    const result = await evaluate(
      ['Administrator', 'Supervisor'],
      '/work-orders'
    );

    expect(result instanceof UrlTree).toBe(true);

    if (result instanceof UrlTree) {
      expect(router.serializeUrl(result))
        .toBe('/access-denied');
    }
  });

  it('denies routes without declared roles', async () => {
    sessionResult = of(administrator);

    const result = await evaluate(
      undefined,
      '/protected-without-roles'
    );

    expect(result instanceof UrlTree).toBe(true);

    if (result instanceof UrlTree) {
      expect(router.serializeUrl(result))
        .toBe('/access-denied');
    }
  });

  it('denies routes with an empty roles list', async () => {
    sessionResult = of(administrator);

    const result = await evaluate(
      [],
      '/protected-with-empty-roles'
    );

    expect(result instanceof UrlTree).toBe(true);

    if (result instanceof UrlTree) {
      expect(router.serializeUrl(result))
        .toBe('/access-denied');
    }
  });

  it('redirects to login when session verification fails', async () => {
    sessionResult = throwError(
      () => new Error('Backend unavailable')
    );

    const result = await evaluate(
      ['Administrator'],
      '/users'
    );

    expect(result instanceof UrlTree).toBe(true);

    if (result instanceof UrlTree) {
      expect(router.serializeUrl(result))
        .toContain('/login?');

      expect(result.queryParams['returnUrl'])
        .toBe('/users');
    }
  });
});