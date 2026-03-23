import { Routes } from '@angular/router';
import { authGuard, menuAccessGuard } from './guards/auth.guard';

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
    path: 'acesso-negado',
    loadComponent: () => import('./pages/acesso-negado/acesso-negado.component').then(m => m.AcessoNegadoComponent)
  },
  {
    path: '',
    loadComponent: () => import('./components/layout/layout.component').then(m => m.LayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: 'home',
        loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.HomeComponent),
        canActivate: [menuAccessGuard]
      },
      {
        path: 'pcp/ordens',
        loadComponent: () => import('./pages/ordens-producao/ordens-producao.component').then(m => m.OrdensProducaoComponent),
        canActivate: [menuAccessGuard]
      },
      {
        path: 'pcp/acompanhamento',
        loadComponent: () => import('./pages/acompanhamento/acompanhamento.component').then(m => m.AcompanhamentoComponent),
        canActivate: [menuAccessGuard]
      },
      {
        path: 'pcp/relatorios',
        loadComponent: () => import('./pages/relatorios-pcp/relatorios-pcp.component').then(m => m.RelatoriosPcpComponent),
        canActivate: [menuAccessGuard]
      },
      {
        path: 'users',
        loadComponent: () => import('./pages/users-manage/users-manage.component').then(m => m.UsersManageComponent),
        canActivate: [menuAccessGuard]
      },
      {
        path: 'users/acesso',
        loadComponent: () => import('./pages/users-manage/users-manage.component').then(m => m.UsersManageComponent),
        canActivate: [menuAccessGuard]
      },
      {
        path: 'projetos/espelhos',
        loadComponent: () => import('./pages/projetos-espelhos/projetos-espelhos.component').then(m => m.ProjetosEspelhosComponent),
        canActivate: [menuAccessGuard]
      },
      {
        path: 'reports',
        loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.HomeComponent),
        canActivate: [menuAccessGuard]
      },
      {
        path: 'settings',
        loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.HomeComponent),
        canActivate: [menuAccessGuard]
      }
    ]
  }
];
