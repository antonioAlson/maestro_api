import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-ordens-producao',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ordens-producao.component.html',
  styleUrl: './ordens-producao.component.scss'
})
export class OrdensProducaoComponent implements OnInit {

  constructor() {}

  ngOnInit(): void {
  }

  openRoutine(routineName: string): void {
    console.log('Abrindo rotina:', routineName);
    // TODO: Implementar navegação ou modal para cada rotina
  }
}
