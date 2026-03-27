import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize, take, timeout } from 'rxjs/operators';
import { JiraService } from '../../services/jira.service';

interface EspelhoItem {
  id: string;
  resumo: string;
  veiculo: string;
  previsao: string;
  numeroProjeto: string;
}

interface EspelhoItemDisplay {
  text: string;
  fullText: string;
}

interface ConsumoCampos {
  c8: string;
  c9: string;
  c11: string;
}

@Component({
  selector: 'app-projetos-espelhos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './projetos-espelhos.component.html',
  styleUrl: './projetos-espelhos.component.scss'
})
export class ProjetosEspelhosComponent implements OnInit {
  aguardandoProjetoItems: EspelhoItem[] = [];
  activeAguardandoTab: 'aramida' | 'tenssylon' = 'tenssylon';
  isLoadingAguardandoProjeto = false;
  loadErrorAguardandoProjeto = '';
  isGeneratingEspelhos = false;
  generateMessage = '';
  generateMessageType: 'success' | 'error' | '' = '';
  showLogsModal = false;
  logsContent = '';
  isLoadingLogs = false;
  searchTerm = '';

  // Modal de quantidade de peças
  showQuantidadeModal = false;
  quantidadePecas: number | null = null;
  quantidadeTampas: number | null = null;
  consumo8C = '';
  consumo9C = '';
  consumo11C = '';
  pendingCardForQuantity: string | null = null;
  pendingFilesForQuantity: File[] = [];

  private markedCardIds = new Set<string>();
  private pendingCardIdForFileSelection: string | null = null;
  private selectedFilesByCardId = new Map<string, File[]>(); // Array de arquivos por card
  private quantidadeByCardId = new Map<string, number>(); // Quantidade de peças por card
  private quantidadeTampasByCardId = new Map<string, number>(); // Quantidade de tampas por card (contra capa)
  private consumoByCardId = new Map<string, ConsumoCampos>(); // Campos de consumo por card

  private readonly requestTimeoutMs = 60000;

  constructor(
    private jiraService: JiraService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.carregarAguardandoProjeto();
  }

