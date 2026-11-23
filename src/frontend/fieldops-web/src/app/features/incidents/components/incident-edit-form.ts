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
  Incident,
  IncidentPriority,
  IncidentStatus
} from '../models/incident.model';
import { IncidentService } from '../services/incident.service';

function notBlankValidator(
  control: AbstractControl
): ValidationErrors | null {
  const value = control.value;

  if (typeof value === 'string' && value.trim().length === 0) {
    return { blank: true };
  }

  return null;
}

function validPriorityValidator(
  control: AbstractControl
): ValidationErrors | null {
  const validValues = ['1', '2', '3', '4'];

  return validValues.includes(String(control.value))
    ? null
    : { invalidPriority: true };
}

@Component({
  selector: 'app-incident-edit-form',
  imports: [ReactiveFormsModule],
  templateUrl: './incident-edit-form.html',
  styleUrl: './incident-edit-form.scss'
})
export class IncidentEditForm {
  readonly incident = input.required<Incident>();

  readonly saved = output<void>();
  readonly cancelled = output<void>();

  protected readonly isSaving = signal(false);
  protected readonly saveError = signal<string | null>(null);

  protected readonly canEdit = computed(() => {
    const status = this.incident().status;

    return status === IncidentStatus.Open ||
      status === IncidentStatus.InProgress;
  });

  protected readonly priorities = [
    { value: IncidentPriority.Low, label: 'Baja' },
    { value: IncidentPriority.Medium, label: 'Media' },
    { value: IncidentPriority.High, label: 'Alta' },
    { value: IncidentPriority.Critical, label: 'Crítica' }
  ];

  private readonly formBuilder = inject(FormBuilder);
  private readonly incidentService = inject(IncidentService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly form = this.formBuilder.nonNullable.group({
    title: ['', [
      Validators.required,
      Validators.maxLength(150),
      notBlankValidator
    ]],
    description: ['', [
      Validators.maxLength(2000)
    ]],
    priority: [String(IncidentPriority.Medium), [
      Validators.required,
      validPriorityValidator
    ]]
  });

  constructor() {
    effect(() => {
      const incident = this.incident();

      // Cargar los datos cuando cambia la incidencia seleccionada.
      this.form.reset({
        title: incident.title,
        description: incident.description ?? '',
        priority: String(incident.priority)
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
        'Esta incidencia debe reabrirse antes de poder editarla.'
      );
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const values = this.form.getRawValue();

    this.isSaving.set(true);

    this.incidentService.update(
      this.incident().id,
      {
        title: values.title.trim(),
        description: values.description.trim() || null,
        priority: Number(values.priority) as IncidentPriority
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
                  'Los datos introducidos no son válidos.'
                );
                break;

              case 404:
                this.saveError.set(
                  'La incidencia ya no existe. Actualiza el listado.'
                );
                break;

              case 409:
                this.saveError.set(
                  'La incidencia ya está resuelta o cerrada. ' +
                  'Debes reabrirla para editarla.'
                );
                break;

              case 0:
                this.saveError.set(
                  'No se pudo conectar con el servidor.'
                );
                break;

              default:
                this.saveError.set(
                  'Se produjo un error al actualizar la incidencia.'
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
