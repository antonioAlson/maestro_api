import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { JiraService, Project, ProjectDetail, ProjectsResponse } from '../../services/jira.service';
import { Subscription } from 'rxjs';

type NovoProjetoForm = {
  project: string;
  material_type: string;
  brand: string;
  model: string;
  spec_8c: string;
  spec_9c: string;
  spec_11c: string;
  metro_quadrado_8c: number | null;
  metro_quadrado_9c: number | null;
  metro_quadrado_11c: number | null;
  quantidade_placas_8c: number;
  quantidade_placas_9c: number;
  quantidade_placas_11c: number;
  flag_corte: boolean;
  flag_mapa_kit: boolean;
  flag_relatorio_encaixe: boolean;
  flag_etiquetagem: boolean;
  flag_modelo_pastas: boolean;
  roof_config: string;
  total_parts_qty: number;
  lid_parts_qty: number;
};

type ModalModo = 'novo' | 'visualizar' | 'editar' | 'clonar';

@Component({
  selector: 'app-cadastro-projetos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cadastro-projetos.component.html',
  styleUrl: './cadastro-projetos.component.scss'
})
export class CadastroProjetosComponent implements OnInit, OnDestroy {
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
  abaAtiva: 'geral' | 'especificacao' | 'anexos' = 'geral';

  // Modal de novo cadastro
  mostrarModal: boolean = false;
  salvandoProjeto: boolean = false;
  modoModal: ModalModo = 'novo';
  projetoEmEdicaoId: number | null = null;
  carregandoProjetoDetalhe: boolean = false;
  showCadastroPopup: boolean = false;
  cadastroPopupType: 'success' | 'error' | '' = '';
  cadastroPopupMessage: string = '';
  showConfirmacaoPopup: boolean = false;
  confirmacaoPopupTitulo: string = '';
  confirmacaoPopupMensagem: string = '';
  confirmacaoPopupBotao: string = 'Confirmar';
  confirmacaoAcaoPendente: 'salvar' | 'excluir' | '' = '';
  projetoPendenteExclusao: Project | null = null;

  // Menu de apoio por linha
  mostrarMenuApoio: boolean = false;
  menuApoioPosicao = { x: 0, y: 0 };
  projetoSelecionadoMenu: Project | null = null;
  
  // Listas para campos do formulário
  tiposMaterial: string[] = ['ARAMIDA', 'TENSYLON'];
  marcas: string[] = [];
  private projetosSubscription?: Subscription;
  
  // Formulário de novo projeto
  novoProjeto: NovoProjetoForm = {
    project: '',
    material_type: '',
    brand: '',
    model: '',
    spec_8c: '',
    spec_9c: '',
    spec_11c: '',
    metro_quadrado_8c: null,
    metro_quadrado_9c: null,
    metro_quadrado_11c: null,
    quantidade_placas_8c: 0,
    quantidade_placas_9c: 0,
    quantidade_placas_11c: 0,
    flag_corte: false,
    flag_mapa_kit: false,
    flag_relatorio_encaixe: false,
    flag_etiquetagem: false,
    flag_modelo_pastas: false,
    roof_config: '',
    total_parts_qty: 0,
    lid_parts_qty: 0
  };

