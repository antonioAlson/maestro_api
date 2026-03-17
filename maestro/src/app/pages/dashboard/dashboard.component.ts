import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

interface MonthlyOrderMetrics {
  newOrders: number;
  inProduction: number;
  releasedForProduction: number;
  deliveredThisMonth: number;
}

type MetricKey = keyof MonthlyOrderMetrics;

interface DailyMetricPoint {
  day: number;
  value: number;
}

type ChartStyle = 'bars' | 'line' | 'area';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class HomeComponent implements OnInit, OnDestroy {
  currentMonthLabel = '';
  currentDateTimeLabel = '';
  daysInMonth = 30;
  currentDayOfMonth = 1;
  yAxisMax = 50;
  yAxisTicks: number[] = Array.from({ length: 11 }, (_, index) => this.yAxisMax - index * 5);
  metrics: MonthlyOrderMetrics = {
    newOrders: 0,
    inProduction: 0,
    releasedForProduction: 0,
    deliveredThisMonth: 0
  };
  selectedMetric: MetricKey = 'newOrders';
  selectedMetricTitle = 'Aguardando Projeto';
  dailySeries: DailyMetricPoint[] = [];
  visibleSeries: DailyMetricPoint[] = [];
  dailyMetrics: Record<MetricKey, DailyMetricPoint[]> = {
    newOrders: [],
    inProduction: [],
    releasedForProduction: [],
    deliveredThisMonth: []
  };
  chartMaxValue = 1;
  selectedMetricTotal = 0;
  chartStyle: ChartStyle = 'bars';
  private clockIntervalId?: ReturnType<typeof setInterval>;

  constructor() {}

  ngOnInit(): void {
    const formattedMonth = new Intl.DateTimeFormat('pt-BR', {
      month: 'long',
      year: 'numeric'
    }).format(new Date());
    this.currentMonthLabel = formattedMonth.charAt(0).toUpperCase() + formattedMonth.slice(1);
    this.updateCurrentDateTime();
    this.clockIntervalId = setInterval(() => this.updateCurrentDateTime(), 1000);
    const now = new Date();
    this.daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    this.currentDayOfMonth = now.getDate();

    this.loadInitialDashboardMetrics();
    this.selectMetric('newOrders', 'Aguardando Projeto');
  }

  ngOnDestroy(): void {
    if (this.clockIntervalId) {
      clearInterval(this.clockIntervalId);
    }
  }

  private updateCurrentDateTime(): void {
    this.currentDateTimeLabel = new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(new Date());
  }

  private loadInitialDashboardMetrics(): void {
    // Simulacao para visualizacao do dashboard.
    this.dailyMetrics = {
      newOrders: this.simulateDailySeries(this.daysInMonth, 10, 30),
      inProduction: this.simulateDailySeries(this.daysInMonth, 8, 26),
      releasedForProduction: this.simulateDailySeries(this.daysInMonth, 6, 22),
      deliveredThisMonth: this.simulateDailySeries(this.daysInMonth, 5, 24)
    };

    this.metrics = {
      newOrders: this.sumDailySeries(this.dailyMetrics.newOrders),
      inProduction: this.sumDailySeries(this.dailyMetrics.inProduction),
      releasedForProduction: this.sumDailySeries(this.dailyMetrics.releasedForProduction),
      deliveredThisMonth: this.sumDailySeries(this.dailyMetrics.deliveredThisMonth)
    };
  }

  selectMetric(metric: MetricKey, title: string): void {
    this.selectedMetric = metric;
    this.selectedMetricTitle = title;
    this.selectedMetricTotal = this.metrics[metric];
    this.dailySeries = this.dailyMetrics[metric] ?? [];
    this.visibleSeries = this.dailySeries.filter(point => point.day <= this.currentDayOfMonth);
    this.chartMaxValue = Math.max(...this.dailySeries.map(p => p.value), 1);
  }

  getBarHeightPercent(value: number): number {
    return (Math.min(value, this.yAxisMax) / this.yAxisMax) * 100;
  }

  setChartStyle(style: ChartStyle): void {
    this.chartStyle = style;
  }

  getPointXByDay(day: number): number {
    if (this.daysInMonth <= 0) {
      return 0;
    }

    // Center line points in each day column of the same grid used by bars.
    return ((day - 0.5) / this.daysInMonth) * 100;
  }

  getPointY(value: number): number {
    return 100 - this.getBarHeightPercent(value);
  }

  getLinePoints(series: DailyMetricPoint[]): string {
    return series
      .map((point) => `${this.getPointXByDay(point.day)},${this.getPointY(point.value)}`)
      .join(' ');
  }

  getAreaPath(series: DailyMetricPoint[]): string {
    if (!series.length) {
      return '';
    }

    const linePoints = this.getLinePoints(series);
    const firstX = this.getPointXByDay(series[0].day);
    const lastX = this.getPointXByDay(series[series.length - 1].day);
    return `M ${firstX},100 L ${linePoints} L ${lastX},100 Z`;
  }

  private simulateDailySeries(days: number, minValue: number, maxValue: number): DailyMetricPoint[] {
    if (days <= 0) {
      return [];
    }

    const series: DailyMetricPoint[] = [];

    for (let day = 1; day <= days; day++) {
      if (day > this.currentDayOfMonth) {
        series.push({ day, value: 0 });
        continue;
      }

      // Fim de semana tende a ter menor entrada de pedidos.
      const weekendAdjustment = day % 7 === 0 || day % 7 === 6 ? -4 : 0;
      const randomBase = Math.floor(Math.random() * (maxValue - minValue + 1)) + minValue;
      const value = Math.min(30, Math.max(0, randomBase + weekendAdjustment));
      series.push({ day, value });
    }

    return series;
  }

  private sumDailySeries(series: DailyMetricPoint[]): number {
    return series.reduce((sum, point) => sum + point.value, 0);
  }
}
