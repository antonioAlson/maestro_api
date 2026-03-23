import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize, take } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';

interface ManagedUser {
  id: number;
  name: string;
  email: string;
  menuAccess?: string[];
  createdAt?: string;
}

interface MenuAccessOption {
  route: string;
  label: string;
}

@Component({
  selector: 'app-users-manage',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './users-manage.component.html',
  styleUrl: './users-manage.component.scss'
})
export class UsersManageComponent implements OnInit {
  users: ManagedUser[] = [];
  filteredUsers: ManagedUser[] = [];
  searchTerm = '';
  isLoading = false;
  isSaving = false;
  showCreateModal = false;
  feedbackMessage = '';
  feedbackType: 'success' | 'error' | '' = '';

  formName = '';
  formEmail = '';
  formPassword = '';
  formConfirmPassword = '';

  readonly menuAccessOptions: MenuAccessOption[] = [
    { route: '/home', label: 'Inicio' },
    { route: '/pcp/ordens', label: 'PCP - Ordens' },
    { route: '/pcp/acompanhamento', label: 'PCP - Acompanhamento' },
    { route: '/pcp/relatorios', label: 'PCP - Relatorios PCP' },
    { route: '/projetos/espelhos', label: 'Projetos - Espelhos' },
    { route: '/users', label: 'Usuarios - Gerenciar' },
    { route: '/users/acesso', label: 'Usuarios - Acesso' },
    { route: '/reports', label: 'Relatorios' },
    { route: '/settings', label: 'Configuracoes' }
  ];

  showAccessModal = false;
  isSavingAccess = false;
  selectedAccessUser: ManagedUser | null = null;
  selectedAccessRoutes = new Set<string>();

  constructor(
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadUsers();

    if (this.router.url === '/users/acesso') {
      this.searchTerm = '';
    }
  }

  loadUsers(): void {
    this.isLoading = true;
    this.feedbackMessage = '';
    this.feedbackType = '';
    this.refreshView();

    this.authService.listUsers()
      .pipe(
        take(1),
        finalize(() => {
          this.isLoading = false;
          this.refreshView();
        })
      )
      .subscribe({
        next: (response) => {
          this.users = response.data?.users || [];
          this.applySearch();
          this.refreshView();
        },
        error: (error) => {
          this.users = [];
          this.filteredUsers = [];
          this.feedbackType = 'error';
          this.feedbackMessage = error?.error?.message || 'Erro ao carregar usuários';
          this.refreshView();
        }
      });
  }

  applySearch(): void {
    const term = this.searchTerm.trim().toLowerCase();

    if (!term) {
      this.filteredUsers = [...this.users];
      return;
    }

    this.filteredUsers = this.users.filter(user => {
      const name = (user.name || '').toLowerCase();
      const email = (user.email || '').toLowerCase();
      return name.includes(term) || email.includes(term);
    });
  }

  openCreateModal(): void {
    this.showCreateModal = true;
    this.formName = '';
    this.formEmail = '';
    this.formPassword = '';
    this.formConfirmPassword = '';
    this.feedbackMessage = '';
    this.feedbackType = '';
    this.refreshView();
  }

  openAccessModal(user: ManagedUser): void {
    this.selectedAccessUser = user;
    this.selectedAccessRoutes = new Set(user.menuAccess || []);
    this.showAccessModal = true;
    this.feedbackMessage = '';
    this.feedbackType = '';
    this.refreshView();
  }

  closeAccessModal(): void {
    if (this.isSavingAccess) {
      return;
    }

    this.showAccessModal = false;
    this.selectedAccessUser = null;
    this.selectedAccessRoutes.clear();
    this.refreshView();
  }

  hasRouteAccess(route: string): boolean {
    return this.selectedAccessRoutes.has(route);
  }

  toggleRouteAccess(route: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      this.selectedAccessRoutes.add(route);
    } else {
      this.selectedAccessRoutes.delete(route);
    }
  }

  grantAllAccess(): void {
    this.selectedAccessRoutes = new Set(this.menuAccessOptions.map(option => option.route));
  }

  clearAllAccess(): void {
    this.selectedAccessRoutes.clear();
  }

  saveAccess(): void {
    if (!this.selectedAccessUser || this.isSavingAccess) {
      return;
    }

    this.isSavingAccess = true;
    this.feedbackMessage = '';
    this.feedbackType = '';
    this.refreshView();

    this.authService.updateUserAccess(
      this.selectedAccessUser.id,
      Array.from(this.selectedAccessRoutes)
    ).pipe(
      take(1),
      finalize(() => {
        this.isSavingAccess = false;
        this.refreshView();
      })
    ).subscribe({
      next: (response) => {
        const updatedUser = response.data?.user as ManagedUser | undefined;
        if (updatedUser) {
          this.users = this.users.map(user => user.id === updatedUser.id ? updatedUser : user);
          this.applySearch();
          this.selectedAccessUser = updatedUser;
          this.selectedAccessRoutes = new Set(updatedUser.menuAccess || []);

          // Se alterou permissões do próprio usuário logado, atualiza imediatamente
          const currentUser = this.authService.getCurrentUser();
          if (currentUser && currentUser.id === updatedUser.id) {
            this.authService.reloadCurrentUser();
          }
        }

        this.feedbackType = 'success';
        this.feedbackMessage = response.message || 'Acessos atualizados com sucesso';
        this.refreshView();

        setTimeout(() => {
          this.closeAccessModal();
        }, 700);
      },
      error: (error) => {
        this.feedbackType = 'error';
        this.feedbackMessage = error?.error?.message || 'Erro ao salvar acessos';
        this.refreshView();
      }
    });
  }

  closeCreateModal(): void {
    if (this.isSaving) {
      return;
    }

    this.showCreateModal = false;
    this.refreshView();
  }

  canSubmitCreateUser(): boolean {
    return this.formName.trim().length > 0
      && this.formEmail.trim().length > 0
      && this.formPassword.length >= 6
      && this.formConfirmPassword.length >= 6
      && this.formPassword === this.formConfirmPassword
      && !this.isSaving;
  }

  createUser(): void {
    if (!this.canSubmitCreateUser()) {
      if (this.formPassword !== this.formConfirmPassword) {
        this.feedbackType = 'error';
        this.feedbackMessage = 'As senhas não coincidem';
        this.refreshView();
      }
      return;
    }

    this.isSaving = true;
    this.feedbackMessage = '';
    this.feedbackType = '';
    this.refreshView();

    this.authService.createManagedUser(this.formName.trim(), this.formEmail.trim(), this.formPassword)
      .pipe(
        take(1),
        finalize(() => {
          this.isSaving = false;
          this.refreshView();
        })
      )
      .subscribe({
        next: (response) => {
          const createdUser = response.data?.user;
          if (createdUser) {
            this.users = [createdUser as ManagedUser, ...this.users];
            this.applySearch();
          }

          this.feedbackType = 'success';
          this.feedbackMessage = response.message || 'Usuário criado com sucesso';
          this.refreshView();

          setTimeout(() => {
            this.showCreateModal = false;
            this.refreshView();
          }, 700);
        },
        error: (error) => {
          this.feedbackType = 'error';
          this.feedbackMessage = error?.error?.message || 'Erro ao criar usuário';
          this.refreshView();
        }
      });
  }

  private refreshView(): void {
    try {
      this.cdr.detectChanges();
    } catch {
      // Ignora tentativas fora do ciclo de renderização.
    }
  }

  formatDate(date?: string): string {
    if (!date) {
      return '-';
    }

    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) {
      return '-';
    }

    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(parsed);
  }
}
