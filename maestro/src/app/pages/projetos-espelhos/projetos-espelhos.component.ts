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
  activeAguardandoTab: 'aramida' | 'tenssylon' = 'aramida';
  isLoadingAguardandoProjeto = false;
  loadErrorAguardandoProjeto = '';
  isGeneratingEspelhos = false;
  generateMessage = '';
  generateMessageType: 'success' | 'error' | '' = '';
  showLogsModal = false;
  logsContent = '';
  isLoadingLogs = false;

  private markedCardIds = new Set<string>();
  private pendingCardIdForFileSelection: string | null = null;
  private selectedFilesByCardId = new Map<string, File>();

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

          this.refreshView();
        },
        error: (error) => {
          this.aguardandoProjetoItems = [];
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

  getAguardandoProjetoDisplay(item: EspelhoItem): EspelhoItemDisplay {
    const osNumber = this.getOsNumberForCard(item.id);
    const resumoSemOs = this.removerOsDoResumo(item.resumo, osNumber);
    const resumo = this.abreviarResumo(resumoSemOs);
    const veiculo = this.abreviarVeiculo(item.veiculo);

    const text = [osNumber, veiculo, resumo, item.previsao]
      .map((value) => String(value || '').trim())
      .filter((value) => value.length > 0 && value !== '-')
      .join(' - ');

    const fullText = [osNumber, resumoSemOs, item.veiculo, item.previsao]
      .map((value) => String(value || '').trim())
      .filter((value) => value.length > 0 && value !== '-')
      .join(' - ');

    return { text, fullText };
  }

  private removerOsDoResumo(resumo: string, osNumber: string): string {
    const value = String(resumo || '').trim();
    const osValue = String(osNumber || '').trim();

    if (!value || !osValue) {
      return value;
    }

    const escaped = osValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const withoutOs = value.replace(new RegExp(`\\b${escaped}\\b`, 'g'), ' ');
    const normalized = withoutOs
      .split('-')
      .map((part) => part.trim())
      .filter((part) => part.length > 0)
      .join(' - ')
      .replace(/\s{2,}/g, ' ')
      .trim();

    return normalized || value;
  }

  onAguardandoCardClick(item: EspelhoItem, fileInput: HTMLInputElement): void {
    if (!item?.id || this.isLoadingAguardandoProjeto) {
      return;
    }

    this.pendingCardIdForFileSelection = item.id;
    fileInput.value = '';
    fileInput.click();

    this.refreshView();
  }

  getSelectedFileNameForCard(cardId: string): string {
    return this.selectedFilesByCardId.get(cardId)?.name || '';
  }

  hasSelectedFileForCard(cardId: string): boolean {
    return this.selectedFilesByCardId.has(cardId);
  }

  setAguardandoTab(tab: 'aramida' | 'tenssylon'): void {
    this.activeAguardandoTab = tab;
    this.refreshView();
  }

  get filteredAguardandoProjetoItems(): EspelhoItem[] {
    if (this.activeAguardandoTab === 'tenssylon') {
      return this.aguardandoProjetoItems.filter((item) => item.id?.toUpperCase().startsWith('TENSYLON-'));
    }

    return this.aguardandoProjetoItems.filter((item) => !item.id?.toUpperCase().startsWith('TENSYLON-'));
  }

  private associateFileWithPendingCard(file: File): void {
    const cardId = this.pendingCardIdForFileSelection;
    this.pendingCardIdForFileSelection = null;

    if (!cardId) {
      return;
    }

    this.selectedFilesByCardId.set(cardId, file);
    this.markedCardIds.add(cardId);
    this.updateAssociationFeedbackMessage();

    this.refreshView();
  }

  private updateAssociationFeedbackMessage(): void {
    const selectedCardIds = Array.from(this.markedCardIds)
      .filter((id) => this.selectedFilesByCardId.has(id))
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));

    if (selectedCardIds.length === 0) {
      this.generateMessage = '';
      this.generateMessageType = '';
      return;
    }

    const selectedOsNumbers = selectedCardIds.map((id) => this.getOsNumberForCard(id));

    this.generateMessageType = 'success';
    this.generateMessage = `Cards selecionados: ${selectedOsNumbers.join(', ')}`;
  }

  private getOsNumberForCard(cardId: string): string {
    const item = this.aguardandoProjetoItems.find((card) => card.id === cardId);
    const resumo = String(item?.resumo || '').trim();

    if (!resumo) {
      return cardId;
    }

    const digitGroups = resumo.match(/\d+/g);
    if (digitGroups && digitGroups.length > 0) {
      return digitGroups[digitGroups.length - 1];
    }

    return resumo;
  }

  private buildFilesByCardPayload(ids: string[]): Record<string, File> {
    return ids.reduce((acc, id) => {
      const selectedFile = this.selectedFilesByCardId.get(id);
      if (selectedFile) {
        acc[id] = selectedFile;
      }
      return acc;
    }, {} as Record<string, File>);
  }

  private hasFileForAllSelectedCards(ids: string[]): boolean {
    return ids.every((id) => this.selectedFilesByCardId.has(id));
  }

  hasAnySelectedFile(): boolean {
    return this.selectedFilesByCardId.size > 0;
  }

  private clearSelectedCardsAndFiles(): void {
    this.markedCardIds.clear();
    this.selectedFilesByCardId.clear();

    this.refreshView();
  }

  isAguardandoCardMarked(cardId: string): boolean {
    return this.markedCardIds.has(cardId);
  }

  canGenerateEspelhos(): boolean {
    return this.markedCardIds.size > 0 && !this.isGeneratingEspelhos;
  }

  isSelectionFeedback(): boolean {
    return this.generateMessage.startsWith('Cards selecionados:');
  }

  openProjectFilePicker(fileInput: HTMLInputElement): void {
    if (this.isGeneratingEspelhos) {
      return;
    }

    fileInput.value = '';
    fileInput.click();
  }

  onProjectFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;

    if (!file) {
      this.pendingCardIdForFileSelection = null;
      return;
    }

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      this.pendingCardIdForFileSelection = null;
      this.generateMessageType = 'error';
      this.generateMessage = 'Selecione um arquivo PDF para juntar com o espelho.';
      this.refreshView();
      return;
    }

    if (this.pendingCardIdForFileSelection) {
      this.associateFileWithPendingCard(file);
      return;
    }

    this.generateMessageType = 'error';
    this.generateMessage = 'Clique em um card para escolher o PDF desse card.';
    this.refreshView();
  }

  clearSelectedProjectFile(): void {
    this.clearSelectedCardsAndFiles();
    this.generateMessage = '';
    this.generateMessageType = '';
    this.refreshView();
  }

  gerarEspelhos(): void {
    const ids = Array.from(this.markedCardIds);
    if (ids.length === 0) {
      this.generateMessageType = 'error';
      this.generateMessage = 'Clique em um card para selecionar o PDF e gerar espelhos.';
      this.refreshView();
      return;
    }

    if (!this.hasFileForAllSelectedCards(ids)) {
      this.generateMessageType = 'error';
      this.generateMessage = 'Selecione um PDF para cada card antes de gerar os espelhos.';
      this.refreshView();
      return;
    }

    const filesByCard = this.buildFilesByCardPayload(ids);

    this.isGeneratingEspelhos = true;
    this.generateMessage = 'Gerando espelhos e juntando com os PDFs selecionados...';
    this.generateMessageType = '';
    this.refreshView();

    this.jiraService.gerarEspelhos(ids, null, filesByCard)
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
            this.clearSelectedCardsAndFiles();
          } else {
            this.generateMessageType = 'success';
            this.generateMessage = response?.message || 'Espelhos gerados com sucesso.';
            this.clearSelectedCardsAndFiles();
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
    const abbreviated = words.map((word) => aliases[word] || word.slice(0, 20));
    const compact = abbreviated.join(' ');

    if (compact.length <= 80) {
      return compact;
    }

    return `${compact.slice(0, 79)}…`;
  }

  private refreshView(): void {
    try {
      this.cdr.detectChanges();
    } catch {
      // Ignora se chamado fora de ciclo de renderização.
    }
  }

  abrirLogsModal(): void {
    this.showLogsModal = true;
    this.isLoadingLogs = true;
    this.logsContent = '';
    this.refreshView();

    this.jiraService.obterLogsEspelhos()
      .pipe(
        take(1),
        finalize(() => {
          this.isLoadingLogs = false;
          this.refreshView();
        })
      )
      .subscribe({
        next: (response) => {
          if (response?.success) {
            this.logsContent = response.data?.logs || 'Nenhum log encontrado.';
          } else {
            this.logsContent = 'Erro ao carregar logs.';
          }
          this.refreshView();
        },
        error: () => {
          this.logsContent = 'Erro ao carregar logs.';
          this.refreshView();
        }
      });
  }

  fecharLogsModal(): void {
    this.showLogsModal = false;
    this.refreshView();
  }
}
