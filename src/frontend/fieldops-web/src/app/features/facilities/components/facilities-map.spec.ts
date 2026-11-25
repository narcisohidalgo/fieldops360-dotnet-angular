import { describe, expect, it } from 'vitest';

import { Facility } from '../models/facility.model';
import { getMappableFacilities, resolveLeafletModule } from './facilities-map';

describe('FacilitiesMap geolocation', () => {
  const base: Facility = {
    id: '1',
    code: 'FAC-1',
    name: 'Centro',
    city: 'Cordoba',
    address: null,
    isActive: true,
    latitude: null,
    longitude: null
  };

  it('ignora instalaciones sin coordenadas', () => {
    expect(getMappableFacilities([base])).toEqual([]);
  });

  it('incluye instalaciones con coordenadas validas', () => {
    const located = {
      ...base,
      latitude: 37.8882,
      longitude: -4.7794
    };

    expect(getMappableFacilities([base, located])).toEqual(
      [located]
    );
  });

  it('acepta coordenadas cero', () => {
    const located = {
      ...base,
      latitude: 0,
      longitude: 0
    };

    expect(getMappableFacilities([located])).toHaveLength(1);
  });

  it('descarta coordenadas fuera de rango', () => {
    expect(getMappableFacilities([
      { ...base, latitude: 91, longitude: 0 },
      { ...base, latitude: 37, longitude: -181 },
      { ...base, latitude: Number.NaN, longitude: 0 }
    ])).toEqual([]);
  });
});

describe('FacilitiesMap Leaflet module interoperability', () => {
  const leaflet = {
    map: () => undefined
  } as unknown as typeof import('leaflet');

  it('supports named Leaflet exports', () => {
    expect(resolveLeafletModule(leaflet)).toBe(leaflet);
  });

  it('supports the default export produced by the production bundler', () => {
    expect(resolveLeafletModule({ default: leaflet })).toBe(leaflet);
  });

  it('rejects a module without a Leaflet map factory', () => {
    const invalidModule = {} as typeof import('leaflet');

    expect(() => resolveLeafletModule(invalidModule))
      .toThrow('Leaflet map factory is unavailable.');
  });
});
