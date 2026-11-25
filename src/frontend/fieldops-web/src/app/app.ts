import {
  Component,
  DestroyRef,
  effect,
  inject,
  OnInit,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { OperationalNotifications } from './operational-notifications/operational-notifications';
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet
} from '@angular/router';

import { AuthService } from './core/services/auth.service';
import { RealtimeService } from './core/services/realtime.service';
import { OperationalNotificationsService } from './core/services/operational-notifications.service';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, OperationalNotifications],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  readonly auth = inject(AuthService);
  protected readonly notificationCenter =
    inject(OperationalNotificationsService);

  protected readonly sessionChecking = signal(true);
  protected readonly isLoggingOut = signal(false);
  protected readonly sessionError = signal<string | null>(null);
  protected readonly notificationsOpen = signal(false);

  private readonly realtime = inject(RealtimeService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    effect(() => {
      const user = this.auth.user();

      if (
        !user ||
        (!user.roles.includes('Administrator') &&
          !user.roles.includes('Supervisor'))
      ) {
        this.notificationsOpen.set(false);
      }
    });

    // Mantener SignalR sincronizado con la sesion verificada.
    // El servicio evita conexiones duplicadas y serializa
    // las operaciones de apertura y cierre.
    effect(() => {
      const authenticated = this.auth.isAuthenticated();

      const operation = authenticated
        ? this.realtime.connect()
        : this.realtime.disconnect();

      void operation.catch((error: unknown) => {
        console.error(
          'Error al sincronizar la conexion SignalR.',
          error
        );
      });
    });
  }
  ngOnInit(): void {
    // Recuperar la sesion al abrir o recargar Angular,
    // incluso si la pagina de inicio es publica.
    this.auth.loadSession()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.sessionChecking.set(false);
        },
        error: () => {
          this.sessionChecking.set(false);
          this.sessionError.set(
            'No se pudo comprobar la sesión con el servidor.'
          );
        }
      });
  }

  protected toggleNotifications(): void {
    if (
      !this.auth.hasRole('Administrator') &&
      !this.auth.hasRole('Supervisor')
    ) {
      return;
    }

    this.notificationsOpen.update(value => !value);
  }

  protected closeNotifications(): void {
    this.notificationsOpen.set(false);
  }

  protected viewNotification(id: number): void {
    this.notificationCenter.markAsRead(id);
    this.closeNotifications();
  }
  protected logout(): void {
    if (this.isLoggingOut()) {
      return;
    }

    this.isLoggingOut.set(true);
    this.notificationsOpen.set(false);
    this.sessionError.set(null);

    this.auth.logout()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isLoggingOut.set(false);
          void this.router.navigateByUrl('/login');
        },
        error: () => {
          this.isLoggingOut.set(false);
          this.sessionError.set(
            'No se pudo cerrar la sesión. Inténtalo de nuevo.'
          );
        }
      });
  }
}
