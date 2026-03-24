import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { JiraService, ProjetoEspelho, EstatisticasProjetosResponse } from '../../services/jira.service';

@Component({
  selector: 'app-cadastro-projetos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cadastro-projetos.component.html',
  styleUrl: './cadastro-projetos.component.scss'
})
export class CadastroProjetosComponent implements OnInit {
  projetos: ProjetoEspelho[] = [];
  loading: boolean = false;
  error: string = '';
  
  // Paginação
  pagina: number = 1;
  limite: number = 20;
  totalPaginas: number = 0;
  totalProjetos: number = 0;
  
  // Filtros e ordenação
  filtro: string = '';
  campoOrdenacao: string = 'created_at';
  ordem: 'ASC' | 'DESC' = 'DESC';
  
  // Estatísticas
  estatisticas: EstatisticasProjetosResponse['data'] | null = null;
  mostrarEstatisticas: boolean = false;

  constructor(private jiraService: JiraService) {}

  ngOnInit(): void {
    console.log('CadastroProjetosComponent inicializado');
    this.carregarProjetos();
    this.carregarEstatisticas();
  }

  carregarProjetos(): void {
    this.loading = true;
    this.error = '';

    this.jiraService.listarProjetosEspelhos({
      page: this.pagina,
      limit: this.limite,
      filtro: this.filtro,
      ordenarPor: this.campoOrdenacao,
      ordem: this.ordem
    }).subscribe({
      next: (response) => {
        this.projetos = response.data;
        this.totalPaginas = response.pagination.totalPages;
        this.totalProjetos = response.pagination.total;
        this.loading = false;
        console.log('✅ Projetos carregados:', this.projetos.length);
      },
      error: (error) => {
        this.error = 'Erro ao carregar projetos: ' + (error.error?.message || error.message);
        this.loading = false;
        console.error('❌ Erro ao carregar projetos:', error);
      }
    });
  }

  carregarEstatisticas(): void {
    this.jiraService.obterEstatisticasProjetos().subscribe({
      next: (response) => {
        this.estatisticas = response.data;
        console.log('✅ Estatísticas carregadas:', this.estatisticas);
      },
      error: (error) => {
        console.error('❌ Erro ao carregar estatísticas:', error);
      }
    });
  }

  aplicarFiltro(): void {
    this.pagina = 1;
    this.carregarProjetos();
  }

  limparFiltro(): void {
    this.filtro = '';
    this.pagina = 1;
    this.carregarProjetos();
  }

  ordenarPor(campo: string): void {
    if (this.campoOrdenacao === campo) {
      this.ordem = this.ordem === 'ASC' ? 'DESC' : 'ASC';
    } else {
      this.campoOrdenacao = campo;
      this.ordem = 'DESC';
    }
    this.carregarProjetos();
  }

  proximaPagina(): void {
    if (this.pagina < this.totalPaginas) {
      this.pagina++;
      this.carregarProjetos();
    }
  }

  paginaAnterior(): void {
    if (this.pagina > 1) {
      this.pagina--;
      this.carregarProjetos();
    }
  }

  irParaPagina(pagina: number): void {
    if (pagina >= 1 && pagina <= this.totalPaginas) {
      this.pagina = pagina;
      this.carregarProjetos();
    }
  }

  toggleEstatisticas(): void {
    this.mostrarEstatisticas = !this.mostrarEstatisticas;
  }

  formatarData(data: string): string {
    return new Date(data).toLocaleString('pt-BR');
  }

  formatarDataCurta(data: string): string {
    return new Date(data).toLocaleDateString('pt-BR');
  }

  getPaginasVisiveis(): number[] {
    const paginas: number[] = [];
    const maxPaginas = 5;
    let inicio = Math.max(1, this.pagina - Math.floor(maxPaginas / 2));
    let fim = Math.min(this.totalPaginas, inicio + maxPaginas - 1);
    
    if (fim - inicio < maxPaginas - 1) {
      inicio = Math.max(1, fim - maxPaginas + 1);
    }
    
    for (let i = inicio; i <= fim; i++) {
      paginas.push(i);
    }
    
    return paginas;
  }

  parseFloat(value: string): number {
    return parseFloat(value) || 0;
  }
}
