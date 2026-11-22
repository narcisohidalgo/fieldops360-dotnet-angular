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
    path: '**',
    redirectTo: ''
  }
];
