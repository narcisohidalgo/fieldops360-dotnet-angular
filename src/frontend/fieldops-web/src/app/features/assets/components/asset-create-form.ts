import {
  Component,
  computed,
  DestroyRef,
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

import { Asset } from '../models/asset.model';
import { AssetService } from '../services/asset.service';
import { Facility } from '../../facilities/models/facility.model';

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
  selector: 'app-asset-create-form',
  imports: [ReactiveFormsModule],
  templateUrl: './asset-create-form.html',
  styleUrl: './asset-create-form.scss'
})
export class AssetCreateForm {
  readonly facilities = input<Facility[]>([]);
  readonly created = output<Asset>();

  protected readonly activeFacilities = computed(() =>
    this.facilities().filter(facility => facility.isActive)
  );

  protected readonly isSaving = signal(false);
  protected readonly saveError = signal<string | null>(null);

  private readonly formBuilder = inject(FormBuilder);
  private readonly assetService = inject(AssetService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly form = this.formBuilder.nonNullable.group({
    facilityId: ['', [
      Validators.required
    ]],
    code: ['', [
      Validators.required,
      Validators.maxLength(50),
      notBlankValidator
    ]],
    name: ['', [
      Validators.required,
      Validators.maxLength(150),
      notBlankValidator
    ]],
    description: ['', [
      Validators.maxLength(500)
    ]]
  });

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

    const selectedFacility = this.activeFacilities().find(
      facility => facility.id === values.facilityId
    );

    if (!selectedFacility) {
      this.saveError.set(
        'Selecciona una instalación activa válida.'
      );
      return;
    }

    this.isSaving.set(true);

    this.assetService.create({
      facilityId: selectedFacility.id,
      code: values.code.trim(),
      name: values.name.trim(),
      description: values.description.trim() || null
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (asset) => {
          this.isSaving.set(false);
          this.form.reset();
          this.created.emit(asset);
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
                  'La instalación seleccionada ya no existe.'
                );
                break;

              case 409:
                this.saveError.set(
                  'Ya existe un activo con ese código en la instalación.'
                );
                break;

              case 0:
                this.saveError.set(
                  'No se pudo conectar con el servidor.'
                );
                break;

              default:
                this.saveError.set(
                  'Se produjo un error al crear el activo.'
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