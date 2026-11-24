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
  selector: 'app-user-edit-form',
  imports: [ReactiveFormsModule],
  templateUrl: './user-edit-form.html',
  styleUrl: './user-edit-form.scss'
})
export class UserEditForm implements OnInit {
  readonly user = input.required<ManagedUser>();
  readonly existingUsers = input.required<readonly ManagedUser[]>();

  readonly updated = output<ManagedUser>();
  readonly cancelled = output<void>();

  protected readonly roles = managedUserRoles;
  protected readonly selectedRole = signal<FieldOpsRole>('Supervisor');

  protected readonly technicians = signal<Technician[]>([]);
  protected readonly loadingTechnicians = signal(true);
  protected readonly technicianError = signal<string | null>(null);

  protected readonly availableTechnicians = computed(() => {
    const currentUser = this.user();

    const linkedToOtherUsers = new Set(
      this.existingUsers()
        .filter(user => user.id !== currentUser.id)
        .map(user => user.technicianId)
        .filter(id => id !== null)
    );

    return this.technicians().filter(
      technician =>
        technician.isActive &&
        !linkedToOtherUsers.has(technician.id)
    );
  });

  /**
   * Mantiene visible la vinculacion original aunque
   * la ficha tecnica este inactiva o no disponible.
   *
   * No convierte esa ficha en una opcion valida
   * para realizar nuevas vinculaciones.
   */
  protected readonly unavailableLinkedTechnician = computed(() => {
    const linkedId = this.user().technicianId;

    if (
      !linkedId ||
      this.availableTechnicians().some(
        technician => technician.id === linkedId
      )
    ) {
      return null;
    }

    const technician = this.technicians().find(
      item => item.id === linkedId
    );

    return {
      id: linkedId,
      label: technician
        ? `${technician.code} — ${technician.name} (${technician.isActive ? 'no disponible' : 'inactivo'})`
        : 'Técnico vinculado actual (inactivo o no disponible)'
    };
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
    const user = this.user();

    const role = user.roles.length === 1 &&
      this.roles.includes(user.roles[0])
        ? user.roles[0]
        : 'Supervisor';

    this.form.setValue({
      displayName: user.displayName,
      role,
      technicianId: user.technicianId ?? ''
    }, {
      emitEvent: false
    });

    this.selectedRole.set(role);
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
      if (
        this.loadingTechnicians() ||
        this.technicianError() !== null ||
        !this.availableTechnicians().some(
          technician => technician.id === values.technicianId
        )
      ) {
        this.saveError.set(
          'Selecciona un técnico activo y disponible.'
        );
        return;
      }

      technicianId = values.technicianId;
    }

    this.isSaving.set(true);
    this.form.disable({ emitEvent: false });

    this.usersService.update(this.user().id, {
      displayName: values.displayName.trim(),
      role: values.role,
      technicianId
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: updatedUser => {
          this.isSaving.set(false);
          this.updated.emit(updatedUser);
        },
        error: (error: unknown) => {
          this.isSaving.set(false);
          this.form.enable({ emitEvent: false });
          this.saveError.set(this.describeError(error));
        }
      });
  }

  protected cancel(): void {
    if (this.isSaving()) {
      return;
    }

    this.cancelled.emit();
  }

  private describeError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      switch (error.status) {
        case 400:
          return 'Comprueba el nombre, el rol y el técnico seleccionado.';
        case 401:
          return 'La sesión ha caducado. Inicia sesión de nuevo.';
        case 403:
          return 'Ya no tienes permiso para administrar usuarios.';
        case 404:
          return 'La cuenta ya no existe. Actualiza el listado.';
        case 409:
          return 'Operación no permitida. Comprueba la vinculación del técnico y que no estés quitando el rol al último administrador activo.';
        case 0:
          return 'No se pudo conectar con el servidor.';
      }
    }

    return 'No se pudo actualizar la cuenta.';
  }
}