  constructor(
    private jiraService: JiraService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    console.log('CadastroProjetosComponent inicializado');
    this.carregarProjetos();
    this.carregarMarcas();
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.mostrarMenuApoio) {
      this.fecharMenuApoio();
    }
  }

  getTituloModal(): string {
    if (this.modoModal === 'visualizar') {
      return 'Visualizar Projeto';
    }

    if (this.modoModal === 'editar') {
      return 'Editar Projeto';
    }

    if (this.modoModal === 'clonar') {
      return 'Clonar Projeto';
    }

    return 'Novo Cadastro de Projeto';
  }

  getTituloConfirmacao(): string {
    if (this.modoModal === 'editar') {
      return 'Confirma atualização';
    }

    if (this.modoModal === 'clonar') {
      return 'Confirma clonagem';
    }

    return 'Confirma cadastro';
  }

  getMensagemConfirmacaoSalvar(): string {
    if (this.modoModal === 'editar') {
      return `Deseja atualizar o projeto ${this.novoProjeto.project.trim()}?`;
    }

    if (this.modoModal === 'clonar') {
      return `Deseja criar o clone ${this.novoProjeto.project.trim()}?`;
    }

    return `Deseja cadastrar o projeto ${this.novoProjeto.project.trim()}?`;
  }

  getTextoBotaoSalvar(): string {
    if (this.modoModal === 'editar') {
      return 'Atualizar Projeto';
    }

    if (this.modoModal === 'clonar') {
      return 'Salvar Clone';
    }

    return 'Salvar Projeto';
  }

  abrirMenuApoio(event: MouseEvent, projeto: Project): void {
    event.stopPropagation();

    this.projetoSelecionadoMenu = projeto;
    this.mostrarMenuApoio = true;

    const menuWidth = 210;
    const margin = 12;
    const desiredX = event.clientX + 8;
    const desiredY = event.clientY + 8;

    this.menuApoioPosicao = {
      x: Math.min(desiredX, window.innerWidth - menuWidth - margin),
      y: Math.max(margin, desiredY)
    };
  }

  fecharMenuApoio(): void {
    this.mostrarMenuApoio = false;
    this.projetoSelecionadoMenu = null;
  }

  abrirPopupConfirmacao(acao: 'salvar' | 'excluir', titulo: string, mensagem: string, botao: string): void {
    this.confirmacaoAcaoPendente = acao;
    this.confirmacaoPopupTitulo = titulo;
    this.confirmacaoPopupMensagem = mensagem;
    this.confirmacaoPopupBotao = botao;
    this.showConfirmacaoPopup = true;
  }

  fecharPopupConfirmacao(): void {
    this.showConfirmacaoPopup = false;
    this.confirmacaoAcaoPendente = '';
    this.confirmacaoPopupTitulo = '';
    this.confirmacaoPopupMensagem = '';
    this.confirmacaoPopupBotao = 'Confirmar';
    this.projetoPendenteExclusao = null;
  }

  confirmarAcaoPopup(): void {
    const acao = this.confirmacaoAcaoPendente;
    const projetoExclusao = this.projetoPendenteExclusao;

    this.showConfirmacaoPopup = false;
    this.confirmacaoAcaoPendente = '';
    this.confirmacaoPopupTitulo = '';
    this.confirmacaoPopupMensagem = '';
    this.confirmacaoPopupBotao = 'Confirmar';

    if (acao === 'salvar') {
      this.executarSalvarProjeto();
      return;
    }

    if (acao === 'excluir' && projetoExclusao) {
      this.executarExcluirProjeto(projetoExclusao);
    }

    this.projetoPendenteExclusao = null;
  }

  private gerarNomeClone(baseProjectName: string): string {
    const base = String(baseProjectName || '').replace(/\s\(\d+\)$/i, '').trim();
    if (!base) {
      return 'Projeto (1)';
    }

    const used = new Set<number>();
    const escapedBase = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`^${escapedBase} \\((\\d+)\\)$`, 'i');

    this.projetos.forEach((item) => {
      const current = String(item.project || '').trim();
      if (current.toLowerCase() === base.toLowerCase()) {
        used.add(0);
        return;
      }

      const match = current.match(regex);
      if (match) {
        used.add(Number(match[1]));
      }
    });

    let idx = 1;
    while (used.has(idx)) {
      idx += 1;
    }

    return `${base} (${idx})`;
  }

  private parseJsonValue(jsonValue: any): Record<string, any> {
    if (!jsonValue) {
      return {};
    }

    if (typeof jsonValue === 'string') {
      try {
        return JSON.parse(jsonValue);
      } catch {
        return {};
      }
    }

    return jsonValue;
  }

  private mapProjectToForm(project: ProjectDetail): NovoProjetoForm {
    const linearMeters = this.parseJsonValue(project.linear_meters);
    const squareMeters = this.parseJsonValue(project.square_meters);
    const plateConsumption = this.parseJsonValue(project.plate_consumption);
    const reviews = this.parseJsonValue(project.reviews);

    const toStringValue = (value: any): string => {
      if (value === null || value === undefined || value === '') {
        return '';
      }

      return String(value);
    };

    const normalizeMaterialType = (value: any): string => {
      const raw = toStringValue(value).trim();
      if (!raw) {
        return '';
      }

      const upper = raw.toUpperCase();
      if (upper === 'MANTA') {
        return 'ARAMIDA';
      }

      if (upper === 'ARAMIDA' || upper === 'TENSYLON') {
        return upper;
      }

      return raw;
    };

    const toNullableNumber = (value: any): number | null => {
      if (value === null || value === undefined || value === '') {
        return null;
      }

      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const toNumber = (value: any): number => {
      if (value === null || value === undefined || value === '') {
        return 0;
      }

      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const materialType = normalizeMaterialType(project.material_type);

    return {
      project: toStringValue(project.project),
      material_type: materialType,
      brand: toStringValue(project.brand),
      model: toStringValue(project.model),
      spec_8c: toStringValue(materialType === 'TENSYLON'
        ? (linearMeters['tensylon'] ?? linearMeters['Metro Linear'] ?? linearMeters['8C'])
        : linearMeters['8C']),
      spec_9c: toStringValue(linearMeters['9C']),
      spec_11c: toStringValue(linearMeters['11C']),
      metro_quadrado_8c: toNullableNumber(materialType === 'TENSYLON'
        ? (squareMeters['tensylon'] ?? squareMeters['8C'])
        : squareMeters['8C']),
      metro_quadrado_9c: toNullableNumber(squareMeters['9C']),
      metro_quadrado_11c: toNullableNumber(squareMeters['11C']),
      quantidade_placas_8c: toNumber(plateConsumption['8C']),
      quantidade_placas_9c: toNumber(plateConsumption['9C']),
      quantidade_placas_11c: toNumber(plateConsumption['11C']),
      flag_corte: Boolean(reviews['cutting'] ?? project.flag_corte),
      flag_mapa_kit: Boolean(reviews['ki_Layout'] ?? project.flag_mapa_kit),
      flag_relatorio_encaixe: Boolean(reviews['nesting_report'] ?? project.flag_relatorio_encaixe),
      flag_etiquetagem: Boolean(reviews['labeling'] ?? project.flag_etiquetagem),
      flag_modelo_pastas: Boolean(reviews['folder_template'] ?? project.flag_modelo_pastas),
      roof_config: toStringValue(project.roof_config),
      total_parts_qty: toNumber(project.total_parts_qty),
      lid_parts_qty: toNumber(project.lid_parts_qty)
    };
  }

  private abrirProjetoEmModo(modo: 'visualizar' | 'editar'): void {
    if (!this.projetoSelecionadoMenu?.id) {
      return;
    }

    const projectId = this.projetoSelecionadoMenu.id;
    this.fecharMenuApoio();
    this.carregandoProjetoDetalhe = true;
    this.cdr.detectChanges();

    this.jiraService.obterProjectById(projectId).subscribe({
      next: (response) => {
        this.ngZone.run(() => {
          const projetoMapeado = this.mapProjectToForm(response.data);

          if (projetoMapeado.material_type && !this.tiposMaterial.includes(projetoMapeado.material_type)) {
            this.tiposMaterial = [...this.tiposMaterial, projetoMapeado.material_type];
          }

          this.novoProjeto = projetoMapeado;
          this.projetoEmEdicaoId = projectId;
          this.modoModal = modo;
          this.abaAtiva = 'geral';
          this.mostrarModal = true;
          this.carregandoProjetoDetalhe = false;
          this.cdr.detectChanges();
        });
      },
      error: (error) => {
        this.ngZone.run(() => {
          this.carregandoProjetoDetalhe = false;
          this.showCadastroPopup = true;
          this.cadastroPopupType = 'error';
          this.cadastroPopupMessage = error?.error?.message || 'Erro ao carregar dados do projeto.';
          this.cdr.detectChanges();
        });
      }
    });
  }

  visualizarProjetoSelecionado(): void {
    this.abrirProjetoEmModo('visualizar');
  }

  editarProjetoSelecionado(): void {
    this.abrirProjetoEmModo('editar');
  }

  clonarProjetoSelecionado(): void {
    if (!this.projetoSelecionadoMenu?.id) {
      return;
    }

    const projectId = this.projetoSelecionadoMenu.id;
    this.fecharMenuApoio();

    this.carregandoProjetoDetalhe = true;
    this.cdr.detectChanges();

    this.jiraService.obterProjectById(projectId).subscribe({
      next: (response) => {
        this.ngZone.run(() => {
          this.novoProjeto = this.mapProjectToForm(response.data);
          this.novoProjeto.project = this.gerarNomeClone(this.novoProjeto.project);
          this.projetoEmEdicaoId = null;
          this.modoModal = 'clonar';
          this.abaAtiva = 'geral';
          this.mostrarModal = true;
          this.carregandoProjetoDetalhe = false;
          this.cdr.detectChanges();
        });
      },
      error: (error) => {
        this.ngZone.run(() => {
          this.carregandoProjetoDetalhe = false;
          this.showCadastroPopup = true;
          this.cadastroPopupType = 'error';
          this.cadastroPopupMessage = error?.error?.message || 'Erro ao preparar clonagem.';
          this.cdr.detectChanges();
        });
      }
    });
  }

  excluirProjetoSelecionado(): void {
    if (!this.projetoSelecionadoMenu?.id) {
      return;
    }

    this.projetoPendenteExclusao = this.projetoSelecionadoMenu;
    this.fecharMenuApoio();

    this.abrirPopupConfirmacao(
      'excluir',
      'Confirma exclusão',
      `Deseja excluir o projeto ${this.projetoPendenteExclusao.project}?`,
      'Excluir Projeto'
    );
  }

  private executarExcluirProjeto(projeto: Project): void {
    if (!projeto?.id) {
      return;
    }

    this.jiraService.excluirProject(projeto.id).subscribe({
      next: (response) => {
        this.carregarProjetos();
        this.showCadastroPopup = true;
        this.cadastroPopupType = 'success';
        this.cadastroPopupMessage = response?.message || 'Projeto excluído com sucesso.';
      },
      error: (error) => {
        this.showCadastroPopup = true;
        this.cadastroPopupType = 'error';
        this.cadastroPopupMessage = error?.error?.message || 'Erro ao excluir projeto.';
      }
    });
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

  selecionarAba(aba: 'geral' | 'especificacao' | 'anexos'): void {
    this.abaAtiva = aba;
    console.log('Aba ativa:', aba);
  }

  onMaterialTypeChange(materialType: string): void {
    const tipo = String(materialType || '').trim().toUpperCase();

    if (tipo !== 'TENSYLON') {
      return;
    }

    // No modo TENSYLON, a aba Placas usa apenas Metro Linear.
    this.novoProjeto.spec_9c = '';
    this.novoProjeto.spec_11c = '';
    this.novoProjeto.metro_quadrado_8c = null;
    this.novoProjeto.metro_quadrado_9c = null;
    this.novoProjeto.metro_quadrado_11c = null;
    this.novoProjeto.quantidade_placas_8c = 0;
    this.novoProjeto.quantidade_placas_9c = 0;
    this.novoProjeto.quantidade_placas_11c = 0;
    this.onMetroLinearChange(this.novoProjeto.spec_8c);
  }

  normalizeSpecField(field: 'spec_8c' | 'spec_9c' | 'spec_11c'): void {
    const currentValue = this.novoProjeto[field];
    const numero = this.parseNumero(currentValue);

    if (numero === null) {
      this.novoProjeto[field] = '';
      return;
    }

    this.novoProjeto[field] = this.formatToThreeDecimals(numero);

    if (field === 'spec_8c') {
      this.onSpec8cChange(this.novoProjeto[field]);
      return;
    }

    if (field === 'spec_9c') {
      this.onSpec9cChange(this.novoProjeto[field]);
      return;
    }

    this.onSpec11cChange(this.novoProjeto[field]);
  }

  isTipoMaterialTensylon(): boolean {
    return String(this.novoProjeto.material_type || '').trim().toUpperCase() === 'TENSYLON';
  }

  private roundToThreeDecimals(value: number): number {
    return Number(value.toFixed(3));
  }

  private formatToThreeDecimals(value: number): string {
    return this.roundToThreeDecimals(value).toFixed(3);
  }

  private parseNumero(value: string): number | null {
    if (value === null || value === undefined) {
      return null;
    }

    const normalizado = String(value).trim().replace(',', '.');
    if (!normalizado) {
      return null;
    }

    const numero = Number(normalizado);
    return Number.isFinite(numero) ? numero : null;
  }

  private calcularValorMetroQuadrado(k: number | null | undefined): string | number {
    if (k === null || k === undefined) return '';

    if (k < 2990) {
      return (k / 1000 * 1.6) + 0.008;
    } else if (k < 5980) {
      return (k / 1000 * 1.6) + 0.024;
    } else if (k < 8970) {
      return (k / 1000 * 1.6) + 0.04;
    } else if (k < 11960) {
      return (k / 1000 * 1.6) + 0.056;
    } else if (k < 14950) {
      return (k / 1000 * 1.6) + 0.064;
    } else {
      return 'fora da faixa';
    }
  }

  onMetroLinearChange(valorMm: string): void {
    const valorMetroLinear = this.parseNumero(valorMm);

    if (valorMetroLinear === null) {
      this.novoProjeto.spec_8c = '';
      this.novoProjeto.metro_quadrado_8c = null;
      return;
    }

    const valorLinearNormalizado = this.roundToThreeDecimals(valorMetroLinear);
    this.novoProjeto.spec_8c = this.formatToThreeDecimals(valorLinearNormalizado);
    this.novoProjeto.metro_quadrado_8c = this.roundToThreeDecimals((valorLinearNormalizado / 1000) * 1.6);
  }

  onSpec8cChange(valorMm: string): void {
    const valorCalculado = this.calcularValorMetroQuadrado(this.parseNumero(valorMm));

    if (typeof valorCalculado === 'number') {
      const metroQuadrado = this.roundToThreeDecimals(valorCalculado);
      this.novoProjeto.metro_quadrado_8c = metroQuadrado;
      this.novoProjeto.quantidade_placas_8c = this.roundToThreeDecimals(metroQuadrado / 4.8);
      return;
    }

    this.novoProjeto.metro_quadrado_8c = null;
    this.novoProjeto.quantidade_placas_8c = 0;
  }

  onSpec9cChange(valorMm: string): void {
    const valorCalculado = this.calcularValorMetroQuadrado(this.parseNumero(valorMm));

    if (typeof valorCalculado === 'number') {
      const metroQuadrado = this.roundToThreeDecimals(valorCalculado);
      this.novoProjeto.metro_quadrado_9c = metroQuadrado;
      this.novoProjeto.quantidade_placas_9c = this.roundToThreeDecimals(metroQuadrado / 4.8);
      return;
    }

    this.novoProjeto.metro_quadrado_9c = null;
    this.novoProjeto.quantidade_placas_9c = 0;
  }

  onSpec11cChange(valorMm: string): void {
    const valorCalculado = this.calcularValorMetroQuadrado(this.parseNumero(valorMm));

    if (typeof valorCalculado === 'number') {
      const metroQuadrado = this.roundToThreeDecimals(valorCalculado);
      this.novoProjeto.metro_quadrado_11c = metroQuadrado;
      this.novoProjeto.quantidade_placas_11c = this.roundToThreeDecimals(metroQuadrado / 4.8);
      return;
    }

    this.novoProjeto.metro_quadrado_11c = null;
    this.novoProjeto.quantidade_placas_11c = 0;
  }

  carregarProjetos(): void {
    this.projetosSubscription?.unsubscribe();
    this.loading = true;
    this.error = '';
    this.cdr.detectChanges();

    this.projetosSubscription = this.jiraService.listarProjects({
      page: this.pagina,
      limit: this.limite,
      filtro: this.filtro,
      ordenarPor: this.campoOrdenacao,
      ordem: this.ordem
    }).subscribe({
      next: (response) => {
        this.ngZone.run(() => {
          this.projetos = response.data;
          this.totalPaginas = response.pagination.totalPages;
          this.totalProjetos = response.pagination.totalItems;
          this.loading = false;
          console.log('✅ Projetos carregados:', this.projetos.length);
          this.cdr.detectChanges();
        });
      },
      error: (error) => {
        this.ngZone.run(() => {
          this.error = 'Erro ao carregar projetos: ' + (error.error?.message || error.message);
          this.loading = false;
          console.error('❌ Erro ao carregar projetos:', error);
          this.cdr.detectChanges();
        });
      }
    });
  }

  ngOnDestroy(): void {
    this.projetosSubscription?.unsubscribe();
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
    this.modoModal = 'novo';
    this.projetoEmEdicaoId = null;
    this.abaAtiva = 'geral';
    this.mostrarModal = true;
    this.limparFormulario();
  }

  fecharModal(): void {
    this.mostrarModal = false;
    this.modoModal = 'novo';
    this.projetoEmEdicaoId = null;
    this.abaAtiva = 'geral';
    this.limparFormulario();
  }

  closeCadastroPopup(): void {
    this.showCadastroPopup = false;
    this.cadastroPopupType = '';
    this.cadastroPopupMessage = '';
    this.cdr.detectChanges();
  }

  limparFormulario(): void {
    this.novoProjeto = {
      project: '',
      material_type: '',
      brand: '',
      model: '',
      spec_8c: '',
      spec_9c: '',
      spec_11c: '',
      metro_quadrado_8c: null,
      metro_quadrado_9c: null,
      metro_quadrado_11c: null,
      quantidade_placas_8c: 0,
      quantidade_placas_9c: 0,
      quantidade_placas_11c: 0,
      flag_corte: false,
      flag_mapa_kit: false,
      flag_relatorio_encaixe: false,
      flag_etiquetagem: false,
      flag_modelo_pastas: false,
      roof_config: '',
      total_parts_qty: 0,
      lid_parts_qty: 0
    };
  }

  salvarNovoProjeto(): void {
    if (this.modoModal === 'visualizar') {
      return;
    }

    if (this.salvandoProjeto) {
      return;
    }

    const camposFaltantes: string[] = [];
    if (!this.novoProjeto.project.trim()) camposFaltantes.push('Projeto');
    if (!this.novoProjeto.material_type.trim()) camposFaltantes.push('Tipo de Material');
    if (!this.novoProjeto.brand.trim()) camposFaltantes.push('Marca');
    if (!this.novoProjeto.model.trim()) camposFaltantes.push('Modelo');
    if (!Number.isFinite(this.novoProjeto.total_parts_qty) || this.novoProjeto.total_parts_qty <= 0) {
      camposFaltantes.push('Qtd. Total');
    }

    if (camposFaltantes.length > 0) {
      this.showCadastroPopup = true;
      this.cadastroPopupType = 'error';
      this.cadastroPopupMessage = `Preencha os campos obrigatórios:\n- ${camposFaltantes.join('\n- ')}`;
      return;
    }

    this.abrirPopupConfirmacao(
      'salvar',
      this.getTituloConfirmacao(),
      this.getMensagemConfirmacaoSalvar(),
      this.getTextoBotaoSalvar()
    );
  }

  private executarSalvarProjeto(): void {
    if (this.salvandoProjeto) {
      return;
    }

    this.salvandoProjeto = true;

    const isTensylon = this.isTipoMaterialTensylon();
    const linearMetersPayload: Record<string, string | number | null> = isTensylon
      ? {
          '8C': '',
          '9C': '',
          '11C': '',
          tensylon: this.novoProjeto.spec_8c
        }
      : {
          '8C': this.novoProjeto.spec_8c,
          '9C': this.novoProjeto.spec_9c,
          '11C': this.novoProjeto.spec_11c
        };

    const squareMetersPayload: Record<string, string | number | null> = isTensylon
      ? {
          '8C': '',
          '9C': '',
          '11C': '',
          tensylon: this.novoProjeto.metro_quadrado_8c
        }
      : {
          '8C': this.novoProjeto.metro_quadrado_8c,
          '9C': this.novoProjeto.metro_quadrado_9c,
          '11C': this.novoProjeto.metro_quadrado_11c
        };

    const payload = {
      ...this.novoProjeto,
      project: this.novoProjeto.project.trim(),
      material_type: this.novoProjeto.material_type.trim(),
      brand: this.novoProjeto.brand.trim(),
      model: this.novoProjeto.model.trim(),
      roof_config: this.novoProjeto.roof_config.trim(),
      total_parts_qty: Math.trunc(this.novoProjeto.total_parts_qty),
      lid_parts_qty: Math.max(0, Math.trunc(this.novoProjeto.lid_parts_qty || 0)),
      linear_meters: linearMetersPayload,
      square_meters: squareMetersPayload,
      plate_consumption: {
        '8C': isTensylon ? 0 : this.novoProjeto.quantidade_placas_8c,
        '9C': isTensylon ? 0 : this.novoProjeto.quantidade_placas_9c,
        '11C': isTensylon ? 0 : this.novoProjeto.quantidade_placas_11c
      },
      reviews: {
        cutting: this.novoProjeto.flag_corte,
        labeling: this.novoProjeto.flag_etiquetagem,
        ki_Layout: this.novoProjeto.flag_mapa_kit,
        nesting_report: this.novoProjeto.flag_relatorio_encaixe,
        folder_template: this.novoProjeto.flag_modelo_pastas
      }
    };

    const operacaoEdicao = this.modoModal === 'editar' && !!this.projetoEmEdicaoId;

    const idEdicao = this.projetoEmEdicaoId;

    const request$ = operacaoEdicao && idEdicao !== null
      ? this.jiraService.atualizarProject(idEdicao, payload)
      : this.jiraService.criarProject(payload);

    request$.subscribe({
      next: (response) => {
        this.salvandoProjeto = false;
        this.fecharModal();

        // Força exibição do novo item recém-criado no topo da listagem.
        this.pagina = 1;
        this.campoOrdenacao = 'id';
        this.ordem = 'DESC';
        this.carregarProjetos();

        this.showCadastroPopup = true;
        this.cadastroPopupType = 'success';
        this.cadastroPopupMessage = response?.message || (operacaoEdicao
          ? 'Projeto atualizado com sucesso!'
          : 'Projeto cadastrado com sucesso!');
      },
      error: (error) => {
        this.salvandoProjeto = false;
        this.showCadastroPopup = true;
        this.cadastroPopupType = 'error';
        this.cadastroPopupMessage = error?.error?.message || 'Erro ao cadastrar projeto.';
        console.error('❌ Erro ao salvar projeto:', error);
        this.cdr.detectChanges();
      }
    });
  }
}
