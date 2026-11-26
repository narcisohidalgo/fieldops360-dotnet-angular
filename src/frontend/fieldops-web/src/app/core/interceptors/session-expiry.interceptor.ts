import {
  HttpErrorResponse,
  HttpInterceptorFn
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { AuthService } from '../services/auth.service';

const protectedApiRoots = [
  '/api/dashboard',
  '/api/facilities',
  '/api/assets',
  '/api/incidents',
  '/api/technicians',
  '/api/work-orders',
  '/api/my/work-orders',
  '/api/users'
];

/**
 * Handle rejected authenticated API sessions centrally.
 * Authentication endpoints retain their own error handling.
 */
export const sessionExpiryInterceptor: HttpInterceptorFn =
  (request, next) => {
    const path = request.url.split(/[?#]/, 1)[0];

    const isProtectedRequest = protectedApiRoots.some(
      root => path === root || path.startsWith(`${root}/`)
    );

    if (!isProtectedRequest) {
      return next(request);
    }

    const auth = inject(AuthService);
    const router = inject(Router);

    const revision = auth.sessionRevision;
    const wasAuthenticated = auth.isAuthenticated();

    return next(request).pipe(
      catchError((error: unknown) => {
        if (
          error instanceof HttpErrorResponse &&
          error.status === 401 &&
          wasAuthenticated &&
          auth.invalidateSession(revision)
        ) {
          const returnUrl = router.url;
          const currentPath = returnUrl.split(/[?#]/, 1)[0];

          // Concurrent responses cannot invalidate twice.
          // Do not interrupt an existing login navigation.
          if (currentPath !== '/login') {
            void router.navigate(['/login'], {
              queryParams: { returnUrl },
              replaceUrl: true
            }).catch((navigationError: unknown) => {
              console.error(
                'Unable to redirect after session invalidation.',
                navigationError
              );
            });
          }
        }

        // Preserve the original error for its subscriber.
        // Never replay a potentially unsafe mutation.
        return throwError(() => error);
      })
    );
  };