  onSearchChange(): void {
    this.refreshView();
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
            .filter((issue: any) => this.isStatusValido(issue?.status))
            .map((issue: any) => ({
              id: (issue?.key || '').toString().trim(),
              resumo: (issue?.resumo || '').toString().trim() || '-',
              veiculo: (issue?.veiculo || '').toString().trim() || '-',
              previsao: (issue?.previsao || '').toString().trim() || '-',
              numeroProjeto: (issue?.numeroProjeto || '').toString().trim() || '-'
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

  private isStatusValido(status: unknown): boolean {
    const normalized = (status || '')
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[\u{1F300}-\u{1F9FF}]/gu, '') // Remove emojis
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

    // Aceita "A Produzir" ou "Recebido Não liberado"
    return normalized === 'a produzir' || 
           normalized.includes('a produzir') ||
           normalized === 'recebido nao liberado' ||
           (normalized.includes('recebido') && normalized.includes('nao liberado'));
  }

  getAguardandoProjetoDisplay(item: EspelhoItem): EspelhoItemDisplay {
    const osNumber = this.getOsNumberForCard(item.id);
    const resumoSemOs = this.removerOsDoResumo(item.resumo, osNumber);
    const resumo = this.abreviarResumo(resumoSemOs);
    const veiculo = this.abreviarVeiculo(item.veiculo);
    const numeroProjeto = String(item.numeroProjeto || '').trim() || '-';
    const projetoLabel = numeroProjeto !== '-' ? `Projeto: ${numeroProjeto}` : '-';

    const text = [osNumber, veiculo, resumo, projetoLabel]
      .map((value) => String(value || '').trim())
      .filter((value) => value.length > 0 && value !== '-')
      .join(' - ');

    const fullText = [osNumber, resumoSemOs, item.veiculo, projetoLabel]
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
    if (!item?.id || this.isLoadingAguardandoProjeto || this.isGeneratingEspelhos) {
      return;
    }

    this.pendingCardIdForFileSelection = item.id;
    fileInput.value = '';
    fileInput.click();

    this.refreshView();
  }

  getSelectedFileNameForCard(cardId: string): string {
    const files = this.selectedFilesByCardId.get(cardId);
    if (!files || files.length === 0) return '';
    if (files.length === 1) return files[0].name;
    return `${files.length} arquivos`;
  }

  hasSelectedFileForCard(cardId: string): boolean {
    return this.selectedFilesByCardId.has(cardId);
  }

  setAguardandoTab(tab: 'aramida' | 'tenssylon'): void {
    this.activeAguardandoTab = tab;
    this.refreshView();
  }

  get filteredAguardandoProjetoItems(): EspelhoItem[] {
    let items: EspelhoItem[];
    
    // Filtrar por tab (Aramida ou Tensylon)
    if (this.activeAguardandoTab === 'tenssylon') {
      items = this.aguardandoProjetoItems.filter((item) => item.id?.toUpperCase().startsWith('TENSYLON-'));
    } else {
      items = this.aguardandoProjetoItems.filter((item) => !item.id?.toUpperCase().startsWith('TENSYLON-'));
    }

    // Aplicar filtro de pesquisa
    if (this.searchTerm && this.searchTerm.trim().length > 0) {
      const searchLower = this.searchTerm.trim().toLowerCase();
      
      items = items.filter((item) => {
        const osNumber = this.getOsNumberForCard(item.id).toLowerCase();
        const id = (item.id || '').toLowerCase();
        const resumo = (item.resumo || '').toLowerCase();
        const veiculo = (item.veiculo || '').toLowerCase();
        const previsao = (item.previsao || '').toLowerCase();
        
        return osNumber.includes(searchLower) ||
               id.includes(searchLower) ||
               resumo.includes(searchLower) ||
               veiculo.includes(searchLower) ||
               previsao.includes(searchLower);
      });
    }

    return items;
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

    const selectedInfo = selectedCardIds.map((id) => {
      const osNum = this.getOsNumberForCard(id);
      const fileCount = this.selectedFilesByCardId.get(id)?.length || 0;
      const quantidade = this.quantidadeByCardId.get(id) || 0;
      
      if (fileCount > 1) {
        return `${osNum} (${fileCount} PDFs, ${quantidade}x)`;
      } else {
        return `${osNum} (${quantidade}x)`;
      }
    });

    this.generateMessageType = 'success';
    this.generateMessage = `Cards selecionados: ${selectedInfo.join(', ')}`;
  }

  getOsNumberForCard(cardId: string): string {
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

  getVeiculoForCard(cardId: string): string {
    const item = this.aguardandoProjetoItems.find((card) => card.id === cardId);
    return String(item?.veiculo || 'Não informado').trim();
  }

  isPendingCardTensylon(): boolean {
    return String(this.pendingCardForQuantity || '').toUpperCase().startsWith('TENSYLON-');
  }

  private buildFilesByCardPayload(ids: string[]): Record<string, File[]> {
    return ids.reduce((acc, id) => {
      const selectedFiles = this.selectedFilesByCardId.get(id);
      if (selectedFiles && selectedFiles.length > 0) {
        acc[id] = selectedFiles;
      }
      return acc;
    }, {} as Record<string, File[]>);
  }

  private buildQuantidadesByCardPayload(ids: string[]): Record<string, number> {
    return ids.reduce((acc, id) => {
      const quantidade = this.quantidadeByCardId.get(id);
      if (quantidade) {
        acc[id] = quantidade;
      }
      return acc;
    }, {} as Record<string, number>);
  }

  private buildQuantidadesTampasByCardPayload(ids: string[]): Record<string, number> {
    return ids.reduce((acc, id) => {
      const quantidade = this.quantidadeTampasByCardId.get(id);
      if (quantidade) {
        acc[id] = quantidade;
      }
      return acc;
    }, {} as Record<string, number>);
  }

  private buildConsumosByCardPayload(ids: string[]): Record<string, ConsumoCampos> {
    return ids.reduce((acc, id) => {
      const consumo = this.consumoByCardId.get(id) || { c8: '', c9: '', c11: '' };
      acc[id] = {
        c8: String(consumo.c8 || '').trim(),
        c9: String(consumo.c9 || '').trim(),
        c11: String(consumo.c11 || '').trim()
      };
      return acc;
    }, {} as Record<string, ConsumoCampos>);
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
    this.quantidadeByCardId.clear();
    this.quantidadeTampasByCardId.clear();
    this.consumoByCardId.clear();

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

  onProjectFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;

    if (!files || files.length === 0) {
      this.pendingCardIdForFileSelection = null;
      return;
    }

    // Validar que todos são PDFs
    const filesArray = Array.from(files);
    const nonPdfFiles = filesArray.filter(
      file => file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')
    );

    if (nonPdfFiles.length > 0) {
      this.pendingCardIdForFileSelection = null;
      this.generateMessageType = 'error';
      this.generateMessage = 'Selecione apenas arquivos PDF para juntar com o espelho.';
      this.refreshView();
      return;
    }

    if (!this.pendingCardIdForFileSelection) {
      this.generateMessageType = 'error';
      this.generateMessage = 'Clique em um card para escolher os PDFs desse card.';
      this.refreshView();
      return;
    }

    // Mostrar modal para solicitar quantidade de peças
    this.pendingCardForQuantity = this.pendingCardIdForFileSelection;
    this.pendingFilesForQuantity = filesArray;
    this.quantidadePecas = null;
    this.quantidadeTampas = this.quantidadeTampasByCardId.get(this.pendingCardForQuantity) ?? null;

    const consumoSalvo = this.consumoByCardId.get(this.pendingCardForQuantity) || { c8: '', c9: '', c11: '' };
    this.consumo8C = consumoSalvo.c8;
    this.consumo9C = consumoSalvo.c9;
    this.consumo11C = consumoSalvo.c11;

    this.showQuantidadeModal = true;
    this.refreshView();
  }

  confirmarQuantidade(): void {
    if (!this.quantidadePecas || this.quantidadePecas < 1 || !this.pendingCardForQuantity) {
      return;
    }

    if (!this.isPendingCardTensylon() && (!this.quantidadeTampas || this.quantidadeTampas < 1)) {
      this.generateMessageType = 'error';
      this.generateMessage = 'Informe a quantidade de tampas para a contra capa.';
      this.refreshView();
      return;
    }

    const cardId = this.pendingCardForQuantity;
    const files = this.pendingFilesForQuantity;

    // Armazenar arquivos e quantidade
    this.selectedFilesByCardId.set(cardId, files);
    this.quantidadeByCardId.set(cardId, this.quantidadePecas);
    if (!this.isPendingCardTensylon() && this.quantidadeTampas && this.quantidadeTampas > 0) {
      this.quantidadeTampasByCardId.set(cardId, this.quantidadeTampas);
    } else {
      this.quantidadeTampasByCardId.delete(cardId);
    }
    this.consumoByCardId.set(cardId, {
      c8: String(this.consumo8C || '').trim(),
      c9: String(this.consumo9C || '').trim(),
      c11: String(this.consumo11C || '').trim()
    });
    this.markedCardIds.add(cardId);

    // Limpar estados temporários
    this.showQuantidadeModal = false;
    this.pendingCardIdForFileSelection = null;
    this.pendingCardForQuantity = null;
    this.pendingFilesForQuantity = [];
    this.quantidadePecas = null;
    this.quantidadeTampas = null;
    this.consumo8C = '';
    this.consumo9C = '';
    this.consumo11C = '';

    this.updateAssociationFeedbackMessage();
    this.refreshView();
  }

  cancelarQuantidade(): void {
    this.showQuantidadeModal = false;
    this.pendingCardIdForFileSelection = null;
    this.pendingCardForQuantity = null;
    this.pendingFilesForQuantity = [];
    this.quantidadePecas = null;
    this.quantidadeTampas = null;
    this.consumo8C = '';
    this.consumo9C = '';
    this.consumo11C = '';
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
    const quantidadesByCard = this.buildQuantidadesByCardPayload(ids);
    const quantidadesTampasByCard = this.buildQuantidadesTampasByCardPayload(ids);
    const consumosByCard = this.buildConsumosByCardPayload(ids);

    this.isGeneratingEspelhos = true;
    this.generateMessage = 'Gerando espelhos e juntando com os PDFs selecionados...';
    this.generateMessageType = '';
    this.refreshView();

    this.jiraService.gerarEspelhos(ids, null, filesByCard, true, quantidadesByCard, quantidadesTampasByCard, consumosByCard)
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
