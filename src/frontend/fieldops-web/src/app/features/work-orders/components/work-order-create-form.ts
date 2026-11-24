import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  output,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
} from '@angular/forms';

import { Asset } from '../../assets/models/asset.model';
import { Facility } from '../../facilities/models/facility.model';
import { Incident } from '../../incidents/models/incident.model';
import { Technician } from '../../technicians/models/technician.model';

import {
  WorkOrder,
  WorkOrderPriority
} from '../models/work-order.model';
import { WorkOrderService } from '../services/work-order.service';

function notBlank(control: AbstractControl): ValidationErrors | null {
  return typeof control.value === 'string' &&
    control.value.trim().length === 0
    ? { blank: true }
    : null;
}

function validPriority(control: AbstractControl): ValidationErrors | null {
  return ['1', '2', '3', '4'].includes(String(control.value))
    ? null
    : { invalidPriority: true };
}

function validLocalDate(control: AbstractControl): ValidationErrors | null {
  const value = control.value as string;

  return !value || Number.isFinite(new Date(value).getTime())
    ? null
    : { invalidDate: true };
}

function validDateRange(control: AbstractControl): ValidationErrors | null {
  const start = control.get('scheduledStartLocal')?.value as string;
  const due = control.get('dueAtLocal')?.value as string;

  if (!start || !due) {
    return null;
  }

  const startTime = new Date(start).getTime();
  const dueTime = new Date(due).getTime();

  if (!Number.isFinite(startTime) || !Number.isFinite(dueTime)) {
    return null;
  }

  return dueTime < startTime
    ? { dueBeforeStart: true }
    : null;
}

function toUtc(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

@Component({
  selector: 'app-work-order-create-form',
  imports: [ReactiveFormsModule],
  templateUrl: './work-order-create-form.html',
  styleUrl: './work-order-create-form.scss'
})
export class WorkOrderCreateForm {
  readonly facilities = input<Facility[]>([]);
  readonly assets = input<Asset[]>([]);
  readonly incidents = input<Incident[]>([]);
  readonly technicians = input<Technician[]>([]);

  readonly created = output<WorkOrder>();

  protected readonly isSaving = signal(false);
  readonly saving = this.isSaving.asReadonly();

  protected readonly saveError = signal<string | null>(null);

  protected readonly selectedFacilityId = signal('');
  protected readonly selectedAssetId = signal('');

  protected readonly assetsForFacility = computed(() =>
    this.assets().filter(
      item => item.facilityId === this.selectedFacilityId()
    )
  );

  protected readonly incidentsForSelection = computed(() =>
    this.incidents().filter(item =>
      item.facilityId === this.selectedFacilityId() &&
      (
        !this.selectedAssetId() ||
        !item.assetId ||
        item.assetId === this.selectedAssetId()
      )
    )
  );

  protected readonly activeTechnicians = computed(() =>
    this.technicians().filter(item => item.isActive)
  );

  protected readonly priorities = [
    { value: WorkOrderPriority.Low, label: 'Baja' },
    { value: WorkOrderPriority.Medium, label: 'Media' },
    { value: WorkOrderPriority.High, label: 'Alta' },
    { value: WorkOrderPriority.Critical, label: 'Crítica' }
  ];

  private readonly fb = inject(FormBuilder);
  private readonly service = inject(WorkOrderService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly form = this.fb.nonNullable.group({
    facilityId: ['', Validators.required],
    assetId: [''],
    incidentId: [''],
    technicianId: [''],

    code: ['', [
      Validators.required,
      Validators.maxLength(30),
      notBlank
    ]],

    title: ['', [
      Validators.required,
      Validators.maxLength(150),
      notBlank
    ]],

    description: ['', Validators.maxLength(2000)],

    priority: [String(WorkOrderPriority.Medium), [
      Validators.required,
      validPriority
    ]],

    scheduledStartLocal: ['', validLocalDate],
    dueAtLocal: ['', validLocalDate]
  }, {
    validators: validDateRange
  });

  constructor() {
    this.form.controls.facilityId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(facilityId => {
        this.selectedFacilityId.set(facilityId);
        this.form.controls.assetId.setValue('');
        this.form.controls.incidentId.setValue('');
        this.saveError.set(null);
      });

    this.form.controls.assetId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(assetId => {
        this.selectedAssetId.set(assetId);
        this.form.controls.incidentId.setValue('');
        this.saveError.set(null);
      });
  }

  protected onSubmit(): void {
    if (this.isSaving()) {
      return;
    }

    this.saveError.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const values = this.form.getRawValue();

    const facility = this.facilities().find(
      item => item.id === values.facilityId
    );

    if (!facility) {
      this.saveError.set('Selecciona una instalación válida.');
      return;
    }

    const assetId = values.assetId || null;
    const incidentId = values.incidentId || null;
    const technicianId = values.technicianId || null;

    if (
      assetId &&
      !this.assetsForFacility().some(item => item.id === assetId)
    ) {
      this.saveError.set(
        'El activo no pertenece a la instalación seleccionada.'
      );
      return;
    }

    if (
      incidentId &&
      !this.incidentsForSelection().some(item => item.id === incidentId)
    ) {
      this.saveError.set(
        'La incidencia seleccionada no es compatible con el activo o la instalación.'
      );
      return;
    }

    if (
      technicianId &&
      !this.activeTechnicians().some(item => item.id === technicianId)
    ) {
      this.saveError.set(
        'Selecciona un técnico activo y válido.'
      );
      return;
    }

    this.isSaving.set(true);

    this.service.create({
      facilityId: facility.id,
      assetId,
      incidentId,
      technicianId,
      code: values.code.trim(),
      title: values.title.trim(),
      description: values.description.trim() || null,
      priority: Number(values.priority) as WorkOrderPriority,
      scheduledStartUtc: toUtc(values.scheduledStartLocal),
      dueAtUtc: toUtc(values.dueAtLocal)
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: order => {
          this.isSaving.set(false);
          this.form.reset();
          this.created.emit(order);
        },
        error: (error: unknown) => {
          this.isSaving.set(false);

          if (error instanceof HttpErrorResponse) {
            switch (error.status) {
              case 400:
                this.saveError.set(
                  'Datos inválidos o relaciones incompatibles.'
                );
                break;
              case 404:
                this.saveError.set(
                  'Alguna instalación, activo, incidencia o técnico ya no existe.'
                );
                break;
              case 409:
                this.saveError.set(
                  'El código ya existe o el técnico no está disponible.'
                );
                break;
              case 0:
                this.saveError.set(
                  'No se pudo conectar con el servidor.'
                );
                break;
              default:
                this.saveError.set(
                  'No se pudo crear la orden de trabajo.'
                );
            }
          } else {
            this.saveError.set(
              'Se produjo un error inesperado.'
            );
          }
        }
      });
  }
}
