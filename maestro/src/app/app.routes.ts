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
        path: 'pcp/ordens',
        loadComponent: () => import('./pages/ordens-producao/ordens-producao.component').then(m => m.OrdensProducaoComponent)
      },
      {
        path: 'pcp/relatorios',
        loadComponent: () => import('./pages/relatorios-pcp/relatorios-pcp.component').then(m => m.RelatoriosPcpComponent)
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
