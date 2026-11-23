import {
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';

import { Asset } from '../../assets/models/asset.model';
import { AssetService } from '../../assets/services/asset.service';
import { Facility } from '../../facilities/models/facility.model';
import { FacilityService } from '../../facilities/services/facility.service';

import { IncidentCreateForm } from '../components/incident-create-form';
import { IncidentEditForm } from '../components/incident-edit-form';

import {
  Incident,
  IncidentFilters,
  IncidentPriority,
  IncidentStatus
} from '../models/incident.model';

import { IncidentService } from '../services/incident.service';

type IncidentStatusAction = 'start' | 'resolve' | 'close' | 'reopen';

@Component({
  selector: 'app-incidents-page',
  imports: [
    DatePipe,
    IncidentCreateForm,
    IncidentEditForm
  ],
  templateUrl: './incidents-page.html',
  styleUrl: './incidents-page.scss'
})
export class IncidentsPage implements OnInit {
  protected readonly incidents = signal<Incident[]>([]);
  protected readonly facilities = signal<Facility[]>([]);
  protected readonly assets = signal<Asset[]>([]);

  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  protected readonly showCreateForm = signal(false);
  protected readonly isCreatingIncident = signal(false);
  protected readonly selectedIncident = signal<Incident | null>(null);

  protected readonly statusTarget = signal<{
    incident: Incident;
    action: IncidentStatusAction;
  } | null>(null);

  protected readonly isUpdatingStatus = signal(false);
  protected readonly statusError = signal<string | null>(null);

  protected readonly selectedFacilityId = signal('');
  protected readonly selectedStatus = signal('');
  protected readonly selectedPriority = signal('');

  protected readonly statusEnum = IncidentStatus;

  protected readonly statuses = [
    { value: IncidentStatus.Open, label: 'Abierta' },
    { value: IncidentStatus.InProgress, label: 'En curso' },
    { value: IncidentStatus.Resolved, label: 'Resuelta' },
    { value: IncidentStatus.Closed, label: 'Cerrada' }
  ];

  protected readonly priorities = [
    { value: IncidentPriority.Low, label: 'Baja' },
    { value: IncidentPriority.Medium, label: 'Media' },
    { value: IncidentPriority.High, label: 'Alta' },
    { value: IncidentPriority.Critical, label: 'Crítica' }
  ];

  protected readonly canCreate = computed(
    () => this.facilities().length > 0
  );

  protected readonly facilityNames = computed(() =>
    new Map(
      this.facilities().map(facility => [
        facility.id,
        `${facility.code} — ${facility.name}`
      ])
    )
  );

  protected readonly assetNames = computed(() =>
    new Map(
      this.assets().map(asset => [
        asset.id,
        `${asset.code} — ${asset.name}`
      ])
    )
  );

  private readonly incidentService = inject(IncidentService);
  private readonly facilityService = inject(FacilityService);
  private readonly assetService = inject(AssetService);
  private readonly destroyRef = inject(DestroyRef);

  private loadSequence = 0;

  ngOnInit(): void {
    this.loadIncidents();
  }

  protected getPriorityLabel(priority: IncidentPriority): string {
    return this.priorities.find(item => item.value === priority)
      ?.label ?? 'Desconocida';
  }

  protected getStatusLabel(status: IncidentStatus): string {
    return this.statuses.find(item => item.value === status)
      ?.label ?? 'Desconocido';
  }

  protected getAvailableStatusActions(
    incident: Incident
  ): IncidentStatusAction[] {
    switch (incident.status) {
      case IncidentStatus.Open:
        return ['start'];

      case IncidentStatus.InProgress:
        return ['resolve'];

      case IncidentStatus.Resolved:
        return ['close', 'reopen'];

      case IncidentStatus.Closed:
        return ['reopen'];

      default:
        return [];
    }
  }

  protected getStatusActionLabel(
    action: IncidentStatusAction
  ): string {
    switch (action) {
      case 'start':
        return 'Iniciar';

      case 'resolve':
        return 'Resolver';

      case 'close':
        return 'Cerrar';

      case 'reopen':
        return 'Reabrir';
    }
  }

  protected getStatusDestinationLabel(
    action: IncidentStatusAction
  ): string {
    switch (action) {
      case 'start':
        return 'En curso';

      case 'resolve':
        return 'Resuelta';

      case 'close':
        return 'Cerrada';

      case 'reopen':
        return 'Abierta';
    }
  }

  protected canEdit(incident: Incident): boolean {
    return incident.status === IncidentStatus.Open ||
      incident.status === IncidentStatus.InProgress;
  }

  protected toggleCreateForm(): void {
    if (
      this.isLoading() ||
      this.isCreatingIncident() ||
      !this.canCreate() ||
      this.selectedIncident() ||
      this.statusTarget() ||
      this.isUpdatingStatus()
    ) {
      return;
    }

    this.showCreateForm.update(value => !value);
    this.successMessage.set(null);
  }

  protected onCreateSavingChanged(isSaving: boolean): void {
    this.isCreatingIncident.set(isSaving);
  }

  protected onIncidentCreated(incident: Incident): void {
    this.isCreatingIncident.set(false);
    this.showCreateForm.set(false);

    this.successMessage.set(
      `Incidencia "${incident.title}" creada correctamente.`
    );

    this.loadIncidents();
  }

  protected editIncident(incident: Incident): void {
    if (
      this.isLoading() ||
      this.showCreateForm() ||
      this.selectedIncident() ||
      this.statusTarget() ||
      this.isUpdatingStatus() ||
      !this.canEdit(incident)
    ) {
      return;
    }

    this.selectedIncident.set(incident);
    this.successMessage.set(null);
  }

  protected cancelEdit(): void {
    this.selectedIncident.set(null);
  }

  protected onIncidentUpdated(): void {
    this.selectedIncident.set(null);
    this.successMessage.set(
      'Incidencia actualizada correctamente.'
    );

    this.loadIncidents();
  }

  protected requestStatusChange(
    incident: Incident,
    action: IncidentStatusAction
  ): void {
    if (
      this.isLoading() ||
      this.isBusy() ||
      !this.getAvailableStatusActions(incident).includes(action)
    ) {
      return;
    }

    this.successMessage.set(null);
    this.statusError.set(null);

    this.statusTarget.set({
      incident,
      action
    });
  }

  protected cancelStatusChange(): void {
    if (this.isUpdatingStatus()) {
      return;
    }

    this.statusTarget.set(null);
    this.statusError.set(null);
  }

  protected refreshAfterStatusError(): void {
    if (this.isUpdatingStatus()) {
      return;
    }

    this.statusTarget.set(null);
    this.statusError.set(null);

    this.loadIncidents();
  }

  protected confirmStatusChange(): void {
    const target = this.statusTarget();

    if (
      !target ||
      this.isUpdatingStatus() ||
      this.isLoading() ||
      this.showCreateForm() ||
      this.selectedIncident()
    ) {
      return;
    }

    if (
      !this.getAvailableStatusActions(target.incident)
        .includes(target.action)
    ) {
      this.statusError.set(
        'La transición de estado seleccionada no está permitida.'
      );
      return;
    }

    const requests = {
      start: () => this.incidentService.startProgress(target.incident.id),
      resolve: () => this.incidentService.resolve(target.incident.id),
      close: () => this.incidentService.close(target.incident.id),
      reopen: () => this.incidentService.reopen(target.incident.id)
    };

    this.isUpdatingStatus.set(true);
    this.statusError.set(null);

    requests[target.action]()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isUpdatingStatus.set(false);
          this.statusTarget.set(null);

          this.successMessage.set(
            `Estado de la incidencia "${target.incident.title}" ` +
            'actualizado correctamente.'
          );

          this.loadIncidents();
        },
        error: (error: unknown) => {
          this.isUpdatingStatus.set(false);

          if (error instanceof HttpErrorResponse) {
            switch (error.status) {
              case 404:
                this.statusError.set(
                  'La incidencia ya no existe. Actualiza el listado.'
                );
                break;

              case 409:
                this.statusError.set(
                  'El estado de la incidencia ha cambiado o ' +
                  'la transición no está permitida. Actualiza el listado.'
                );
                break;

              case 0:
                this.statusError.set(
                  'No se pudo conectar con el servidor.'
                );
                break;

              default:
                this.statusError.set(
                  'Se produjo un error al cambiar el estado.'
                );
            }
          } else {
            this.statusError.set(
              'Se produjo un error inesperado.'
            );
          }
        }
      });
  }

  protected onFacilityFilterChanged(value: string): void {
    if (this.isLoading() || this.isBusy()) {
      return;
    }

    this.selectedFacilityId.set(value);
    this.loadIncidents();
  }

  protected onStatusFilterChanged(value: string): void {
    if (this.isLoading() || this.isBusy()) {
      return;
    }

    this.selectedStatus.set(value);
    this.loadIncidents();
  }

  protected onPriorityFilterChanged(value: string): void {
    if (this.isLoading() || this.isBusy()) {
      return;
    }

    this.selectedPriority.set(value);
    this.loadIncidents();
  }

  protected readonly isBusy = computed(
    () =>
      this.showCreateForm() ||
      this.selectedIncident() !== null ||
      this.statusTarget() !== null ||
      this.isUpdatingStatus()
  );

  protected loadIncidents(): void {
    const currentLoad = ++this.loadSequence;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const filters: IncidentFilters = {};

    if (this.selectedFacilityId()) {
      filters.facilityId = this.selectedFacilityId();
    }

    if (this.selectedStatus()) {
      filters.status = Number(
        this.selectedStatus()
      ) as IncidentStatus;
    }

    if (this.selectedPriority()) {
      filters.priority = Number(
        this.selectedPriority()
      ) as IncidentPriority;
    }

    forkJoin({
      incidents: this.incidentService.getAll(filters),
      facilities: this.facilityService.getAll(),
      assets: this.assetService.getAll()
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ incidents, facilities, assets }) => {
          if (currentLoad !== this.loadSequence) {
            return;
          }

          this.incidents.set(incidents);
          this.facilities.set(facilities);
          this.assets.set(assets);

          this.isLoading.set(false);
        },
        error: () => {
          if (currentLoad !== this.loadSequence) {
            return;
          }

          this.errorMessage.set(
            'No se pudieron cargar las incidencias, ' +
            'instalaciones y activos.'
          );

          this.isLoading.set(false);
        }
      });
  }
}
