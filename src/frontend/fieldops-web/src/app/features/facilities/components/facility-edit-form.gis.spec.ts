import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Facility } from '../models/facility.model';
import { FacilityEditForm } from './facility-edit-form';

describe('FacilityEditForm GIS', () => {
  let httpMock: HttpTestingController;

  const original: Facility = {
    id: '00000000-0000-0000-0000-000000000101',
    code: 'FAC-GIS-101',
    name: 'Centro GIS',
    city: 'Cordoba',
    address: null,
    isActive: true,
    latitude: 37.8882,
    longitude: -4.7794
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [FacilityEditForm],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  function mount(facility: Facility = original) {
    const fixture = TestBed.createComponent(FacilityEditForm);
    fixture.componentRef.setInput('facility', facility);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    const input = (field: string): HTMLInputElement => {
      const result = element.querySelector<HTMLInputElement>(
        `#edit-facility-${field}`
      );

      if (!result) {
        throw new Error(`Missing input: ${field}`);
      }

      return result;
    };

    const fill = (field: string, value: string): void => {
      const control = input(field);
      control.value = value;
      control.dispatchEvent(new Event('input', { bubbles: true }));
    };

    const submit = (): void => {
      element.querySelector('form')!.dispatchEvent(
        new Event('submit', {
          bubbles: true,
          cancelable: true
        })
      );

      fixture.detectChanges();
    };

    return { fixture, element, input, fill, submit };
  }

  it('precarga y conserva las coordenadas al editar el nombre', () => {
    const form = mount();

    expect(form.input('latitude').value).toBe('37.8882');
    expect(form.input('longitude').value).toBe('-4.7794');

    form.fill('name', 'Centro GIS actualizado');
    form.submit();

    const request = httpMock.expectOne(
      `/api/facilities/${original.id}`
    );

    expect(request.request.method).toBe('PUT');
    expect(request.request.body.name).toBe(
      'Centro GIS actualizado'
    );
    expect(request.request.body.latitude).toBe(37.8882);
    expect(request.request.body.longitude).toBe(-4.7794);

    request.flush(null, {
      status: 204,
      statusText: 'No Content'
    });
  });

  it('permite modificar las coordenadas existentes', () => {
    const form = mount();

    form.fill('latitude', '36.721300');
    form.fill('longitude', '-4.421400');
    form.submit();

    const request = httpMock.expectOne(
      `/api/facilities/${original.id}`
    );

    expect(request.request.body.latitude).toBe(36.7213);
    expect(request.request.body.longitude).toBe(-4.4214);

    request.flush(null, {
      status: 204,
      statusText: 'No Content'
    });
  });

  it('permite eliminar ambas coordenadas', () => {
    const form = mount();

    form.fill('latitude', '');
    form.fill('longitude', '');
    form.submit();

    const request = httpMock.expectOne(
      `/api/facilities/${original.id}`
    );

    expect(request.request.body.latitude).toBeNull();
    expect(request.request.body.longitude).toBeNull();

    request.flush(null, {
      status: 204,
      statusText: 'No Content'
    });
  });

  it('rechaza una sola coordenada sin enviar PUT', () => {
    const form = mount({
      ...original,
      latitude: null,
      longitude: null
    });

    form.fill('latitude', '37.8882');
    form.submit();

    expect(form.element.textContent).toContain(
      'Indica ambas coordenadas'
    );

    httpMock.expectNone(
      `/api/facilities/${original.id}`
    );
  });

  it('rechaza valores fuera de rango sin enviar PUT', () => {
    const form = mount();

    form.fill('latitude', '95');
    form.submit();

    expect(
      form.input('latitude')
        .closest('.form-field')
        ?.querySelector('.field-error')
    ).not.toBeNull();

    httpMock.expectNone(
      `/api/facilities/${original.id}`
    );
  });

  it('rechaza mas de seis decimales sin enviar PUT', () => {
    const form = mount();

    form.fill('longitude', '-4.1234567');
    form.submit();

    expect(
      form.input('longitude')
        .closest('.form-field')
        ?.querySelector('.field-error')
    ).not.toBeNull();

    httpMock.expectNone(
      `/api/facilities/${original.id}`
    );
  });
});