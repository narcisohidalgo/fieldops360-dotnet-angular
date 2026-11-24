import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  OnInit,
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

import { FieldOpsRole } from '../../../core/models/auth-user';
import { Technician } from '../../technicians/models/technician.model';
import { TechnicianService } from '../../technicians/services/technician.service';
import {
  ManagedUser,
  managedUserRoles
} from '../models/managed-user.model';
import { UserManagementService } from '../services/user-management.service';

function notBlank(
  control: AbstractControl
): ValidationErrors | null {
  const value = control.value;

  return typeof value === 'string' && !value.trim()
    ? { blank: true }
    : null;
}

@Component({
  selector: 'app-user-create-form',
  imports: [ReactiveFormsModule],
  templateUrl: './user-create-form.html',
  styleUrl: './user-create-form.scss'
})
export class UserCreateForm implements OnInit {
  readonly existingUsers = input.required<readonly ManagedUser[]>();

  readonly created = output<ManagedUser>();
  readonly cancelled = output<void>();

  protected readonly roles = managedUserRoles;
  protected readonly selectedRole = signal<FieldOpsRole>('Supervisor');

  protected readonly technicians = signal<Technician[]>([]);
  protected readonly loadingTechnicians = signal(true);
  protected readonly technicianError = signal<string | null>(null);

  protected readonly availableTechnicians = computed(() => {
    const linkedIds = new Set(
      this.existingUsers()
        .map(user => user.technicianId)
        .filter(id => id !== null)
    );

    return this.technicians().filter(
      technician =>
        technician.isActive &&
        !linkedIds.has(technician.id)
    );
  });

  protected readonly isSaving = signal(false);
  protected readonly saveError = signal<string | null>(null);

  private readonly fb = inject(FormBuilder);
  private readonly usersService = inject(UserManagementService);
  private readonly technicianService = inject(TechnicianService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly form = this.fb.nonNullable.group({
    displayName: ['', [
      Validators.required,
      Validators.minLength(2),
      Validators.maxLength(150),
      notBlank
    ]],
    email: ['', [
      Validators.required,
      Validators.email,
      Validators.maxLength(256),
      notBlank
    ]],
    password: ['', [
      Validators.required,
      Validators.minLength(12),
      Validators.maxLength(1024),
      Validators.pattern(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/
      )
    ]],
    role: ['Supervisor' as FieldOpsRole, [
      Validators.required
    ]],
    technicianId: ['']
  });

  constructor() {
    this.form.controls.role.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(role => {
        this.selectedRole.set(role);
        this.form.controls.technicianId.setValue('');
        this.saveError.set(null);
      });
  }

  ngOnInit(): void {
    this.loadTechnicians();
  }

  protected loadTechnicians(): void {
    this.loadingTechnicians.set(true);
    this.technicianError.set(null);

    this.technicianService.getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: technicians => {
          this.technicians.set(technicians);
          this.loadingTechnicians.set(false);
        },
        error: () => {
          this.loadingTechnicians.set(false);
          this.technicianError.set(
            'No se pudieron consultar los técnicos disponibles.'
          );
        }
      });
  }

  protected submit(): void {
    if (this.isSaving()) {
      return;
    }

    this.saveError.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const values = this.form.getRawValue();

    if (!this.roles.includes(values.role)) {
      this.saveError.set('Selecciona un rol válido.');
      return;
    }

    let technicianId: string | null = null;

    if (values.role === 'Technician') {
      const selectedId = values.technicianId;

      if (
        this.loadingTechnicians() ||
        !this.availableTechnicians()
          .some(item => item.id === selectedId)
      ) {
        this.saveError.set(
          'Selecciona un técnico activo y sin cuenta vinculada.'
        );
        return;
      }

      technicianId = selectedId;
    }

    this.isSaving.set(true);
    this.form.disable({ emitEvent: false });

    this.usersService.create({
      displayName: values.displayName.trim(),
      email: values.email.trim(),
      password: values.password,
      role: values.role,
      technicianId
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: user => {
          this.isSaving.set(false);
          this.form.reset({
            displayName: '',
            email: '',
            password: '',
            role: 'Supervisor',
            technicianId: ''
          });

          this.created.emit(user);
        },
        error: (error: unknown) => {
          this.isSaving.set(false);
          this.form.enable({ emitEvent: false });

          // No conservar la contrasena tras un fallo.
          this.form.controls.password.reset('');

          this.saveError.set(this.describeError(error));
        }
      });
  }

  protected cancel(): void {
    if (this.isSaving()) {
      return;
    }

    this.form.controls.password.reset('');
    this.cancelled.emit();
  }

  private describeError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      switch (error.status) {
        case 400:
          return 'Los datos o la contraseña no cumplen los requisitos.';
        case 401:
          return 'La sesión ha caducado. Inicia sesión de nuevo.';
        case 403:
          return 'No tienes permiso para crear usuarios.';
        case 409:
          return 'El correo o el técnico ya están vinculados a otra cuenta.';
        case 0:
          return 'No se pudo conectar con el servidor.';
      }
    }

    return 'No se pudo crear la cuenta. Inténtalo de nuevo.';
  }
}
