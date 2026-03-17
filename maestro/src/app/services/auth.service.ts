import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, tap } from 'rxjs';

// Interfaces
interface User {
  id: number;
  name: string;
  email: string;
}

interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    user: User;
    token: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:3000/api/auth';
  private tokenKey = 'maestro_token';
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {
    // Verificar se já tem token salvo ao iniciar
    const token = this.getToken();
    if (token) {
      this.loadCurrentUser();
    }
  }

  /**
   * Fazer login
   */
  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, {
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

  /**
   * Registrar novo usuário
   */
  register(name: string, email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/register`, {
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

  /**
   * Fazer logout
   */
  logout(): void {
    localStorage.removeItem(this.tokenKey);
    this.currentUserSubject.next(null);
  }

  /**
   * Obter token JWT
   */
  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  /**
   * Salvar token JWT
   */
  private setToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
  }

  /**
   * Verificar se está autenticado
   */
  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  /**
   * Obter usuário atual
   */
  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  /**
   * Carregar dados do usuário atual
   */
  private loadCurrentUser(): void {
    this.http.get<any>(`${this.apiUrl}/me`).subscribe({
      next: (response) => {
        if (response.success) {
          this.currentUserSubject.next(response.data.user);
        }
      },
      error: () => {
        // Token inválido ou expirado
        this.logout();
      }
    });
  }
}
