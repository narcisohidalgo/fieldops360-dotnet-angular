import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, output, signal } from '@angular/core';
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
  selector: 'app-technician-create-form',
  imports: [ReactiveFormsModule],
  templateUrl: './technician-create-form.html',
  styleUrl: './technician-create-form.scss'
})
export class TechnicianCreateForm {
  private readonly formBuilder = inject(FormBuilder);
  private readonly technicianService = inject(TechnicianService);
  private readonly destroyRef = inject(DestroyRef);

  readonly created = output<Technician>();

  protected readonly isSaving = signal(false);
  readonly saving = this.isSaving.asReadonly();
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

    this.technicianService.create({
      code: values.code.trim(),
      name: values.name.trim(),
      email: values.email.trim(),
      phone: values.phone.trim() || null,
      specialty: values.specialty.trim() || null
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (technician) => {
          this.isSaving.set(false);
          this.form.reset();
          this.created.emit(technician);
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
                  'Ya existe un técnico con ese código.'
                );
                break;

              case 0:
                this.saveError.set(
                  'No se pudo conectar con el servidor.'
                );
                break;

              default:
                this.saveError.set(
                  'Se produjo un error al crear el técnico.'
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
