import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AuthService } from '../../../core/services/auth.service';
import { Facility } from '../models/facility.model';
import { FacilityService } from '../services/facility.service';
import { FacilityCreateForm } from '../components/facility-create-form';
import { FacilityEditForm } from '../components/facility-edit-form';

@Component({
  selector: 'app-facilities-page',
  imports: [FacilityCreateForm, FacilityEditForm],
  templateUrl: './facilities-page.html',
  styleUrl: './facilities-page.scss'
})
export class FacilitiesPage implements OnInit {
  protected readonly facilities = signal<Facility[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly showCreateForm = signal(false);
  protected readonly selectedFacility = signal<Facility | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  protected readonly facilityToDeactivate = signal<Facility | null>(null);
  protected readonly isDeactivating = signal(false);
  protected readonly deactivationError = signal<string | null>(null);

  protected readonly facilityToActivate = signal<Facility | null>(null);
  protected readonly isActivating = signal(false);
  protected readonly activationError = signal<string | null>(null);

  private readonly auth = inject(AuthService);

  protected readonly canManage = computed(
    () => this.auth.hasRole('Administrator')
  );

  private readonly facilityService = inject(FacilityService);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.loadFacilities();
  }

  protected toggleCreateForm(): void {
    if (!this.canManage()) {
      return;
    }
    if (this.isDeactivating() || this.isActivating()) {
      return;
    }

    const willOpen = !this.showCreateForm();

    this.showCreateForm.set(willOpen);

    if (willOpen) {
      this.facilityToActivate.set(null);
      this.selectedFacility.set(null);
      this.facilityToDeactivate.set(null);
    }

    this.successMessage.set(null);
    this.deactivationError.set(null);
  }

  protected onFacilityCreated(facility: Facility): void {
    if (!this.canManage()) {
      return;
    }
    this.showCreateForm.set(false);

    this.successMessage.set(
      `Instalación ${facility.code} creada correctamente.`
    );

    this.loadFacilities();
  }

  protected editFacility(facility: Facility): void {
    if (!this.canManage()) {
      return;
    }
    if (this.isDeactivating() || this.isActivating()) {
      return;
    }

    this.showCreateForm.set(false);
    this.facilityToDeactivate.set(null);
    this.deactivationError.set(null);

    this.facilityToActivate.set(null);
    this.activationError.set(null);
    this.selectedFacility.set(facility);
    this.successMessage.set(null);
  }

  protected cancelEdit(): void {
    this.selectedFacility.set(null);
  }

  protected onFacilityUpdated(): void {
    if (!this.canManage()) {
      return;
    }
    const facility = this.selectedFacility();

    this.selectedFacility.set(null);

    this.successMessage.set(
      facility
        ? `Instalación ${facility.code} actualizada correctamente.`
        : 'Instalación actualizada correctamente.'
    );

    this.loadFacilities();
  }

  protected requestDeactivation(facility: Facility): void {
    if (!this.canManage()) {
      return;
    }
    if (this.isDeactivating() || this.isActivating() || !facility.isActive) {
      return;
    }

    this.showCreateForm.set(false);
    this.selectedFacility.set(null);
    this.successMessage.set(null);

    this.deactivationError.set(null);
    this.facilityToActivate.set(null);
    this.facilityToDeactivate.set(facility);
  }

  protected cancelDeactivation(): void {
    if (this.isDeactivating() || this.isActivating()) {
      return;
    }

    this.facilityToDeactivate.set(null);
    this.deactivationError.set(null);
  }

  protected confirmDeactivation(): void {
    if (!this.canManage()) {
      return;
    }
    const facility = this.facilityToDeactivate();

    if (!facility || this.isDeactivating() || this.isActivating()) {
      return;
    }

    this.isDeactivating.set(true);
    this.deactivationError.set(null);

    this.facilityService.deactivate(facility.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isDeactivating.set(false);
          this.facilityToDeactivate.set(null);

          this.successMessage.set(
            `Instalación ${facility.code} desactivada correctamente.`
          );

          this.loadFacilities();
        },
        error: (error: unknown) => {
          this.isDeactivating.set(false);

          if (error instanceof HttpErrorResponse) {
            switch (error.status) {
              case 404:
                this.deactivationError.set(
                  'La instalación ya no existe. Actualiza el listado.'
                );
                break;

              case 0:
                this.deactivationError.set(
                  'No se pudo conectar con el servidor.'
                );
                break;

              default:
                this.deactivationError.set(
                  'Se produjo un error al desactivar la instalación.'
                );
            }
          } else {
            this.deactivationError.set(
              'Se produjo un error inesperado.'
            );
          }
        }
      });
  }

  protected requestActivation(facility: Facility): void {
    if (!this.canManage()) {
      return;
    }
    if (this.isActivating() || this.isDeactivating() || facility.isActive) {
      return;
    }

    this.showCreateForm.set(false);
    this.selectedFacility.set(null);
    this.facilityToDeactivate.set(null);
    this.deactivationError.set(null);
    this.successMessage.set(null);
    this.activationError.set(null);
    this.facilityToActivate.set(facility);
  }

  protected cancelActivation(): void {
    if (this.isActivating()) {
      return;
    }

    this.facilityToActivate.set(null);
    this.activationError.set(null);
  }

  protected confirmActivation(): void {
    if (!this.canManage()) {
      return;
    }
    const facility = this.facilityToActivate();

    if (!facility || this.isActivating() || this.isDeactivating()) {
      return;
    }

    this.isActivating.set(true);
    this.activationError.set(null);

    this.facilityService.activate(facility.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isActivating.set(false);
          this.facilityToActivate.set(null);

          this.successMessage.set(
            `Instalación ${facility.code} activada correctamente.`
          );

          this.loadFacilities();
        },
        error: (error: unknown) => {
          this.isActivating.set(false);

          if (error instanceof HttpErrorResponse) {
            switch (error.status) {
              case 404:
                this.activationError.set(
                  'La instalación ya no existe. Actualiza el listado.'
                );
                break;

              case 0:
                this.activationError.set(
                  'No se pudo conectar con el servidor.'
                );
                break;

              default:
                this.activationError.set(
                  'Se produjo un error al activar la instalación.'
                );
            }
          } else {
            this.activationError.set(
              'Se produjo un error inesperado.'
            );
          }
        }
      });
  }

  protected loadFacilities(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.facilityService.getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (facilities) => {
          this.facilities.set(facilities);
          this.isLoading.set(false);
        },
        error: () => {
          this.errorMessage.set(
            'No se pudieron cargar las instalaciones.'
          );

          this.isLoading.set(false);
        }
      });
  }
}
