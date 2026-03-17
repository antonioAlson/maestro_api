import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/home',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: '',
    loadComponent: () => import('./components/layout/layout.component').then(m => m.LayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: 'home',
        loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.HomeComponent)
      },
      {
        path: 'users',
        loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.HomeComponent)
      },
      {
        path: 'reports',
        loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.HomeComponent)
      },
      {
        path: 'settings',
        loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.HomeComponent)
      }
    ]
  }
];
