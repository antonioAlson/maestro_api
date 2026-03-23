import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-acesso-negado',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './acesso-negado.component.html',
  styleUrl: './acesso-negado.component.scss'
})
export class AcessoNegadoComponent {
  userName = '';

  constructor(
    private router: Router,
    private authService: AuthService
  ) {
    const user = this.authService.getCurrentUser();
    this.userName = user?.name || 'Usuário';
  }

  goToHome(): void {
    this.router.navigate(['/home']);
  }

  goBack(): void {
    window.history.back();
  }
}
