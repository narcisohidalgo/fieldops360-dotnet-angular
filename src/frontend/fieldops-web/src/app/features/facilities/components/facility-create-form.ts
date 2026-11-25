import { Component, DestroyRef, inject, output, signal } from '@angular/core';
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
  selector: 'app-facility-create-form',
  imports: [ReactiveFormsModule],
  templateUrl: './facility-create-form.html',
  styleUrl: './facility-create-form.scss'
})
export class FacilityCreateForm {
  private readonly formBuilder = inject(FormBuilder);
  private readonly facilityService = inject(FacilityService);
  private readonly destroyRef = inject(DestroyRef);

  readonly created = output<Facility>();

  protected readonly isSaving = signal(false);
  protected readonly saveError = signal<string | null>(null);

  protected readonly form = this.formBuilder.nonNullable.group({
    code: ['', [
      Validators.required,
      Validators.maxLength(30),
      notBlankValidator
    ]],
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

    this.facilityService.create({
      code: values.code.trim(),
      name: values.name.trim(),
      city: values.city.trim(),
      address: values.address.trim() || null,
      latitude: parseCoordinate(values.latitude),
      longitude: parseCoordinate(values.longitude)
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (facility) => {
          this.isSaving.set(false);
          this.form.reset();
          this.created.emit(facility);
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

              case 409:
                this.saveError.set(
                  'Ya existe una instalación con ese código.'
                );
                break;

              case 0:
                this.saveError.set(
                  'No se pudo conectar con el servidor.'
                );
                break;

              default:
                this.saveError.set(
                  'Se produjo un error al crear la instalación.'
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
