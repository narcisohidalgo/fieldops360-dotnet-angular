import { signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';

import { AuthUser } from '../models/auth-user';
import { AuthService } from './auth.service';
import {
  OperationalRealtimeEvent,
  RealtimeService
} from './realtime.service';
import {
  OperationalNotificationsService
} from './operational-notifications.service';

describe('OperationalNotificationsService', () => {
  let currentUser: WritableSignal<AuthUser | null>;
  let realtimeEvents: Subject<OperationalRealtimeEvent>;
  let service: OperationalNotificationsService;

  const admin: AuthUser = {
    id: 'admin-1',
    email: 'admin@example.invalid',
    displayName: 'Administrador',
    technicianId: null,
    roles: ['Administrator']
  };

  const supervisor: AuthUser = {
    id: 'supervisor-1',
    email: 'supervisor@example.invalid',
    displayName: 'Supervisor',
    technicianId: null,
    roles: ['Supervisor']
  };

  const technician: AuthUser = {
    id: 'technician-1',
    email: 'technician@example.invalid',
    displayName: 'Técnico',
    technicianId: 'technician-record-1',
    roles: ['Technician']
  };

  beforeEach(() => {
    currentUser = signal<AuthUser | null>(null);
    realtimeEvents = new Subject<OperationalRealtimeEvent>();

    TestBed.configureTestingModule({
      providers: [
        OperationalNotificationsService,
        {
          provide: AuthService,
          useValue: {
            user: currentUser.asReadonly()
          }
        },
        {
          provide: RealtimeService,
          useValue: {
            operationalEvents$: realtimeEvents.asObservable()
          }
        }
      ]
    });

    service = TestBed.inject(
      OperationalNotificationsService
    );

    TestBed.tick();
  });

  function authenticate(user: AuthUser): void {
    currentUser.set(user);
    TestBed.tick();
  }

  function notify(kind: OperationalRealtimeEvent): void {
    realtimeEvents.next(kind);
  }

  it('starts with an empty notification history', () => {
    expect(service.notifications()).toEqual([]);
    expect(service.unreadCount()).toBe(0);
  });

  it('ignores events for anonymous users', () => {
    notify('incidents');
    notify('work-orders');

    expect(service.notifications()).toEqual([]);
  });

  it('does not expose notifications to technicians', () => {
    authenticate(technician);

    notify('work-orders');
    notify('incidents');

    expect(service.notifications()).toEqual([]);
    expect(service.unreadCount()).toBe(0);
  });

  it('receives both operational events for administrators', () => {
    authenticate(admin);

    notify('work-orders');
    notify('incidents');

    expect(service.notifications()).toHaveLength(2);
    expect(service.unreadCount()).toBe(2);

    expect(service.notifications()[0]).toMatchObject({
      kind: 'incidents',
      title: 'Incidencias actualizadas',
      read: false
    });

    expect(service.notifications()[1]).toMatchObject({
      kind: 'work-orders',
      title: 'Órdenes de trabajo actualizadas',
      read: false
    });

    expect(
      Number.isNaN(
        Date.parse(service.notifications()[0].receivedAt)
      )
    ).toBe(false);
  });

  it('receives operational events for supervisors', () => {
    authenticate(supervisor);

    notify('incidents');

    expect(service.notifications()).toHaveLength(1);
    expect(service.unreadCount()).toBe(1);
  });

  it('keeps only the 20 most recent notifications', () => {
    authenticate(admin);

    for (let index = 0; index < 25; index++) {
      notify('work-orders');
    }

    expect(service.notifications()).toHaveLength(20);
    expect(service.unreadCount()).toBe(20);

    expect(service.notifications()[0].id).toBe(25);
    expect(service.notifications()[19].id).toBe(6);
  });

  it('marks a single notification as read', () => {
    authenticate(admin);

    notify('work-orders');
    notify('incidents');

    const id = service.notifications()[0].id;

    service.markAsRead(id);

    expect(service.unreadCount()).toBe(1);
    expect(service.notifications()[0].read).toBe(true);
    expect(service.notifications()[1].read).toBe(false);
  });

  it('marks all notifications as read', () => {
    authenticate(admin);

    notify('work-orders');
    notify('incidents');

    service.markAllAsRead();

    expect(service.unreadCount()).toBe(0);
    expect(
      service.notifications().every(item => item.read)
    ).toBe(true);
  });

  it('clears the notification history on request', () => {
    authenticate(admin);

    notify('incidents');

    service.clear();

    expect(service.notifications()).toEqual([]);
    expect(service.unreadCount()).toBe(0);
  });

  it('clears notifications after logout', () => {
    authenticate(admin);

    notify('work-orders');

    expect(service.notifications()).toHaveLength(1);

    currentUser.set(null);
    TestBed.tick();

    expect(service.notifications()).toEqual([]);
    expect(service.unreadCount()).toBe(0);
  });

  it('clears notifications when the user changes', () => {
    authenticate(admin);

    notify('incidents');

    authenticate(supervisor);

    expect(service.notifications()).toEqual([]);

    notify('work-orders');

    expect(service.notifications()).toHaveLength(1);
    expect(service.notifications()[0].kind).toBe(
      'work-orders'
    );
  });

  it('keeps notifications when the same session is refreshed', () => {
    authenticate(admin);

    notify('incidents');

    currentUser.set({ ...admin });
    TestBed.tick();

    expect(service.notifications()).toHaveLength(1);
    expect(service.unreadCount()).toBe(1);
  });

  it('does not collect events after logout', () => {
    authenticate(admin);

    notify('work-orders');

    currentUser.set(null);
    TestBed.tick();

    notify('incidents');

    expect(service.notifications()).toEqual([]);
    expect(service.unreadCount()).toBe(0);
  });
});