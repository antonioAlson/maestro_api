import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

interface KanbanCard {
  id: string;
  numero: string;
  title: string;
  description: string;
  status: string;
  situacao: string;
  veiculo: string;
  previsao: string;
  prioridade?: 'alta' | 'media' | 'baixa';
}

interface KanbanColumn {
  id: string;
  title: string;
  cards: KanbanCard[];
}

@Component({
  selector: 'app-acompanhamento',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './acompanhamento.component.html',
  styleUrl: './acompanhamento.component.scss'
})
export class AcompanhamentoComponent implements OnInit {
  columns: KanbanColumn[] = [
    {
      id: 'aguardando-projeto',
      title: 'Aguardando Projeto',
      cards: []
    },
    {
      id: 'projeto-liberado',
      title: 'Projeto Liberado',
      cards: []
    },
    {
      id: 'produzidos',
      title: 'Produzidos',
      cards: []
    }
  ];

  draggedCard: KanbanCard | null = null;
  draggedFromColumn: string | null = null;

  constructor() {}

  ngOnInit(): void {
    this.loadMockData();
  }

  loadMockData(): void {
    // Dados de exemplo
    this.columns[0].cards = [
      {
        id: 'MANTA-30999',
        numero: '31134',
        title: 'REBLINDAGEM - OS 1046042 - SUPPLY 114526',
        description: 'BYD KING SEDAN 2026',
        status: 'Aguardando Projeto',
        situacao: '⚫ Aguardando entrada',
        veiculo: 'TOYOTA - COROLLA SEDAN',
        previsao: '20/03/2026',
        prioridade: 'baixa'
      },
      {
        id: 'TENSYLON-205',
        numero: '30945',
        title: 'Montagem peça 5678',
        description: '',
        status: 'Aguardando Projeto',
        situacao: '⚫ Aguardando análise',
        veiculo: 'Toyota',
        previsao: '22/03/2026',
        prioridade: 'media'
      }
    ];

    this.columns[1].cards = [
      {
        id: 'MANTA-30622',
        numero: '31028',
        title: 'TOYOTA - COROLLA SEDAN 2026',
        description: '',
        status: 'Projeto Liberado',
        situacao: '🟢 RECEBIDO LIBERADO',
        veiculo: 'TOYOTA - COROLLA SEDAN',
        previsao: '19/03/2026',
        prioridade: 'alta'
      },
      {
        id: 'MANTA-30621',
        numero: '31021',
        title: 'TOYOTA - COROLLA CROSS',
        description: 'Explorador de Arquivos',
        status: 'Projeto Liberado',
        situacao: '🟢 RECEBIDO LIBERADO',
        veiculo: 'TOYOTA - COROLLA CROSS',
        previsao: '21/03/2026',
        prioridade: 'media'
      },
      {
        id: 'MANTA-89',
        numero: '30876',
        title: 'Acabamento item 9012',
        description: '',
        status: 'Projeto Liberado',
        situacao: '🟢 Em análise',
        veiculo: 'Jaguar',
        previsao: '19/03/2026',
        prioridade: 'alta'
      }
    ];

    this.columns[2].cards = [
      {
        id: 'MANTA-30084',
        numero: '30541',
        title: 'GWM - HAVAL H9 SUV - 2026',
        description: '',
        status: 'Produzidos',
        situacao: '⚪ RECEBIDO ENCAMINHADO',
        veiculo: 'GWM - HAVAL H9 SUV',
        previsao: '15/03/2026',
        prioridade: 'media'
      },
      {
        id: 'MANTA-30805',
        numero: '30805',
        title: 'BMW - X1 SUV - 2026',
        description: '',
        status: 'Produzidos',
        situacao: '✅ Finalizado',
        veiculo: 'BMW - X1 SUV',
        previsao: '16/03/2026',
        prioridade: 'baixa'
      },
      {
        id: 'MANTA-67',
        numero: '30234',
        title: 'Montagem finalizada 7890',
        description: '',
        status: 'Produzidos',
        situacao: '✅ Finalizado',
        veiculo: 'Land Rover',
        previsao: '15/03/2026',
        prioridade: 'media'
      }
    ];
  }

  onDragStart(event: DragEvent, card: KanbanCard, columnId: string): void {
    this.draggedCard = card;
    this.draggedFromColumn = columnId;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/html', event.target as any);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  onDrop(event: DragEvent, targetColumnId: string): void {
    event.preventDefault();
    
    if (this.draggedCard && this.draggedFromColumn) {
      // Remover card da coluna original
      const fromColumn = this.columns.find(col => col.id === this.draggedFromColumn);
      if (fromColumn) {
        const cardIndex = fromColumn.cards.findIndex(c => c.id === this.draggedCard!.id);
        if (cardIndex > -1) {
          fromColumn.cards.splice(cardIndex, 1);
        }
      }

      // Adicionar card na coluna de destino
      const toColumn = this.columns.find(col => col.id === targetColumnId);
      if (toColumn) {
        this.draggedCard.status = toColumn.title;
        toColumn.cards.push(this.draggedCard);
      }

      this.draggedCard = null;
      this.draggedFromColumn = null;
    }
  }

  onDragEnd(): void {
    this.draggedCard = null;
    this.draggedFromColumn = null;
  }

  isContecVehicle(veiculo: string): boolean {
    const marcasContec = ['land rover', 'toyota', 'jaguar'];
    return marcasContec.some(marca => veiculo.toLowerCase().includes(marca));
  }
}
