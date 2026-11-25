import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  viewChild
} from '@angular/core';

import type {
  LatLngTuple,
  LayerGroup,
  Map as LeafletMap
} from 'leaflet';

import { Facility } from '../models/facility.model';

type LeafletModule = typeof import('leaflet');

export function resolveLeafletModule(
  module: LeafletModule | { default: LeafletModule }
): LeafletModule {
  // Support both named exports and CommonJS default interop.
  if ('map' in module && typeof module.map === 'function') {
    return module;
  }

  if (
    'default' in module &&
    typeof module.default?.map === 'function'
  ) {
    return module.default;
  }

  throw new TypeError('Leaflet map factory is unavailable.');
}

export type LocatedFacility = Facility & {
  latitude: number;
  longitude: number;
};

export function getMappableFacilities(
  facilities: Facility[]
): LocatedFacility[] {
  return facilities.filter(
    (facility): facility is LocatedFacility => {
      const latitude = facility.latitude;
      const longitude = facility.longitude;

      return (
        typeof latitude === 'number' &&
        typeof longitude === 'number' &&
        Number.isFinite(latitude) &&
        Number.isFinite(longitude) &&
        latitude >= -90 &&
        latitude <= 90 &&
        longitude >= -180 &&
        longitude <= 180
      );
    }
  );
}

@Component({
  selector: 'app-facilities-map',
  templateUrl: './facilities-map.html',
  styleUrl: './facilities-map.scss'
})
export class FacilitiesMap {
  readonly facilities = input<Facility[]>([]);

  private readonly container =
    viewChild.required<ElementRef<HTMLDivElement>>('mapContainer');

  private readonly destroyRef = inject(DestroyRef);

  private leaflet: LeafletModule | null = null;
  private map: LeafletMap | null = null;
  private markers: LayerGroup | null = null;

  protected readonly errorMessage = signal<string | null>(null);

  protected readonly located = computed(
    () => getMappableFacilities(this.facilities())
  );

  protected readonly missingCount = computed(
    () => this.facilities().length - this.located().length
  );

  constructor() {
    afterNextRender(() => {
      void this.initialize();
    });

    effect(() => {
      const facilities = this.facilities();

      if (this.map && this.markers && this.leaflet) {
        this.updateMarkers(facilities);
      }
    });

    this.destroyRef.onDestroy(() => {
      this.map?.remove();
      this.map = null;
      this.markers = null;
    });
  }

  private async initialize(): Promise<void> {
    try {
      const leafletModule = await import('leaflet');

      if (this.destroyRef.destroyed) return;

      const leaflet = resolveLeafletModule(leafletModule);

      this.leaflet = leaflet;

      this.map = leaflet.map(
        this.container().nativeElement
      ).setView([40.4168, -3.7038], 6);

      leaflet.tileLayer(
        'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }
      ).addTo(this.map);

      this.markers = leaflet.layerGroup().addTo(this.map);

      this.updateMarkers(this.facilities());
    } catch (error) {
      if (!this.destroyRef.destroyed) {
        console.error('Facilities map initialization failed.', error);

        this.errorMessage.set(
          'No se pudo inicializar el mapa interactivo.'
        );
      }
    }
  }

  private updateMarkers(facilities: Facility[]): void {
    const leaflet = this.leaflet;
    const map = this.map;
    const markers = this.markers;

    if (!leaflet || !map || !markers) return;

    markers.clearLayers();

    const located = getMappableFacilities(facilities);
    const positions: LatLngTuple[] = [];

    for (const facility of located) {
      const position: LatLngTuple = [
        facility.latitude,
        facility.longitude
      ];

      positions.push(position);

      const color = facility.isActive
        ? '#2563eb'
        : '#dc2626';

      const marker = leaflet.circleMarker(position, {
        radius: 9,
        color: '#ffffff',
        weight: 2,
        fillColor: color,
        fillOpacity: 0.95
      });

      // Utilizar textContent evita interpretar HTML de la API.
      const popup = document.createElement('div');
      const title = document.createElement('strong');
      const details = document.createElement('p');
      const address = document.createElement('p');

      title.textContent = facility.name;

      details.textContent =
        `${facility.code} · ${facility.city} · ` +
        (facility.isActive ? 'Activa' : 'Inactiva');

      address.textContent =
        facility.address ?? 'Sin dirección';

      details.style.margin = '0.4rem 0';
      address.style.margin = '0';

      popup.append(title, details, address);

      marker.bindPopup(popup);
      marker.addTo(markers);
    }

    if (positions.length === 1) {
      map.setView(positions[0]!, 12);
    } else if (positions.length > 1) {
      map.fitBounds(leaflet.latLngBounds(positions), {
        padding: [32, 32],
        maxZoom: 13
      });
    } else {
      // Vista general sin atribuir ubicaciones a instalaciones.
      map.setView([40.4168, -3.7038], 6);
    }
  }
}
