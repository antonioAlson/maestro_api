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
        path: 'pcp/acompanhamento',
        loadComponent: () => import('./pages/acompanhamento/acompanhamento.component').then(m => m.AcompanhamentoComponent)
      },
      {
        path: 'pcp/relatorios',
        loadComponent: () => import('./pages/relatorios-pcp/relatorios-pcp.component').then(m => m.RelatoriosPcpComponent)
      },
      {
        path: 'users',
        loadComponent: () => import('./pages/users-manage/users-manage.component').then(m => m.UsersManageComponent)
      },
      {
        path: 'users/acesso',
        loadComponent: () => import('./pages/users-manage/users-manage.component').then(m => m.UsersManageComponent)
      },
      {
        path: 'projetos/espelhos',
        loadComponent: () => import('./pages/projetos-espelhos/projetos-espelhos.component').then(m => m.ProjetosEspelhosComponent)
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
