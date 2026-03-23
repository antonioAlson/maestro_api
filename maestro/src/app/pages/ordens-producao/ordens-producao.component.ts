import { Component, OnInit, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { JiraService } from '../../services/jira.service';
import { FilterIssuesPipe } from './filter-issues.pipe';
import { finalize, take, timeout } from 'rxjs/operators';
import JSZip from 'jszip';

type MultiFilterColumn = 'status' | 'situacao' | 'previsao' | 'novaData';
type FilterColumn = MultiFilterColumn;
type SortDirection = '' | 'asc' | 'desc';

interface SortConfig {
  column: '' | MultiFilterColumn;
  direction: SortDirection;
}

interface FilterOption {
  value: string;
  label: string;
}

interface ColumnFiltersState {
  status: string[];
  situacao: string[];
  previsao: string[];
  novaData: string[];
}

@Component({
  selector: 'app-ordens-producao',
  standalone: true,
  imports: [CommonModule, FormsModule, FilterIssuesPipe],
  templateUrl: './ordens-producao.component.html',
  styleUrl: './ordens-producao.component.scss'
})
export class OrdensProducaoComponent implements OnInit {
    searchTerm: string = '';
  activeFilterMenu: '' | 'status' | 'situacao' | 'previsao' | 'novaData' = '';
  filterMenuPosition = { top: 0, left: 0 };
  filterOptionSearch = '';
  sortConfig: SortConfig = {
    column: '',
    direction: ''
  };
  columnFilters: ColumnFiltersState = {
    status: [],
    situacao: [],
    previsao: [],
    novaData: []
  };
  statusOptions: string[] = [];
  situacaoOptions: string[] = [];
  readonly previsaoOptions = [
    { value: 'com-data', label: 'Com data' },
    { value: 'sem-data', label: 'Sem data' }
  ];
  readonly novaDataOptions = [
    { value: 'com-data', label: 'Preenchida' },
    { value: 'sem-data', label: 'Vazia' }
  ];
  showReprogramModal = false;
  showPrintModal = false;
  showAlterarDatasModal = false;
  showReprogramPopup = false;
  reprogramPopupType: 'success' | 'error' | '' = '';
  reprogramPopupMessage = '';
  idsInput = '';
  dateInput = '';
  isProcessing = false;
  resultMessage = '';
  resultType: 'success' | 'error' | '' = '';
  dateIsValid = true;
  parsedIdsCount = 0;
  
  // Propriedades para busca de arquivos
  printIdsInput = '';
  parsedPrintIdsCount = 0;
  foundFiles: Array<{url: string, name: string, cardId: string, selected: boolean, downloaded: boolean, extension?: string, isPdf?: boolean}> = [];
  isSearchingFiles = false;
  downloadProgress = 0;
  totalFilesToDownload = 0;
  
  // Propriedades para alterar datas individuais
  issuesSemData: Array<{
    key: string;
    resumo: string | number;
    status: string;
    situacao: string;
    veiculo: string;
    previsao: string;
    novaData: string;
  }> = [];
  isLoadingIssues = false;
  
  private readonly feedbackDelayMs = 6000;
  private readonly requestTimeoutMs = 60000; // 1 minuto (otimizado)
  private readonly downloadBatchSize = 15; // Downloads simultâneos (otimizado de 5 para 15)
  private processingGuardTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private jiraService: JiraService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent): void {
    // ESC fecha qualquer modal aberto
    if (event.key === 'Escape') {
      if (this.showReprogramPopup) {
        this.closeReprogramPopup();
        event.preventDefault();
      } else if (this.showReprogramModal) {
        this.closeReprogramModal();
        event.preventDefault();
      } else if (this.showPrintModal) {
        this.closePrintModal();
        event.preventDefault();
      } else if (this.showAlterarDatasModal) {
        this.closeAlterarDatasModal();
        event.preventDefault();
      }
    }
    
    // ENTER confirma o botão principal se disponível
    if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.altKey) {
      // Verificar se não está em um textarea ou input de data
      const target = event.target as HTMLElement;
      if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
        return; // Permitir ENTER normal em textarea e inputs
      }
      
      if (this.showReprogramModal && !this.isProcessing && this.parsedIdsCount > 0 && this.canReprogramWithDate()) {
        this.reprogramar();
        event.preventDefault();
      } else if (this.showPrintModal && !this.isProcessing && this.parsedPrintIdsCount > 0) {
        this.buscarEBaixarPdfs();
        event.preventDefault();
      } else if (this.showAlterarDatasModal && !this.isProcessing) {
        this.salvarDatasIndividuais();
        event.preventDefault();
      }
    }
  }

  @HostListener('document:click', ['$event'])
  handleDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    const clickedInsideFilterArea = !!target?.closest('.filterable-header, .filter-popup');

    if (!clickedInsideFilterArea && this.activeFilterMenu) {
      setTimeout(() => {
        this.activeFilterMenu = '';
        this.filterOptionSearch = '';
        this.refreshView();
      }, 0);
    }
  }

  toggleFilterMenu(column: FilterColumn, event: Event): void {
    event.stopPropagation();

    if (this.activeFilterMenu === column) {
      this.activeFilterMenu = '';
      this.filterOptionSearch = '';
      this.refreshView();
      return;
    }

    const trigger = event.currentTarget as HTMLElement | null;
    if (trigger) {
      const rect = trigger.getBoundingClientRect();
      const popupWidth = 270;
      const popupHeight = 220;
      const margin = 10;

      let top = rect.bottom + 8;
      let left = rect.right - popupWidth;

      if (left < margin) {
        left = margin;
      }

      if (left + popupWidth > window.innerWidth - margin) {
        left = window.innerWidth - popupWidth - margin;
      }

      if (top + popupHeight > window.innerHeight - margin) {
        top = Math.max(margin, rect.top - popupHeight - 8);
      }

      this.filterMenuPosition = { top, left };
    }

    this.activeFilterMenu = column;
    this.filterOptionSearch = '';
    this.refreshView();
  }

  clearColumnFilter(column: FilterColumn): void {
    this.columnFilters[column] = [];
    this.refreshView();
  }

  hasActiveFilter(column: FilterColumn): boolean {
    return this.columnFilters[column].length > 0;
  }

  closeActiveFilterMenu(): void {
    if (!this.activeFilterMenu) {
      return;
    }

    this.activeFilterMenu = '';
    this.filterOptionSearch = '';
    this.refreshView();
  }

  clearAllFilters(): void {
    this.searchTerm = '';
    this.filterOptionSearch = '';
    this.sortConfig = { column: '', direction: '' };
    this.activeFilterMenu = '';
    this.resetColumnFilters();
    this.refreshView();
  }

  getActiveFilterTitle(): string {
    switch (this.activeFilterMenu) {
      case 'status':
        return 'Status';
      case 'situacao':
        return 'Situação';
      case 'previsao':
        return 'Prev. Atual';
      case 'novaData':
        return 'Nova Data';
      default:
        return 'Filtro';
    }
  }

  getSortBadgeText(): string {
    if (!this.activeFilterMenu || this.sortConfig.column !== this.activeFilterMenu || this.sortConfig.direction === '') {
      return 'Sem ordem';
    }

    return this.sortConfig.direction === 'asc' ? 'Crescente' : 'Decrescente';
  }

  getVisibleFilterOptions(): FilterOption[] {
    if (!this.activeFilterMenu) {
      return [];
    }

    const search = this.filterOptionSearch.trim().toLowerCase();
    const options = this.getOptionsByColumn(this.activeFilterMenu);

    if (!search) {
      return options;
    }

    return options.filter(option => option.label.toLowerCase().includes(search));
  }

  getSelectedCountForActiveFilter(): number {
    if (!this.activeFilterMenu) {
      return 0;
    }

    return this.columnFilters[this.activeFilterMenu].length;
  }

  toggleSelectVisibleOptions(): void {
    if (!this.activeFilterMenu) {
      return;
    }

    const visibleOptions = this.getVisibleFilterOptions();
    const visibleValues = visibleOptions.map(option => option.value);
    const selectedValues = this.columnFilters[this.activeFilterMenu];
    const allVisibleSelected = visibleValues.length > 0 && visibleValues.every(value => selectedValues.includes(value));

    if (allVisibleSelected) {
      this.columnFilters[this.activeFilterMenu] = selectedValues.filter(value => !visibleValues.includes(value));
    } else {
      const merged = [...selectedValues];
      visibleValues.forEach(value => {
        if (!merged.includes(value)) {
          merged.push(value);
        }
      });
      this.columnFilters[this.activeFilterMenu] = merged;
    }

    this.refreshView();
  }

  getToggleVisibleButtonLabel(): string {
    if (!this.activeFilterMenu) {
      return 'Selecionar visíveis';
    }

    const visibleOptions = this.getVisibleFilterOptions();
    const selectedValues = this.columnFilters[this.activeFilterMenu];
    const allVisibleSelected = visibleOptions.length > 0 && visibleOptions.every(option => selectedValues.includes(option.value));

    return allVisibleSelected ? 'Limpar' : 'Selecionar visíveis';
  }

  toggleSortForActiveFilter(): void {
    const targetColumn = this.activeFilterMenu;
    if (!targetColumn) {
      return;
    }

    if (this.sortConfig.column !== targetColumn || this.sortConfig.direction === '') {
      this.sortConfig = { column: targetColumn, direction: 'asc' };
    } else if (this.sortConfig.direction === 'asc') {
      this.sortConfig = { column: targetColumn, direction: 'desc' };
    } else {
      this.sortConfig = { column: '', direction: '' };
    }

    this.refreshView();
  }

  getSortButtonLabel(): string {
    if (!this.activeFilterMenu || this.sortConfig.column !== this.activeFilterMenu || this.sortConfig.direction === '') {
      return 'Ordenar';
    }

    return this.sortConfig.direction === 'asc' ? 'Ordem: Crescente' : 'Ordem: Decrescente';
  }

  isFilterOptionSelected(column: MultiFilterColumn, value: string): boolean {
    return this.columnFilters[column].includes(value);
  }

  onFilterOptionChange(column: MultiFilterColumn, value: string, event: Event): void {
    const target = event.target as HTMLInputElement;
    const checked = target.checked;
    const currentValues = this.columnFilters[column];

    if (checked && !currentValues.includes(value)) {
      this.columnFilters[column] = [...currentValues, value];
    }

    if (!checked) {
      this.columnFilters[column] = currentValues.filter(item => item !== value);
    }

    this.refreshView();
  }

  private getOptionsByColumn(column: MultiFilterColumn): FilterOption[] {
    switch (column) {
      case 'status':
        return this.statusOptions.map(item => ({ value: item, label: item }));
      case 'situacao':
        return this.situacaoOptions.map(item => ({ value: item, label: item }));
      case 'previsao':
        return this.previsaoOptions.map(item => ({ value: item.value, label: item.label }));
      case 'novaData':
        return this.novaDataOptions.map(item => ({ value: item.value, label: item.label }));
      default:
        return [];
    }
  }

  openRoutine(routineName: string): void {
    console.log('Abrindo rotina:', routineName);
    
    if (routineName === 'reprogramar-massa') {
      this.openReprogramModal();
    } else if (routineName === 'imprimir-ops') {
      this.openPrintModal();
    } else if (routineName === 'alterar-datas') {
      this.openAlterarDatasModal();
    } else {
      // TODO: Implementar outras rotinas
      alert(`Rotina "${routineName}" em desenvolvimento`);
    }
  }

  openReprogramModal(): void {
    this.showReprogramModal = true;
    this.showReprogramPopup = false;
    this.reprogramPopupType = '';
    this.reprogramPopupMessage = '';
    this.idsInput = '';
    this.dateInput = '';
    this.resultMessage = '';
    this.resultType = '';
    this.dateIsValid = true;
    this.parsedIdsCount = 0;
  }

  closeReprogramModal(): void {
    this.showReprogramModal = false;
    this.isProcessing = false;
    this.clearProcessingGuard();
  }

  closeReprogramPopup(): void {
    this.showReprogramPopup = false;
    this.reprogramPopupType = '';
    this.reprogramPopupMessage = '';
  }

  openPrintModal(): void {
    this.showPrintModal = true;
    this.printIdsInput = '';
    this.parsedPrintIdsCount = 0;
    this.foundFiles = [];
    this.isSearchingFiles = false;
    this.downloadProgress = 0;
    this.totalFilesToDownload = 0;
    this.resultMessage = '';
    this.resultType = '';
  }

  closePrintModal(): void {
    this.showPrintModal = false;
    this.isProcessing = false;
    this.clearProcessingGuard();
  }

  openAlterarDatasModal(): void {
    this.showAlterarDatasModal = true;
    this.searchTerm = '';
    this.sortConfig = { column: '', direction: '' };
    this.resetColumnFilters();
    this.statusOptions = [];
    this.situacaoOptions = [];
    this.issuesSemData = [];
    this.resultMessage = 'Carregando...';
    this.resultType = '';
    this.isLoadingIssues = true;
    this.refreshView();
    
    // Buscar todas as issues (não apenas sem data) após o modal estar renderizado
    setTimeout(() => {
      this.buscarIssuesSemData();
    }, 100);
  }

  closeAlterarDatasModal(): void {
    this.showAlterarDatasModal = false;
    this.searchTerm = '';
    this.filterOptionSearch = '';
    this.sortConfig = { column: '', direction: '' };
    this.resetColumnFilters();
    this.activeFilterMenu = '';
    this.isProcessing = false;
    this.clearProcessingGuard();
  }

  buscarIssuesSemData(): void {
    this.isLoadingIssues = true;
    this.resultMessage = 'Buscando cartões do relatório Jira...';
    this.resultType = '';

    this.jiraService.getJiraIssues(false) // false = todos os itens (mesmo JQL do relatório)
      .pipe(
        timeout(this.requestTimeoutMs),
        take(1),
        finalize(() => {
          this.isLoadingIssues = false;
          this.refreshView();
        })
      )
      .subscribe({
        next: (response: any) => {
          if (response.success && response.data && response.data.length > 0) {
            this.issuesSemData = response.data.map((issue: any) => ({
              key: issue.key,
              resumo: issue.resumo,
              status: issue.status,
              situacao: issue.situacao,
              veiculo: issue.veiculo,
              previsao: issue.previsao || '',
              novaData: ''
            }));
            this.refreshColumnFilterOptions();
            this.resultMessage = `${this.issuesSemData.length} cartões encontrados`;
            this.resultType = 'success';
          } else {
            this.issuesSemData = [];
            this.statusOptions = [];
            this.situacaoOptions = [];
            this.resultMessage = 'Nenhum cartão encontrado';
            this.resultType = 'error';
          }
          this.refreshView();
        },
        error: (error) => {
          this.issuesSemData = [];
          this.statusOptions = [];
          this.situacaoOptions = [];
          this.resultType = 'error';
          if (error?.name === 'TimeoutError') {
            this.resultMessage = `Tempo limite excedido (${this.requestTimeoutMs / 1000}s). Tente novamente.`;
          } else {
            this.resultMessage = error.error?.message || 'Erro ao buscar cartões';
          }
          this.refreshView();
        }
      });
  }

  salvarDatasIndividuais(): void {
    // Filtrar apenas issues com data preenchida
    const updates = this.issuesSemData
      .filter(issue => issue.novaData && issue.novaData.length === 10)
      .map(issue => ({
        id: issue.key,
        date: this.convertDateToISO(issue.novaData)
      }));

    if (updates.length === 0) {
      this.resultType = 'error';
      this.resultMessage = 'Nenhuma data válida preenchida para salvar';
      return;
    }

    this.isProcessing = true;
    this.resultMessage = `Salvando ${updates.length} data(s)...`;
    this.resultType = '';

    this.jiraService.atualizarDatasIndividuais(updates)
      .pipe(
        timeout(this.requestTimeoutMs * 2), // Mais tempo para múltiplas atualizações
        take(1),
        finalize(() => {
          this.isProcessing = false;
        })
      )
      .subscribe({
        next: (response: any) => {
          if (response.success) {
            const successIds = new Set(
              (response.data?.results || [])
                .filter((r: any) => r.success)
                .map((r: any) => r.id)
            );

            let updatedCardsCount = 0;
            this.issuesSemData = this.issuesSemData.map(issue => {
              if (!successIds.has(issue.key)) {
                return issue;
              }

              updatedCardsCount += 1;
              return {
                ...issue,
                previsao: issue.novaData,
                novaData: ''
              };
            });

            this.resultType = 'success';
            this.resultMessage = `✓ ${updatedCardsCount} cartão(ões) atualizado(s) com sucesso!`;
            this.refreshView();
          } else {
            this.resultType = 'error';
            this.resultMessage = response.message || 'Erro ao salvar datas';
          }
        },
        error: (error) => {
          this.resultType = 'error';
          if (error?.name === 'TimeoutError') {
            this.resultMessage = `Tempo limite excedido. Tente novamente.`;
          } else {
            this.resultMessage = error.error?.message || 'Erro ao salvar datas';
          }
        }
      });
  }

  hasPendingDateUpdates(): boolean {
    return this.issuesSemData.some(issue => !!issue.novaData && issue.novaData.length === 10);
  }

  private convertDateToISO(dateStr: string): string {
    // Converter DD/MM/YYYY para YYYY-MM-DD
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
  }

  aplicarMascaraData(event: Event, issue: any): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, ''); // Remove tudo que não é dígito
    
    if (value.length > 8) {
      value = value.substring(0, 8);
    }
    
    let formatted = '';
    if (value.length > 0) {
      formatted = value.substring(0, 2);
      if (value.length >= 3) {
        formatted += '/' + value.substring(2, 4);
      }
      if (value.length >= 5) {
        formatted += '/' + value.substring(4, 8);
      }
    }
    
    issue.novaData = formatted;
    input.value = formatted;
  }

  getSituacaoTagClass(situacao: string): string {
    const value = (situacao || '').toLowerCase();

    if (value.includes('atras') || value.includes('bloque')) {
      return 'tag-danger';
    }

    if (value.includes('risc') || value.includes('aten') || value.includes('pend')) {
      return 'tag-warning';
    }

    if (value.includes('concl') || value.includes('finaliz') || value.includes('ok')) {
      return 'tag-success';
    }

    if (value.includes('andamento') || value.includes('progres') || value.includes('desenv')) {
      return 'tag-info';
    }

    return 'tag-neutral';
  }

  getSituacaoDisplay(situacao: string): string {
    const normalized = (situacao || '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (normalized.includes('recebido encaminhado')) {
      return '⚪️RECEBIDO ENCAMINH';
    }

    return situacao;
  }

  private refreshView(): void {
    try {
      this.cdr.detectChanges();
    } catch {
      // Ignora se o detector não estiver disponível durante transição de view.
    }
  }

  private resetColumnFilters(): void {
    this.columnFilters = {
      status: [],
      situacao: [],
      previsao: [],
      novaData: []
    };
  }

  private refreshColumnFilterOptions(): void {
    this.statusOptions = this.buildDistinctOptions('status');
    this.situacaoOptions = this.buildDistinctOptions('situacao');
  }

  private buildDistinctOptions(field: 'status' | 'situacao'): string[] {
    const values = this.issuesSemData
      .map(issue => (issue[field] || '').toString().trim())
      .filter(value => value.length > 0);

    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  onPrintIdsInput(): void {
    const ids = this.parseIds(this.printIdsInput);
    this.parsedPrintIdsCount = ids.length;
  }

  buscarEBaixarPdfs(): void {
    console.log('⚡ Iniciando busca e criação de ZIP...');
    
    const ids = this.parseIds(this.printIdsInput);
    if (ids.length === 0) {
      this.resultType = 'error';
      this.resultMessage = 'Por favor, informe pelo menos um ID';
      return;
    }

    this.isProcessing = true;
    this.foundFiles = [];
    this.downloadProgress = 0;
    this.totalFilesToDownload = 0;
    this.resultMessage = `Buscando PDFs para ${ids.length} ${ids.length === 1 ? 'card' : 'cards'}...`;
    this.resultType = '';
    
    this.jiraService.buscarArquivosPorIds(ids)
      .pipe(
        timeout(this.requestTimeoutMs),
        take(1)
      )
      .subscribe({
        next: (response) => {
          if (response.success && response.files && response.files.length > 0) {
            // Filtrar apenas PDFs (otimizado)
            const pdfFiles = response.files.filter((file: any) => 
              file.isPdf || file.extension?.toLowerCase() === '.pdf'
            );
            
            if (pdfFiles.length > 0) {
              this.resultMessage = `${pdfFiles.length} PDF(s) encontrado(s). Baixando...`;
              // Baixar todos os PDFs automaticamente
              this.downloadPdfsAutomaticamente(pdfFiles);
            } else {
              this.isProcessing = false;
              this.resultType = 'error';
              this.resultMessage = 'Nenhum PDF encontrado para os IDs informados.';
            }
          } else {
            this.isProcessing = false;
            this.resultType = 'error';
            this.resultMessage = 'Nenhum PDF encontrado para os IDs informados.';
          }
        },
        error: (error) => {
          this.isProcessing = false;
          this.resultType = 'error';
          if (error?.name === 'TimeoutError') {
            this.resultMessage = `Tempo limite excedido (${this.requestTimeoutMs / 1000}s). Tente novamente.`;
          } else {
            this.resultMessage = error.error?.message || 'Erro ao buscar PDFs';
          }
        }
      });
  }

  private async downloadPdfsAutomaticamente(files: Array<any>): Promise<void> {
    const total = files.length;
    const startTime = performance.now();
    
    console.log(`⚡ Criando ZIP com ${total} PDFs...`);
    
    const zip = new JSZip();
    let completed = 0;
    const failedFiles: string[] = [];
    
    // Baixar todos os PDFs em paralelo e adicionar ao ZIP
    for (let i = 0; i < files.length; i += this.downloadBatchSize) {
      const batch = files.slice(i, i + this.downloadBatchSize);
      const batchStart = performance.now();
      
      const downloadPromises = batch.map(async (file) => {
        try {
          const blob = await this.jiraService.downloadArquivo(file.url).toPromise();
          
          if (blob) {
            // Adicionar PDF ao ZIP com prefixo do card ID para evitar duplicatas
            const uniqueFileName = `${file.cardId}_${file.name}`;
            zip.file(uniqueFileName, blob);
            return { success: true, name: file.name };
          }
          return { success: false, name: file.name };
        } catch (error) {
          console.error(`❌ Erro: ${file.name}`);
          return { success: false, name: file.name };
        }
      });
      
      const results = await Promise.all(downloadPromises);
      completed += results.filter(r => r.success).length;
      failedFiles.push(...results.filter(r => !r.success).map(r => r.name));
      
      const batchTime = ((performance.now() - batchStart) / 1000).toFixed(1);
      console.log(`📦 Lote ${Math.floor(i / this.downloadBatchSize) + 1} completo em ${batchTime}s`);
      
      this.downloadProgress = Math.round((completed / total) * 100);
      this.resultMessage = `Adicionando PDFs ao ZIP... ${this.downloadProgress}% (${completed}/${total})`;
    }

    if (completed > 0) {
      // Gerar o arquivo ZIP
      this.resultMessage = 'Gerando arquivo ZIP...';
      console.log('🗜️ Comprimindo arquivos...');
      
      const zipBlob = await zip.generateAsync({ 
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });
      
      // Download do ZIP
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const zipFileName = `PDFs-${timestamp}.zip`;
      
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = zipFileName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);
      
      const totalTime = ((performance.now() - startTime) / 1000).toFixed(1);
      console.log(`⚡ ZIP gerado em ${totalTime}s com ${completed} PDFs`);
      
      this.isProcessing = false;
      this.resultType = 'success';
      
      if (failedFiles.length > 0) {
        this.resultMessage = `ZIP baixado com ${completed} de ${total} PDFs em ${totalTime}s! (${failedFiles.length} falharam)`;
      } else {
        this.resultMessage = `ZIP baixado com ${completed} PDFs em ${totalTime}s!`;
      }
    } else {
      const totalTime = ((performance.now() - startTime) / 1000).toFixed(1);
      this.isProcessing = false;
      this.resultType = 'error';
      this.resultMessage = 'Erro ao baixar os PDFs. Tente novamente.';
    }
  }

  toggleFileSelection(index: number): void {
    if (!this.foundFiles[index].downloaded) return;
    this.foundFiles[index].selected = !this.foundFiles[index].selected;
  }

  toggleAllFiles(selectAll: boolean): void {
    this.foundFiles.forEach(file => {
      if (file.downloaded) {
        file.selected = selectAll;
      }
    });
  }

  getSelectedFilesCount(): number {
    return this.foundFiles.filter(file => file.selected).length;
  }

  clearPrintSelection(): void {
    this.printIdsInput = '';
    this.parsedPrintIdsCount = 0;
    this.foundFiles = [];
    this.resultMessage = '';
    this.resultType = '';
  }

  canSearchFiles(): boolean {
    return this.parsedPrintIdsCount > 0 && !this.isSearchingFiles;
  }

  downloadSelectedFiles(): void {
    const selectedFiles = this.foundFiles.filter(f => f.selected && f.downloaded);
    
    if (selectedFiles.length === 0) {
      this.resultType = 'error';
      this.resultMessage = 'Nenhum PDF selecionado para download';
      return;
    }

    console.log(`📥 Iniciando download de ${selectedFiles.length} PDF(s)...`);
    this.isProcessing = true;
    this.downloadProgress = 0;
    this.resultMessage = `Baixando ${selectedFiles.length} PDF(s)...`;
    this.resultType = '';
    
    // Download em paralelo otimizado
    this.downloadFilesInBatches(selectedFiles, this.downloadBatchSize);
  }

  private async downloadFilesInBatches(files: Array<any>, batchSize: number): Promise<void> {
    const total = files.length;
    const startTime = performance.now();
    
    console.log(`⚡ Criando ZIP com ${total} PDFs selecionados...`);
    
    const zip = new JSZip();
    let completed = 0;
    
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      
      const downloadPromises = batch.map(async (file) => {
        try {
          const blob = await this.jiraService.downloadArquivo(file.url).toPromise();
          
          if (blob) {
            // Adicionar PDF ao ZIP com prefixo do card ID para evitar duplicatas
            const uniqueFileName = `${file.cardId}_${file.name}`;
            zip.file(uniqueFileName, blob);
            return true;
          }
          return false;
        } catch (error) {
          console.error(`❌ Erro: ${file.name}`);
          return false;
        }
      });
      
      const results = await Promise.all(downloadPromises);
      completed += results.filter(r => r).length;
      
      this.downloadProgress = Math.round((completed / total) * 100);
      this.resultMessage = `Adicionando PDFs ao ZIP... ${this.downloadProgress}% (${completed}/${total})`;
    }

    if (completed > 0) {
      // Gerar o arquivo ZIP
      this.resultMessage = 'Gerando arquivo ZIP...';
      
      const zipBlob = await zip.generateAsync({ 
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });
      
      // Download do ZIP
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const zipFileName = `PDFs-Selecionados-${timestamp}.zip`;
      
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = zipFileName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);
      
      const totalTime = ((performance.now() - startTime) / 1000).toFixed(1);
      console.log(`⚡ ZIP gerado em ${totalTime}s com ${completed} PDFs`);
      
      this.isProcessing = false;
      this.resultType = 'success';
      this.resultMessage = `ZIP baixado com ${completed} de ${total} PDF(s) em ${totalTime}s!`;
    } else {
      this.isProcessing = false;
      this.resultType = 'error';
      this.resultMessage = 'Erro ao baixar os PDFs. Tente novamente.';
    }
  }

  private getReprogramTimeoutMs(cardCount: number): number {
    // O backend processa cards em sequência e pode levar vários minutos em lotes maiores.
    const perCardMs = 50000;
    const bufferMs = 30000;
    const estimated = cardCount * perCardMs + bufferMs;
    const maxTimeoutMs = 30 * 60 * 1000;

    return Math.min(Math.max(this.requestTimeoutMs, estimated), maxTimeoutMs);
  }

  private startProcessingGuard(guardTimeoutMs?: number): void {
    this.clearProcessingGuard();
    const guardTimeout = guardTimeoutMs ?? (this.requestTimeoutMs + 10000);
    console.log(`⏰ Watchdog iniciado: ${guardTimeout / 1000}s`);
    
    this.processingGuardTimer = setTimeout(() => {
      if (!this.isProcessing) {
        console.log('✅ Watchdog: operação já finalizada');
        return;
      }

      console.log('⚠️ Watchdog: forçando parada do loading');
      this.isProcessing = false;
      this.resultType = 'error';
      this.resultMessage = 'A operação demorou mais do que o esperado. Verifique no Jira se as alterações foram aplicadas e tente novamente se necessário.';
    }, guardTimeout);
  }

  private clearProcessingGuard(): void {
    if (this.processingGuardTimer) {
      clearTimeout(this.processingGuardTimer);
      this.processingGuardTimer = null;
    }
  }

  private scheduleResetAfterFeedback(closeModal: boolean = true): void {
    setTimeout(() => {
      if (closeModal) {
        this.closeReprogramModal();
        this.idsInput = '';
        this.dateInput = '';
      }
      this.resultMessage = '';
      this.resultType = '';
      this.refreshView();
    }, this.feedbackDelayMs);
  }

  private showReprogramResultPopup(type: 'success' | 'error', message: string): void {
    this.reprogramPopupType = type;
    this.reprogramPopupMessage = message;
    this.showReprogramPopup = true;
    this.refreshView();
  }

  /**
   * Atualiza contador de IDs detectados
   */
  onIdsInput(): void {
    const ids = this.parseIds(this.idsInput);
    this.parsedIdsCount = ids.length;
  }

  /**
   * Aplica máscara de data DD/MM/AAAA enquanto o usuário digita
   */
  onDateInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, ''); // Remove tudo que não é número
    
    // Aplicar máscara DD/MM/AAAA
    if (value.length > 0) {
      if (value.length <= 2) {
        value = value;
      } else if (value.length <= 4) {
        value = value.slice(0, 2) + '/' + value.slice(2);
      } else {
        value = value.slice(0, 2) + '/' + value.slice(2, 4) + '/' + value.slice(4, 8);
      }
    }
    
    this.dateInput = value;

    input.value = value;
    
    // Validar data se estiver completa
    if (value.length === 10) {
      // Permitir 00/00/0000 como comando para limpar no envio
      this.dateIsValid = value === '00/00/0000' || this.isValidDate(value);
    } else {
      this.dateIsValid = true; // Não marcar erro enquanto digita
    }
  }

  private toIsoDate(dateStr: string): string | null {
    const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return null;

    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);

    if (!this.isValidDate(dateStr)) return null;

    const dd = String(day).padStart(2, '0');
    const mm = String(month).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  }

  private fromIsoDate(isoDate: string): string {
    const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return isoDate;

    const [, year, month, day] = match;
    return `${day}/${month}/${year}`;
  }

  openCalendarPicker(nativePicker: HTMLInputElement): void {
    if (this.isProcessing) return;

    const isoDate = this.toIsoDate(this.dateInput.trim());
    nativePicker.value = isoDate || '';

    const pickerWithMethod = nativePicker as HTMLInputElement & { showPicker?: () => void };
    if (typeof pickerWithMethod.showPicker === 'function') {
      pickerWithMethod.showPicker();
      return;
    }

    nativePicker.click();
  }

  onNativeDateChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.value) return;

    this.dateInput = this.fromIsoDate(input.value);
    this.dateIsValid = true;
  }

  /**
   * Valida se a data está no formato correto e é uma data válida
   */
  private isValidDate(dateStr: string): boolean {
    const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return false;
    
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);
    
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;
    if (year < 2000 || year > 2100) return false;
    
    // Verificar dias válidos por mês
    const daysInMonth = new Date(year, month, 0).getDate();
    return day <= daysInMonth;
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
    
    // Tentar diferentes formatos (priorizar DD/MM/YYYY da máscara)
    const formats = [
      { regex: /^(\d{2})\/(\d{2})\/(\d{4})$/, format: (m: RegExpMatchArray) => `${m[3]}-${m[2]}-${m[1]}` }, // DD/MM/YYYY
      { regex: /^(\d{4})-(\d{2})-(\d{2})$/, format: (m: RegExpMatchArray) => `${m[1]}-${m[2]}-${m[3]}` }, // YYYY-MM-DD
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

  canReprogramWithDate(): boolean {
    const trimmedDate = this.dateInput.trim();

    // Reprogramar só com data preenchida, completa e válida
    if (!trimmedDate || trimmedDate === '00/00/0000') {
      return false;
    }

    return this.dateIsValid && trimmedDate.length === 10;
  }

  removerDatas(): void {
    this.dateInput = '00/00/0000';
    this.dateIsValid = true;
    this.reprogramar(true);
  }

  reprogramar(forceRemoveDates = false): void {
    console.log('🚀 Iniciando reprogramação...');
    
    // Parse IDs
    const ids = this.parseIds(this.idsInput);
    if (ids.length === 0) {
      this.resultType = 'error';
      this.resultMessage = 'Por favor, informe pelo menos um ID';
      return;
    }

    const isRemovingDates = forceRemoveDates || this.dateInput.trim() === '00/00/0000';

    // Normalize date (permitir vazio para limpar o campo)
    let date: string | null = null;
    if (this.dateInput && this.dateInput.trim().length > 0) {
      const cleanedDateInput = this.dateInput.trim();

      // 00/00/0000 significa limpar a data no Jira
      if (isRemovingDates || cleanedDateInput === '00/00/0000') {
        date = null;
      } else {
        date = this.normalizeDate(cleanedDateInput);
        if (!date) {
          this.resultType = 'error';
          this.resultMessage = 'Data inválida. Use YYYY-MM-DD, DD/MM/YYYY ou DD-MM-YYYY';
          return;
        }
      }
    }

    const operationTimeoutMs = this.getReprogramTimeoutMs(ids.length);

    this.isProcessing = true;
    this.resultMessage = isRemovingDates
      ? `Removendo data de ${ids.length} ${ids.length === 1 ? 'card' : 'cards'}... Aguarde.`
      : `Processando ${ids.length} ${ids.length === 1 ? 'card' : 'cards'}... Aguarde.`;
    this.resultType = '';
    this.startProcessingGuard(operationTimeoutMs + 15000);

    console.log('📡 Enviando requisição para backend...');
    console.log('⏱️ Timeout configurado:', operationTimeoutMs / 1000, 'segundos');
    
    this.jiraService.reprogramarEmMassa(ids, date)
      .pipe(
        timeout(operationTimeoutMs),
        take(1),
        finalize(() => {
          console.log('🏁 Finalize executado - parando loading');
          this.isProcessing = false;
          this.clearProcessingGuard();
          this.refreshView();
        })
      )
      .subscribe({
        next: (response) => {
          console.log('✅ Resposta completa recebida:', JSON.stringify(response, null, 2));
          console.log('✅ Response type:', typeof response);
          console.log('✅ Response.success:', response?.success);

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

          this.showReprogramResultPopup(this.resultType || 'error', this.resultMessage);
          this.refreshView();
          this.scheduleResetAfterFeedback(true);
        },
        error: (error) => {
          console.error('❌ Erro capturado:', error);
          console.error('❌ Error name:', error?.name);
          console.error('❌ Error message:', error?.message);
          this.resultType = 'error';

          if (error?.name === 'TimeoutError') {
            console.error('⏱️ TIMEOUT: Operação excedeu', operationTimeoutMs / 1000, 'segundos');
            this.resultMessage = `Tempo limite excedido (${operationTimeoutMs / 1000}s). A operação pode ainda estar em andamento no servidor. Verifique o Jira.`;
          } else if (error?.status === 0) {
            console.error('🔌 CONEXÃO: Sem resposta do servidor');
            this.resultMessage = 'Não foi possível conectar ao servidor. Verifique sua conexão.';
          } else {
            this.resultMessage = error.error?.message || error?.message || 'Erro ao conectar com o servidor';
          }

          this.showReprogramResultPopup('error', this.resultMessage);
          this.refreshView();
          this.scheduleResetAfterFeedback(false);
        }
      });
  }
}
