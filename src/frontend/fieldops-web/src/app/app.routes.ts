import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    title: 'Inicio | FieldOps 360',
    loadComponent: () =>
      import('./features/home/pages/home-page')
        .then(m => m.HomePage)
  },
  {
    path: 'facilities',
    title: 'Instalaciones | FieldOps 360',
    loadComponent: () =>
      import('./features/facilities/pages/facilities-page')
        .then(m => m.FacilitiesPage)
  },
  {
    path: 'assets',
    title: 'Activos | FieldOps 360',
    loadComponent: () =>
      import('./features/assets/pages/assets-page')
        .then(m => m.AssetsPage)
  },
  {
    path: 'incidents',
    title: 'Incidencias | FieldOps 360',
    loadComponent: () =>
      import('./features/incidents/pages/incidents-page')
        .then(m => m.IncidentsPage)
  },
  {
    path: 'technicians',
    title: 'Técnicos | FieldOps 360',
    loadComponent: () =>
      import('./features/technicians/pages/technicians-page')
        .then(m => m.TechniciansPage)
  },
  {
    path: 'work-orders',
    title: 'Órdenes de trabajo | FieldOps 360',
    loadComponent: () =>
      import('./features/work-orders/pages/work-orders-page')
        .then(m => m.WorkOrdersPage)
  },
  {
    path: '**',
    redirectTo: ''
  }
];
