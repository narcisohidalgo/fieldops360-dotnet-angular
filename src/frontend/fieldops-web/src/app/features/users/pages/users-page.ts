import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { UserCreateForm } from '../components/user-create-form';
import { UserEditForm } from '../components/user-edit-form';
import { UserResetPasswordForm } from '../components/user-reset-password-form';
import { ManagedUser } from '../models/managed-user.model';
import { UserManagementService } from '../services/user-management.service';

@Component({
  selector: 'app-users-page',
  imports: [UserCreateForm, UserEditForm, UserResetPasswordForm],
  templateUrl: './users-page.html',
  styleUrl: './users-page.scss'
})
export class UsersPage implements OnInit {
  protected readonly users = signal<ManagedUser[]>([]);
  protected readonly showCreateForm = signal(false);
  protected readonly selectedEditUser = signal<ManagedUser | null>(null);
  protected readonly selectedPasswordUser = signal<ManagedUser | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  protected readonly statusTarget = signal<ManagedUser | null>(null);
  protected readonly isSaving = signal(false);
  protected readonly actionError = signal<string | null>(null);

  private readonly service = inject(UserManagementService);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.loadUsers();
  }

  protected toggleCreateForm(): void {
    if (this.isLoading() || this.isSaving() || this.statusTarget() || this.selectedEditUser() || this.selectedPasswordUser()) {
      return;
    }

    this.showCreateForm.update(value => !value);
    this.successMessage.set(null);
  }

  protected cancelCreateForm(): void {
    this.showCreateForm.set(false);
  }

  protected onUserCreated(user: ManagedUser): void {
    this.showCreateForm.set(false);
    this.successMessage.set(
      `Usuario ${user.displayName} creado correctamente.`
    );
    this.loadUsers();
  }

  protected editUser(user: ManagedUser): void {
    if (
      this.isLoading() ||
      this.isSaving() ||
      this.showCreateForm() ||
      this.statusTarget() ||
      this.selectedEditUser() ||
      this.selectedPasswordUser() ||
      !this.users().some(item => item.id === user.id)
    ) {
      return;
    }

    this.selectedEditUser.set(user);
    this.successMessage.set(null);
  }

  protected cancelEditUser(): void {
    if (this.isSaving()) {
      return;
    }

    this.selectedEditUser.set(null);
  }

  protected onUserUpdated(user: ManagedUser): void {
    this.selectedEditUser.set(null);

    this.successMessage.set(
      `Usuario ${user.displayName} actualizado correctamente.`
    );

    this.loadUsers();
  }

  protected requestPasswordReset(user: ManagedUser): void {
    if (
      this.isLoading() ||
      this.isSaving() ||
      this.showCreateForm() ||
      this.selectedEditUser() ||
      this.statusTarget() ||
      this.selectedPasswordUser() ||
      !this.users().some(item => item.id === user.id)
    ) {
      return;
    }

    this.selectedPasswordUser.set(user);
    this.successMessage.set(null);
  }

  protected cancelPasswordReset(): void {
    this.selectedPasswordUser.set(null);
  }

  protected onPasswordReset(user: ManagedUser): void {
    this.selectedPasswordUser.set(null);

    this.successMessage.set(
      `Contraseña de ${user.displayName} restablecida correctamente. ` +
      'Las sesiones anteriores de esa cuenta dejarán de ser válidas.'
    );
  }

  protected loadUsers(): void {
    if (
      this.isSaving() ||
      this.statusTarget() ||
      this.showCreateForm() ||
      this.selectedEditUser() ||
      this.selectedPasswordUser()
    ) {
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.service.getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: users => {
          this.users.set(users);
          this.isLoading.set(false);
        },
        error: (error: unknown) => {
          this.isLoading.set(false);
          this.errorMessage.set(this.describeError(
            error,
            'No se pudo cargar el listado de usuarios.'
          ));
        }
      });
  }

  protected requestStatusChange(user: ManagedUser): void {
    if (
      this.isLoading() ||
      this.isSaving() ||
      this.statusTarget() ||
      this.showCreateForm() ||
      this.selectedEditUser() ||
      this.selectedPasswordUser() ||
      !this.users().some(item => item.id === user.id)
    ) {
      return;
    }

    this.statusTarget.set(user);
    this.actionError.set(null);
    this.successMessage.set(null);
  }

  protected cancelStatusChange(): void {
    if (this.isSaving()) {
      return;
    }

    this.statusTarget.set(null);
    this.actionError.set(null);
  }

  protected confirmStatusChange(): void {
    const target = this.statusTarget();

    if (!target || this.isSaving() || this.isLoading()) {
      return;
    }

    this.isSaving.set(true);
    this.actionError.set(null);

    const operation = target.isActive
      ? this.service.deactivate(target.id)
      : this.service.activate(target.id);

    operation
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: updated => {
          this.isSaving.set(false);
          this.statusTarget.set(null);

          this.successMessage.set(
            `Usuario ${updated.displayName} ${
              updated.isActive ? 'activado' : 'desactivado'
            } correctamente.`
          );

          this.loadUsers();
        },
        error: (error: unknown) => {
          this.isSaving.set(false);
          this.actionError.set(this.describeError(
            error,
            'No se pudo actualizar el estado del usuario.'
          ));
        }
      });
  }

  private describeError(
    error: unknown,
    fallback: string
  ): string {
    if (error instanceof HttpErrorResponse) {
      switch (error.status) {
        case 0:
          return 'No se pudo conectar con el servidor.';

        case 400:
          return 'La solicitud no es válida. Comprueba los datos.';

        case 401:
          return 'La sesión ha caducado. Inicia sesión de nuevo.';

        case 403:
          return 'No tienes permisos para administrar usuarios.';

        case 404:
          return 'El usuario ya no existe. Actualiza el listado.';

        case 409:
          return 'Operación no permitida: comprueba que no sea el último administrador activo o que no exista otro conflicto.';
      }
    }

    return fallback;
  }
}
