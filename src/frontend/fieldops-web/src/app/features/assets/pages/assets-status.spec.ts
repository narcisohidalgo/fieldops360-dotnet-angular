import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Asset } from '../models/asset.model';
import { Facility } from '../../facilities/models/facility.model';
import { AssetsPage } from './assets-page';

describe('AssetsPage - Asset status management', () => {
  let httpMock: HttpTestingController;

  const facilityId = '00000000-0000-0000-0000-000000000001';
  const assetId = '00000000-0000-0000-0000-000000000002';

  const facility: Facility = {
    id: facilityId,
    code: 'FAC-001',
    name: 'Centro Logístico Córdoba Norte',
    city: 'Córdoba',
    address: null,
    isActive: true
  };

  const asset: Asset = {
    id: assetId,
    facilityId,
    code: 'EQ-002',
    name: 'Sensor de temperatura calibrado',
    description: 'Sensor ambiental calibrado',
    isActive: true
  };

  const operations = [
    {
      name: 'deactivation',
      endpoint: 'deactivate',
      initialActive: true,
      finalActive: false,
      buttonClass: '.deactivate-button',
      resultButtonClass: '.activate-button',
      expectedStatus: 'Inactivo',
      expectedMessage: 'Activo EQ-002 desactivado correctamente.',
      expectedError: 'El activo ya no existe. Actualiza el listado.'
    },
    {
      name: 'activation',
      endpoint: 'activate',
      initialActive: false,
      finalActive: true,
      buttonClass: '.activate-button',
      resultButtonClass: '.deactivate-button',
      expectedStatus: 'Activo',
      expectedMessage: 'Activo EQ-002 activado correctamente.',
      expectedError: 'El activo ya no existe. Actualiza el listado.'
    }
  ] as const;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AssetsPage],
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

  function setup(isActive: boolean) {
    const fixture = TestBed.createComponent(AssetsPage);

    fixture.detectChanges();

    const assetsRequest = httpMock.expectOne('/api/assets');
    const facilitiesRequest = httpMock.expectOne('/api/facilities');

    expect(assetsRequest.request.method).toBe('GET');
    expect(facilitiesRequest.request.method).toBe('GET');

    assetsRequest.flush([{ ...asset, isActive }]);
    facilitiesRequest.flush([facility]);

    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    return { fixture, element };
  }

  function openConfirmation(
    element: HTMLElement,
    buttonClass: string
  ): void {
    const button = element.querySelector<HTMLButtonElement>(
      buttonClass
    );

    expect(button).not.toBeNull();
    expect(button?.disabled).toBe(false);

    button!.click();
  }

  function confirmChange(element: HTMLElement): void {
    const button = element.querySelector<HTMLButtonElement>(
      '.confirm-status'
    );

    expect(button).not.toBeNull();

    button!.click();
  }

  function flushReload(isActive: boolean): void {
    const assetsRequest = httpMock.expectOne('/api/assets');
    const facilitiesRequest = httpMock.expectOne('/api/facilities');

    expect(assetsRequest.request.method).toBe('GET');
    expect(facilitiesRequest.request.method).toBe('GET');

    assetsRequest.flush([{ ...asset, isActive }]);
    facilitiesRequest.flush([facility]);
  }

  for (const operation of operations) {

    it(`should confirm ${operation.name} and refresh the list`, () => {
      const { fixture, element } = setup(operation.initialActive);

      openConfirmation(element, operation.buttonClass);

      fixture.detectChanges();

      const panel = element.querySelector('.status-panel');

      expect(panel).not.toBeNull();
      expect(panel?.textContent).toContain('EQ-002');

      // Todavia no se debe enviar el PATCH.
      httpMock.expectNone(
        `/api/assets/${assetId}/${operation.endpoint}`
      );

      confirmChange(element);

      const request = httpMock.expectOne(
        `/api/assets/${assetId}/${operation.endpoint}`
      );

      expect(request.request.method).toBe('PATCH');
      expect(request.request.body).toEqual({});

      request.flush(null, {
        status: 204,
        statusText: 'No Content'
      });

      flushReload(operation.finalActive);

      fixture.detectChanges();

      expect(element.querySelector('.status-panel')).toBeNull();

      expect(
        element.querySelector('.success-message')?.textContent
      ).toContain(operation.expectedMessage);

      const row = element.querySelector('tbody tr');

      expect(row?.textContent).toContain(operation.expectedStatus);

      expect(
        element.querySelector(operation.resultButtonClass)
      ).not.toBeNull();
    });

    it(`should cancel ${operation.name} without sending PATCH`, () => {
      const { fixture, element } = setup(operation.initialActive);

      openConfirmation(element, operation.buttonClass);

      fixture.detectChanges();

      expect(element.querySelector('.status-panel')).not.toBeNull();

      const cancelButton = element.querySelector<HTMLButtonElement>(
        '.cancel-status'
      );

      expect(cancelButton).not.toBeNull();

      cancelButton!.click();

      fixture.detectChanges();

      expect(element.querySelector('.status-panel')).toBeNull();

      httpMock.expectNone(
        `/api/assets/${assetId}/${operation.endpoint}`
      );

      httpMock.expectNone('/api/assets');
      httpMock.expectNone('/api/facilities');

      expect(
        element.querySelector(operation.buttonClass)
      ).not.toBeNull();

      expect(
        element.querySelector('.success-message')
      ).toBeNull();
    });

    for (const errorCase of [
      {
        label: '404 Not Found',
        status: 404,
        message: operation.expectedError
      },
      {
        label: 'network error',
        status: 0,
        message: 'No se pudo conectar con el servidor.'
      },
      {
        label: '500 server error',
        status: 500,
        message: 'Se produjo un error al cambiar el estado del activo.'
      }
    ]) {
      it(`should handle ${errorCase.label} during ${operation.name}`, () => {
        const { fixture, element } = setup(operation.initialActive);

        openConfirmation(element, operation.buttonClass);

        fixture.detectChanges();

        confirmChange(element);

        const request = httpMock.expectOne(
          `/api/assets/${assetId}/${operation.endpoint}`
        );

        expect(request.request.method).toBe('PATCH');

        if (errorCase.status === 0) {
          request.error(new ProgressEvent('error'));
        } else {
          request.flush(
            { title: 'Request failed' },
            {
              status: errorCase.status,
              statusText: 'Request failed'
            }
          );
        }

        fixture.detectChanges();

        // El panel permanece abierto para permitir reintentar.
        expect(element.querySelector('.status-panel')).not.toBeNull();

        expect(
          element.querySelector('.status-error')?.textContent
        ).toContain(errorCase.message);

        expect(
          element.querySelector('.success-message')
        ).toBeNull();

        const confirmButton =
          element.querySelector<HTMLButtonElement>(
            '.confirm-status'
          );

        const cancelButton =
          element.querySelector<HTMLButtonElement>(
            '.cancel-status'
          );

        expect(confirmButton?.disabled).toBe(false);
        expect(cancelButton?.disabled).toBe(false);

        // No se debe actualizar el listado tras un error.
        httpMock.expectNone('/api/assets');
        httpMock.expectNone('/api/facilities');
      });
    }

    it(`should prevent duplicate PATCH requests during ${operation.name}`, () => {
      const { fixture, element } = setup(operation.initialActive);

      openConfirmation(element, operation.buttonClass);

      fixture.detectChanges();

      const confirmDebugElement = fixture.debugElement.query(
        By.css('.confirm-status')
      );

      expect(confirmDebugElement).not.toBeNull();

      const confirmButton =
        confirmDebugElement.nativeElement as HTMLButtonElement;

      confirmButton.click();

      fixture.detectChanges();

      expect(confirmButton.disabled).toBe(true);

      const cancelButton =
        element.querySelector<HTMLButtonElement>(
          '.cancel-status'
        );

      expect(cancelButton?.disabled).toBe(true);

      // Forzar una segunda llamada al manejador para
      // comprobar la proteccion contra duplicados.
      confirmDebugElement.triggerEventHandler(
        'click',
        new MouseEvent('click')
      );

      // Debe existir exactamente una peticion PATCH.
      const request = httpMock.expectOne(
        `/api/assets/${assetId}/${operation.endpoint}`
      );

      expect(request.request.method).toBe('PATCH');

      // Todavia no debe haber una recarga del listado.
      httpMock.expectNone('/api/assets');
      httpMock.expectNone('/api/facilities');

      request.flush(null, {
        status: 204,
        statusText: 'No Content'
      });

      flushReload(operation.finalActive);

      fixture.detectChanges();

      expect(element.querySelector('.status-panel')).toBeNull();

      expect(
        element.querySelector('.success-message')?.textContent
      ).toContain(operation.expectedMessage);
    });
  }
});