import {
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet
} from '@angular/router';

import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  readonly auth = inject(AuthService);

  protected readonly sessionChecking = signal(true);
  protected readonly isLoggingOut = signal(false);
  protected readonly sessionError = signal<string | null>(null);

  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

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

  protected logout(): void {
    if (this.isLoggingOut()) {
      return;
    }

    this.isLoggingOut.set(true);
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
