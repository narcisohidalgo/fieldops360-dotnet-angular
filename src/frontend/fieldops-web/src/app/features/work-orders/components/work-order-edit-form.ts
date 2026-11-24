import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  computed,
  DestroyRef,
  effect,
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

import {
  WorkOrder,
  WorkOrderPriority,
  WorkOrderStatus
} from '../models/work-order.model';

import { WorkOrderService } from '../services/work-order.service';

function notBlank(
  control: AbstractControl
): ValidationErrors | null {
  return typeof control.value === 'string' &&
    control.value.trim().length === 0
    ? { blank: true }
    : null;
}

function validPriority(
  control: AbstractControl
): ValidationErrors | null {
  return ['1', '2', '3', '4'].includes(String(control.value))
    ? null
    : { invalidPriority: true };
}

function validLocalDate(
  control: AbstractControl
): ValidationErrors | null {
  const value = control.value as string;

  return !value || Number.isFinite(new Date(value).getTime())
    ? null
    : { invalidDate: true };
}

function validDateRange(
  control: AbstractControl
): ValidationErrors | null {
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

function toLocalDateTime(
  utcValue: string | null
): string {
  if (!utcValue) {
    return '';
  }

  const date = new Date(utcValue);

  if (!Number.isFinite(date.getTime())) {
    return '';
  }

  const pad = (value: number): string =>
    String(value).padStart(2, '0');

  const localMinute = [
    date.getFullYear(),
    '-',
    pad(date.getMonth() + 1),
    '-',
    pad(date.getDate()),
    'T',
    pad(date.getHours()),
    ':',
    pad(date.getMinutes())
  ].join('');

  return date.getSeconds() === 0
    ? localMinute
    : `${localMinute}:${pad(date.getSeconds())}`;
}

function toUtc(
  localValue: string,
  originalUtc: string | null
): string | null {
  if (!localValue) {
    return null;
  }

  // Conservar exactamente la fecha original si no se ha editado.
  // Evita perder segundos, milisegundos u offset.
  if (
    originalUtc &&
    localValue === toLocalDateTime(originalUtc)
  ) {
    return originalUtc;
  }

  return new Date(localValue).toISOString();
}

@Component({
  selector: 'app-work-order-edit-form',
  imports: [ReactiveFormsModule],
  templateUrl: './work-order-edit-form.html',
  styleUrl: './work-order-edit-form.scss'
})
export class WorkOrderEditForm {
  readonly workOrder = input.required<WorkOrder>();

  readonly saved = output<void>();
  readonly cancelled = output<void>();

  protected readonly isSaving = signal(false);
  readonly saving = this.isSaving.asReadonly();

  protected readonly saveError = signal<string | null>(null);

  protected readonly canEdit = computed(
    () => this.workOrder().status === WorkOrderStatus.Planned
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
    title: ['', [
      Validators.required,
      Validators.maxLength(150),
      notBlank
    ]],

    description: ['', [
      Validators.maxLength(2000)
    ]],

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
    effect(() => {
      const order = this.workOrder();

      // Cargar los valores de la orden seleccionada.
      // Las fechas UTC se muestran en hora local.
      this.form.reset({
        title: order.title,
        description: order.description ?? '',
        priority: String(order.priority),
        scheduledStartLocal: toLocalDateTime(
          order.scheduledStartUtc
        ),
        dueAtLocal: toLocalDateTime(
          order.dueAtUtc
        )
      });

      this.saveError.set(null);
    });
  }

  protected onSubmit(): void {
    if (this.isSaving()) {
      return;
    }

    this.saveError.set(null);

    if (!this.canEdit()) {
      this.saveError.set(
        'Solo se pueden editar órdenes en estado Planificada.'
      );
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const values = this.form.getRawValue();

    this.isSaving.set(true);

    this.service.update(
      this.workOrder().id,
      {
        title: values.title.trim(),
        description: values.description.trim() || null,
        priority: Number(values.priority) as WorkOrderPriority,
        scheduledStartUtc: toUtc(values.scheduledStartLocal, this.workOrder().scheduledStartUtc),
        dueAtUtc: toUtc(values.dueAtLocal, this.workOrder().dueAtUtc)
      }
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isSaving.set(false);
          this.saved.emit();
        },
        error: (error: unknown) => {
          this.isSaving.set(false);

          if (error instanceof HttpErrorResponse) {
            switch (error.status) {
              case 400:
                this.saveError.set(
                  'Los datos introducidos o las fechas no son válidos.'
                );
                break;

              case 404:
                this.saveError.set(
                  'La orden de trabajo ya no existe. Actualiza el listado.'
                );
                break;

              case 409:
                this.saveError.set(
                  'La orden ha cambiado o ya no permite editarse. ' +
                  'Actualiza el listado y vuelve a intentarlo.'
                );
                break;

              case 0:
                this.saveError.set(
                  'No se pudo conectar con el servidor.'
                );
                break;

              default:
                this.saveError.set(
                  'No se pudo actualizar la orden de trabajo.'
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
