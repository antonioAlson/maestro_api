import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, BehaviorSubject, tap } from 'rxjs';

// Interfaces
interface User {
  id: number;
  name: string;
  email: string;
  menuAccess?: string[];
  createdAt?: string;
  updatedAt?: string;
}

interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    user: User;
    token: string;
  };
}

interface UsersListResponse {
  success: boolean;
  message?: string;
  data: {
    users: User[];
  };
}

interface CreateUserResponse {
  success: boolean;
  message: string;
  data: {
    user: User;
  };
}

interface UpdateUserAccessResponse {
  success: boolean;
  message: string;
  data: {
    user: User;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:3000/api/auth';
  private tokenKey = 'maestro_token';
  private tabsStorageKey = 'maestro_active_tabs';
  private tabSessionKey = 'maestro_tab_id';
  private reloadFlagSessionKey = 'maestro_tab_reloading';
  private lastUnloadAtKey = 'maestro_last_unload_at';
  private tabStaleThresholdMs = 45000;
  private tabHeartbeatIntervalMs = 15000;
  private reloadGraceWindowMs = 5000;
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  private tabId = '';
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private http: HttpClient) {
    this.initializeTabSessionTracking();

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
   * Listar usuários cadastrados
   */
  listUsers(): Observable<UsersListResponse> {
    return this.http.get<UsersListResponse>(`${this.apiUrl}/users`);
  }

  /**
   * Criar novo usuário sem alterar sessão atual
   */
  createManagedUser(name: string, email: string, password: string): Observable<CreateUserResponse> {
    return this.http.post<CreateUserResponse>(`${this.apiUrl}/users`, {
      name,
      email,
      password
    });
  }

  updateUserAccess(userId: number, menuAccess: string[]): Observable<UpdateUserAccessResponse> {
    return this.http.put<UpdateUserAccessResponse>(`${this.apiUrl}/users/${userId}/access`, {
      menuAccess
    }).pipe(
      tap((response) => {
        if (!response.success) {
          return;
        }

        const currentUser = this.currentUserSubject.value;
        if (currentUser && currentUser.id === response.data.user.id) {
          this.currentUserSubject.next({
            ...currentUser,
            menuAccess: response.data.user.menuAccess || []
          });
        }
      })
    );
  }

  /**
   * Fazer logout
   */
  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.tabsStorageKey);
    localStorage.removeItem(this.lastUnloadAtKey);
    sessionStorage.removeItem(this.tabSessionKey);
    sessionStorage.removeItem(this.reloadFlagSessionKey);
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
      error: (error: HttpErrorResponse) => {
        // Deslogar apenas quando o token realmente não é mais válido.
        if (error?.status === 401 || error?.status === 403) {
          this.logout();
        }
      }
    });
  }

  /**
   * Recarregar dados do usuário atual (usado quando permissões são alteradas)
   */
  reloadCurrentUser(): void {
    this.loadCurrentUser();
  }

  private initializeTabSessionTracking(): void {
    const hadReloadFlag = sessionStorage.getItem(this.reloadFlagSessionKey) === '1';
    sessionStorage.removeItem(this.reloadFlagSessionKey);
    const isReloadNavigation = this.isReloadNavigation();
    const hadRecentUnload = this.hadRecentUnload();

    this.purgeStaleTabs();
    const hadActiveTabs = this.getActiveTabsCount() > 0;

    // Se não havia abas ativas e não foi um refresh, considera fim de sessão do navegador.
    if (!hadActiveTabs && !hadReloadFlag && !isReloadNavigation && !hadRecentUnload) {
      localStorage.removeItem(this.tokenKey);
      this.currentUserSubject.next(null);
    }

    this.tabId = this.getOrCreateTabId();
    this.registerCurrentTab();
    this.startTabHeartbeat();

    window.addEventListener('beforeunload', this.handleBeforeUnload);
    window.addEventListener('pagehide', this.handlePageHide);
  }

  private getOrCreateTabId(): string {
    const existing = sessionStorage.getItem(this.tabSessionKey);
    if (existing) {
      return existing;
    }

    const newId = `tab_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(this.tabSessionKey, newId);
    return newId;
  }

  private handleBeforeUnload = (): void => {
    // No refresh este flag permanece no sessionStorage; ao fechar a aba ele é descartado.
    sessionStorage.setItem(this.reloadFlagSessionKey, '1');
    localStorage.setItem(this.lastUnloadAtKey, Date.now().toString());
    this.unregisterCurrentTab();
  };

  private handlePageHide = (): void => {
    sessionStorage.setItem(this.reloadFlagSessionKey, '1');
    localStorage.setItem(this.lastUnloadAtKey, Date.now().toString());
    this.unregisterCurrentTab();
  };

  private startTabHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.heartbeatTimer = setInterval(() => {
      this.purgeStaleTabs();
      this.registerCurrentTab();
    }, this.tabHeartbeatIntervalMs);
  }

  private registerCurrentTab(): void {
    if (!this.tabId) {
      return;
    }

    const tabs = this.readTabsMap();
    tabs[this.tabId] = Date.now();
    this.writeTabsMap(tabs);
  }

  private unregisterCurrentTab(): void {
    if (!this.tabId) {
      return;
    }

    const tabs = this.readTabsMap();
    delete tabs[this.tabId];
    this.writeTabsMap(tabs);
  }

  private purgeStaleTabs(): void {
    const now = Date.now();
    const tabs = this.readTabsMap();
    let changed = false;

    Object.entries(tabs).forEach(([id, lastSeen]) => {
      if (now - Number(lastSeen) > this.tabStaleThresholdMs) {
        delete tabs[id];
        changed = true;
      }
    });

    if (changed) {
      this.writeTabsMap(tabs);
    }
  }

  private getActiveTabsCount(): number {
    return Object.keys(this.readTabsMap()).length;
  }

  private readTabsMap(): Record<string, number> {
    const raw = localStorage.getItem(this.tabsStorageKey);
    if (!raw) {
      return {};
    }

    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') {
        return {};
      }
      return parsed as Record<string, number>;
    } catch {
      return {};
    }
  }

  private writeTabsMap(tabs: Record<string, number>): void {
    const keys = Object.keys(tabs);
    if (keys.length === 0) {
      localStorage.removeItem(this.tabsStorageKey);
      return;
    }

    localStorage.setItem(this.tabsStorageKey, JSON.stringify(tabs));
  }

  private hadRecentUnload(): boolean {
    const raw = localStorage.getItem(this.lastUnloadAtKey);
    if (!raw) {
      return false;
    }

    const lastUnloadAt = Number(raw);
    if (Number.isNaN(lastUnloadAt)) {
      return false;
    }

    return Date.now() - lastUnloadAt <= this.reloadGraceWindowMs;
  }

  private isReloadNavigation(): boolean {
    const navigationEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    if (navigationEntries.length > 0) {
      return navigationEntries[0].type === 'reload';
    }

    const legacyNavigation = (performance as Performance & { navigation?: { type?: number } }).navigation;
    return legacyNavigation?.type === 1;
  }
}
