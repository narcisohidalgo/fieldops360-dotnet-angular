import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { HubConnection } from '@microsoft/signalr';

import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { AuthService } from './auth.service';

import {
  REALTIME_CONNECTION_FACTORY,
  REALTIME_RETRY_SCHEDULER,
  RealtimeService
} from './realtime.service';

describe('RealtimeService', () => {
  const authenticated = signal(false);

  const callbacks: {
    reconnecting?: (error?: Error) => void;
    reconnected?: (connectionId?: string) => void;
    closed?: (error?: Error) => void;
    workOrdersChanged?: () => void;
    incidentsChanged?: () => void;
  } = {};

  const connection = {
    start: vi.fn(async () => {}),
    stop: vi.fn(async () => {}),

    on: vi.fn(
      (eventName: string, callback: () => void) => {
        if (eventName === 'WorkOrdersChanged') {
          callbacks.workOrdersChanged = callback;
        } else if (eventName === 'IncidentsChanged') {
          callbacks.incidentsChanged = callback;
        }
      }
    ),

    onreconnecting: vi.fn(
      (callback: (error?: Error) => void) => {
        callbacks.reconnecting = callback;
      }
    ),

    onreconnected: vi.fn(
      (callback: (connectionId?: string) => void) => {
        callbacks.reconnected = callback;
      }
    ),

    onclose: vi.fn(
      (callback: (error?: Error) => void) => {
        callbacks.closed = callback;
      }
    )
  };

  const factory = vi.fn(
    () => connection as unknown as HubConnection
  );

  const scheduledRetry: {
    callback?: () => Promise<void>;
    delayMs?: number;
  } = {};

  const cancelRetry = vi.fn();

  const retryScheduler = vi.fn(
    (callback: () => Promise<void>, delayMs: number) => {
      scheduledRetry.callback = callback;
      scheduledRetry.delayMs = delayMs;
      return cancelRetry;
    }
  );
  let service: RealtimeService;

  beforeEach(() => {
    authenticated.set(false);
    vi.clearAllMocks();
    scheduledRetry.callback = undefined;
    scheduledRetry.delayMs = undefined;

    callbacks.reconnecting = undefined;
    callbacks.reconnected = undefined;
    callbacks.closed = undefined;
    callbacks.workOrdersChanged = undefined;
    callbacks.incidentsChanged = undefined;

    connection.start.mockImplementation(async () => {});
    connection.stop.mockImplementation(async () => {});

    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: {
            isAuthenticated: authenticated.asReadonly()
          }
        },
        {
          provide: REALTIME_CONNECTION_FACTORY,
          useValue: factory
        },
        {
          provide: REALTIME_RETRY_SCHEDULER,
          useValue: retryScheduler
        }
      ]
    });

    service = TestBed.inject(RealtimeService);
  });

  it('starts disconnected', () => {
    expect(service.status()).toBe('disconnected');
    expect(service.error()).toBeNull();
  });

  it('does not connect without authentication', async () => {
    await service.connect();

    expect(factory).not.toHaveBeenCalled();
    expect(connection.start).not.toHaveBeenCalled();
    expect(service.status()).toBe('disconnected');
  });

  it('connects when authenticated', async () => {
    authenticated.set(true);

    await service.connect();

    expect(factory).toHaveBeenCalledTimes(1);
    expect(connection.start).toHaveBeenCalledTimes(1);
    expect(service.status()).toBe('connected');
    expect(service.error()).toBeNull();
  });

  it('avoids duplicate connections', async () => {
    authenticated.set(true);

    await Promise.all([
      service.connect(),
      service.connect(),
      service.connect()
    ]);

    expect(factory).toHaveBeenCalledTimes(1);
    expect(connection.start).toHaveBeenCalledTimes(1);
  });

  it('disconnects and releases the connection', async () => {
    authenticated.set(true);

    await service.connect();
    await service.disconnect();

    expect(connection.stop).toHaveBeenCalledTimes(1);
    expect(service.status()).toBe('disconnected');
    expect(service.error()).toBeNull();
  });

  it('handles connection failures', async () => {
    authenticated.set(true);

    connection.start.mockRejectedValueOnce(
      new Error('Connection rejected')
    );

    await service.connect();

    expect(service.status()).toBe('disconnected');
    expect(service.error()).not.toBeNull();
    expect(connection.stop).toHaveBeenCalledTimes(1);
  });

  it('updates status during automatic reconnection', async () => {
    authenticated.set(true);

    await service.connect();

    callbacks.reconnecting?.();

    expect(service.status()).toBe('reconnecting');

    callbacks.reconnected?.();

    expect(service.status()).toBe('connected');
    expect(service.error()).toBeNull();
  });

  it('disconnects if authentication is lost', async () => {
    authenticated.set(true);

    await service.connect();

    authenticated.set(false);

    await service.connect();

    expect(connection.stop).toHaveBeenCalledTimes(1);
    expect(service.status()).toBe('disconnected');
  });

  it('emits WorkOrdersChanged for authenticated connections', async () => {
    authenticated.set(true);

    let received = 0;
    service.workOrdersChanged$.subscribe(() => received++);

    await service.connect();

    expect(connection.on).toHaveBeenCalledWith(
      'WorkOrdersChanged',
      expect.any(Function)
    );

    callbacks.workOrdersChanged?.();

    expect(received).toBe(1);
  });

  it('refreshes subscribers after SignalR reconnects', async () => {
    authenticated.set(true);

    let received = 0;
    service.workOrdersChanged$.subscribe(() => received++);

    await service.connect();

    callbacks.reconnecting?.();
    callbacks.reconnected?.();

    expect(received).toBe(1);
    expect(service.status()).toBe('connected');
  });

  it('ignores late events after disconnect', async () => {
    authenticated.set(true);

    let received = 0;
    service.workOrdersChanged$.subscribe(() => received++);

    await service.connect();
    await service.disconnect();

    callbacks.workOrdersChanged?.();

    expect(received).toBe(0);
  });
  it('emits IncidentsChanged for authenticated connections', async () => {
    authenticated.set(true);

    let received = 0;

    service.incidentsChanged$.subscribe(() => received++);

    await service.connect();

    expect(connection.on).toHaveBeenCalledWith(
      'IncidentsChanged',
      expect.any(Function)
    );

    callbacks.incidentsChanged?.();

    expect(received).toBe(1);
  });

  it('refreshes incidents after SignalR reconnects', async () => {
    authenticated.set(true);

    let received = 0;

    service.incidentsChanged$.subscribe(() => received++);

    await service.connect();

    callbacks.reconnecting?.();
    callbacks.reconnected?.();

    expect(received).toBe(1);
    expect(service.status()).toBe('connected');
  });

  it('ignores incident events after disconnect', async () => {
    authenticated.set(true);

    let received = 0;

    service.incidentsChanged$.subscribe(() => received++);

    await service.connect();
    await service.disconnect();

    callbacks.incidentsChanged?.();

    expect(received).toBe(0);
  });
  it('emits operational events only for server notifications', async () => {
    authenticated.set(true);

    const events: string[] = [];

    service.operationalEvents$.subscribe(event => {
      events.push(event);
    });

    await service.connect();

    callbacks.workOrdersChanged?.();
    callbacks.incidentsChanged?.();

    expect(events).toEqual([
      'work-orders',
      'incidents'
    ]);

    // La reconexion refresca las tablas, pero no debe
    // crear notificaciones operativas falsas.
    callbacks.reconnecting?.();
    callbacks.reconnected?.();

    expect(events).toEqual([
      'work-orders',
      'incidents'
    ]);
  });

  it('ignores operational events after logout', async () => {
    authenticated.set(true);

    const events: string[] = [];

    service.operationalEvents$.subscribe(event => {
      events.push(event);
    });

    await service.connect();
    await service.disconnect();

    callbacks.workOrdersChanged?.();
    callbacks.incidentsChanged?.();

    expect(events).toEqual([]);
  });
  it('recovers after an initial start failure', async () => {
    authenticated.set(true);

    connection.start.mockRejectedValueOnce(
      new Error('Server unavailable')
    );

    let refreshes = 0;
    let notifications = 0;

    service.workOrdersChanged$.subscribe(() => refreshes++);
    service.operationalEvents$.subscribe(() => notifications++);

    await service.connect();

    expect(service.status()).toBe('disconnected');
    expect(retryScheduler).toHaveBeenCalledTimes(1);
    expect(scheduledRetry.delayMs).toBe(5000);

    await scheduledRetry.callback?.();

    expect(connection.start).toHaveBeenCalledTimes(2);
    expect(service.status()).toBe('connected');
    expect(refreshes).toBe(1);
    expect(notifications).toBe(0);
  });

  it('recovers after reconnect attempts are exhausted', async () => {
    authenticated.set(true);

    let refreshes = 0;
    service.incidentsChanged$.subscribe(() => refreshes++);

    await service.connect();

    callbacks.closed?.(new Error('Reconnect exhausted'));

    expect(service.status()).toBe('disconnected');
    expect(retryScheduler).toHaveBeenCalledTimes(1);

    await scheduledRetry.callback?.();

    expect(factory).toHaveBeenCalledTimes(2);
    expect(service.status()).toBe('connected');
    expect(refreshes).toBe(1);
  });

  it('cancels pending retries after logout', async () => {
    authenticated.set(true);

    connection.start.mockRejectedValueOnce(
      new Error('Server unavailable')
    );

    await service.connect();

    const oldCallback = scheduledRetry.callback;

    authenticated.set(false);
    await service.disconnect();

    expect(cancelRetry).toHaveBeenCalledTimes(1);

    await oldCallback?.();

    expect(connection.start).toHaveBeenCalledTimes(1);
    expect(service.status()).toBe('disconnected');
  });

  it('increases the delay on consecutive failures', async () => {
    authenticated.set(true);

    connection.start
      .mockRejectedValueOnce(new Error('Failure 1'))
      .mockRejectedValueOnce(new Error('Failure 2'));

    await service.connect();

    expect(scheduledRetry.delayMs).toBe(5000);

    await scheduledRetry.callback?.();

    expect(scheduledRetry.delayMs).toBe(10000);

    await scheduledRetry.callback?.();

    expect(service.status()).toBe('connected');
    expect(connection.start).toHaveBeenCalledTimes(3);
  });
  it('handles an unexpected connection closure', async () => {
    authenticated.set(true);

    await service.connect();

    callbacks.closed?.(new Error('Network failure'));

    expect(service.status()).toBe('disconnected');
    expect(service.error()).not.toBeNull();
  });
});