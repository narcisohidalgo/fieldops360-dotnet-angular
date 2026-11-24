import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  WorkOrder,
  WorkOrderPriority,
  WorkOrderStatus
} from '../models/work-order.model';

import { MyWorkOrderService } from '../services/my-work-order.service';

type TechnicianAction = 'start' | 'complete';

@Component({
  selector: 'app-my-work-orders-page',
  imports: [DatePipe],
  templateUrl: './my-work-orders-page.html',
  styleUrl: './my-work-orders-page.scss'
})
export class MyWorkOrdersPage implements OnInit {
  protected readonly orders = signal<WorkOrder[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  protected readonly actionTarget = signal<{
    order: WorkOrder;
    action: TechnicianAction;
  } | null>(null);

  protected readonly isChangingStatus = signal(false);
  protected readonly actionError = signal<string | null>(null);

  protected readonly statuses = WorkOrderStatus;

  private readonly service = inject(MyWorkOrderService);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.loadOrders();
  }

  protected statusLabel(status: WorkOrderStatus): string {
    switch (status) {
      case WorkOrderStatus.Planned:
        return 'Planificada';
      case WorkOrderStatus.InProgress:
        return 'En curso';
      case WorkOrderStatus.Completed:
        return 'Completada';
      case WorkOrderStatus.Cancelled:
        return 'Cancelada';
      default:
        return 'Desconocido';
    }
  }

  protected priorityLabel(priority: WorkOrderPriority): string {
    switch (priority) {
      case WorkOrderPriority.Low:
        return 'Baja';
      case WorkOrderPriority.Medium:
        return 'Media';
      case WorkOrderPriority.High:
        return 'Alta';
      case WorkOrderPriority.Critical:
        return 'Crítica';
      default:
        return 'Desconocida';
    }
  }

  protected availableAction(order: WorkOrder): TechnicianAction | null {
    switch (order.status) {
      case WorkOrderStatus.Planned:
        return 'start';
      case WorkOrderStatus.InProgress:
        return 'complete';
      default:
        return null;
    }
  }

  protected actionLabel(action: TechnicianAction): string {
    return action === 'start' ? 'Iniciar' : 'Completar';
  }

  protected requestAction(
    order: WorkOrder,
    action: TechnicianAction
  ): void {
    if (
      this.isLoading() ||
      this.isChangingStatus() ||
      this.actionTarget() !== null ||
      this.availableAction(order) !== action ||
      !this.orders().some(item => item.id === order.id)
    ) {
      return;
    }

    this.actionTarget.set({ order, action });
    this.actionError.set(null);
    this.successMessage.set(null);
  }

  protected cancelAction(): void {
    if (this.isChangingStatus()) {
      return;
    }

    this.actionTarget.set(null);
    this.actionError.set(null);
  }

  protected confirmAction(): void {
    const target = this.actionTarget();

    if (
      !target ||
      this.isChangingStatus() ||
      this.isLoading() ||
      this.availableAction(target.order) !== target.action
    ) {
      return;
    }

    this.isChangingStatus.set(true);
    this.actionError.set(null);

    const request$ = target.action === 'start'
      ? this.service.start(target.order.id)
      : this.service.complete(target.order.id);

    request$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isChangingStatus.set(false);
          this.actionTarget.set(null);

          this.successMessage.set(
            `Orden ${target.order.code} actualizada correctamente.`
          );

          this.loadOrders();
        },
        error: (error: unknown) => {
          this.isChangingStatus.set(false);
          this.actionError.set(this.describeActionError(error));
        }
      });
  }

  protected loadOrders(): void {
    if (this.isChangingStatus()) {
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.service.getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: orders => {
          this.orders.set(orders);
          this.isLoading.set(false);
        },
        error: (error: unknown) => {
          this.errorMessage.set(this.describeLoadError(error));
          this.isLoading.set(false);
        }
      });
  }

  private describeLoadError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      switch (error.status) {
        case 401:
          return 'Tu sesión ha caducado. Inicia sesión de nuevo.';
        case 403:
          return 'Tu cuenta necesita una ficha de técnico activa vinculada.';
        case 0:
          return 'No se pudo conectar con el servidor.';
      }
    }

    return 'No se pudieron cargar tus órdenes de trabajo.';
  }

  private describeActionError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      switch (error.status) {
        case 400:
          return 'La solicitud no pudo validarse. Actualiza la página.';
        case 401:
          return 'Tu sesión ha caducado. Inicia sesión de nuevo.';
        case 403:
          return 'Ya no tienes permiso para realizar esta operación.';
        case 404:
          return 'La orden no existe o ya no está asignada a tu usuario.';
        case 409:
          return 'La orden ha cambiado de estado. Actualiza el listado.';
        case 0:
          return 'No se pudo conectar con el servidor.';
      }
    }

    return 'No se pudo actualizar la orden de trabajo.';
  }
}
