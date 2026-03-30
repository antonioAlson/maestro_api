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

  // Modal de novo cadastro
  mostrarModal: boolean = false;
  salvandoProjeto: boolean = false;
  
  // Listas para campos do formulário
  tiposMaterial: string[] = ['MANTA', 'VIDRO', 'POLICARBONATO', 'ACRILICO'];
  marcas: string[] = ['Audi', 'BMW', 'Mercedes', 'Volkswagen', 'Ford', 'Chevrolet', 'Fiat', 'Honda', 'Toyota', 'Hyundai', 'Nissan', 'Renault', 'Peugeot', 'Citroën'];
  modelos: string[] = [];
  
  modelosPorMarca: { [key: string]: string[] } = {
    'Audi': ['A1', 'A3', 'A4', 'A5', 'A6', 'Q3', 'Q5', 'Q7', 'Q8', 'TT'],
    'BMW': ['Série 1', 'Série 3', 'Série 5', 'X1', 'X3', 'X5', 'X6'],
    'Mercedes': ['Classe A', 'Classe C', 'Classe E', 'GLA', 'GLC', 'GLE'],
    'Volkswagen': ['Gol', 'Polo', 'Golf', 'Jetta', 'Passat', 'Tiguan', 'T-Cross'],
    'Ford': ['Ka', 'Fiesta', 'Focus', 'Fusion', 'EcoSport', 'Ranger'],
    'Chevrolet': ['Onix', 'Prisma', 'Cruze', 'Tracker', 'S10'],
    'Fiat': ['Uno', 'Palio', 'Argo', 'Cronos', 'Toro', 'Mobi'],
    'Honda': ['Civic', 'City', 'Fit', 'HR-V', 'CR-V'],
    'Toyota': ['Corolla', 'Hilux', 'RAV4', 'Yaris', 'Etios'],
    'Hyundai': ['HB20', 'Creta', 'Tucson', 'Santa Fe'],
    'Nissan': ['March', 'Versa', 'Sentra', 'Kicks', 'Frontier'],
    'Renault': ['Kwid', 'Sandero', 'Logan', 'Duster', 'Captur'],
    'Peugeot': ['208', '308', '2008', '3008'],
    'Citroën': ['C3', 'C4 Cactus', 'Aircross']
  };
  
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
    this.modelos = [];
  }

  onMarcaChange(): void {
    // Atualiza lista de modelos baseado na marca selecionada
    if (this.novoProjeto.brand && this.modelosPorMarca[this.novoProjeto.brand]) {
      this.modelos = this.modelosPorMarca[this.novoProjeto.brand];
    } else {
      this.modelos = [];
    }
    // Limpa o modelo selecionado quando marca mudar
    this.novoProjeto.model = '';
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
