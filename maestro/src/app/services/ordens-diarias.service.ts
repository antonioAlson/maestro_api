import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface OrdemDiaria {
  id?: number;
  seq?: string;
  tipo?: string;
  os?: string;
  veiculo?: string;
  data_entrega?: string;
  obs?: string;
  created_at?: string;
  updated_at?: string;
}

export interface OrdensDiariasResponse {
  success: boolean;
  data: OrdemDiaria[];
  total: number;
}

@Injectable({
  providedIn: 'root'
})
export class OrdensDiariasService {
  private apiUrl = `${environment.apiUrl}/ordens-diarias`;

  constructor(private http: HttpClient) {}

  /**
   * Buscar ordens diárias com filtros opcionais
   */
  getOrdensDiarias(dataInicio?: string, dataFim?: string): Observable<OrdensDiariasResponse> {
    let params = new HttpParams();

    if (dataInicio) {
      params = params.set('dataInicio', dataInicio);
    }

    if (dataFim) {
      params = params.set('dataFim', dataFim);
    }

    return this.http.get<OrdensDiariasResponse>(this.apiUrl, { params });
  }

  /**
   * Criar nova ordem diária
   */
  createOrdemDiaria(ordem: OrdemDiaria): Observable<any> {
    return this.http.post(this.apiUrl, ordem);
  }

  /**
   * Atualizar ordem diária
   */
  updateOrdemDiaria(id: number, ordem: OrdemDiaria): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, ordem);
  }

  /**
   * Deletar ordem diária
   */
  deleteOrdemDiaria(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}
