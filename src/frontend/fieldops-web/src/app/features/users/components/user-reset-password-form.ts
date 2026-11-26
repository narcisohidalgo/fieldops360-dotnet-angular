import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
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

import { ManagedUser } from '../models/managed-user.model';
import { UserManagementService } from '../services/user-management.service';

function passwordsMatch(
  control: AbstractControl
): ValidationErrors | null {
  const password = control.get('newPassword')?.value;
  const confirmation = control.get('confirmPassword')?.value;

  return password === confirmation
    ? null
    : { passwordMismatch: true };
}

@Component({
  selector: 'app-user-reset-password-form',
  imports: [ReactiveFormsModule],
  templateUrl: './user-reset-password-form.html',
  styleUrl: './user-reset-password-form.scss'
})
export class UserResetPasswordForm {
  readonly user = input.required<ManagedUser>();

  readonly passwordReset = output<ManagedUser>();
  readonly cancelled = output<void>();

  protected readonly isSaving = signal(false);
  readonly saving = this.isSaving.asReadonly();
  protected readonly saveError = signal<string | null>(null);

  private readonly fb = inject(FormBuilder);
  private readonly service = inject(UserManagementService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly form = this.fb.nonNullable.group({
    newPassword: ['', [
      Validators.required,
      Validators.minLength(12),
      Validators.maxLength(1024),
      Validators.pattern(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/
      )
    ]],
    confirmPassword: ['', [
      Validators.required
    ]]
  }, {
    validators: passwordsMatch
  });

  protected submit(): void {
    if (this.isSaving()) {
      return;
    }

    this.saveError.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const password = this.form.controls.newPassword.value;
    const target = this.user();

    this.isSaving.set(true);
    this.form.disable({ emitEvent: false });

    this.service.resetPassword(target.id, {
      newPassword: password
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isSaving.set(false);

          this.clearPasswords();

          this.passwordReset.emit(target);
        },
        error: (error: unknown) => {
          this.isSaving.set(false);
          this.form.enable({ emitEvent: false });

          // No conservar contrasenas despues
          // de una solicitud fallida.
          this.clearPasswords();

          this.saveError.set(this.describeError(error));
        }
      });
  }

  protected cancel(): void {
    if (this.isSaving()) {
      return;
    }

    this.clearPasswords();
    this.cancelled.emit();
  }

  private clearPasswords(): void {
    this.form.reset({
      newPassword: '',
      confirmPassword: ''
    }, {
      emitEvent: false
    });
  }

  private describeError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      switch (error.status) {
        case 400:
          return 'La contraseña no cumple los requisitos de seguridad o la solicitud no es válida.';
        case 401:
          return 'La sesión ha caducado. Inicia sesión de nuevo.';
        case 403:
          return 'Ya no tienes permiso para administrar usuarios.';
        case 404:
          return 'La cuenta no existe. Actualiza el listado.';
        case 409:
          return 'No se pudo restablecer la contraseña por un conflicto de seguridad.';
        case 0:
          return 'No se pudo conectar con el servidor.';
      }
    }

    return 'No se pudo restablecer la contraseña.';
  }
}
