import { Component, OnInit, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { JiraService } from '../../services/jira.service';
import { FilterIssuesPipe } from './filter-issues.pipe';
import { finalize, take, timeout } from 'rxjs/operators';
import JSZip from 'jszip';

@Component({
  selector: 'app-ordens-producao',
  standalone: true,
  imports: [CommonModule, FormsModule, FilterIssuesPipe],
  templateUrl: './ordens-producao.component.html',
  styleUrl: './ordens-producao.component.scss'
})
export class OrdensProducaoComponent implements OnInit {
    searchTerm: string = '';
  showReprogramModal = false;
  showPrintModal = false;
  showAlterarDatasModal = false;
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
  
  private readonly feedbackDelayMs = 3000;
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
      if (this.showReprogramModal) {
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
            this.resultMessage = `${this.issuesSemData.length} cartões encontrados`;
            this.resultType = 'success';
          } else {
            this.issuesSemData = [];
            this.resultMessage = 'Nenhum cartão encontrado';
            this.resultType = 'error';
          }
          this.refreshView();
        },
        error: (error) => {
          this.issuesSemData = [];
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
            this.resultType = 'success';
            this.resultMessage = `✓ ${response.data.successCount} data(s) atualizada(s) com sucesso!`;
            
            // Atualizar lista removendo as que foram salvas com sucesso
            const successIds = response.data.results
              .filter((r: any) => r.success)
              .map((r: any) => r.id);
            
            this.issuesSemData = this.issuesSemData.filter(
              issue => !successIds.includes(issue.key)
            );
            
            if (this.issuesSemData.length === 0) {
              // Fechar modal após sucesso total
              setTimeout(() => {
                this.closeAlterarDatasModal();
              }, 2000);
            }
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

  private refreshView(): void {
    try {
      this.cdr.detectChanges();
    } catch {
      // Ignora se o detector não estiver disponível durante transição de view.
    }
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

  private startProcessingGuard(): void {
    this.clearProcessingGuard();
    const guardTimeout = this.requestTimeoutMs + 10000; // 10s após o timeout da requisição
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

  private scheduleResetAfterFeedback(): void {
    setTimeout(() => {
      this.closeReprogramModal();
      this.idsInput = '';
      this.dateInput = '';
      this.resultMessage = '';
      this.resultType = '';
    }, this.feedbackDelayMs);
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

    this.isProcessing = true;
    this.resultMessage = isRemovingDates
      ? `Removendo data de ${ids.length} ${ids.length === 1 ? 'card' : 'cards'}... Aguarde.`
      : `Processando ${ids.length} ${ids.length === 1 ? 'card' : 'cards'}... Aguarde.`;
    this.resultType = '';
    this.startProcessingGuard();

    console.log('📡 Enviando requisição para backend...');
    console.log('⏱️ Timeout configurado:', this.requestTimeoutMs / 1000, 'segundos');
    
    this.jiraService.reprogramarEmMassa(ids, date)
      .pipe(
        timeout(this.requestTimeoutMs),
        take(1),
        finalize(() => {
          console.log('🏁 Finalize executado - parando loading');
          this.isProcessing = false;
          this.clearProcessingGuard();
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

          this.scheduleResetAfterFeedback();
        },
        error: (error) => {
          console.error('❌ Erro capturado:', error);
          console.error('❌ Error name:', error?.name);
          console.error('❌ Error message:', error?.message);
          this.resultType = 'error';

          if (error?.name === 'TimeoutError') {
            console.error('⏱️ TIMEOUT: Operação excedeu', this.requestTimeoutMs / 1000, 'segundos');
            this.resultMessage = `Tempo limite excedido (${this.requestTimeoutMs / 1000}s). A operação pode ainda estar em andamento no servidor. Verifique o Jira.`;
          } else if (error?.status === 0) {
            console.error('🔌 CONEXÃO: Sem resposta do servidor');
            this.resultMessage = 'Não foi possível conectar ao servidor. Verifique sua conexão.';
          } else {
            this.resultMessage = error.error?.message || error?.message || 'Erro ao conectar com o servidor';
          }

          this.scheduleResetAfterFeedback();
        }
      });
  }
}
