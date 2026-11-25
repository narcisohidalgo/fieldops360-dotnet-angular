import { computed, signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { App } from './app';
import { routes } from './app.routes';
import { AuthUser, FieldOpsRole } from './core/models/auth-user';
import { AuthService } from './core/services/auth.service';

describe('App', () => {
  let currentUser: WritableSignal<AuthUser | null>;

  beforeEach(async () => {
    currentUser = signal<AuthUser | null>(null);

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes),
        {
          provide: AuthService,
          useValue: {
            user: currentUser.asReadonly(),
            isAuthenticated: computed(() => currentUser() !== null),
            hasRole: (role: FieldOpsRole) =>
              currentUser()?.roles.includes(role) ?? false,
            loadSession: () => of(null),
            logout: () => of(void 0)
          }
        }
      ]
    }).compileComponents();
  });

  it('should create the application shell', () => {
    const fixture = TestBed.createComponent(App);

    fixture.detectChanges();

    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should register the technicians lazy-loaded route', () => {
    const route = routes.find(
      route => route.path === 'technicians'
    );

    expect(route).toBeDefined();
    expect(route?.title).toBe('Técnicos | FieldOps 360');
    expect(typeof route?.loadComponent).toBe('function');
  });

  it('should register the work orders lazy-loaded route', () => {
    const route = routes.find(
      route => route.path === 'work-orders'
    );

    expect(route).toBeDefined();
    expect(route?.title).toBe('Órdenes de trabajo | FieldOps 360');
    expect(typeof route?.loadComponent).toBe('function');
  });

  it('should protect the My Work Orders route for Technician', () => {
    const route = routes.find(
      item => item.path === 'my-work-orders'
    );

    expect(route).toBeDefined();
    expect(route?.data?.['roles']).toEqual(['Technician']);
    expect(route?.canActivate?.length).toBe(1);
  });

  it('should protect user administration for Administrator', () => {
    const route = routes.find(item => item.path === 'users');

    expect(route).toBeDefined();
    expect(route?.data?.['roles']).toEqual(['Administrator']);
    expect(route?.canActivate?.length).toBe(1);
  });

  it('should display login navigation for anonymous users', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const links = compiled.querySelectorAll('.primary-nav a');

    expect(links.length).toBe(2);
    expect(links[0].getAttribute('href')).toBe('/');
    expect(links[1].getAttribute('href')).toBe('/login');
    expect(compiled.querySelector('router-outlet')).not.toBeNull();
  });

  it('should display all modules for Administrator', () => {
    currentUser.set({
      id: 'test-admin',
      email: 'test@example.invalid',
      displayName: 'Test Administrator',
      technicianId: null,
      roles: ['Administrator']
    });

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const links = Array.from(
      compiled.querySelectorAll<HTMLAnchorElement>(
        '.primary-nav a'
      )
    );

    expect(links.map(link => link.getAttribute('href'))).toEqual([
      '/',
      '/facilities',
      '/assets',
      '/dashboard',
      '/incidents',
      '/technicians',
      '/work-orders',
      '/users'
    ]);

    expect(compiled.textContent).toContain('Test Administrator');
  });

  it('should restrict Technician navigation to basic modules', () => {
    currentUser.set({
      id: 'test-technician',
      email: 'technician@example.invalid',
      displayName: 'Test Technician',
      technicianId: 'test-technician-record',
      roles: ['Technician']
    });

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const links = Array.from(
      compiled.querySelectorAll<HTMLAnchorElement>(
        '.primary-nav a'
      )
    );

    expect(links.map(link => link.getAttribute('href'))).toEqual([
      '/',
      '/facilities',
      '/assets',
      '/my-work-orders'
    ]);
  });
});
