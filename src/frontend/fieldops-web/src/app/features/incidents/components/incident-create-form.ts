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
import {
  Incident,
  IncidentPriority
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
  selector: 'app-incident-create-form',
  imports: [ReactiveFormsModule],
  templateUrl: './incident-create-form.html',
  styleUrl: './incident-create-form.scss'
})
export class IncidentCreateForm {
  readonly facilities = input<Facility[]>([]);
  readonly assets = input<Asset[]>([]);

  readonly created = output<Incident>();
  readonly savingChange = output<boolean>();

  protected readonly selectedFacilityId = signal('');

  protected readonly assetsForFacility = computed(() =>
    this.assets().filter(
      asset => asset.facilityId === this.selectedFacilityId()
    )
  );

  protected readonly priorities = [
    { value: IncidentPriority.Low, label: 'Baja' },
    { value: IncidentPriority.Medium, label: 'Media' },
    { value: IncidentPriority.High, label: 'Alta' },
    { value: IncidentPriority.Critical, label: 'Crítica' }
  ];

  protected readonly isSaving = signal(false);
  protected readonly saveError = signal<string | null>(null);

  private readonly formBuilder = inject(FormBuilder);
  private readonly incidentService = inject(IncidentService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly form = this.formBuilder.nonNullable.group({
    facilityId: ['', [
      Validators.required
    ]],
    assetId: [''],
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
    this.form.controls.facilityId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(facilityId => {
        this.selectedFacilityId.set(facilityId);

        // Evitar conservar un activo de otra instalacion.
        this.form.controls.assetId.setValue('');
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
      this.saveError.set(
        'Selecciona una instalación válida.'
      );
      return;
    }

    const assetId = values.assetId || null;

    if (
      assetId &&
      !this.assetsForFacility().some(asset => asset.id === assetId)
    ) {
      this.saveError.set(
        'El activo seleccionado no pertenece a la instalación.'
      );
      return;
    }

    this.isSaving.set(true);
    this.savingChange.emit(true);

    this.incidentService.create({
      facilityId: facility.id,
      assetId,
      title: values.title.trim(),
      description: values.description.trim() || null,
      priority: Number(values.priority) as IncidentPriority
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: incident => {
          this.isSaving.set(false);
          this.savingChange.emit(false);
          this.form.reset();
          this.created.emit(incident);
        },
        error: (error: unknown) => {
          this.isSaving.set(false);
          this.savingChange.emit(false);

          if (error instanceof HttpErrorResponse) {
            switch (error.status) {
              case 400:
                this.saveError.set(
                  'Los datos no son válidos o el activo no pertenece a la instalación.'
                );
                break;

              case 404:
                this.saveError.set(
                  'La instalación o el activo ya no existe.'
                );
                break;

              case 0:
                this.saveError.set(
                  'No se pudo conectar con el servidor.'
                );
                break;

              default:
                this.saveError.set(
                  'Se produjo un error al crear la incidencia.'
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
