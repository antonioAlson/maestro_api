import { Component, OnInit } from '@angular/core';
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
export class LoginComponent implements OnInit {
  email: string = '';
  password: string = '';
  rememberMe: boolean = false;
  errorMessage: string = '';
  isLoading: boolean = false;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Carregar dados salvos se existirem
    const savedEmail = localStorage.getItem('maestro_remember_email');
    const rememberMe = localStorage.getItem('maestro_remember_me') === 'true';
    
    if (rememberMe && savedEmail) {
      this.email = savedEmail;
      this.rememberMe = true;
    }
  }

  onSubmit(): void {
    this.errorMessage = '';
    
    // Validação básica
    if (!this.email || !this.password) {
      this.errorMessage = 'Por favor, preencha todos os campos.';
      return;
    }

    if (!this.isValidEmail(this.email)) {
      this.errorMessage = 'Por favor, insira um e-mail válido.';
      return;
    }

    this.isLoading = true;

    // Chamar API de login
    this.authService.login(this.email, this.password).subscribe({
      next: (response) => {
        console.log('✅ Login bem-sucedido:', response);
        
        // Gerenciar "Lembrar-me"
        if (this.rememberMe) {
          localStorage.setItem('maestro_remember_email', this.email);
          localStorage.setItem('maestro_remember_me', 'true');
        } else {
          localStorage.removeItem('maestro_remember_email');
          localStorage.removeItem('maestro_remember_me');
        }
        
        // Redirecionar para inicio
        this.router.navigate(['/home']);
      },
      error: (error) => {
        console.error('❌ Erro no login:', error);
        this.isLoading = false;
        
        // Tratar erros
        if (error.error?.message) {
          this.errorMessage = error.error.message;
        } else if (error.status === 0) {
          this.errorMessage = 'Erro ao conectar com o servidor. Verifique se a API está rodando.';
        } else if (error.status === 401) {
          this.errorMessage = 'E-mail ou senha inválidos.';
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
    // Implementar lógica de recuperação de senha
  }
}
