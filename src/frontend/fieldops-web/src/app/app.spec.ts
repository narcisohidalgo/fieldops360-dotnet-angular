import { computed, signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { App } from './app';
import { routes } from './app.routes';
import { AuthUser, FieldOpsRole } from './core/models/auth-user';
import { AuthService } from './core/services/auth.service';
import { RealtimeService } from './core/services/realtime.service';
import {
  OperationalNotificationsService,
  type OperationalNotification
} from './core/services/operational-notifications.service';

describe('App', () => {
  let currentUser: WritableSignal<AuthUser | null>;
  let notificationItems: WritableSignal<OperationalNotification[]>;

  const adminUser: AuthUser = {
    id: 'notifications-admin',
    email: 'admin@example.invalid',
    displayName: 'Test Administrator',
    technicianId: null,
    roles: ['Administrator']
  };

  const sampleNotification: OperationalNotification = {
    id: 1,
    kind: 'incidents',
    title: 'Incidencias actualizadas',
    message: 'Se han registrado cambios en las incidencias.',
    receivedAt: '2026-11-25T10:00:00.000Z',
    read: false
  };

  const notificationActions = {
    markAsRead: vi.fn((id: number) => {
      notificationItems.update(items =>
        items.map(item =>
          item.id === id ? { ...item, read: true } : item
        )
      );
    }),
    markAllAsRead: vi.fn(() => {
      notificationItems.update(items =>
        items.map(item => ({ ...item, read: true }))
      );
    }),
    clear: vi.fn(() => notificationItems.set([]))
  };
  const realtime = {
    connect: vi.fn(async () => {}),
    disconnect: vi.fn(async () => {})
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    currentUser = signal<AuthUser | null>(null);
    notificationItems = signal<OperationalNotification[]>([]);

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes),
        {
          provide: RealtimeService,
          useValue: realtime
        },
        {
          provide: OperationalNotificationsService,
          useValue: {
            notifications: notificationItems.asReadonly(),
            unreadCount: computed(() =>
              notificationItems().filter(item => !item.read).length
            ),
            markAsRead: notificationActions.markAsRead,
            markAllAsRead: notificationActions.markAllAsRead,
            clear: notificationActions.clear
          }
        },
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

  it('does not connect SignalR for an anonymous visitor', async () => {
    const fixture = TestBed.createComponent(App);

    fixture.detectChanges();
    await fixture.whenStable();

    expect(realtime.connect).not.toHaveBeenCalled();
    expect(realtime.disconnect).toHaveBeenCalledTimes(1);
  });

  it('connects SignalR for an authenticated user', async () => {
    currentUser.set({
      id: 'realtime-admin',
      email: 'admin@example.invalid',
      displayName: 'Realtime Administrator',
      technicianId: null,
      roles: ['Administrator']
    });

    const fixture = TestBed.createComponent(App);

    fixture.detectChanges();
    await fixture.whenStable();

    expect(realtime.connect).toHaveBeenCalledTimes(1);
    expect(realtime.disconnect).not.toHaveBeenCalled();
  });

  it('disconnects SignalR when authentication is lost', async () => {
    currentUser.set({
      id: 'realtime-admin',
      email: 'admin@example.invalid',
      displayName: 'Realtime Administrator',
      technicianId: null,
      roles: ['Administrator']
    });

    const fixture = TestBed.createComponent(App);

    fixture.detectChanges();
    await fixture.whenStable();

    expect(realtime.connect).toHaveBeenCalledTimes(1);

    // Simular la invalidacion de la sesion tras logout.
    currentUser.set(null);

    fixture.detectChanges();
    await fixture.whenStable();

    expect(realtime.disconnect).toHaveBeenCalledTimes(1);
  });
  it('hides notifications from anonymous visitors', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(
      element.querySelector('.notifications-trigger')
    ).toBeNull();
  });

  it('hides notifications from technicians', () => {
    currentUser.set({
      ...adminUser,
      id: 'notifications-technician',
      technicianId: 'technician-record',
      roles: ['Technician']
    });

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(
      element.querySelector('.notifications-trigger')
    ).toBeNull();
  });

  it('shows the bell and unread count for administrators', () => {
    currentUser.set(adminUser);
    notificationItems.set([sampleNotification]);

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    const trigger = element.querySelector<HTMLButtonElement>(
      '.notifications-trigger'
    );

    expect(trigger).not.toBeNull();
    expect(trigger?.getAttribute('aria-label')).toContain(
      '1 sin leer'
    );

    trigger!.click();
    fixture.detectChanges();

    expect(
      element.querySelector('.notifications-panel')
    ).not.toBeNull();

    expect(element.textContent).toContain(
      'Incidencias actualizadas'
    );

    expect(
      element.querySelector<HTMLAnchorElement>(
        '.notification-link'
      )?.getAttribute('href')
    ).toBe('/incidents');
  });

  it('shows notifications for supervisors', () => {
    currentUser.set({
      ...adminUser,
      id: 'notifications-supervisor',
      roles: ['Supervisor']
    });

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(
      element.querySelector('.notifications-trigger')
    ).not.toBeNull();
  });

  it('marks all notifications read and clears history', () => {
    currentUser.set(adminUser);

    notificationItems.set([
      sampleNotification,
      {
        ...sampleNotification,
        id: 2,
        kind: 'work-orders',
        title: 'Órdenes de trabajo actualizadas'
      }
    ]);

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    element.querySelector<HTMLButtonElement>(
      '.notifications-trigger'
    )!.click();

    fixture.detectChanges();

    element.querySelector<HTMLButtonElement>(
      '.notification-action'
    )!.click();

    fixture.detectChanges();

    expect(
      notificationActions.markAllAsRead
    ).toHaveBeenCalledTimes(1);

    expect(
      element.querySelector('.notification-count')
    ).toBeNull();

    element.querySelector<HTMLButtonElement>(
      '.notification-clear'
    )!.click();

    fixture.detectChanges();

    expect(notificationActions.clear).toHaveBeenCalledTimes(1);

    expect(element.textContent).toContain(
      'Todavía no hay avisos recientes.'
    );
  });

  it('marks a notification read when its link is opened', () => {
    currentUser.set(adminUser);
    notificationItems.set([sampleNotification]);

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    element.querySelector<HTMLButtonElement>(
      '.notifications-trigger'
    )!.click();

    fixture.detectChanges();

    const link = element.querySelector<HTMLAnchorElement>(
      '.notification-link'
    );

    expect(link).not.toBeNull();

    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      button: 1
    });

    // Prevent native document navigation in jsdom.
    // This test verifies notification handling, not browser navigation.
    clickEvent.preventDefault();

    link!.dispatchEvent(clickEvent);

    fixture.detectChanges();

    expect(notificationActions.markAsRead)
      .toHaveBeenCalledWith(1);

    expect(notificationItems()[0].read).toBe(true);

    expect(
      element.querySelector('.notifications-panel')
    ).toBeNull();
  });

  it('closes the panel when authentication is lost', () => {
    currentUser.set(adminUser);

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    element.querySelector<HTMLButtonElement>(
      '.notifications-trigger'
    )!.click();

    fixture.detectChanges();

    expect(
      element.querySelector('.notifications-panel')
    ).not.toBeNull();

    currentUser.set(null);
    fixture.detectChanges();

    expect(
      element.querySelector('.notifications-panel')
    ).toBeNull();
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
