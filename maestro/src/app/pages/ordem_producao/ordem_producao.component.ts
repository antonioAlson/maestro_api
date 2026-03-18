import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-ordem-producao',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ordem_producao.component.html',
  styleUrl: './ordem_producao.component.scss'
})
export class OrdemProducaoComponent implements OnInit {

  constructor() {}

  ngOnInit(): void {
  }

  openRoutine(routineName: string): void {
    console.log('Abrindo rotina:', routineName);
    // TODO: Implementar navegação ou modal para cada rotina
  }
}
