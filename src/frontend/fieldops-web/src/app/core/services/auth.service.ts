import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import {
  catchError,
  Observable,
  of,
  switchMap,
  tap,
  throwError
} from 'rxjs';

import {
  AuthUser,
  FieldOpsRole,
  LoginRequest
} from '../models/auth-user';
import { CsrfService } from './csrf.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly csrf = inject(CsrfService);

  private readonly userState = signal<AuthUser | null>(null);

  readonly user = this.userState.asReadonly();

  readonly isAuthenticated = computed(
    () => this.userState() !== null
  );

  readonly isAdministrator = computed(
    () => this.hasRole('Administrator')
  );

  readonly isSupervisor = computed(
    () => this.hasRole('Supervisor')
  );

  readonly isTechnician = computed(
    () => this.hasRole('Technician')
  );

  hasRole(role: FieldOpsRole): boolean {
    return this.userState()?.roles.includes(role) ?? false;
  }

  // Obtener la sesion existente tras recargar Angular.
  loadSession(): Observable<AuthUser | null> {
    return this.http.get<AuthUser>('/api/auth/me').pipe(
      tap(user => this.userState.set(user)),
      catchError((error: unknown) => {
        // Una comprobacion fallida no debe conservar
        // una identidad anterior como sesion verificada.
        this.userState.set(null);

        // El token CSRF anterior puede pertenecer
        // a una identidad que ya no es valida.
        this.csrf.clear();

        if (
          error instanceof HttpErrorResponse &&
          error.status === 401
        ) {
          return of(null);
        }

        // Los errores de red y servidor se comunican
        // a los componentes para mostrar el problema.
        return throwError(() => error);
      })
    );
  }

  // Inicio de sesion con token antifalsificacion.
  login(request: LoginRequest): Observable<AuthUser> {
    return this.csrf.getToken().pipe(
      switchMap(token =>
        this.http.post<AuthUser>(
          '/api/auth/login',
          request,
          {
            headers: {
              'X-XSRF-TOKEN': token
            }
          }
        )
      ),
      tap(user => {
        this.userState.set(user);

        // El siguiente POST necesita un token emitido
        // para la nueva identidad autenticada.
        this.csrf.clear();
      })
    );
  }

  // Cierre de sesion protegido contra CSRF.
  logout(): Observable<void> {
    // Solicitar un token actualizado por si la identidad
    // de la cookie ha cambiado desde la ultima peticion.
    this.csrf.clear();

    return this.csrf.getToken().pipe(
      switchMap(token =>
        this.http.post<void>(
          '/api/auth/logout',
          null,
          {
            headers: {
              'X-XSRF-TOKEN': token
            }
          }
        )
      ),
      tap(() => this.clearLocalSession()),
      catchError((error: unknown) => {
        // Si la cookie ya no es valida, la sesion
        // del navegador debe considerarse finalizada.
        if (
          error instanceof HttpErrorResponse &&
          error.status === 401
        ) {
          this.clearLocalSession();
          return of(void 0);
        }

        // Ante un posible problema antiforgery,
        // renovar el token en el siguiente intento.
        if (
          error instanceof HttpErrorResponse &&
          error.status === 400
        ) {
          this.csrf.clear();
        }

        // No afirmar que se cerro la sesion del servidor
        // ante problemas de red u otros errores.
        return throwError(() => error);
      })
    );
  }

  private clearLocalSession(): void {
    this.userState.set(null);
    this.csrf.clear();
  }
}
