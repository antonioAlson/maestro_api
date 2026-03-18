import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { JiraService } from '../../services/jira.service';
import { finalize, take } from 'rxjs/operators';

@Component({
  selector: 'app-ordens-producao',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ordens-producao.component.html',
  styleUrl: './ordens-producao.component.scss'
})
export class OrdensProducaoComponent implements OnInit {
  showReprogramModal = false;
  idsInput = '';
  dateInput = '';
  isProcessing = false;
  resultMessage = '';
  resultType: 'success' | 'error' | '' = '';
  private readonly feedbackDelayMs = 3000;

  constructor(private jiraService: JiraService) {}

  ngOnInit(): void {
  }

  openRoutine(routineName: string): void {
    console.log('Abrindo rotina:', routineName);
    
    if (routineName === 'reprogramar-massa') {
      this.openReprogramModal();
    } else {
      // TODO: Implementar outras rotinas
      alert(`Rotina "${routineName}" em desenvolvimento`);
    }
  }

  openReprogramModal(): void {
    this.showReprogramModal = true;
    this.idsInput = '';
    this.dateInput = '';
    this.resultMessage = '';
    this.resultType = '';
  }

  closeReprogramModal(): void {
    this.showReprogramModal = false;
    this.isProcessing = false;
  }

  private scheduleResetAfterFeedback(): void {
    setTimeout(() => {
      this.closeReprogramModal();
      this.idsInput = '';
      this.dateInput = '';
      this.resultMessage = '';
      this.resultType = '';
    }, this.feedbackDelayMs);
  }

  parseIds(rawInput: string): string[] {
    if (!rawInput) return [];
    
    // Separar por vírgula, ponto e vírgula, espaço ou quebra de linha
    return rawInput
      .split(/[,;\s\n]+/)
      .map(id => id.trim())
      .filter(id => id.length > 0);
  }

  normalizeDate(rawDate: string): string | null {
    if (!rawDate) return null;

    const cleaned = rawDate.trim();
    
    // Tentar diferentes formatos
    const formats = [
      { regex: /^(\d{4})-(\d{2})-(\d{2})$/, format: (m: RegExpMatchArray) => `${m[1]}-${m[2]}-${m[3]}` }, // YYYY-MM-DD
      { regex: /^(\d{2})\/(\d{2})\/(\d{4})$/, format: (m: RegExpMatchArray) => `${m[3]}-${m[2]}-${m[1]}` }, // DD/MM/YYYY
      { regex: /^(\d{2})-(\d{2})-(\d{4})$/, format: (m: RegExpMatchArray) => `${m[3]}-${m[2]}-${m[1]}` }  // DD-MM-YYYY
    ];

    for (const fmt of formats) {
      const match = cleaned.match(fmt.regex);
      if (match) {
        return fmt.format(match);
      }
    }

    return null;
  }

  reprogramar(): void {
    console.log('🚀 Iniciando reprogramação...');
    
    // Parse IDs
    const ids = this.parseIds(this.idsInput);
    if (ids.length === 0) {
      this.resultType = 'error';
      this.resultMessage = 'Por favor, informe pelo menos um ID';
      return;
    }

    // Normalize date
    const date = this.normalizeDate(this.dateInput);
    if (!date) {
      this.resultType = 'error';
      this.resultMessage = 'Data inválida. Use YYYY-MM-DD, DD/MM/YYYY ou DD-MM-YYYY';
      return;
    }

    this.isProcessing = true;
    this.resultMessage = 'Processando...';
    this.resultType = '';

    this.jiraService.reprogramarEmMassa(ids, date)
      .pipe(
        take(1),
        finalize(() => {
          this.isProcessing = false;
        })
      )
      .subscribe({
        next: (response) => {
          console.log('✅ Resposta:', response);

          if (response?.success) {
            this.resultType = 'success';
            this.resultMessage = response.message || 'Reprogramação concluída com sucesso.';

            if (response.data) {
              const { successCount, errorCount, total } = response.data;
              this.resultMessage += `\n\nTotal: ${total} | Sucesso: ${successCount} | Erros: ${errorCount}`;
            }
          } else {
            this.resultType = 'error';
            this.resultMessage = response?.message || 'Erro ao reprogramar';
          }

          this.scheduleResetAfterFeedback();
        },
        error: (error) => {
          console.error('❌ Erro:', error);
          this.resultType = 'error';
          this.resultMessage = error.error?.message || 'Erro ao conectar com o servidor';
          this.scheduleResetAfterFeedback();
        }
      });
  }
}
