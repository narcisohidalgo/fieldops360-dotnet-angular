import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
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
  FormControl,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
} from '@angular/forms';

import { Technician } from '../models/technician.model';
import { TechnicianService } from '../services/technician.service';

function notBlankValidator(
  control: AbstractControl
): ValidationErrors | null {
  const value = control.value;

  if (typeof value === 'string' && value.trim().length === 0) {
    return { blank: true };
  }

  return null;
}

function trimmedEmailValidator(
  control: AbstractControl
): ValidationErrors | null {
  const value = control.value;

  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  return Validators.email(new FormControl(value.trim()));
}

@Component({
  selector: 'app-technician-edit-form',
  imports: [ReactiveFormsModule],
  templateUrl: './technician-edit-form.html',
  styleUrl: './technician-edit-form.scss'
})
export class TechnicianEditForm {
  readonly technician = input.required<Technician>();

  readonly saved = output<void>();
  readonly cancelled = output<void>();

  private readonly formBuilder = inject(FormBuilder);
  private readonly technicianService = inject(TechnicianService);
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
    email: ['', [
      Validators.required,
      Validators.maxLength(254),
      notBlankValidator,
      trimmedEmailValidator
    ]],
    phone: ['', [
      Validators.maxLength(30)
    ]],
    specialty: ['', [
      Validators.maxLength(100)
    ]]
  });

  constructor() {
    effect(() => {
      const technician = this.technician();

      this.form.reset({
        name: technician.name,
        email: technician.email,
        phone: technician.phone ?? '',
        specialty: technician.specialty ?? ''
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

    this.technicianService.update(this.technician().id, {
      name: values.name.trim(),
      email: values.email.trim(),
      phone: values.phone.trim() || null,
      specialty: values.specialty.trim() || null
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
                  'El técnico ya no existe. Actualiza el listado.'
                );
                break;

              case 0:
                this.saveError.set(
                  'No se pudo conectar con el servidor.'
                );
                break;

              default:
                this.saveError.set(
                  'Se produjo un error al actualizar el técnico.'
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
