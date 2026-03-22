import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpResponse } from '@angular/common/http';
import { Observable, switchMap, from, tap, of } from 'rxjs';
import { catchError, map, mergeMap, toArray } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import * as ExcelJS from 'exceljs';

interface BackendJiraResponse {
  success: boolean;
  total: number;
  filtered: number;
  data: Array<{
    key: string;
    resumo: number;
    status: string;
    situacao: string;
    veiculo: string;
    previsao: string;
  }>;
}

interface ExportRow {
  ID: string;
  Resumo: number;
  Status: string;
  SITUAÇÃO: string;
  Veículo: string;
  'DT. PREVISÃO ENTREGA': string;
}

@Injectable({
  providedIn: 'root'
})
export class JiraService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  private getAuthToken(): string | null {
    // Prioriza a chave atual e mantém fallback para instalações antigas.
    return localStorage.getItem('maestro_token') || localStorage.getItem('token');
  }


  /**
   * Gera arquivo Excel e faz download
   */
  private async generateExcel(
    data: ExportRow[],
    filename?: string,
    onDownloadStart?: () => void
  ): Promise<void> {
    console.log('📊 [JiraService] Gerando arquivo Excel...');
    
    // Criar workbook e worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Jira Cards');

    // Definir colunas com larguras
    worksheet.columns = [
      { header: 'ID', key: 'ID', width: 12 },
      { header: 'Resumo', key: 'Resumo', width: 15 },
      { header: 'Status', key: 'Status', width: 20 },
      { header: 'SITUAÇÃO', key: 'SITUAÇÃO', width: 25 },
      { header: 'Veículo', key: 'Veículo', width: 20 },
      { header: 'DT. PREVISÃO ENTREGA', key: 'DT. PREVISÃO ENTREGA', width: 18 }
    ];

    // Adicionar dados
    data.forEach(row => {
      worksheet.addRow(row);
    });

    // Estilizar header (linha 1)
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' } // Cinza claro
    };

    // Marcas que devem ter destaque
    const marcasDestaque = ['land rover', 'toyota', 'jaguar'];

    // Aplicar formatação condicional
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Pular header

      // Coluna Veículo (E) - Formatação condicional
      const veiculoCell = row.getCell(5);
      const veiculoValue = (veiculoCell.value as string || '').toLowerCase();

      // Verificar se contém alguma das marcas
      const contemMarca = marcasDestaque.some(marca => veiculoValue.includes(marca));

      if (contemMarca) {
        veiculoCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFF6B6B' } // Vermelho claro
        };
        veiculoCell.font = {
          color: { argb: 'FFFFFFFF' }, // Branco
          bold: true
        };
      }
    });

    // Auto-ajustar largura das colunas baseado no conteúdo
    worksheet.columns.forEach((column) => {
      let maxLength = 0;
      
      column.eachCell?.({ includeEmpty: true }, (cell) => {
        const cellValue = cell.value ? cell.value.toString() : '';
        maxLength = Math.max(maxLength, cellValue.length);
      });
      
      // Adicionar margem extra e definir largura (mínimo 10, máximo 50)
      column.width = Math.min(Math.max(maxLength + 2, 10), 50);
    });

    // Gerar nome do arquivo com timestamp
    const now = new Date();
    const timestamp = now.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).replace(/[/:]/g, '.').replace(', ', ' ');
    
    const finalFilename = filename || `jira_cards ${timestamp}.xlsx`;

    // Gerar buffer e fazer download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = finalFilename;
    onDownloadStart?.();
    link.click();
    window.URL.revokeObjectURL(url);
    
    console.log('✅ [JiraService] Excel gerado:', finalFilename);
  }

  /**
   * Método principal para exportar relatório - chama o backend
   */
  exportJiraReport(onDownloadStart?: () => void): Observable<{ success: boolean; message: string; count: number }> {
    console.log('🎯 [JiraService] exportJiraReport iniciado');
    console.log('📡 Chamando backend:', `${this.apiUrl}/jira/issues`);
    
    // O interceptor já adiciona o Authorization header automaticamente
    return this.http.get<BackendJiraResponse>(`${this.apiUrl}/jira/issues`).pipe(
      switchMap((response) => {
        console.log('📥 [JiraService] Resposta do backend:', {
          success: response.success,
          total: response.total,
          filtered: response.filtered,
          dataLength: response.data?.length || 0
        });

        if (!response.success || !response.data || response.data.length === 0) {
          console.warn('⚠️ Nenhuma issue encontrada');
          return from([{
            success: false,
            message: 'Nenhum cartão encontrado com os critérios especificados',
            count: 0
          }]);
        }

        // Converter dados do backend para formato do Excel
        const excelData: ExportRow[] = response.data.map(item => ({
          ID: item.key,
          Resumo: item.resumo,
          Status: item.status,
          SITUAÇÃO: item.situacao,
          Veículo: item.veiculo,
          'DT. PREVISÃO ENTREGA': item.previsao
        }));

        console.log(`✅ [JiraService] ${excelData.length} issues processadas`);
        
        // Gerar Excel (async) e converter Promise em Observable
        return from(
          this.generateExcel(excelData, undefined, onDownloadStart).then(() => ({
            success: true,
            message: `Relatório gerado com sucesso! ${excelData.length} cartões exportados.`,
            count: excelData.length
          }))
        );
      })
    );
  }

  /**
   * Método para exportar relatório CONTEC - apenas marcas Land Rover, Toyota e Jaguar
   */
  exportContecReport(onDownloadStart?: () => void): Observable<{ success: boolean; message: string; count: number }> {
    console.log('🎯 [JiraService] exportContecReport iniciado');
    console.log('📡 Chamando backend:', `${this.apiUrl}/jira/contec`);
    
    // O interceptor já adiciona o Authorization header automaticamente
    return this.http.get<BackendJiraResponse>(`${this.apiUrl}/jira/contec`).pipe(
      switchMap((response) => {
        console.log('📥 [JiraService] Resposta do backend CONTEC:', {
          success: response.success,
          total: response.total,
          filtered: response.filtered,
          dataLength: response.data?.length || 0
        });

        if (!response.success || !response.data || response.data.length === 0) {
          console.warn('⚠️ Nenhuma issue CONTEC encontrada');
          return from([{
            success: false,
            message: 'Nenhum cartão CONTEC encontrado',
            count: 0
          }]);
        }

        // Converter dados do backend para formato do Excel
        const excelData: ExportRow[] = response.data.map(item => ({
          ID: item.key,
          Resumo: item.resumo,
          Status: item.status,
          SITUAÇÃO: item.situacao,
          Veículo: item.veiculo,
          'DT. PREVISÃO ENTREGA': item.previsao
        }));

        console.log(`✅ [JiraService] ${excelData.length} issues CONTEC processadas`);
        
        // Gerar nome do arquivo CONTEC
        const now = new Date();
        const timestamp = now.toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }).replace(/[/:]/g, '.').replace(', ', ' ');
        
        const filename = `carros_contec ${timestamp}.xlsx`;
        
        // Gerar Excel (async) e converter Promise em Observable
        return from(
          this.generateExcel(excelData, filename, onDownloadStart).then(() => ({
            success: true,
            message: `Relatório CONTEC gerado com sucesso! ${excelData.length} cartões exportados.`,
            count: excelData.length
          }))
        );
      })
    );
  }

  /**
   * Reprograma múltiplas issues do Jira com nova data
   */
  reprogramarEmMassa(ids: string[], date: string | null): Observable<any> {
    console.log('🚀 [JiraService] reprogramarEmMassa iniciado');
    console.log('📋 IDs:', ids);
    console.log('📅 Data:', date === null ? '(LIMPAR CAMPO)' : date);
    console.log('🔑 Token disponível:', !!this.getAuthToken());
    console.log('🌐 URL:', `${this.apiUrl}/jira/reprogramar-massa`);

    // O interceptor já adiciona o Authorization header automaticamente
    // Não precisamos adicionar manualmente para evitar duplicação
    return this.http.post<any>(`${this.apiUrl}/jira/reprogramar-massa`, { ids, date }).pipe(
      tap({
        next: (response) => {
          console.log('📥 [JiraService] Resposta recebida:', response);
          console.log('📊 [JiraService] Status:', response?.success ? 'Sucesso' : 'Falha');
        },
        error: (error) => {
          console.error('❌ [JiraService] Erro na requisição:', error);
          console.error('❌ [JiraService] Status code:', error?.status);
          console.error('❌ [JiraService] Error message:', error?.message);
        },
        complete: () => {
          console.log('✅ [JiraService] Observable completado com sucesso');
        }
      })
    );
  }

  /**
   * Busca issues do Jira
   * @param semData - Se true, retorna apenas issues sem data de previsão
   */
  getJiraIssues(semData: boolean = false): Observable<any> {
    console.log('🔍 [JiraService] getJiraIssues iniciado');
    console.log('📅 Filtro sem data:', semData);
    const url = `${this.apiUrl}/jira/issues${semData ? '?semData=true' : ''}`;
    console.log('🌐 URL:', url);

    return this.http.get<any>(url).pipe(
      tap({
        next: (response) => {
          console.log('📥 [JiraService] Issues recebidas:', response?.data?.length || 0);
        },
        error: (error) => {
          console.error('❌ [JiraService] Erro ao buscar issues:', error);
        }
      })
    );
  }

  /**
   * Atualiza datas individuais para múltiplas issues
   * @param updates - Array de {id: string, date: string}
   */
  atualizarDatasIndividuais(updates: Array<{id: string, date: string}>): Observable<any> {
    console.log('🔄 [JiraService] atualizarDatasIndividuais iniciado');
    console.log('📋 Updates:', updates.length);
    console.log('🌐 URL:', `${this.apiUrl}/jira/atualizar-datas-individuais`);

    return this.http.post<any>(`${this.apiUrl}/jira/atualizar-datas-individuais`, { updates }).pipe(
      tap({
        next: (response) => {
          console.log('📥 [JiraService] Resposta recebida:', response);
          console.log('📊 [JiraService] Sucesso:', response?.data?.successCount || 0);
          console.log('📊 [JiraService] Erros:', response?.data?.errorCount || 0);
        },
        error: (error) => {
          console.error('❌ [JiraService] Erro na atualização:', error);
        }
      })
    );
  }

  /**
   * Busca arquivos por IDs dos cards
   */
  buscarArquivosPorIds(ids: string[]): Observable<any> {
    console.log('🔍 [JiraService] buscarArquivosPorIds iniciado');
    console.log('📋 IDs:', ids);
    console.log('🌐 URL:', `${this.apiUrl}/jira/buscar-arquivos`);

    return this.http.post<any>(`${this.apiUrl}/jira/buscar-arquivos`, { ids }).pipe(
      tap({
        next: (response) => {
          console.log('📥 [JiraService] Arquivos encontrados:', response?.files?.length || 0);
        },
        error: (error) => {
          console.error('❌ [JiraService] Erro ao buscar arquivos:', error);
        }
      })
    );
  }

  /**
   * Faz download de um arquivo específico
   */
  downloadArquivo(url: string): Observable<Blob> {
    console.log('📥 [JiraService] Baixando arquivo:', url);
    return this.http.get(url, { responseType: 'blob' }).pipe(
      tap({
        next: (blob) => {
          console.log('✅ [JiraService] Arquivo baixado:', blob.size, 'bytes');
        },
        error: (error) => {
          console.error('❌ [JiraService] Erro ao baixar arquivo:', error);
        }
      })
    );
  }

  /**
   * Gera espelhos para os cards informados.
   */
  gerarEspelhos(ids: string[], arquivoProjeto?: File | null, arquivosPorId?: Record<string, File>): Observable<any> {
    console.log('🧩 [JiraService] gerarEspelhos iniciado');
    console.log('📋 IDs:', ids);
    console.log('🌐 URL:', `${this.apiUrl}/jira/gerar-espelhos`);

    const normalizedIds = (ids || [])
      .map((id) => String(id || '').trim().toUpperCase())
      .filter((id) => id.length > 0);

    if (normalizedIds.length === 0) {
      return of({
        success: false,
        message: 'Nenhum ID valido para gerar espelhos.',
        data: { processed: 0, generated: 0, errors: [] }
      });
    }

    const parallelism = 3;

    return from(normalizedIds).pipe(
      mergeMap((id) => {
        const fileForId = arquivosPorId?.[id] || arquivoProjeto || null;
        const payload = fileForId
          ? this.buildEspelhoFormData(id, fileForId)
          : { ids: [id] };

        return this.http.post(`${this.apiUrl}/jira/gerar-espelhos`, payload, {
          observe: 'response',
          responseType: 'blob'
        }).pipe(
        map((response: HttpResponse<Blob>) => {
          this.saveBlobResponse(response, fileForId ? `espelho-${id}-projeto.pdf` : `espelho-${id}.pdf`);
          return { id, success: true as const };
        }),
        catchError((error) => this.extractBlobErrorMessage(error).pipe(
          map((message) => {
            console.error(`❌ [JiraService] Erro ao gerar espelho ${id}:`, error);
            return {
              id,
              success: false as const,
              message
            };
          })
        ))
      );
      }, parallelism),
      toArray(),
      map((results) => {
        const successItems = results.filter((item) => item.success);
        const failedItems = results.filter((item) => !item.success);

        const hasAnyFile = !!arquivoProjeto || Object.keys(arquivosPorId || {}).length > 0;
        const actionText = hasAnyFile ? 'Espelhos juntados e baixados' : 'Espelhos baixados';

        return {
          success: failedItems.length === 0,
          message: failedItems.length === 0
            ? `${actionText}: ${successItems.length}`
            : `${actionText}: ${successItems.length}. Falhas: ${failedItems.length}`,
          data: {
            processed: results.length,
            generated: successItems.length,
            errorCount: failedItems.length,
            errors: failedItems
          }
        };
      }),
      tap({
        next: (response) => {
          console.log('✅ [JiraService] gerarEspelhos sucesso:', response);
        },
        error: (error) => {
          console.error('❌ [JiraService] gerarEspelhos erro:', error);
        }
      })
    );
  }

  private buildEspelhoFormData(id: string, arquivoProjeto: File): FormData {
    const formData = new FormData();
    formData.append('ids[]', id);
    formData.append('arquivoProjeto', arquivoProjeto, arquivoProjeto.name);
    return formData;
  }

  private extractBlobErrorMessage(error: any): Observable<string> {
    const fallback = error?.message || 'Erro ao gerar espelho.';
    const blobError = error?.error;

    if (!(blobError instanceof Blob)) {
      return of(error?.error?.message || fallback);
    }

    return from(blobError.text()).pipe(
      map((rawText) => {
        if (!rawText) {
          return fallback;
        }

        try {
          const parsed = JSON.parse(rawText);
          return parsed?.message || rawText;
        } catch {
          return rawText;
        }
      }),
      catchError(() => of(fallback))
    );
  }

  private saveBlobResponse(response: HttpResponse<Blob>, fallbackName: string): void {
    const blob = response.body;
    if (!blob) {
      return;
    }

    const contentDisposition = response.headers.get('content-disposition') || '';
    const filename = this.extractFilename(contentDisposition, this.inferFilenameByMime(fallbackName, blob.type));

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  private extractFilename(contentDisposition: string, fallbackName: string): string {
    const match = contentDisposition.match(/filename="?([^";]+)"?/i);
    if (!match?.[1]) {
      return fallbackName;
    }

    return match[1].trim();
  }

  private inferFilenameByMime(fallbackName: string, mimeType: string): string {
    const baseName = fallbackName.replace(/\.(pdf|docx)$/i, '');
    const mime = String(mimeType || '').toLowerCase();

    if (mime.includes('application/pdf')) {
      return `${baseName}.pdf`;
    }

    if (mime.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document')) {
      return `${baseName}.docx`;
    }

    return fallbackName;
  }


}