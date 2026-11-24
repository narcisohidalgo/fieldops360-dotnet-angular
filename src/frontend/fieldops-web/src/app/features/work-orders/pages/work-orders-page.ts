import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
  viewChild
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';

import { Asset } from '../../assets/models/asset.model';
import { AssetService } from '../../assets/services/asset.service';
import { Facility } from '../../facilities/models/facility.model';
import { FacilityService } from '../../facilities/services/facility.service';
import { Incident } from '../../incidents/models/incident.model';
import { IncidentService } from '../../incidents/services/incident.service';
import { Technician } from '../../technicians/models/technician.model';
import { TechnicianService } from '../../technicians/services/technician.service';

import { WorkOrderCreateForm } from '../components/work-order-create-form';
import { WorkOrderEditForm } from '../components/work-order-edit-form';

import {
  WorkOrder,
  WorkOrderFilters,
  WorkOrderPriority,
  WorkOrderStatus
} from '../models/work-order.model';

import { WorkOrderService } from '../services/work-order.service';

type WorkOrderAction = 'start' | 'complete' | 'cancel';

type FilterName =
  | 'facility'
  | 'asset'
  | 'incident'
  | 'technician'
  | 'status'
  | 'priority';

@Component({
  selector: 'app-work-orders-page',
  imports: [
    DatePipe,
    WorkOrderCreateForm,
    WorkOrderEditForm
  ],
  templateUrl: './work-orders-page.html',
  styleUrl: './work-orders-page.scss'
})
export class WorkOrdersPage implements OnInit {
  protected readonly orders = signal<WorkOrder[]>([]);
  protected readonly facilities = signal<Facility[]>([]);
  protected readonly assets = signal<Asset[]>([]);
  protected readonly incidents = signal<Incident[]>([]);
  protected readonly technicians = signal<Technician[]>([]);

  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  protected readonly showCreateForm = signal(false);
  protected readonly selectedOrder = signal<WorkOrder | null>(null);

  protected readonly assignmentTarget = signal<WorkOrder | null>(null);
  protected readonly assignmentTechnicianId = signal('');
  protected readonly isAssigning = signal(false);
  protected readonly assignmentError = signal<string | null>(null);

  protected readonly statusTarget = signal<{
    order: WorkOrder;
    action: WorkOrderAction;
  } | null>(null);

  protected readonly cancellationReason = signal('');
  protected readonly isChangingStatus = signal(false);
  protected readonly statusError = signal<string | null>(null);

  protected readonly selectedFacilityId = signal('');
  protected readonly selectedAssetId = signal('');
  protected readonly selectedIncidentId = signal('');
  protected readonly selectedTechnicianId = signal('');
  protected readonly selectedStatus = signal('');
  protected readonly selectedPriority = signal('');

  protected readonly statusEnum = WorkOrderStatus;

  protected readonly statuses = [
    { value: WorkOrderStatus.Planned, label: 'Planificada' },
    { value: WorkOrderStatus.InProgress, label: 'En curso' },
    { value: WorkOrderStatus.Completed, label: 'Completada' },
    { value: WorkOrderStatus.Cancelled, label: 'Cancelada' }
  ];

  protected readonly priorities = [
    { value: WorkOrderPriority.Low, label: 'Baja' },
    { value: WorkOrderPriority.Medium, label: 'Media' },
    { value: WorkOrderPriority.High, label: 'Alta' },
    { value: WorkOrderPriority.Critical, label: 'Crítica' }
  ];

  protected readonly activeTechnicians = computed(() =>
    this.technicians().filter(technician => technician.isActive)
  );

  protected readonly canCreate = computed(
    () => this.facilities().length > 0
  );

  protected readonly facilityNames = computed(() =>
    new Map(this.facilities().map(item => [
      item.id,
      `${item.code} — ${item.name}`
    ]))
  );

  protected readonly assetNames = computed(() =>
    new Map(this.assets().map(item => [
      item.id,
      `${item.code} — ${item.name}`
    ]))
  );

