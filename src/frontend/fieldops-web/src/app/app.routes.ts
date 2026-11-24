import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    title: 'Iniciar sesión | FieldOps 360',
    loadComponent: () =>
      import('./features/auth/pages/login-page')
        .then(m => m.LoginPage)
  },
  {
    path: '',
    title: 'Inicio | FieldOps 360',
    loadComponent: () =>
      import('./features/home/pages/home-page')
        .then(m => m.HomePage)
  },
  {
    path: 'facilities',
    canActivate: [authGuard],
    data: {
      roles: ['Administrator', 'Supervisor', 'Technician']
    },
    title: 'Instalaciones | FieldOps 360',
    loadComponent: () =>
      import('./features/facilities/pages/facilities-page')
        .then(m => m.FacilitiesPage)
  },
  {
    path: 'assets',
    canActivate: [authGuard],
    data: {
      roles: ['Administrator', 'Supervisor', 'Technician']
    },
    title: 'Activos | FieldOps 360',
    loadComponent: () =>
      import('./features/assets/pages/assets-page')
        .then(m => m.AssetsPage)
  },
  {
    path: 'incidents',
    canActivate: [authGuard],
    data: {
      roles: ['Administrator', 'Supervisor']
    },
    title: 'Incidencias | FieldOps 360',
    loadComponent: () =>
      import('./features/incidents/pages/incidents-page')
        .then(m => m.IncidentsPage)
  },
  {
    path: 'technicians',
    canActivate: [authGuard],
    data: {
      roles: ['Administrator', 'Supervisor']
    },
    title: 'Técnicos | FieldOps 360',
    loadComponent: () =>
      import('./features/technicians/pages/technicians-page')
        .then(m => m.TechniciansPage)
  },
  {
    path: 'my-work-orders',
    canActivate: [authGuard],
    data: {
      roles: ['Technician']
    },
    title: 'Mis órdenes | FieldOps 360',
    loadComponent: () =>
      import('./features/work-orders/pages/my-work-orders-page')
        .then(m => m.MyWorkOrdersPage)
  },
  {
    path: 'work-orders',
    canActivate: [authGuard],
    data: {
      roles: ['Administrator', 'Supervisor']
    },
    title: 'Órdenes de trabajo | FieldOps 360',
    loadComponent: () =>
      import('./features/work-orders/pages/work-orders-page')
        .then(m => m.WorkOrdersPage)
  },
  {
    path: 'users',
    canActivate: [authGuard],
    data: {
      roles: ['Administrator']
    },
    title: 'Usuarios | FieldOps 360',
    loadComponent: () =>
      import('./features/users/pages/users-page')
        .then(m => m.UsersPage)
  },
  {
    path: 'access-denied',
    title: 'Acceso denegado | FieldOps 360',
    loadComponent: () =>
      import('./features/auth/pages/access-denied-page')
        .then(m => m.AccessDeniedPage)
  },
  {
    path: '**',
    redirectTo: ''
  }
];
