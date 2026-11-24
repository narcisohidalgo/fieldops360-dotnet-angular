import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { switchMap } from 'rxjs';

import { CsrfService } from '../services/csrf.service';

const unsafeMethods = new Set([
  'POST',
  'PUT',
  'PATCH',
  'DELETE'
]);

/**
 * Adjunta el token CSRF a las operaciones que modifican
 * datos dentro de la API propia de FieldOps 360.
 *
 * No modifica peticiones GET, HEAD ni URLs externas.
 * Respeta las cabeceras CSRF que ya hayan sido añadidas.
 */
export const csrfInterceptor: HttpInterceptorFn = (req, next) => {
  const isApiRequest = req.url.startsWith('/api/');
  const isUnsafeMethod = unsafeMethods.has(
    req.method.toUpperCase()
  );

  if (
    !isApiRequest ||
    !isUnsafeMethod ||
    req.headers.has('X-XSRF-TOKEN')
  ) {
    return next(req);
  }

  // Obtener el servicio dentro del contexto de inyeccion
  // del interceptor funcional.
  const csrf = inject(CsrfService);

  return csrf.getToken().pipe(
    switchMap(token => {
      const protectedRequest = req.clone({
        setHeaders: {
          'X-XSRF-TOKEN': token
        }
      });

      return next(protectedRequest);
    })
  );
};
