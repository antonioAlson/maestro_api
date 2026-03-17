import { HttpInterceptorFn } from '@angular/common/http';

/**
 * Interceptor para adicionar o token JWT em todas as requisições
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('maestro_token');
  
  // Se tiver token, adiciona no header Authorization
  if (token) {
    const cloned = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${token}`)
    });
    return next(cloned);
  }
  
  return next(req);
};
