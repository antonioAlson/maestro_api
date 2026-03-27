import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { OrdensDiariasService, OrdemDiaria } from '../../services/ordens-diarias.service';
import { JiraService } from '../../services/jira.service';

interface CronogramaItem {
  seq: string;
  tipo: string;
  os: string;
  veiculo: string;
  dataEntrega: string;
  obs: string;
  status: 'liberado' | 'proximo' | 'vidros' | 'normal';
  cardId: string;
}

@Component({
  selector: 'app-acompanhamento',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './acompanhamento.component.html',
  styleUrl: './acompanhamento.component.scss'
})
export class AcompanhamentoComponent implements OnInit {
  items: CronogramaItem[] = [];
  filteredItems: CronogramaItem[] = [];
  dataProducao: string = ''; // Formato YYYY-MM-DD para o input type="date"
  filtroManualAtivo = false;
  cardIdInput = '';
  isAtualizandoCard = false;
  updateMessage = '';
  updateMessageType: 'success' | 'error' | '' = '';
  isLoading = false;
  errorMessage = '';

  constructor(
    private ordensDiariasService: OrdensDiariasService,
    private jiraService: JiraService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Inicia com a data atual no campo de produção.
    this.dataProducao = this.formatDateForInput(new Date());
    this.carregarDados();
  }

