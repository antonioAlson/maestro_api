import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { JiraService, Project, ProjectsResponse } from '../../services/jira.service';

@Component({
  selector: 'app-cadastro-projetos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cadastro-projetos.component.html',
  styleUrl: './cadastro-projetos.component.scss'
})
export class CadastroProjetosComponent implements OnInit {
  projetos: Project[] = [];
  loading: boolean = false;
  error: string = '';
  
  // Paginação
  pagina: number = 1;
  limite: number = 20;
  totalPaginas: number = 0;
  totalProjetos: number = 0;
  
  // Filtros e ordenação
  filtro: string = '';
  campoOrdenacao: string = 'id';
  ordem: 'ASC' | 'DESC' = 'DESC';

  // Controle de abas
  abaAtiva: 'geral' | 'camadas' = 'geral';

  // Modal de novo cadastro
  mostrarModal: boolean = false;
  salvandoProjeto: boolean = false;
  
  // Listas para campos do formulário
  tiposMaterial: string[] = ['MANTA', 'TENSYLON'];
  marcas: string[] = [];
  
  // Formulário de novo projeto
  novoProjeto = {
    project: '',
    material_type: '',
    brand: '',
    model: '',
    roof_config: '',
    total_parts_qty: 0,
    lid_parts_qty: 0
  };

  constructor(
    private jiraService: JiraService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    console.log('CadastroProjetosComponent inicializado');
    this.carregarProjetos();
    this.carregarMarcas();
  }

  carregarMarcas(): void {
    console.log('🏷️ Carregando marcas do banco de dados...');
    
    this.jiraService.obterMarcasUnicas().subscribe({
      next: (marcas) => {
        this.marcas = marcas;
        console.log(`✅ ${marcas.length} marcas carregadas:`, marcas);
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('❌ Erro ao carregar marcas:', error);
        // Mantém array vazio em caso de erro
        this.marcas = [];
      }
    });
  }

  selecionarAba(aba: 'geral' | 'camadas'): void {
    this.abaAtiva = aba;
    console.log('Aba ativa:', aba);
  }

  carregarProjetos(): void {
    this.loading = true;
    this.error = '';

    this.jiraService.listarProjects({
      page: this.pagina,
      limit: this.limite,
      filtro: this.filtro,
      ordenarPor: this.campoOrdenacao,
      ordem: this.ordem
    }).subscribe({
      next: (response) => {
        this.projetos = response.data;
        this.totalPaginas = response.pagination.totalPages;
        this.totalProjetos = response.pagination.totalItems;
        this.loading = false;
        console.log('✅ Projetos carregados:', this.projetos.length);
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.error = 'Erro ao carregar projetos: ' + (error.error?.message || error.message);
        this.loading = false;
        console.error('❌ Erro ao carregar projetos:', error);
        this.cdr.detectChanges();
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

  novoCadastro(): void {
    console.log('🆕 Novo cadastro solicitado');
    this.mostrarModal = true;
    this.limparFormulario();
  }

  fecharModal(): void {
    this.mostrarModal = false;
    this.limparFormulario();
  }

  limparFormulario(): void {
    this.novoProjeto = {
      project: '',
      material_type: '',
      brand: '',
      model: '',
      roof_config: '',
      total_parts_qty: 0,
      lid_parts_qty: 0
    };
  }

  salvarNovoProjeto(): void {
    // Validação básica
    if (!this.novoProjeto.project || !this.novoProjeto.material_type || !this.novoProjeto.brand) {
      alert('Por favor, preencha os campos obrigatórios: Projeto, Tipo de Material e Marca');
      return;
    }

    this.salvandoProjeto = true;
    
    // TODO: Implementar chamada à API para criar novo projeto
    console.log('Salvando novo projeto:', this.novoProjeto);
    
    // Simulação temporária - remover quando implementar a API
    setTimeout(() => {
      this.salvandoProjeto = false;
      this.fecharModal();
      alert('Projeto cadastrado com sucesso!');
      this.carregarProjetos(); // Recarregar lista
    }, 1000);
  }
}
