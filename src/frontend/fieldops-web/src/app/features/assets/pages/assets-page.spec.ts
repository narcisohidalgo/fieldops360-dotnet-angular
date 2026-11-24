import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../../core/services/auth.service';
import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Asset } from '../models/asset.model';
import { Facility } from '../../facilities/models/facility.model';
import { AssetsPage } from './assets-page';

describe('AssetsPage', () => {
  let httpMock: HttpTestingController;
  let grantedRoles: Set<string>;

  const facilityId = '00000000-0000-0000-0000-000000000001';
  const assetId = '00000000-0000-0000-0000-000000000002';

  const facility: Facility = {
    id: facilityId,
    code: 'FAC-001',
    name: 'Centro Logístico Córdoba Norte',
    city: 'Córdoba',
    address: 'Calle Innovación 25',
    isActive: true
  };

  const asset: Asset = {
    id: assetId,
    facilityId,
    code: 'EQ-001',
    name: 'Tractor agrícola actualizado',
    description: 'Equipo revisado y operativo',
    isActive: true
  };

  beforeEach(() => {
    grantedRoles = new Set(['Administrator']);

    TestBed.configureTestingModule({
      imports: [AssetsPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            hasRole: (role: string) => grantedRoles.has(role)
          }
        }
      ]
    });

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should load assets and show their facility names', () => {
    const fixture = TestBed.createComponent(AssetsPage);

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain(
      'Cargando activos...'
    );

    const assetsRequest = httpMock.expectOne('/api/assets');
    const facilitiesRequest = httpMock.expectOne('/api/facilities');

    expect(assetsRequest.request.method).toBe('GET');
    expect(facilitiesRequest.request.method).toBe('GET');

    assetsRequest.flush([asset]);
    facilitiesRequest.flush([facility]);

    fixture.detectChanges();

    const row = compiled.querySelector('tbody tr');

    expect(row).not.toBeNull();
    expect(row?.textContent).toContain('EQ-001');
    expect(row?.textContent).toContain('Tractor agrícola actualizado');
    expect(row?.textContent).toContain('FAC-001');
    expect(row?.textContent).toContain('Centro Logístico Córdoba Norte');
    expect(row?.textContent).toContain('Activo');
  });

  it('should show an empty message when no assets exist', () => {
    const fixture = TestBed.createComponent(AssetsPage);

    fixture.detectChanges();

    httpMock.expectOne('/api/assets').flush([]);
    httpMock.expectOne('/api/facilities').flush([facility]);

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain(
      'Todavía no hay activos registrados.'
    );

    expect(compiled.querySelector('tbody tr')).toBeNull();
  });

  it('should show a fallback when the associated facility is unavailable', () => {
    const fixture = TestBed.createComponent(AssetsPage);

    fixture.detectChanges();

    httpMock.expectOne('/api/assets').flush([asset]);
    httpMock.expectOne('/api/facilities').flush([]);

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const row = compiled.querySelector('tbody tr');

    expect(row).not.toBeNull();

    expect(row?.textContent).toContain(
      'Instalación no disponible'
    );

    expect(row?.textContent).toContain('EQ-001');
  });

  it('should show an error and allow retrying the load', () => {
    const fixture = TestBed.createComponent(AssetsPage);

    fixture.detectChanges();

    const assetsRequest = httpMock.expectOne('/api/assets');
    const facilitiesRequest = httpMock.expectOne('/api/facilities');

    // Completar primero Facilities para evitar
    // cancelar una petición pendiente al fallar Assets.
    facilitiesRequest.flush([facility]);

    assetsRequest.flush(
      { title: 'Internal Server Error' },
      {
        status: 500,
        statusText: 'Internal Server Error'
      }
    );

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    const errorMessage = compiled.querySelector('[role="alert"]');

    expect(errorMessage?.textContent).toContain(
      'No se pudieron cargar los activos y sus instalaciones.'
    );

    const retryButton =
      compiled.querySelector<HTMLButtonElement>(
        '.error button'
      );

    expect(retryButton).not.toBeNull();

    retryButton!.click();

    fixture.detectChanges();

    const retryAssetsRequest = httpMock.expectOne('/api/assets');
    const retryFacilitiesRequest = httpMock.expectOne('/api/facilities');

    expect(retryAssetsRequest.request.method).toBe('GET');
    expect(retryFacilitiesRequest.request.method).toBe('GET');

    retryAssetsRequest.flush([asset]);
    retryFacilitiesRequest.flush([facility]);

    fixture.detectChanges();

    expect(compiled.querySelector('[role="alert"]')).toBeNull();

    const row = compiled.querySelector('tbody tr');

    expect(row?.textContent).toContain('EQ-001');
    expect(row?.textContent).toContain('FAC-001');
  });

  function loadPageForActionTests() {
    const fixture = TestBed.createComponent(AssetsPage);

    fixture.detectChanges();

    httpMock.expectOne('/api/assets').flush([asset]);
    httpMock.expectOne('/api/facilities').flush([facility]);

    fixture.detectChanges();

    return fixture;
  }

  it('should block edit and status while creating', () => {
    const fixture = loadPageForActionTests();
    const element = fixture.nativeElement as HTMLElement;

    const createButton =
      element.querySelector<HTMLButtonElement>('.create-button');

    expect(createButton).not.toBeNull();

    createButton!.click();
    fixture.detectChanges();

    expect(element.querySelector('.create-panel')).not.toBeNull();

    const editButton =
      element.querySelector<HTMLButtonElement>('.edit-button');

    const statusButton =
      element.querySelector<HTMLButtonElement>('.status-button');

    expect(editButton?.disabled).toBe(true);
    expect(statusButton?.disabled).toBe(true);

    // Comprobar también las protecciones de los manejadores.
    fixture.debugElement.query(
      By.css('.edit-button')
    ).triggerEventHandler('click', new MouseEvent('click'));

    fixture.debugElement.query(
      By.css('.status-button')
    ).triggerEventHandler('click', new MouseEvent('click'));

    fixture.detectChanges();

    expect(element.querySelector('.create-panel')).not.toBeNull();
    expect(element.querySelector('.edit-panel')).toBeNull();
    expect(element.querySelector('.status-panel')).toBeNull();
  });

  it('should block creating and editing while confirming status', () => {
    const fixture = loadPageForActionTests();
    const element = fixture.nativeElement as HTMLElement;

    const statusButton =
      element.querySelector<HTMLButtonElement>('.status-button');

    expect(statusButton).not.toBeNull();

    statusButton!.click();
    fixture.detectChanges();

    expect(element.querySelector('.status-panel')).not.toBeNull();

    const createButton =
      element.querySelector<HTMLButtonElement>('.create-button');

    const editButton =
      element.querySelector<HTMLButtonElement>('.edit-button');

    expect(createButton?.disabled).toBe(true);
    expect(editButton?.disabled).toBe(true);

    fixture.debugElement.query(
      By.css('.create-button')
    ).triggerEventHandler('click', new MouseEvent('click'));

    fixture.debugElement.query(
      By.css('.edit-button')
    ).triggerEventHandler('click', new MouseEvent('click'));

    fixture.detectChanges();

    expect(element.querySelector('.status-panel')).not.toBeNull();
    expect(element.querySelector('.create-panel')).toBeNull();
    expect(element.querySelector('.edit-panel')).toBeNull();
  });

  it('should block creation and status changes while editing', () => {
    const fixture = loadPageForActionTests();
    const element = fixture.nativeElement as HTMLElement;

    const editButton =
      element.querySelector<HTMLButtonElement>('.edit-button');

    expect(editButton).not.toBeNull();

    editButton!.click();
    fixture.detectChanges();

    expect(element.querySelector('.edit-panel')).not.toBeNull();

    const createButton =
      element.querySelector<HTMLButtonElement>('.create-button');

    const statusButton =
      element.querySelector<HTMLButtonElement>('.status-button');

    expect(createButton?.disabled).toBe(true);
    expect(statusButton?.disabled).toBe(true);

    expect(element.querySelector('.create-panel')).toBeNull();
    expect(element.querySelector('.status-panel')).toBeNull();
  });
  it('should display assets as read-only for Technician', () => {
    grantedRoles = new Set(['Technician']);

    const fixture = TestBed.createComponent(AssetsPage);
    fixture.detectChanges();

    httpMock.expectOne('/api/assets').flush([asset]);
    httpMock.expectOne('/api/facilities').flush([facility]);

    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelectorAll('tbody tr').length).toBe(1);
    expect(element.querySelector('.create-button')).toBeNull();
    expect(element.querySelector('.edit-button')).toBeNull();
    expect(element.querySelector('.status-button')).toBeNull();
    expect(element.textContent).toContain('Modo consulta');
  });
});
