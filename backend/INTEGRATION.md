# 🔗 Integração Angular com a API

## Como integrar o login do Angular com a API

### 1. Criar o Auth Service no Angular

```typescript
// src/app/services/auth.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';

interface LoginResponse {
  success: boolean;
  message: string;
  data: {
    user: {
      id: number;
      name: string;
      email: string;
    };
    token: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:3000/api/auth';
  private tokenKey = 'maestro_token';
  private currentUserSubject = new BehaviorSubject<any>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {
    // Verificar se já tem token salvo
    const token = this.getToken();
    if (token) {
      this.loadCurrentUser();
    }
  }

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, {
      email,
      password
    }).pipe(
      tap(response => {
        if (response.success) {
          this.setToken(response.data.token);
          this.currentUserSubject.next(response.data.user);
        }
      })
    );
  }

  register(name: string, email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/register`, {
      name,
      email,
      password
    }).pipe(
      tap(response => {
        if (response.success) {
          this.setToken(response.data.token);
          this.currentUserSubject.next(response.data.user);
        }
      })
    );
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    this.currentUserSubject.next(null);
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  setToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  private loadCurrentUser(): void {
    this.http.get<any>(`${this.apiUrl}/me`).subscribe({
      next: (response) => {
        if (response.success) {
          this.currentUserSubject.next(response.data.user);
        }
      },
      error: () => {
        this.logout();
      }
    });
  }
}
```

### 2. Criar HTTP Interceptor para adicionar o token

```typescript
// src/app/interceptors/auth.interceptor.ts
import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('maestro_token');
  
  if (token) {
    const cloned = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${token}`)
    });
    return next(cloned);
  }
  
  return next(req);
};
```

### 3. Configurar no app.config.ts

```typescript
// src/app/app.config.ts
import { ApplicationConfig, LOCALE_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './interceptors/auth.interceptor';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    { provide: LOCALE_ID, useValue: 'pt-BR' }
  ]
};
```

### 4. Atualizar o Login Component

```typescript
// src/app/pages/login/login.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  email: string = '';
  password: string = '';
  rememberMe: boolean = false;
  errorMessage: string = '';
  isLoading: boolean = false;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  onSubmit(): void {
    this.errorMessage = '';
    
    if (!this.email || !this.password) {
      this.errorMessage = 'Por favor, preencha todos os campos.';
      return;
    }

    if (!this.isValidEmail(this.email)) {
      this.errorMessage = 'Por favor, insira um e-mail válido.';
      return;
    }

    this.isLoading = true;

    this.authService.login(this.email, this.password).subscribe({
      next: (response) => {
        console.log('Login bem-sucedido:', response);
        // Redirecionar para dashboard ou home
        this.router.navigate(['/dashboard']);
      },
      error: (error) => {
        console.error('Erro no login:', error);
        this.isLoading = false;
        
        if (error.error?.message) {
          this.errorMessage = error.error.message;
        } else if (error.status === 0) {
          this.errorMessage = 'Erro ao conectar com o servidor. Verifique se a API está rodando.';
        } else {
          this.errorMessage = 'Erro ao fazer login. Tente novamente.';
        }
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  onForgotPassword(): void {
    console.log('Esqueceu a senha?');
  }
}
```

### 5. Criar um Guard para rotas protegidas

```typescript
// src/app/guards/auth.guard.ts
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  router.navigate(['/login']);
  return false;
};
```

### 6. Usar o guard nas rotas

```typescript
// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/login',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [authGuard]
  }
];
```

## 🧪 Testando a Integração

1. **Inicie a API primeiro:**
   ```bash
   cd backend
   npm run dev
   ```

2. **Inicie o Angular em outro terminal:**
   ```bash
   cd maestro
   npm start
   ```

3. **Teste o login:**
   - Email: `teste@maestro.com`
   - Senha: `123456`

## 🔒 Segurança - Boas Práticas

### Produção:

1. **Configure CORS corretamente:**
   ```javascript
   // backend/server.js
   app.use(cors({
     origin: 'https://seu-dominio.com',
     credentials: true
   }));
   ```

2. **Use HTTPS em produção**

3. **Não commite o arquivo .env**

4. **Use variáveis de ambiente diferentes para dev/prod**

5. **Implemente refresh tokens**

## 📱 Testando com Postman/Insomnia

Importe a collection ou teste manualmente:

**Login:**
- URL: `POST http://localhost:3000/api/auth/login`
- Body (JSON):
  ```json
  {
    "email": "teste@maestro.com",
    "password": "123456"
  }
  ```

**Requisição autenticada:**
- URL: `GET http://localhost:3000/api/auth/me`
- Headers:
  ```
  Authorization: Bearer SEU_TOKEN_AQUI
  ```
