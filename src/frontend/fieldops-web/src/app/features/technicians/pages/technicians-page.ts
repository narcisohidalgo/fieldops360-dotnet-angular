import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, DestroyRef, inject, OnInit, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { Technician } from '../models/technician.model';
import { TechnicianService } from '../services/technician.service';
import { TechnicianCreateForm } from '../components/technician-create-form';
import { TechnicianEditForm } from '../components/technician-edit-form';

type TechnicianAction = 'activate' | 'deactivate';

@Component({
  selector: 'app-technicians-page',
  imports: [TechnicianCreateForm, TechnicianEditForm],
  templateUrl: './technicians-page.html',
  styleUrl: './technicians-page.scss'
})
export class TechniciansPage implements OnInit {
  protected readonly technicians = signal<Technician[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  protected readonly showCreateForm = signal(false);
  protected readonly selectedTechnician = signal<Technician | null>(null);

  protected readonly pendingTechnician = signal<Technician | null>(null);
  protected readonly pendingAction = signal<TechnicianAction | null>(null);
  protected readonly isUpdatingStatus = signal(false);
  protected readonly statusError = signal<string | null>(null);

  private readonly technicianService = inject(TechnicianService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly createForm = viewChild(TechnicianCreateForm);
  private readonly editForm = viewChild(TechnicianEditForm);

  protected readonly isFormSaving = computed(
    () => !!this.createForm()?.saving() || !!this.editForm()?.saving()
  );

  ngOnInit(): void {
    this.loadTechnicians();
  }

  protected toggleCreateForm(): void {
    if (this.pendingAction() || this.isUpdatingStatus() || this.isFormSaving()) {
      return;
    }

    const willOpen = !this.showCreateForm();

    this.showCreateForm.set(willOpen);

    if (willOpen) {
      this.selectedTechnician.set(null);
    }

    this.successMessage.set(null);
  }

  protected onTechnicianCreated(technician: Technician): void {
    this.showCreateForm.set(false);

    this.successMessage.set(
      `Técnico ${technician.code} creado correctamente.`
    );

    this.loadTechnicians();
  }

  protected editTechnician(technician: Technician): void {
    if (this.pendingAction() || this.isUpdatingStatus() || this.isFormSaving()) {
      return;
    }

    this.showCreateForm.set(false);
    this.selectedTechnician.set(technician);
    this.successMessage.set(null);
  }

  protected cancelEdit(): void {
    if (this.isFormSaving()) {
      return;
    }

    this.selectedTechnician.set(null);
  }

  protected onTechnicianUpdated(): void {
    const technician = this.selectedTechnician();

    this.selectedTechnician.set(null);

    this.successMessage.set(
      technician
        ? `Técnico ${technician.code} actualizado correctamente.`
        : 'Técnico actualizado correctamente.'
    );

    this.loadTechnicians();
  }

  protected requestStatus(
    technician: Technician,
    action: TechnicianAction
  ): void {
    if (this.pendingAction() || this.isUpdatingStatus() || this.isFormSaving()) {
      return;
    }

    if (action === 'activate' && technician.isActive) {
      return;
    }

    if (action === 'deactivate' && !technician.isActive) {
      return;
    }

    this.showCreateForm.set(false);
    this.selectedTechnician.set(null);
    this.successMessage.set(null);
    this.statusError.set(null);

    this.pendingTechnician.set(technician);
    this.pendingAction.set(action);
  }

  protected cancelStatus(): void {
    if (this.isUpdatingStatus()) {
      return;
    }

    this.pendingTechnician.set(null);
    this.pendingAction.set(null);
    this.statusError.set(null);
  }

  protected refreshAfterStatusError(): void {
    if (this.isUpdatingStatus()) {
      return;
    }

    this.cancelStatus();
    this.loadTechnicians();
  }

  protected confirmStatus(): void {
    const technician = this.pendingTechnician();
    const action = this.pendingAction();

    if (!technician || !action || this.isUpdatingStatus()) {
      return;
    }

    this.isUpdatingStatus.set(true);
    this.statusError.set(null);

    const operation$ = action === 'activate'
      ? this.technicianService.activate(technician.id)
      : this.technicianService.deactivate(technician.id);

    operation$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isUpdatingStatus.set(false);
          this.pendingTechnician.set(null);
          this.pendingAction.set(null);

          const description = action === 'activate'
            ? 'activado'
            : 'desactivado';

          this.successMessage.set(
            `Técnico ${technician.code} ${description} correctamente.`
          );

          this.loadTechnicians();
        },
        error: (error: unknown) => {
          this.isUpdatingStatus.set(false);

          if (error instanceof HttpErrorResponse) {
            switch (error.status) {
              case 404:
                this.statusError.set(
                  'El técnico ya no existe. Actualiza el listado.'
                );
                break;

              case 0:
                this.statusError.set(
                  'No se pudo conectar con el servidor.'
                );
                break;

              default:
                this.statusError.set(
                  'Se produjo un error al cambiar el estado del técnico.'
                );
            }
          } else {
            this.statusError.set(
              'Se produjo un error inesperado.'
            );
          }
        }
      });
  }

  protected loadTechnicians(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.technicianService.getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (technicians) => {
          this.technicians.set(technicians);
          this.isLoading.set(false);
        },
        error: () => {
          this.errorMessage.set(
            'No se pudieron cargar los técnicos.'
          );

          this.isLoading.set(false);
        }
      });
  }
}