  protected readonly incidentNames = computed(() =>
    new Map(this.incidents().map(item => [
      item.id,
      item.title
    ]))
  );

  protected readonly technicianNames = computed(() =>
    new Map(this.technicians().map(item => [
      item.id,
      `${item.code} — ${item.name}`
    ]))
  );

  protected readonly filterAssets = computed(() =>
    this.assets().filter(item =>
      !this.selectedFacilityId() ||
      item.facilityId === this.selectedFacilityId()
    )
  );

  protected readonly filterIncidents = computed(() =>
    this.incidents().filter(item =>
      (!this.selectedFacilityId() ||
        item.facilityId === this.selectedFacilityId()) &&
      (!this.selectedAssetId() ||
        !item.assetId ||
        item.assetId === this.selectedAssetId())
    )
  );

  private readonly workOrderService = inject(WorkOrderService);
  private readonly facilityService = inject(FacilityService);
  private readonly assetService = inject(AssetService);
  private readonly incidentService = inject(IncidentService);
  private readonly technicianService = inject(TechnicianService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly createForm = viewChild(WorkOrderCreateForm);
  private readonly editForm = viewChild(WorkOrderEditForm);

  protected readonly isFormSaving = computed(() =>
    this.createForm()?.saving() === true ||
    this.editForm()?.saving() === true
  );

  protected readonly isBusy = computed(() =>
    this.showCreateForm() ||
    this.selectedOrder() !== null ||
    this.assignmentTarget() !== null ||
    this.statusTarget() !== null ||
    this.isAssigning() ||
    this.isChangingStatus() ||
    this.isFormSaving()
  );

  private loadSequence = 0;

  ngOnInit(): void {
    this.loadOrders();
  }

  protected getPriorityLabel(value: WorkOrderPriority): string {
    return this.priorities.find(item => item.value === value)
      ?.label ?? 'Desconocida';
  }

  protected getStatusLabel(value: WorkOrderStatus): string {
    return this.statuses.find(item => item.value === value)
      ?.label ?? 'Desconocido';
  }

  protected canEdit(order: WorkOrder): boolean {
    return order.status === WorkOrderStatus.Planned;
  }

  protected getAvailableActions(
    order: WorkOrder
  ): WorkOrderAction[] {
    switch (order.status) {
      case WorkOrderStatus.Planned:
        return ['start', 'cancel'];

      case WorkOrderStatus.InProgress:
        return ['complete', 'cancel'];

      default:
        return [];
    }
  }

  protected getActionLabel(action: WorkOrderAction): string {
    switch (action) {
      case 'start':
        return 'Iniciar';

      case 'complete':
        return 'Completar';

      case 'cancel':
        return 'Cancelar';
    }
  }

  protected getActionDestination(
    action: WorkOrderAction
  ): string {
    switch (action) {
      case 'start':
        return 'En curso';

      case 'complete':
        return 'Completada';

      case 'cancel':
        return 'Cancelada';
    }
  }

  protected toggleCreateForm(): void {
    if (
      this.isLoading() ||
      this.isFormSaving() ||
      this.selectedOrder() ||
      this.assignmentTarget() ||
      this.statusTarget() ||
      this.isAssigning() ||
      this.isChangingStatus() ||
      !this.canCreate()
    ) {
      return;
    }

    this.showCreateForm.update(value => !value);
    this.successMessage.set(null);
  }

  protected onOrderCreated(order: WorkOrder): void {
    this.showCreateForm.set(false);

    this.successMessage.set(
      `Orden ${order.code} creada correctamente.`
    );

    this.loadOrders();
  }

  protected editOrder(order: WorkOrder): void {
    if (
      this.isLoading() ||
      this.isBusy() ||
      !this.canEdit(order)
    ) {
      return;
    }

    this.selectedOrder.set(order);
    this.successMessage.set(null);
  }

  protected cancelEdit(): void {
    if (this.isFormSaving()) {
      return;
    }

    this.selectedOrder.set(null);
  }

  protected onOrderUpdated(): void {
    const order = this.selectedOrder();

    this.selectedOrder.set(null);

    this.successMessage.set(
      order
        ? `Orden ${order.code} actualizada correctamente.`
        : 'Orden actualizada correctamente.'
    );

    this.loadOrders();
  }

  // ========================================
  // TECHNICIAN ASSIGNMENT
  // ========================================

  protected requestAssignment(order: WorkOrder): void {
    if (
      this.isLoading() ||
      this.isBusy() ||
      order.status !== WorkOrderStatus.Planned
    ) {
      return;
    }

    const currentIsActive = this.activeTechnicians().some(
      item => item.id === order.technicianId
    );

    this.assignmentTarget.set(order);
    this.assignmentTechnicianId.set(
      currentIsActive ? (order.technicianId ?? '') : ''
    );

    this.assignmentError.set(null);
    this.successMessage.set(null);
  }

  protected cancelAssignment(): void {
    if (this.isAssigning()) {
      return;
    }

    this.assignmentTarget.set(null);
    this.assignmentTechnicianId.set('');
    this.assignmentError.set(null);
  }

  protected confirmAssignment(): void {
    const order = this.assignmentTarget();

    if (!order || this.isAssigning() || this.isLoading()) {
      return;
    }

    if (order.status !== WorkOrderStatus.Planned) {
      this.assignmentError.set(
        'Solo pueden asignarse técnicos a órdenes planificadas.'
      );
      return;
    }

    const technicianId = this.assignmentTechnicianId();

    if (
      technicianId &&
      !this.activeTechnicians().some(item => item.id === technicianId)
    ) {
      this.assignmentError.set(
        'Selecciona un técnico activo válido.'
      );
      return;
    }

    this.isAssigning.set(true);
    this.assignmentError.set(null);

    this.workOrderService.assignTechnician(
      order.id,
      technicianId || null
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isAssigning.set(false);
          this.assignmentTarget.set(null);

          this.successMessage.set(
            `Asignación de la orden ${order.code} actualizada.`
          );

          this.loadOrders();
        },
        error: (error: unknown) => {
          this.isAssigning.set(false);
          this.assignmentError.set(
            this.getMutationError(
              error,
              'No se pudo actualizar la asignación.'
            )
          );
        }
      });
  }

  protected refreshAssignment(): void {
    if (this.isAssigning()) {
      return;
    }

    this.cancelAssignment();
    this.loadOrders();
  }

  // ========================================
  // STATUS TRANSITIONS
  // ========================================

  protected requestStatus(
    order: WorkOrder,
    action: WorkOrderAction
  ): void {
    if (
      this.isLoading() ||
      this.isBusy() ||
      !this.getAvailableActions(order).includes(action)
    ) {
      return;
    }

    this.statusTarget.set({ order, action });
    this.cancellationReason.set('');
    this.statusError.set(null);
    this.successMessage.set(null);
  }

  protected cancelStatus(): void {
    if (this.isChangingStatus()) {
      return;
    }

    this.statusTarget.set(null);
    this.cancellationReason.set('');
    this.statusError.set(null);
  }

  protected refreshStatus(): void {
    if (this.isChangingStatus()) {
      return;
    }

    this.cancelStatus();
    this.loadOrders();
  }

  protected confirmStatus(): void {
    const target = this.statusTarget();

    if (
      !target ||
      this.isChangingStatus() ||
      this.isLoading()
    ) {
      return;
    }

    if (!this.getAvailableActions(target.order).includes(
      target.action
    )) {
      this.statusError.set(
        'La transición seleccionada no está permitida.'
      );
      return;
    }

    const reason = this.cancellationReason().trim();

    if (
      target.action === 'cancel' &&
      (reason.length === 0 || reason.length > 500)
    ) {
      this.statusError.set(
        'Introduce un motivo de cancelación de hasta 500 caracteres.'
      );
      return;
    }

    this.isChangingStatus.set(true);
    this.statusError.set(null);

    const operation = target.action === 'start'
      ? this.workOrderService.start(target.order.id)
      : target.action === 'complete'
        ? this.workOrderService.complete(target.order.id)
        : this.workOrderService.cancel(target.order.id, reason);

    operation
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isChangingStatus.set(false);
          this.statusTarget.set(null);
          this.cancellationReason.set('');

          this.successMessage.set(
            `Orden ${target.order.code}: operación realizada correctamente.`
          );

          this.loadOrders();
        },
        error: (error: unknown) => {
          this.isChangingStatus.set(false);

          this.statusError.set(
            this.getMutationError(
              error,
              'No se pudo cambiar el estado de la orden.'
            )
          );
        }
      });
  }

  // ========================================
  // FILTERS
  // ========================================

  protected changeFilter(
    filter: FilterName,
    value: string
  ): void {
    if (this.isLoading() || this.isBusy()) {
      return;
    }

    switch (filter) {
      case 'facility':
        this.selectedFacilityId.set(value);
        this.selectedAssetId.set('');
        this.selectedIncidentId.set('');
        break;

      case 'asset':
        this.selectedAssetId.set(value);
        this.selectedIncidentId.set('');
        break;

      case 'incident':
        this.selectedIncidentId.set(value);
        break;

      case 'technician':
        this.selectedTechnicianId.set(value);
        break;

      case 'status':
        this.selectedStatus.set(value);
        break;

      case 'priority':
        this.selectedPriority.set(value);
        break;
    }

    this.loadOrders();
  }

  protected loadOrders(): void {
    const currentLoad = ++this.loadSequence;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const filters: WorkOrderFilters = {};

    if (this.selectedFacilityId()) {
      filters.facilityId = this.selectedFacilityId();
    }

    if (this.selectedAssetId()) {
      filters.assetId = this.selectedAssetId();
    }

    if (this.selectedIncidentId()) {
      filters.incidentId = this.selectedIncidentId();
    }

    if (this.selectedTechnicianId()) {
      filters.technicianId = this.selectedTechnicianId();
    }

    if (this.selectedStatus()) {
      filters.status = Number(
        this.selectedStatus()
      ) as WorkOrderStatus;
    }

    if (this.selectedPriority()) {
      filters.priority = Number(
        this.selectedPriority()
      ) as WorkOrderPriority;
    }

    forkJoin({
      orders: this.workOrderService.getAll(filters),
      facilities: this.facilityService.getAll(),
      assets: this.assetService.getAll(),
      incidents: this.incidentService.getAll(),
      technicians: this.technicianService.getAll()
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({
          orders,
          facilities,
          assets,
          incidents,
          technicians
        }) => {
          if (currentLoad !== this.loadSequence) {
            return;
          }

          this.orders.set(orders);
          this.facilities.set(facilities);
          this.assets.set(assets);
          this.incidents.set(incidents);
          this.technicians.set(technicians);

          this.isLoading.set(false);
        },
        error: () => {
          if (currentLoad !== this.loadSequence) {
            return;
          }

          this.errorMessage.set(
            'No se pudieron cargar las órdenes de trabajo ' +
            'y sus datos relacionados.'
          );

          this.isLoading.set(false);
        }
      });
  }

  private getMutationError(
    error: unknown,
    fallback: string
  ): string {
    if (!(error instanceof HttpErrorResponse)) {
      return 'Se produjo un error inesperado.';
    }

    switch (error.status) {
      case 400:
        return 'Los datos introducidos no son válidos.';

      case 404:
        return 'La orden o el recurso asociado ya no existe. ' +
          'Actualiza el listado.';

      case 409:
        return 'La operación no está permitida o los datos ' +
          'han cambiado. Actualiza el listado.';

      case 0:
        return 'No se pudo conectar con el servidor.';

      default:
        return fallback;
    }
  }
}
