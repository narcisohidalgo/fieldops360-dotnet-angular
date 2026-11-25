import {
  computed,
  DestroyRef,
  effect,
  inject,
  Injectable,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AuthService } from './auth.service';
import {
  OperationalRealtimeEvent,
  RealtimeService
} from './realtime.service';

export interface OperationalNotification {
  id: number;
  kind: OperationalRealtimeEvent;
  title: string;
  message: string;
  receivedAt: string;
  read: boolean;
}

const MAX_NOTIFICATIONS = 20;

@Injectable({
  providedIn: 'root'
})
export class OperationalNotificationsService {
  private readonly auth = inject(AuthService);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly notificationsState =
    signal<OperationalNotification[]>([]);

  private nextId = 0;
  private sessionUserId: string | null =
    this.auth.user()?.id ?? null;

  readonly notifications =
    this.notificationsState.asReadonly();

  readonly unreadCount = computed(() =>
    this.notificationsState().filter(item => !item.read).length
  );

  constructor() {
    // Limpiar avisos al cerrar sesion o cambiar de identidad.
    // Una recarga de datos del mismo usuario no los elimina.
    effect(() => {
      this.syncIdentity();
    });

    this.realtime.operationalEvents$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(kind => {
        const user = this.syncIdentity();

        if (!user) {
          return;
        }

        const isManager =
          user.roles.includes('Administrator') ||
          user.roles.includes('Supervisor');

        if (!isManager) {
          return;
        }

        this.addNotification(kind);
      });
  }

  markAsRead(id: number): void {
    this.notificationsState.update(items =>
      items.map(item =>
        item.id === id
          ? { ...item, read: true }
          : item
      )
    );
  }

  markAllAsRead(): void {
    this.notificationsState.update(items =>
      items.map(item =>
        item.read
          ? item
          : { ...item, read: true }
      )
    );
  }

  clear(): void {
    this.notificationsState.set([]);
  }

  private syncIdentity() {
    const user = this.auth.user();
    const userId = user?.id ?? null;

    if (userId !== this.sessionUserId) {
      this.sessionUserId = userId;
      this.clear();
    }

    return user;
  }

  private addNotification(
    kind: OperationalRealtimeEvent
  ): void {
    const title = kind === 'work-orders'
      ? 'Órdenes de trabajo actualizadas'
      : 'Incidencias actualizadas';

    const message = kind === 'work-orders'
      ? 'Se han registrado cambios en las órdenes de trabajo.'
      : 'Se han registrado cambios en las incidencias.';

    const notification: OperationalNotification = {
      id: ++this.nextId,
      kind,
      title,
      message,
      receivedAt: new Date().toISOString(),
      read: false
    };

    this.notificationsState.update(items =>
      [notification, ...items].slice(0, MAX_NOTIFICATIONS)
    );
  }
}