import {
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
} from '@angular/forms';

import { Facility } from '../models/facility.model';
import { FacilityService } from '../services/facility.service';
import {
  coordinatesPairValidator,
  latitudeValidators,
  longitudeValidators,
  parseCoordinate
} from './facility-coordinates';

function notBlankValidator(
  control: AbstractControl
): ValidationErrors | null {
  const value = control.value;

  if (typeof value === 'string' && value.trim().length === 0) {
    return { blank: true };
  }

  return null;
}

@Component({
  selector: 'app-facility-edit-form',
  imports: [ReactiveFormsModule],
  templateUrl: './facility-edit-form.html',
  styleUrl: './facility-edit-form.scss'
})
export class FacilityEditForm {
  readonly facility = input.required<Facility>();

  readonly saved = output<void>();
  readonly cancelled = output<void>();

  private readonly formBuilder = inject(FormBuilder);
  private readonly facilityService = inject(FacilityService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly isSaving = signal(false);
  readonly saving = this.isSaving.asReadonly();
  protected readonly saveError = signal<string | null>(null);

  protected readonly form = this.formBuilder.nonNullable.group({
    name: ['', [
      Validators.required,
      Validators.maxLength(150),
      notBlankValidator
    ]],
    city: ['', [
      Validators.required,
      Validators.maxLength(100),
      notBlankValidator
    ]],
    address: ['', [
      Validators.maxLength(250)
    ]],
    latitude: ['', latitudeValidators],
    longitude: ['', longitudeValidators]
  }, { validators: coordinatesPairValidator });

  constructor() {
    effect(() => {
      const facility = this.facility();

      this.form.reset({
        name: facility.name,
        city: facility.city,
        address: facility.address ?? '',
        latitude: facility.latitude?.toString() ?? '',
        longitude: facility.longitude?.toString() ?? ''
      });
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

    this.isSaving.set(true);
    this.form.disable({ emitEvent: false });

    this.facilityService.update(this.facility().id, {
      name: values.name.trim(),
      city: values.city.trim(),
      address: values.address.trim() || null,
      latitude: parseCoordinate(values.latitude),
      longitude: parseCoordinate(values.longitude)
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.form.enable({ emitEvent: false });
          this.isSaving.set(false);
          this.saved.emit();
        },
        error: (error: unknown) => {
          this.form.enable({ emitEvent: false });
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
                  'La instalación ya no existe.'
                );
                break;

              case 0:
                this.saveError.set(
                  'No se pudo conectar con el servidor.'
                );
                break;

              default:
                this.saveError.set(
                  'Se produjo un error al actualizar la instalación.'
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
