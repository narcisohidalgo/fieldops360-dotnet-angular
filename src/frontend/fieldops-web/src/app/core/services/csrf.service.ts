import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, shareReplay, throwError } from 'rxjs';

import { CsrfTokenResponse } from '../models/auth-user';

@Injectable({
  providedIn: 'root'
})
export class CsrfService {
  private readonly http = inject(HttpClient);

  private cachedToken$: Observable<string> | null = null;

  getToken(): Observable<string> {
    if (this.cachedToken$) {
      return this.cachedToken$;
    }

    this.cachedToken$ = this.http
      .get<CsrfTokenResponse>('/api/auth/csrf')
      .pipe(
        map(response => {
          if (!response.requestToken) {
            throw new Error('CSRF token is missing.');
          }

          return response.requestToken;
        }),
        catchError(error => {
          this.cachedToken$ = null;
          return throwError(() => error);
        }),
        shareReplay({
          bufferSize: 1,
          refCount: false
        })
      );

    return this.cachedToken$;
  }

  // El token cambia cuando cambia la identidad.
  // Debe renovarse tras login y logout.
  clear(): void {
    this.cachedToken$ = null;
  }
}