  carregarDados(): void {
    this.isLoading = true;
    this.errorMessage = '';
    
    this.ordensDiariasService.getOrdensDiarias().subscribe({
      next: (response) => {
        console.log('📊 Dados recebidos:', response);
        
        if (response && response.success && response.data) {
          this.items = response.data.map((ordem: OrdemDiaria) => ({
            seq: ordem.seq ? String(ordem.seq) : '',
            tipo: ordem.tipo || '',
            os: ordem.os || '',
            veiculo: ordem.veiculo || '',
            dataEntrega: this.formatarDataEntrega(ordem.data_entrega || ''),
            obs: ordem.obs || '',
            status: this.determinarStatusPorData(ordem.data_entrega || ''),
            cardId: ordem.id?.toString() || ''
          }));
          
          this.aplicarFiltro();
        } else {
          this.errorMessage = 'Nenhum dado encontrado';
        }
        
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('❌ Erro ao carregar dados:', error);
        this.errorMessage = 'Erro ao carregar dados do servidor';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  aplicarFiltro(): void {
    if (!this.filtroManualAtivo) {
      this.filteredItems = this.ordenarItens([...this.items]);
      this.cdr.detectChanges();
      return;
    }

    if (!this.dataProducao) {
      this.filteredItems = this.ordenarItens([...this.items]);
      this.cdr.detectChanges();
      return;
    }

    // Converter data do input (YYYY-MM-DD) para Date
    const dataSelecionada = new Date(this.dataProducao + 'T00:00:00');
    
    // Filtrar itens com data <= data de produção selecionada
    this.filteredItems = this.ordenarItens(this.items.filter(item => {
      const dataEntrega = this.parseData(item.dataEntrega);
      return dataEntrega <= dataSelecionada;
    }));
    
    this.cdr.detectChanges();
  }

  onDataChange(): void {
    this.filtroManualAtivo = true;
    this.aplicarFiltro();
  }

  async atualizarPorCardId(): Promise<void> {
    const cardIds = this.parseCardIds(this.cardIdInput);
    if (cardIds.length === 0) {
      this.updateMessageType = 'error';
      this.updateMessage = 'Informe pelo menos um ID de card.';
      this.cdr.detectChanges();
      return;
    }

    this.isAtualizandoCard = true;
    this.updateMessage = '';
    this.updateMessageType = '';

    try {
      const response = await firstValueFrom(this.jiraService.getJiraIssues(false));
      const issues = Array.isArray(response?.data) ? response.data : [];
      const issuesById = new Map<string, any>(
        issues.map((item: any) => [String(item?.key || '').toUpperCase(), item])
      );

      const existentesPorOs = new Map(
        this.items
          .filter((item) => String(item.os || '').trim().length > 0)
          .map((item) => [String(item.os || '').trim(), item])
      );

      let sucesso = 0;
      const erros: string[] = [];

      for (const cardId of cardIds) {
        const issue = issuesById.get(cardId);

        if (!issue) {
          erros.push(`${cardId}: não encontrado`);
          continue;
        }

        const os = this.extrairOsDoResumo(issue?.resumo);
        const veiculo = String(issue?.veiculo || '').trim();
        const dataEntregaIso = this.normalizarDataParaIso(issue?.previsao);

        if (!os || !dataEntregaIso) {
          erros.push(`${cardId}: OS/data inválidos`);
          continue;
        }

        const payload: OrdemDiaria = {
          os,
          veiculo,
          data_entrega: dataEntregaIso
        };

        const existente = existentesPorOs.get(os);

        try {
          if (existente?.cardId) {
            await firstValueFrom(this.ordensDiariasService.updateOrdemDiaria(Number(existente.cardId), payload));
          } else {
            await firstValueFrom(this.ordensDiariasService.createOrdemDiaria(payload));
          }

          sucesso++;
        } catch {
          erros.push(`${cardId}: falha ao salvar`);
        }
      }

      if (sucesso > 0 && erros.length === 0) {
        this.updateMessageType = 'success';
        this.updateMessage = `${sucesso} ${sucesso === 1 ? 'card atualizado' : 'cards atualizados'} com sucesso.`;
      } else if (sucesso > 0) {
        this.updateMessageType = 'error';
        this.updateMessage = `Atualização parcial: ${sucesso}/${cardIds.length}. Erros: ${erros.join(' | ')}`;
      } else {
        this.updateMessageType = 'error';
        this.updateMessage = `Nenhum card atualizado. ${erros.join(' | ')}`;
      }

      if (sucesso > 0) {
        this.cardIdInput = '';
        this.carregarDados();
      }
    } catch {
      this.updateMessageType = 'error';
      this.updateMessage = 'Erro ao consultar dados dos cards no Jira.';
    } finally {
      this.isAtualizandoCard = false;
      this.cdr.detectChanges();
    }
  }

  private parseCardIds(rawInput: string): string[] {
    return Array.from(new Set(
      String(rawInput || '')
        .split(/[,;\s\n]+/)
        .map((id) => id.trim().toUpperCase())
        .filter((id) => id.length > 0)
    ));
  }

  private extrairOsDoResumo(resumo: unknown): string {
    const value = String(resumo || '').trim();
    const match = value.match(/(\d{3,10})/g);
    if (!match || match.length === 0) {
      return '';
    }
    return match[match.length - 1];
  }

  private normalizarDataParaIso(rawDate: unknown): string {
    const value = String(rawDate || '').trim();
    if (!value || value === '-' || /sem\s*data/i.test(value)) {
      return '';
    }

    const ddmmyyyy = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (ddmmyyyy) {
      return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;
    }

    const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) {
      return `${iso[1]}-${iso[2]}-${iso[3]}`;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return '';
    }

    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  formatarDataEntrega(data: string): string {
    if (!data || data === 'Sem data') {
      return '-';
    }
    
    // Se já estiver no formato DD/MM/YYYY, retorna como está
    if (data.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      return data;
    }
    
    // Trata formatos vindos do PostgreSQL/Node sem deslocar dia por timezone.
    try {
      if (data.includes('T')) {
        const isoDate = data.split('T')[0];
        const parts = isoDate.split('-');
        if (parts.length === 3) {
          return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
      }

      if (/^\d{4}-\d{2}-\d{2}$/.test(data)) {
        const parts = data.split('-');
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }

      const date = new Date(data);
      if (!isNaN(date.getTime())) {
        return this.formatDate(date);
      }
    } catch (e) {
      console.error('Erro ao formatar data:', e);
    }
    
    return data;
  }

  determinarStatusPorData(data: string): 'liberado' | 'proximo' | 'vidros' | 'normal' {
    // Esta é uma função simples - você pode adicionar lógica mais complexa conforme necessário
    // Por exemplo, baseado em quanto tempo falta para a data de entrega
    if (!data) {
      return 'normal';
    }
    
    try {
      const dataEntrega = new Date(data);
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      dataEntrega.setHours(0, 0, 0, 0);
      
      const diasDiferenca = Math.ceil((dataEntrega.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
      
      // Se a data já passou ou é hoje, marca como liberado
      if (diasDiferenca <= 0) {
        return 'liberado';
      }
      // Se falta 1-2 dias, marca como próximo
      else if (diasDiferenca <= 2) {
        return 'proximo';
      }
      // Se falta mais de 2 dias, marca como normal
      else {
        return 'normal';
      }
    } catch (e) {
      return 'normal';
    }
  }

  formatDate(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }
formatDateForInput(date: Date): string {
    // Formato YYYY-MM-DD para input type="date"
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  
  parseData(dataStr: string): Date {
    if (!dataStr || dataStr === '-') {
      return new Date(0); // Data muito antiga para itens sem data
    }
    
    // Formato DD/MM/YYYY
    const parts = dataStr.split('/');
    if (parts.length === 3) {
      return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    }
    
    return new Date(dataStr);
  }

  private ordenarItens(items: CronogramaItem[]): CronogramaItem[] {
    return items.sort((a, b) => {
      const seqA = this.parseSeq(a.seq);
      const seqB = this.parseSeq(b.seq);

      if (seqA !== seqB) {
        return seqA - seqB;
      }

      const dataA = this.parseData(a.dataEntrega).getTime();
      const dataB = this.parseData(b.dataEntrega).getTime();
      if (dataA !== dataB) {
        return dataA - dataB;
      }

      return String(a.os || '').localeCompare(String(b.os || ''), 'pt-BR');
    });
  }

  private parseSeq(seq: string): number {
    const parsed = Number.parseInt(String(seq || '').replace(/\D/g, ''), 10);
    return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
  }

  getStatusClass(status: string): string {
    return `status-${status}`;
  }

  imprimirCronograma(): void {
    window.print();
  }
}
