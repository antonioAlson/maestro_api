import { inject } from '@angular/core';
import { Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map, take } from 'rxjs/operators';

/**
 * Guard para proteger rotas que requerem autenticação
 */
export const authGuard = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  // Redireciona para login se não estiver autenticado
  router.navigate(['/login']);
  return false;
};

/**
 * Guard para verificar se o usuário tem permissão de acesso à rota
 */
export const menuAccessGuard = (route: ActivatedRouteSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Primeiro verifica se está autenticado
  if (!authService.isAuthenticated()) {
    router.navigate(['/login']);
    return false;
  }

  // Aguarda o usuário estar carregado e verifica permissões
  return authService.currentUser$.pipe(
    take(1),
    map(currentUser => {
      // Se não conseguiu carregar o usuário, bloqueia
      if (!currentUser) {
        router.navigate(['/home']);
        return false;
      }

      // Monta o path completo da rota
      const fullPath = '/' + route.pathFromRoot
        .filter(r => r.routeConfig?.path)
        .map(r => r.routeConfig!.path)
        .join('/');

      // Se o usuário não tem menuAccess definido ou está vazio, permite acesso total (admin)
      const menuAccess = currentUser.menuAccess || [];
      if (menuAccess.length === 0) {
        return true;
      }

      // Verifica se o usuário tem permissão para acessar esta rota
      const hasAccess = menuAccess.includes(fullPath);

      if (!hasAccess) {
        console.warn(`Acesso negado para ${fullPath}. Redirecionando para página de acesso negado`);
        router.navigate(['/acesso-negado'], { 
          queryParams: { attempted: fullPath },
          skipLocationChange: false 
        });
        return false;
      }

      return true;
    })
  );
};
