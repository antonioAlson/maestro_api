import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { finalize, take, timeout } from 'rxjs/operators';
import { JiraService } from '../../services/jira.service';

interface EspelhoItem {
  id: string;
  resumo: string;
  veiculo: string;
  previsao: string;
}

interface EspelhoItemDisplay {
  text: string;
  fullText: string;
}

@Component({
  selector: 'app-projetos-espelhos',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './projetos-espelhos.component.html',
  styleUrl: './projetos-espelhos.component.scss'
})
export class ProjetosEspelhosComponent implements OnInit {
  aguardandoProjetoItems: EspelhoItem[] = [];
  liberadosItems: EspelhoItem[] = [];
  isLoadingAguardandoProjeto = false;
  loadErrorAguardandoProjeto = '';
  isGeneratingEspelhos = false;
  generateMessage = '';
  generateMessageType: 'success' | 'error' | '' = '';

  private markedCardIds = new Set<string>();

  private readonly requestTimeoutMs = 60000;

  constructor(
    private jiraService: JiraService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.carregarAguardandoProjeto();
  }

  carregarAguardandoProjeto(): void {
    this.isLoadingAguardandoProjeto = true;
    this.loadErrorAguardandoProjeto = '';
    this.refreshView();

    this.jiraService.getJiraIssues(false)
      .pipe(
        timeout(this.requestTimeoutMs),
        take(1),
        finalize(() => {
          this.isLoadingAguardandoProjeto = false;
          this.refreshView();
        })
      )
      .subscribe({
        next: (response: any) => {
          if (!response?.success || !Array.isArray(response.data)) {
            this.aguardandoProjetoItems = [];
            this.loadErrorAguardandoProjeto = 'Não foi possível carregar os dados do Jira.';
            this.refreshView();
            return;
          }

          this.aguardandoProjetoItems = response.data
            .filter((issue: any) => this.isStatusAProduzir(issue?.status))
            .map((issue: any) => ({
              id: (issue?.key || '').toString().trim(),
              resumo: (issue?.resumo || '').toString().trim() || '-',
              veiculo: (issue?.veiculo || '').toString().trim() || '-',
              previsao: (issue?.previsao || '').toString().trim() || '-'
            }));

          // Temporario: manter a coluna "Liberados" sem carga de itens.
          this.liberadosItems = [];

          this.refreshView();
        },
        error: (error) => {
          this.aguardandoProjetoItems = [];
          this.liberadosItems = [];
          if (error?.name === 'TimeoutError') {
            this.loadErrorAguardandoProjeto = `Tempo limite excedido (${this.requestTimeoutMs / 1000}s).`;
          } else {
            this.loadErrorAguardandoProjeto = error?.error?.message || 'Erro ao carregar cartões do Jira.';
          }
          this.refreshView();
        }
      });
  }

  private isStatusAProduzir(status: unknown): boolean {
    const normalized = (status || '')
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

    return normalized === 'a produzir' || normalized.includes('a produzir');
  }

  private isStatusLiberadoEngenharia(status: unknown): boolean {
    const normalized = (status || '')
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

    return normalized === 'liberado engenharia' || normalized.includes('liberado engenharia');
  }

  getAguardandoProjetoDisplay(item: EspelhoItem): EspelhoItemDisplay {
    const resumo = this.abreviarResumo(item.resumo);
    const veiculo = this.abreviarVeiculo(item.veiculo);
    const text = `${resumo} - ${veiculo} - ${item.previsao}`;
    const fullText = `${item.resumo} - ${item.veiculo} - ${item.previsao}`;

    return { text, fullText };
  }

  onAguardandoCardClick(item: EspelhoItem): void {
    if (!item?.id || this.isLoadingAguardandoProjeto) {
      return;
    }

    if (this.markedCardIds.has(item.id)) {
      this.markedCardIds.delete(item.id);
    } else {
      this.markedCardIds.add(item.id);
    }

    this.refreshView();
  }

  isAguardandoCardMarked(cardId: string): boolean {
    return this.markedCardIds.has(cardId);
  }

  canGenerateEspelhos(): boolean {
    return this.markedCardIds.size > 0 && !this.isGeneratingEspelhos;
  }

  gerarEspelhos(): void {
    const ids = Array.from(this.markedCardIds);
    if (ids.length === 0) {
      this.generateMessageType = 'error';
      this.generateMessage = 'Selecione ao menos um card para gerar espelhos.';
      this.refreshView();
      return;
    }

    this.isGeneratingEspelhos = true;
    this.generateMessage = 'Gerando espelhos...';
    this.generateMessageType = '';
    this.refreshView();

    this.jiraService.gerarEspelhos(ids)
      .pipe(
        take(1),
        finalize(() => {
          this.isGeneratingEspelhos = false;
          this.refreshView();
        })
      )
      .subscribe({
        next: (response: any) => {
          const generated = response?.data?.generated;
          if (typeof generated === 'number') {
            this.generateMessageType = 'success';
            this.generateMessage = `Espelhos gerados: ${generated}`;
          } else {
            this.generateMessageType = 'success';
            this.generateMessage = response?.message || 'Espelhos gerados com sucesso.';
          }
          this.refreshView();
        },
        error: (error) => {
          this.generateMessageType = 'error';
          this.generateMessage = error?.error?.message || 'Erro ao gerar espelhos.';
          this.refreshView();
        }
      });
  }

  private abreviarResumo(resumo: string): string {
    const value = (resumo || '').trim();
    if (!value) {
      return '-';
    }

    if (value.length <= 12) {
      return value;
    }

    return `${value.slice(0, 11)}…`;
  }

  private abreviarVeiculo(veiculo: string): string {
    const value = (veiculo || '').trim();
    if (!value) {
      return '-';
    }

    const normalized = value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase();

    const aliases: Record<string, string> = {
      'CAMINHAO': 'CAM.',
      'CARRETA': 'CAR.',
      'UTILITARIO': 'UTIL.',
      'UTILITARIOS': 'UTIL.',
      'CAMIONETE': 'CAMION.',
      'VEICULO': 'VEIC.',
      'TRUCK': 'TRK',
      'VAN': 'VAN'
    };

    const words = normalized.split(/\s+/).filter(Boolean);
    const abbreviated = words.map((word) => aliases[word] || word.slice(0, 4));
    const compact = abbreviated.join(' ');

    if (compact.length <= 12) {
      return compact;
    }

    return `${compact.slice(0, 11)}…`;
  }

  private refreshView(): void {
    try {
      this.cdr.detectChanges();
    } catch {
      // Ignora se chamado fora de ciclo de renderização.
    }
  }
}
