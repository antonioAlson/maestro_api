import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-relatorios-pcp',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './relatorios-pcp.component.html',
  styleUrl: './relatorios-pcp.component.scss'
})
export class RelatoriosPcpComponent implements OnInit {

  constructor() {}

  ngOnInit(): void {
  }

  openReport(reportName: string): void {
    console.log('Abrindo relatório:', reportName);
    // TODO: Implementar navegação ou modal para cada relatório
  }
}
