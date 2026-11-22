import {
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';

import { Asset } from '../models/asset.model';
import { AssetCreateForm } from '../components/asset-create-form';
import { AssetEditForm } from '../components/asset-edit-form';
import { AssetService } from '../services/asset.service';
import { Facility } from '../../facilities/models/facility.model';
import { FacilityService } from '../../facilities/services/facility.service';

@Component({
  selector: 'app-assets-page',
  imports: [AssetCreateForm, AssetEditForm],
  templateUrl: './assets-page.html',
  styleUrl: './assets-page.scss'
})
export class AssetsPage implements OnInit {
  protected readonly assets = signal<Asset[]>([]);
  protected readonly facilities = signal<Facility[]>([]);
  protected readonly showCreateForm = signal(false);
  protected readonly selectedAsset = signal<Asset | null>(null);
  protected readonly statusTarget = signal<Asset | null>(null);
  protected readonly isUpdatingStatus = signal(false);
  protected readonly statusError = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  protected readonly hasActiveFacilities = computed(() =>
    this.facilities().some(facility => facility.isActive)
  );

  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly facilityNames = computed(() =>
    new Map(
      this.facilities().map(facility => [
        facility.id,
        `${facility.code} — ${facility.name}`
      ])
    )
  );

  private readonly assetService = inject(AssetService);
  private readonly facilityService = inject(FacilityService);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.loadAssets();
  }

  protected toggleCreateForm(): void {
    if (this.selectedAsset() || this.statusTarget() || this.isUpdatingStatus()) {
      return;
    }
    this.showCreateForm.update(value => !value);
    this.successMessage.set(null);
  }

  protected onAssetCreated(asset: Asset): void {
    this.showCreateForm.set(false);

    this.successMessage.set(
      `Activo ${asset.code} creado correctamente.`
    );

    this.loadAssets();
  }

  protected editAsset(asset: Asset): void {
    if (
      this.showCreateForm() ||
      this.selectedAsset() ||
      this.statusTarget() ||
      this.isUpdatingStatus()
    ) {
      return;
    }

    this.showCreateForm.set(false);
    this.selectedAsset.set(asset);
    this.successMessage.set(null);
  }

  protected cancelEdit(): void {
    this.selectedAsset.set(null);
  }

  protected onAssetUpdated(): void {
    const asset = this.selectedAsset();

    this.selectedAsset.set(null);

    this.successMessage.set(
      asset
        ? `Activo ${asset.code} actualizado correctamente.`
        : 'Activo actualizado correctamente.'
    );

    this.loadAssets();
  }

  protected requestStatusChange(asset: Asset): void {
    if (
      this.showCreateForm() ||
      this.isUpdatingStatus() ||
      this.statusTarget() ||
      this.selectedAsset()
    ) {
      return;
    }

    this.showCreateForm.set(false);
    this.selectedAsset.set(null);
    this.successMessage.set(null);
    this.statusError.set(null);

    this.statusTarget.set(asset);
  }

  protected cancelStatusChange(): void {
    if (this.isUpdatingStatus()) {
      return;
    }

    this.statusTarget.set(null);
    this.statusError.set(null);
  }

  protected confirmStatusChange(): void {
    const asset = this.statusTarget();

    if (!asset || this.isUpdatingStatus()) {
      return;
    }

    this.isUpdatingStatus.set(true);
    this.statusError.set(null);

    const request$ = asset.isActive
      ? this.assetService.deactivate(asset.id)
      : this.assetService.activate(asset.id);

    request$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isUpdatingStatus.set(false);
          this.statusTarget.set(null);

          this.successMessage.set(
            asset.isActive
              ? `Activo ${asset.code} desactivado correctamente.`
              : `Activo ${asset.code} activado correctamente.`
          );

          this.loadAssets();
        },
        error: (error: unknown) => {
          this.isUpdatingStatus.set(false);

          if (error instanceof HttpErrorResponse) {
            switch (error.status) {
              case 404:
                this.statusError.set(
                  'El activo ya no existe. Actualiza el listado.'
                );
                break;

              case 0:
                this.statusError.set(
                  'No se pudo conectar con el servidor.'
                );
                break;

              default:
                this.statusError.set(
                  'Se produjo un error al cambiar el estado del activo.'
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

  protected loadAssets(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    forkJoin({
      assets: this.assetService.getAll(),
      facilities: this.facilityService.getAll()
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ assets, facilities }) => {
          this.assets.set(assets);
          this.facilities.set(facilities);
          this.isLoading.set(false);
        },
        error: () => {
          this.errorMessage.set(
            'No se pudieron cargar los activos y sus instalaciones.'
          );
          this.isLoading.set(false);
        }
      });
  }
}