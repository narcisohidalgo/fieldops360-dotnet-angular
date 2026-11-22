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

import { Asset } from '../models/asset.model';
import { AssetService } from '../services/asset.service';

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
  selector: 'app-asset-edit-form',
  imports: [ReactiveFormsModule],
  templateUrl: './asset-edit-form.html',
  styleUrl: './asset-edit-form.scss'
})
export class AssetEditForm {
  readonly asset = input.required<Asset>();

  readonly saved = output<void>();
  readonly cancelled = output<void>();

  private readonly formBuilder = inject(FormBuilder);
  private readonly assetService = inject(AssetService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly isSaving = signal(false);
  protected readonly saveError = signal<string | null>(null);

  protected readonly form = this.formBuilder.nonNullable.group({
    name: ['', [
      Validators.required,
      Validators.maxLength(150),
      notBlankValidator
    ]],
    description: ['', [
      Validators.maxLength(500)
    ]]
  });

  constructor() {
    effect(() => {
      const asset = this.asset();

      this.form.reset({
        name: asset.name,
        description: asset.description ?? ''
      });

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

    this.isSaving.set(true);

    this.assetService.update(this.asset().id, {
      name: values.name.trim(),
      description: values.description.trim() || null
    })
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
                  'El activo ya no existe. Actualiza el listado.'
                );
                break;

              case 0:
                this.saveError.set(
                  'No se pudo conectar con el servidor.'
                );
                break;

              default:
                this.saveError.set(
                  'Se produjo un error al actualizar el activo.'
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