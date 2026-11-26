import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';
import { CsrfService } from '../../../core/services/csrf.service';

@Component({
  selector: 'app-login-page',
  imports: [FormsModule, RouterLink],
  templateUrl: './login-page.html',
  styleUrl: './login-page.scss'
})
export class LoginPage {
  protected email = '';
  protected password = '';

  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  private readonly auth = inject(AuthService);
  private readonly csrf = inject(CsrfService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected submit(): void {
    if (
      this.isSubmitting() ||
      !this.email.trim() ||
      !this.password
    ) {
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    this.auth.login({
      email: this.email.trim(),
      password: this.password
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.password = '';
          this.isSubmitting.set(false);

          // Recuperar solo rutas internas conocidas tras el login.
          // Solo permitir rutas internas conocidas.
          // Nunca utilizar destinos externos enviados por URL.
          const requested = this.route.snapshot.queryParamMap
            .get('returnUrl');

          const safePath = requested?.split(/[?#]/, 1)[0];

          const protectedRoutes = new Set([
            '/dashboard',
            '/facilities',
            '/assets',
            '/incidents',
            '/technicians',
            '/work-orders',
            '/my-work-orders',
            '/users'
          ]);

          const destination =
            safePath && protectedRoutes.has(safePath) && requested
              ? requested
              : '/';

          void this.router.navigateByUrl(destination);
        },
        error: (error: unknown) => {
          this.password = '';
          this.isSubmitting.set(false);

          if (error instanceof HttpErrorResponse) {
            switch (error.status) {
              case 401:
              case 403:
                this.errorMessage.set(
                  'Correo o contraseña incorrectos, o cuenta no disponible.'
                );
                break;

              case 400:
                // Renovar CSRF en el siguiente intento.
                this.csrf.clear();
                this.errorMessage.set(
                  'No se pudo validar la solicitud. Inténtalo de nuevo.'
                );
                break;

              case 0:
                this.errorMessage.set(
                  'No se pudo conectar con el servidor.'
                );
                break;

              default:
                this.errorMessage.set(
                  'No se pudo iniciar sesión. Inténtalo de nuevo.'
                );
            }
          } else {
            this.errorMessage.set(
              'Se produjo un error inesperado.'
            );
          }
        }
      });
  }
}
