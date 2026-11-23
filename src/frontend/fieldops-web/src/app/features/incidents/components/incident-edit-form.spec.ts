import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  Incident,
  IncidentPriority,
  IncidentStatus
} from '../models/incident.model';

import { IncidentEditForm } from './incident-edit-form';

describe('IncidentEditForm', () => {
  let httpMock: HttpTestingController;

  const facilityId = '00000000-0000-0000-0000-000000000001';
  const assetId = '00000000-0000-0000-0000-000000000002';
  const incidentId = '00000000-0000-0000-0000-000000000003';

  const incident: Incident = {
    id: incidentId,
    facilityId,
    assetId,
    title: 'Fallo de arranque del tractor',
    description: 'El motor no arranca',
    priority: IncidentPriority.High,
    status: IncidentStatus.Open,
    createdAtUtc: '2026-11-23T13:00:00+00:00',
    updatedAtUtc: '2026-11-23T13:00:00+00:00',
    resolvedAtUtc: null,
    closedAtUtc: null
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [IncidentEditForm],
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

  function setup(selectedIncident: Incident = incident) {
    const fixture = TestBed.createComponent(IncidentEditForm);

    fixture.componentRef.setInput(
      'incident',
      selectedIncident
    );

    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    return { fixture, element };
  }

  function fillField(
    element: HTMLElement,
    field: string,
    value: string
  ): void {
    const control = element.querySelector<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >(`#edit-incident-${field}`);

    if (!control) {
      throw new Error(`No se encontro el campo: ${field}`);
    }

    control.value = value;

    control.dispatchEvent(
      new Event(
        control.tagName === 'SELECT' ? 'change' : 'input',
        { bubbles: true }
      )
    );
  }

  function submitForm(element: HTMLElement): void {
    const form = element.querySelector('form');

    if (!form) {
      throw new Error('No se encontro el formulario.');
    }

    form.dispatchEvent(
      new Event('submit', {
        bubbles: true,
        cancelable: true
      })
    );
  }

  it('should populate the form with incident data', () => {
    const { element } = setup();

    const title = element.querySelector<HTMLInputElement>(
      '#edit-incident-title'
    );

    const description =
      element.querySelector<HTMLTextAreaElement>(
        '#edit-incident-description'
      );

    const priority =
      element.querySelector<HTMLSelectElement>(
        '#edit-incident-priority'
      );

    expect(title?.value).toBe(
      'Fallo de arranque del tractor'
    );

    expect(description?.value).toBe(
      'El motor no arranca'
    );

    expect(priority?.value).toBe('3');

    // Estos campos no pueden modificarse.
    expect(element.querySelector('#edit-incident-facility')).toBeNull();
    expect(element.querySelector('#edit-incident-asset')).toBeNull();
    expect(element.querySelector('#edit-incident-status')).toBeNull();
  });

  it('should update an incident using PUT and emit saved', () => {
    const { fixture, element } = setup();

    fillField(
      element,
      'title',
      '  Tractor revisado  '
    );

    fillField(
      element,
      'description',
      '  Pendiente de comprobacion  '
    );

    fillField(
      element,
      'priority',
      String(IncidentPriority.Medium)
    );

    let saved = false;

    fixture.componentInstance.saved.subscribe(() => {
      saved = true;
    });

    submitForm(element);

    const request = httpMock.expectOne(
      `/api/incidents/${incidentId}`
    );

    expect(request.request.method).toBe('PUT');

    expect(request.request.body).toEqual({
      title: 'Tractor revisado',
      description: 'Pendiente de comprobacion',
      priority: IncidentPriority.Medium
    });

    // El contrato de edicion no permite cambiar relaciones.
    expect(request.request.body.id).toBeUndefined();
    expect(request.request.body.facilityId).toBeUndefined();
    expect(request.request.body.assetId).toBeUndefined();
    expect(request.request.body.status).toBeUndefined();

    request.flush(null, {
      status: 204,
      statusText: 'No Content'
    });

    fixture.detectChanges();

    expect(saved).toBe(true);
  });

  it('should send null when description is blank', () => {
    const { element } = setup();

    fillField(element, 'description', '   ');

    submitForm(element);

    const request = httpMock.expectOne(
      `/api/incidents/${incidentId}`
    );

    expect(request.request.method).toBe('PUT');

    expect(request.request.body).toEqual({
      title: 'Fallo de arranque del tractor',
      description: null,
      priority: IncidentPriority.High
    });

    request.flush(null, {
      status: 204,
      statusText: 'No Content'
    });
  });

  it('should cancel without sending a PUT request', () => {
    const { fixture, element } = setup();

    let cancelled = false;

    fixture.componentInstance.cancelled.subscribe(() => {
      cancelled = true;
    });

    const button =
      element.querySelector<HTMLButtonElement>(
        '.cancel-button'
      );

    expect(button).not.toBeNull();

    button!.click();

    expect(cancelled).toBe(true);

    httpMock.expectNone(`/api/incidents/${incidentId}`);
  });

  it('should reject a blank title', () => {
    const { fixture, element } = setup();

    fillField(element, 'title', '   ');

    submitForm(element);
    fixture.detectChanges();

    expect(
      element.querySelector('#edit-incident-title')
        ?.closest('.form-field')
        ?.querySelector('.field-error')
    ).not.toBeNull();

    httpMock.expectNone(`/api/incidents/${incidentId}`);
  });

  it('should reject titles exceeding 150 characters', () => {
    const { fixture, element } = setup();

    fillField(element, 'title', 'X'.repeat(151));

    submitForm(element);
    fixture.detectChanges();

    expect(
      element.querySelector('#edit-incident-title')
        ?.closest('.form-field')
        ?.querySelector('.field-error')
    ).not.toBeNull();

    httpMock.expectNone(`/api/incidents/${incidentId}`);
  });

  it('should reject descriptions exceeding 2000 characters', () => {
    const { fixture, element } = setup();

    fillField(element, 'description', 'X'.repeat(2001));

    submitForm(element);
    fixture.detectChanges();

    expect(
      element.querySelector('#edit-incident-description')
        ?.closest('.form-field')
        ?.querySelector('.field-error')
    ).not.toBeNull();

    httpMock.expectNone(`/api/incidents/${incidentId}`);
  });

  it('should reject an invalid priority', () => {
    const { fixture, element } = setup();

    fillField(element, 'priority', '');

    submitForm(element);
    fixture.detectChanges();

    expect(
      element.querySelector('#edit-incident-priority')
        ?.closest('.form-field')
        ?.querySelector('.field-error')
    ).not.toBeNull();

    httpMock.expectNone(`/api/incidents/${incidentId}`);
  });

  it('should reset the form when another incident is selected', () => {
    const { fixture, element } = setup();

    fillField(
      element,
      'title',
      'Cambio sin guardar'
    );

    const anotherIncident: Incident = {
      ...incident,
      id: '00000000-0000-0000-0000-000000000099',
      title: 'Sensor de temperatura averiado',
      description: 'Lecturas incorrectas',
      priority: IncidentPriority.Critical
    };

    fixture.componentRef.setInput(
      'incident',
      anotherIncident
    );

    fixture.detectChanges();

    const title = element.querySelector<HTMLInputElement>(
      '#edit-incident-title'
    );

    const description =
      element.querySelector<HTMLTextAreaElement>(
        '#edit-incident-description'
      );

    const priority =
      element.querySelector<HTMLSelectElement>(
        '#edit-incident-priority'
      );

    expect(title?.value).toBe(
      'Sensor de temperatura averiado'
    );

    expect(description?.value).toBe(
      'Lecturas incorrectas'
    );

    expect(priority?.value).toBe('4');

    httpMock.expectNone('/api/incidents');
  });

  it('should allow editing an InProgress incident', () => {
    const inProgressIncident: Incident = {
      ...incident,
      status: IncidentStatus.InProgress
    };

    const { element } = setup(inProgressIncident);

    const button =
      element.querySelector<HTMLButtonElement>(
        '.save-button'
      );

    expect(button?.disabled).toBe(false);

    fillField(
      element,
      'title',
      'Reparacion en curso'
    );

    submitForm(element);

    const request = httpMock.expectOne(
      `/api/incidents/${incidentId}`
    );

    expect(request.request.method).toBe('PUT');
    expect(request.request.body.title).toBe(
      'Reparacion en curso'
    );

    request.flush(null, {
      status: 204,
      statusText: 'No Content'
    });
  });

  for (const status of [
    IncidentStatus.Resolved,
    IncidentStatus.Closed
  ]) {
    it(`should block editing when status is ${status}`, () => {
      const restrictedIncident: Incident = {
        ...incident,
        status
      };

      const { fixture, element } = setup(
        restrictedIncident
      );

      const button =
        element.querySelector<HTMLButtonElement>(
          '.save-button'
        );

      expect(button?.disabled).toBe(true);

      expect(element.textContent).toContain(
        'Debes reabrirla antes de modificar sus datos.'
      );

      // Incluso si se intenta enviar el formulario por codigo,
      // el componente debe rechazar la operacion.
      submitForm(element);

      fixture.detectChanges();

      const error =
        element.querySelector('.save-error');

      expect(error?.textContent).toContain(
        'Esta incidencia debe reabrirse'
      );

      httpMock.expectNone(
        `/api/incidents/${incidentId}`
      );
    });
  }

  for (const testCase of [
    {
      status: 400,
      label: 'invalid data',
      message: 'Los datos introducidos no son válidos.'
    },
    {
      status: 404,
      label: 'missing incident',
      message: 'La incidencia ya no existe.'
    },
    {
      status: 409,
      label: 'status conflict',
      message: 'Debes reabrirla para editarla.'
    },
    {
      status: 0,
      label: 'network error',
      message: 'No se pudo conectar con el servidor.'
    },
    {
      status: 500,
      label: 'server error',
      message: 'Se produjo un error al actualizar la incidencia.'
    }
  ]) {
    it(`should handle ${testCase.label}`, () => {
      const { fixture, element } = setup();

      fillField(
        element,
        'title',
        'Tractor actualizado'
      );

      let saved = false;

      fixture.componentInstance.saved.subscribe(() => {
        saved = true;
      });

      submitForm(element);

      const request = httpMock.expectOne(
        `/api/incidents/${incidentId}`
      );

      expect(request.request.method).toBe('PUT');

      if (testCase.status === 0) {
        request.error(new ProgressEvent('error'));
      } else {
        request.flush(
          { title: 'Request failed' },
          {
            status: testCase.status,
            statusText: 'Request failed'
          }
        );
      }

      fixture.detectChanges();

      const error =
        element.querySelector('.save-error');

      expect(error?.textContent).toContain(
        testCase.message
      );

      expect(saved).toBe(false);

      const title =
        element.querySelector<HTMLInputElement>(
          '#edit-incident-title'
        );

      expect(title?.value).toBe(
        'Tractor actualizado'
      );

      const button =
        element.querySelector<HTMLButtonElement>(
          '.save-button'
        );

      expect(button?.disabled).toBe(false);
    });
  }

  it('should prevent duplicate PUT requests while saving', () => {
    const { fixture, element } = setup();

    fillField(
      element,
      'title',
      'Tractor actualizado'
    );

    submitForm(element);

    fixture.detectChanges();

    const saveButton =
      element.querySelector<HTMLButtonElement>(
        '.save-button'
      );

    const cancelButton =
      element.querySelector<HTMLButtonElement>(
        '.cancel-button'
      );

    expect(saveButton?.disabled).toBe(true);
    expect(cancelButton?.disabled).toBe(true);

    expect(saveButton?.textContent).toContain(
      'Guardando...'
    );

    // Intentar enviar una segunda vez mientras el PUT
    // sigue pendiente.
    submitForm(element);

    // Solo debe existir una peticion PUT.
    const request = httpMock.expectOne(
      `/api/incidents/${incidentId}`
    );

    expect(request.request.method).toBe('PUT');

    request.flush(null, {
      status: 204,
      statusText: 'No Content'
    });

    fixture.detectChanges();

    expect(saveButton?.disabled).toBe(false);
    expect(cancelButton?.disabled).toBe(false);

    httpMock.expectNone(
      `/api/incidents/${incidentId}`
    );
  });
});
