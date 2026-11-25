import { Injectable, InjectionToken, inject, signal } from '@angular/core';

import {
  HubConnectionBuilder,
  LogLevel,
  type HubConnection
} from '@microsoft/signalr';

import { Subject } from 'rxjs';
import { AuthService } from './auth.service';

export type OperationalRealtimeEvent = 'work-orders' | 'incidents';

export type RealtimeStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting';

export const REALTIME_CONNECTION_FACTORY =
  new InjectionToken<() => HubConnection>(
    'FieldOpsRealtimeConnectionFactory',
    {
      providedIn: 'root',
      factory: () => () =>
        new HubConnectionBuilder()
          .withUrl('/hubs/operations')
          .withAutomaticReconnect([0, 2000, 10000, 30000])
          .configureLogging(LogLevel.Warning)
          .build()
    }
  );

export type RealtimeRetryScheduler = (
  callback: () => Promise<void>,
  delayMs: number
) => () => void;

export const REALTIME_RETRY_SCHEDULER =
  new InjectionToken<RealtimeRetryScheduler>(
    'FieldOpsRealtimeRetryScheduler',
    {
      providedIn: 'root',
      factory: () => (callback, delayMs) => {
        const timer = setTimeout(() => {
          void callback();
        }, delayMs);

        return () => clearTimeout(timer);
      }
    }
  );
@Injectable({
  providedIn: 'root'
})
export class RealtimeService {
  private readonly auth = inject(AuthService);
  private readonly createConnection =
    inject(REALTIME_CONNECTION_FACTORY);
  private readonly scheduleRetry = inject(REALTIME_RETRY_SCHEDULER);

  private readonly workOrdersChangedSubject = new Subject<void>();
  private readonly incidentsChangedSubject = new Subject<void>();

  private readonly operationalEventsSubject =
    new Subject<OperationalRealtimeEvent>();

  readonly workOrdersChanged$ =
    this.workOrdersChangedSubject.asObservable();

  readonly incidentsChanged$ =
    this.incidentsChangedSubject.asObservable();

  // Solo eventos recibidos realmente del backend.
  // No se emiten durante una reconexion.
  readonly operationalEvents$ =
    this.operationalEventsSubject.asObservable();

  private connection: HubConnection | null = null;
  private desiredConnected = false;
  private retryCount = 0;
  private cancelScheduledRetry: (() => void) | null = null;

  // Serializar start/stop para evitar operaciones simultaneas.
  private pendingOperation: Promise<void> = Promise.resolve();

  private readonly statusSignal =
    signal<RealtimeStatus>('disconnected');

  private readonly errorSignal = signal<string | null>(null);

  readonly status = this.statusSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  connect(): Promise<void> {
    if (!this.auth.isAuthenticated()) {
      return this.disconnect();
    }

    this.desiredConnected = true;
    this.cancelRetry();

    return this.enqueue(async () => {
      if (
        !this.desiredConnected ||
        !this.auth.isAuthenticated() ||
        this.connection
      ) {
        return;
      }

      const connection = this.createConnection();
      this.connection = connection;

      this.statusSignal.set('connecting');
      this.errorSignal.set(null);

      connection.on('WorkOrdersChanged', () => {
        if (
          this.connection === connection &&
          this.desiredConnected &&
          this.auth.isAuthenticated()
        ) {
          this.workOrdersChangedSubject.next();
          this.operationalEventsSubject.next('work-orders');
        }
      });

      connection.on('IncidentsChanged', () => {
        if (
          this.connection === connection &&
          this.desiredConnected &&
          this.auth.isAuthenticated()
        ) {
          this.incidentsChangedSubject.next();
          this.operationalEventsSubject.next('incidents');
        }
      });
      connection.onreconnecting(() => {
        if (
          this.connection === connection &&
          this.desiredConnected
        ) {
          this.statusSignal.set('reconnecting');
        }
      });

      connection.onreconnected(() => {
        if (this.connection !== connection) {
          return;
        }

        if (
          !this.desiredConnected ||
          !this.auth.isAuthenticated()
        ) {
          void this.disconnect();
          return;
        }

        this.statusSignal.set('connected');
        this.errorSignal.set(null);

        this.retryCount = 0;

        // Recuperar posibles cambios perdidos durante la desconexion.
        this.workOrdersChangedSubject.next();
        this.incidentsChangedSubject.next();
      });

      connection.onclose(() => {
        if (this.connection !== connection) {
          return;
        }

        this.connection = null;
        this.statusSignal.set('disconnected');

        if (
          this.desiredConnected &&
          this.auth.isAuthenticated()
        ) {
          this.errorSignal.set(
            'Se ha perdido la conexión en tiempo real.'
          );
          this.planRetry();
        }
      });

      try {
        await connection.start();

        if (
          this.connection === connection &&
          this.desiredConnected &&
          this.auth.isAuthenticated()
        ) {
          this.statusSignal.set('connected');
          this.errorSignal.set(null);

          if (this.retryCount > 0) {
            this.workOrdersChangedSubject.next();
            this.incidentsChangedSubject.next();
          }

          this.retryCount = 0;
        }
      } catch {
        if (this.connection === connection) {
          this.connection = null;
          this.statusSignal.set('disconnected');

          this.errorSignal.set(
            'No se pudo establecer la conexión en tiempo real.'
          );
        }

        // Liberar recursos si falla la conexion inicial.
        try {
          await connection.stop();
        } catch {
          // Conservar el error original de conexion.
        }

        this.planRetry();
      }
    });
  }

  disconnect(): Promise<void> {
    this.desiredConnected = false;
    this.cancelRetry();
    this.retryCount = 0;

    return this.enqueue(async () => {
      const connection = this.connection;

      this.connection = null;
      this.statusSignal.set('disconnected');
      this.errorSignal.set(null);

      if (connection) {
        await connection.stop();
      }
    });
  }

  private planRetry(): void {
    if (
      !this.desiredConnected ||
      !this.auth.isAuthenticated() ||
      this.cancelScheduledRetry
    ) {
      return;
    }

    const delayMs = Math.min(
      30000,
      5000 * (2 ** Math.min(this.retryCount, 3))
    );

    this.retryCount++;

    this.cancelScheduledRetry = this.scheduleRetry(
      async () => {
        this.cancelScheduledRetry = null;

        if (
          !this.desiredConnected ||
          !this.auth.isAuthenticated()
        ) {
          return;
        }

        try {
          await this.connect();
        } catch {
          this.planRetry();
        }
      },
      delayMs
    );
  }

  private cancelRetry(): void {
    const cancel = this.cancelScheduledRetry;
    this.cancelScheduledRetry = null;
    cancel?.();
  }
  private enqueue(operation: () => Promise<void>): Promise<void> {
    const next = this.pendingOperation.then(
      operation,
      operation
    );

    // Mantener la cola utilizable incluso ante un fallo.
    this.pendingOperation = next.catch(() => {});

    return next;
  }
}