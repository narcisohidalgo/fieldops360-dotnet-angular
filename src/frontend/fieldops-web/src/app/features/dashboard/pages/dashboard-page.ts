import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { merge } from 'rxjs';
import { RealtimeService } from '../../../core/services/realtime.service';

import { DashboardSummary } from '../models/dashboard-summary.model';
import { DashboardService } from '../services/dashboard.service';

type ChartColor = 'blue' | 'amber' | 'green' | 'slate';

interface ChartBar {
  key: string;
  label: string;
  count: number;
  percentage: number;
  color: ChartColor;
}

function chartBar(
  key: string,
  label: string,
  count: number,
  total: number,
  color: ChartColor
): ChartBar {
  return {
    key,
    label,
    count,
    percentage: total > 0 ? (count / total) * 100 : 0,
    color
  };
}
@Component({
  selector: 'app-dashboard-page',
  imports: [DatePipe, DecimalPipe, RouterLink],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss'
})
export class DashboardPage implements OnInit {
  protected readonly summary = signal<DashboardSummary | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly incidentChart = computed(() => {
    const data = this.summary()?.incidents;
    if (!data) return [];

    return [
      chartBar('open', 'Abiertas', data.open, data.total, 'blue'),
      chartBar('progress', 'En curso', data.inProgress, data.total, 'amber'),
      chartBar('resolved', 'Resueltas', data.resolved, data.total, 'green'),
      chartBar('closed', 'Cerradas', data.closed, data.total, 'slate')
    ];
  });

  protected readonly workOrderChart = computed(() => {
    const data = this.summary()?.workOrders;
    if (!data) return [];

    return [
      chartBar('planned', 'Planificadas', data.planned, data.total, 'blue'),
      chartBar('progress', 'En curso', data.inProgress, data.total, 'amber'),
      chartBar('completed', 'Completadas', data.completed, data.total, 'green'),
      chartBar('cancelled', 'Canceladas', data.cancelled, data.total, 'slate')
    ];
  });
  private readonly realtime = inject(RealtimeService);
  private readonly dashboard = inject(DashboardService);
  private readonly destroyRef = inject(DestroyRef);
  private loadSequence = 0;

  ngOnInit(): void {
    // Actualizar los indicadores al recibir cambios operativos.
    // Reutilizar el endpoint REST y los permisos existentes.
    merge(
      this.realtime.workOrdersChanged$,
      this.realtime.incidentsChanged$
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadSummary());

    this.loadSummary();
  }

  protected refresh(): void {
    if (!this.isLoading()) {
      this.loadSummary();
    }
  }

  private loadSummary(): void {
    // Evitar que respuestas antiguas sustituyan datos recientes.
    const currentLoad = ++this.loadSequence;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.dashboard.getSummary()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: summary => {
          if (currentLoad !== this.loadSequence) {
            return;
          }

          this.summary.set(summary);
          this.isLoading.set(false);
        },
        error: (error: unknown) => {
          if (currentLoad !== this.loadSequence) {
            return;
          }

          this.summary.set(null);
          this.isLoading.set(false);

          if (error instanceof HttpErrorResponse) {
            switch (error.status) {
              case 401:
                this.errorMessage.set(
                  'La sesión ha caducado. Inicia sesión nuevamente.'
                );
                return;

              case 403:
                this.errorMessage.set(
                  'No tienes permisos para consultar el dashboard.'
                );
                return;

              case 0:
                this.errorMessage.set(
                  'No se pudo conectar con el servidor.'
                );
                return;
            }
          }

          this.errorMessage.set(
            'No se pudieron cargar los indicadores.'
          );
        }
      });
  }
}