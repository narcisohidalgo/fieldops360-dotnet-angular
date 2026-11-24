import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { FieldOpsRole } from '../models/auth-user';
import { AuthService } from '../services/auth.service';

/**
 * Comprueba la sesion real en ASP.NET Core Identity.
 * Restaura el usuario tras recargar una ruta protegida.
 *
 * Tambien comprueba los roles permitidos para cada ruta.
 * El backend sigue siendo la autoridad de seguridad.
 */
export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const loginRedirect = router.createUrlTree(['/login'], {
    queryParams: {
      returnUrl: state.url
    }
  });

  return auth.loadSession().pipe(
    map(user => {
      if (!user) {
        return loginRedirect;
      }

      const allowedRoles = route.data['roles'] as
        readonly FieldOpsRole[] | undefined;

      // Denegar por defecto si una ruta protegida
      // no declara sus roles permitidos.
      if (
        !allowedRoles?.length ||
        !allowedRoles.some(role => user.roles.includes(role))
      ) {
        return router.createUrlTree(['/access-denied']);
      }

      return true;
    }),
    catchError(() => of(loginRedirect))
  );
};
