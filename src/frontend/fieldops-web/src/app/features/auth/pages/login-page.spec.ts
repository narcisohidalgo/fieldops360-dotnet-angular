import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { filter, firstValueFrom, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { routes } from '../../../app.routes';
import type {
  AuthUser,
  FieldOpsRole,
  LoginRequest
} from '../../../core/models/auth-user';
import { AuthService } from '../../../core/services/auth.service';
import { CsrfService } from '../../../core/services/csrf.service';
import { LoginPage } from './login-page';

@Component({
  template: '<p>Test destination</p>'
})
class TestDestinationPage {}

describe('LoginPage redirects', () => {
  let user: AuthUser;
  let router: Router;

  const credentials = {
    email: 'audit@example.invalid',
    password: 'TestPassword123!'
  };

  const login = vi.fn(
    (_request: LoginRequest) => of(user)
  );

  beforeEach(() => {
    vi.clearAllMocks();

    user = {
      id: 'audit-login-user',
      email: credentials.email,
      displayName: 'Audit Login User',
      technicianId: null,
      roles: ['Administrator']
    };

    // Use the real dashboard route authorization metadata and guard.
    // Only replace the destination component to isolate login behavior.
    const dashboardRoute = routes.find(
      route => route.path === 'dashboard'
    );

    if (!dashboardRoute) {
      throw new Error('Dashboard route is missing.');
    }

    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: 'login',
            component: LoginPage
          },
          {
            path: 'dashboard',
            component: TestDestinationPage,
            canActivate: dashboardRoute.canActivate,
            data: dashboardRoute.data
          },
          {
            path: 'facilities',
            component: TestDestinationPage
          },
          {
            path: 'access-denied',
            component: TestDestinationPage
          },
          {
            path: '',
            pathMatch: 'full',
            component: TestDestinationPage
          }
        ]),
        {
          provide: AuthService,
          useValue: {
            login,
            loadSession: () => of(user)
          }
        },
        {
          provide: CsrfService,
          useValue: {
            clear: vi.fn()
          }
        }
      ]
    });

    router = TestBed.inject(Router);
  });

  async function submitLogin(
    returnUrl: string | null,
    role: FieldOpsRole = 'Administrator'
  ): Promise<void> {
    user = {
      ...user,
      roles: [role],
      technicianId:
        role === 'Technician'
          ? 'audit-technician-id'
          : null
    };

    const harness = await RouterTestingHarness.create();

    const loginUrl = router.serializeUrl(
      router.createUrlTree(['/login'], {
        queryParams:
          returnUrl === null ? {} : { returnUrl }
      })
    );

    await harness.navigateByUrl(loginUrl, LoginPage);

    await harness.fixture.whenStable();

    const element = harness.routeNativeElement;

    expect(element).not.toBeNull();

    const email = element!.querySelector<HTMLInputElement>(
      '#login-email'
    );

    const password = element!.querySelector<HTMLInputElement>(
      '#login-password'
    );

    const form = element!.querySelector<HTMLFormElement>(
      'form'
    );

    expect(email).not.toBeNull();
    expect(password).not.toBeNull();
    expect(form).not.toBeNull();

    email!.value = credentials.email;
    email!.dispatchEvent(new Event('input', {
      bubbles: true
    }));

    password!.value = credentials.password;
    password!.dispatchEvent(new Event('input', {
      bubbles: true
    }));

    harness.detectChanges();
    await harness.fixture.whenStable();

    const navigation = firstValueFrom(
      router.events.pipe(
        filter(event => event instanceof NavigationEnd)
      )
    );

    // Exercise the actual template and its ngSubmit binding.
    form!.dispatchEvent(new Event('submit', {
      bubbles: true,
      cancelable: true
    }));

    await navigation;
    await harness.fixture.whenStable();

    expect(login).toHaveBeenCalledTimes(1);
    expect(login).toHaveBeenCalledWith(credentials);
  }

  it.each<FieldOpsRole>([
    'Administrator',
    'Supervisor'
  ])('returns %s to the dashboard after login', async role => {
    await submitLogin('/dashboard', role);

    expect(router.url).toBe('/dashboard');
  });

  it('preserves dashboard query parameters and fragment', async () => {
    const destination = '/dashboard?view=open#summary';

    await submitLogin(destination);

    expect(router.url).toBe(destination);
  });

  it('does not bypass dashboard authorization for Technician', async () => {
    await submitLogin('/dashboard', 'Technician');

    expect(router.url).toBe('/access-denied');
  });

  it('preserves previously allowed internal destinations', async () => {
    await submitLogin('/facilities');

    expect(router.url).toBe('/facilities');
  });

  it.each([
    null,
    'https://example.invalid/dashboard',
    '//example.invalid/dashboard',
    '/dashboard-extra',
    '/dashboard/details',
    '/login',
    '/unknown',
    'javascript:alert(1)'
  ])('falls back to home for invalid returnUrl: %s', async returnUrl => {
    await submitLogin(returnUrl);

    expect(router.url).toBe('/');
  });
});
