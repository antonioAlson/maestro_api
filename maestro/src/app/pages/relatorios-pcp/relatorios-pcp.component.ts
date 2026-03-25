import { ChangeDetectorRef, Component, NgZone, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { JiraService } from '../../services/jira.service';

@Component({
  selector: 'app-relatorios-pcp',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './relatorios-pcp.component.html',
  styleUrl: './relatorios-pcp.component.scss'
})
export class RelatoriosPcpComponent implements OnInit {
  isGenerating = false;
  isGeneratingContec = false;
  message = '';
  messageType: 'success' | 'error' | '' = '';

  constructor(
    private jiraService: JiraService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
  }

  private runUiUpdate(update: () => void): void {
    this.ngZone.run(() => {
      update();
      this.cdr.detectChanges();
    });
  }

  generateJiraReport(): void {
    console.log('🚀 [Componente] Botão clicado - Iniciando geração de relatório');
    this.isGenerating = true;
    this.message = 'Gerando relatório... Por favor, aguarde.';
    this.messageType = '';

    console.log('📞 [Componente] Chamando jiraService.exportJiraReport()');
    this.jiraService.exportJiraReport(() => {
      this.runUiUpdate(() => {
        this.isGenerating = false;
        this.message = 'Download iniciado. O arquivo está sendo salvo.';
        this.messageType = 'success';
      });
    }).subscribe({
      next: (result) => {
        console.log('✅ [Componente] Resposta recebida:', result);
        this.runUiUpdate(() => {
          this.isGenerating = false;
          this.message = result.message;
          this.messageType = result.success ? 'success' : 'error';
        });
        
        // Limpar mensagem após 5 segundos
        setTimeout(() => {
          this.runUiUpdate(() => {
            this.message = '';
            this.messageType = '';
          });
        }, 5000);
      },
      error: (error) => {
        console.error('❌ [Componente] Erro ao gerar relatório:', error);
        console.error('❌ Detalhes do erro:', {
          status: error.status,
          statusText: error.statusText,
          message: error.message,
          error: error.error
        });
        
        // Tentar extrair mensagem específica do backend
        let errorMessage = 'Erro ao gerar relatório.';
        
        if (error.error?.message) {
          errorMessage = error.error.message;
        } else if (error.status === 400) {
          errorMessage = 'Credenciais do Jira não configuradas. Configure no perfil.';
        } else if (error.status === 401) {
          errorMessage = 'Sessão expirada. Faça login novamente.';
        } else if (error.status === 503) {
          errorMessage = 'Não foi possível conectar ao Jira. Verifique a conexão.';
        } else if (error.status === 0) {
          errorMessage = 'Não foi possível conectar ao servidor. Verifique sua conexão.';
        }
        
        this.runUiUpdate(() => {
          this.isGenerating = false;
          this.message = errorMessage;
          this.messageType = 'error';
        });
        
        // Limpar mensagem após 5 segundos
        setTimeout(() => {
          this.runUiUpdate(() => {
            this.message = '';
            this.messageType = '';
          });
        }, 5000);
      }
    });
  }

  generateContecReport(): void {
    console.log('🚀 [Componente] Botão Carros CONTEC clicado');
    this.isGeneratingContec = true;
    this.message = 'Gerando relatório CONTEC... Por favor, aguarde.';
    this.messageType = '';

    console.log('📞 [Componente] Chamando jiraService.exportContecReport()');
    this.jiraService.exportContecReport(() => {
      this.runUiUpdate(() => {
        this.isGeneratingContec = false;
        this.message = 'Download iniciado. O arquivo CONTEC está sendo salvo.';
        this.messageType = 'success';
      });
    }).subscribe({
      next: (result) => {
        console.log('✅ [Componente] Resposta CONTEC recebida:', result);
        this.runUiUpdate(() => {
          this.isGeneratingContec = false;
          this.message = result.message;
          this.messageType = result.success ? 'success' : 'error';
        });
        
        // Limpar mensagem após 5 segundos
        setTimeout(() => {
          this.runUiUpdate(() => {
            this.message = '';
            this.messageType = '';
          });
        }, 5000);
      },
      error: (error) => {
        console.error('❌ [Componente] Erro ao gerar relatório CONTEC:', error);
        console.error('❌ Detalhes do erro:', {
          status: error.status,
          statusText: error.statusText,
          message: error.message,
          error: error.error
        });
        
        // Tentar extrair mensagem específica do backend
        let errorMessage = 'Erro ao gerar relatório CONTEC.';
        
        if (error.error?.message) {
          errorMessage = error.error.message;
        } else if (error.status === 400) {
          errorMessage = 'Credenciais do Jira não configuradas. Configure no perfil.';
        } else if (error.status === 401) {
          errorMessage = 'Sessão expirada. Faça login novamente.';
        } else if (error.status === 503) {
          errorMessage = 'Não foi possível conectar ao Jira. Verifique a conexão.';
        } else if (error.status === 0) {
          errorMessage = 'Não foi possível conectar ao servidor. Verifique sua conexão.';
        }
        
        this.runUiUpdate(() => {
          this.isGeneratingContec = false;
          this.message = errorMessage;
          this.messageType = 'error';
        });
        
        // Limpar mensagem após 5 segundos
        setTimeout(() => {
          this.runUiUpdate(() => {
            this.message = '';
            this.messageType = '';
          });
        }, 5000);
      }
    });
  }
}
