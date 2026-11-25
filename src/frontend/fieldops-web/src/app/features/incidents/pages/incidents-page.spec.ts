import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { RealtimeService } from '../../../core/services/realtime.service';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it
} from 'vitest';

import { Asset } from '../../assets/models/asset.model';
import { Facility } from '../../facilities/models/facility.model';
import {
  Incident,
  IncidentPriority,
  IncidentStatus
} from '../models/incident.model';
import { IncidentsPage } from './incidents-page';

describe('IncidentsPage', () => {
  let httpMock: HttpTestingController;
  let realtimeEvents: Subject<void>;

  const facilityId = '00000000-0000-0000-0000-000000000001';
  const otherFacilityId = '00000000-0000-0000-0000-000000000002';
  const assetId = '00000000-0000-0000-0000-000000000003';
  const incidentId = '00000000-0000-0000-0000-000000000004';

  const facilities: Facility[] = [
    {
      id: facilityId,
      code: 'FAC-001',
      name: 'Centro Logístico Córdoba Norte',
      city: 'Córdoba',
      address: null,
      isActive: true
    },
    {
      id: otherFacilityId,
      code: 'FAC-002',
      name: 'Centro de Operaciones Sevilla',
      city: 'Sevilla',
      address: null,
      isActive: true
    }
  ];

  const assets: Asset[] = [
    {
      id: assetId,
      facilityId,
      code: 'EQ-001',
      name: 'Tractor agrícola',
      description: null,
      isActive: true
    }
  ];

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
    realtimeEvents = new Subject<void>();

    TestBed.configureTestingModule({
      imports: [IncidentsPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: RealtimeService,
          useValue: {
            incidentsChanged$: realtimeEvents.asObservable()
          }
        }
      ]
    });

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  function setup() {
    const fixture = TestBed.createComponent(IncidentsPage);

    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    return { fixture, element };
  }

  function flushLoad(
    fixture: ComponentFixture<IncidentsPage>,
    records: Incident[] = [incident],
    availableFacilities: Facility[] = facilities,
    availableAssets: Asset[] = assets,
    expectedFilters: Record<string, string> = {}
  ): void {
    const incidentsRequest = httpMock.expectOne(
      request => request.url === '/api/incidents'
    );

    const facilitiesRequest = httpMock.expectOne(
      '/api/facilities'
    );

    const assetsRequest = httpMock.expectOne(
      '/api/assets'
    );

    expect(incidentsRequest.request.method).toBe('GET');
    expect(facilitiesRequest.request.method).toBe('GET');
    expect(assetsRequest.request.method).toBe('GET');

    for (const key of [
      'facilityId',
      'assetId',
      'status',
      'priority'
    ]) {
      expect(
        incidentsRequest.request.params.get(key)
      ).toBe(expectedFilters[key] ?? null);
    }

    incidentsRequest.flush(records);
    facilitiesRequest.flush(availableFacilities);
    assetsRequest.flush(availableAssets);

    fixture.detectChanges();
  }

  function changeSelect(
    element: HTMLElement,
    selector: string,
    value: string
  ): void {
    const select = element.querySelector<HTMLSelectElement>(
      selector
    );

    if (!select) {
      throw new Error(`No se encontro el selector ${selector}`);
    }

    select.value = value;

    select.dispatchEvent(
      new Event('change', { bubbles: true })
    );
  }

  function fillField(
    element: HTMLElement,
    selector: string,
    value: string
  ): void {
    const control = element.querySelector<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >(selector);

    if (!control) {
      throw new Error(`No se encontro el campo ${selector}`);
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

  it('should load and display incidents with related data', () => {
    const { fixture, element } = setup();

    expect(element.textContent).toContain(
      'Cargando incidencias...'
    );

    flushLoad(fixture);

    const row = element.querySelector('tbody tr');

    expect(row).not.toBeNull();
    expect(row?.textContent).toContain(
      'Fallo de arranque del tractor'
    );
    expect(row?.textContent).toContain('FAC-001');
    expect(row?.textContent).toContain('EQ-001');
    expect(row?.textContent).toContain('Alta');
    expect(row?.textContent).toContain('Abierta');
    expect(row?.textContent).toContain('23/11/2026');
  });

  it('refreshes incidents on SignalR and preserves filters', () => {
    const { fixture, element } = setup();

    flushLoad(fixture);

    changeSelect(
      element,
      '#filter-incident-facility',
      facilityId
    );

    flushLoad(
      fixture,
      [incident],
      facilities,
      assets,
      { facilityId }
    );

    changeSelect(
      element,
      '#filter-incident-status',
      String(IncidentStatus.Open)
    );

    flushLoad(
      fixture,
      [incident],
      facilities,
      assets,
      {
        facilityId,
        status: String(IncidentStatus.Open)
      }
    );

    changeSelect(
      element,
      '#filter-incident-priority',
      String(IncidentPriority.High)
    );

    const expectedFilters = {
      facilityId,
      status: String(IncidentStatus.Open),
      priority: String(IncidentPriority.High)
    };

    flushLoad(
      fixture,
      [incident],
      facilities,
      assets,
      expectedFilters
    );

    // Simular la notificacion de otra sesion.
    realtimeEvents.next();

    flushLoad(
      fixture,
      [{
        ...incident,
        title: 'Incidencia actualizada desde otra sesion'
      }],
      facilities,
      assets,
      expectedFilters
    );

    expect(element.textContent).toContain(
      'Incidencia actualizada desde otra sesion'
    );

    expect(
      element.querySelector<HTMLSelectElement>(
        '#filter-incident-facility'
      )?.value
    ).toBe(facilityId);

    expect(
      element.querySelector<HTMLSelectElement>(
        '#filter-incident-status'
      )?.value
    ).toBe(String(IncidentStatus.Open));

    expect(
      element.querySelector<HTMLSelectElement>(
        '#filter-incident-priority'
      )?.value
    ).toBe(String(IncidentPriority.High));
  });

  it('stops listening to incident events after leaving the page', () => {
    const { fixture } = setup();

    flushLoad(fixture);

    fixture.destroy();

    realtimeEvents.next();

    httpMock.expectNone('/api/incidents');
  });
  it('should show an empty message when there are no incidents', () => {
    const { fixture, element } = setup();

    flushLoad(fixture, []);

    expect(element.textContent).toContain(
      'No hay incidencias que coincidan con los filtros seleccionados.'
    );

    expect(element.querySelector('tbody tr')).toBeNull();
  });

  it('should show fallbacks for missing related entities', () => {
    const { fixture, element } = setup();

    const missingRelations: Incident = {
      ...incident,
      facilityId: otherFacilityId,
      assetId: '00000000-0000-0000-0000-000000000099'
    };

    const generalIncident: Incident = {
      ...incident,
      id: '00000000-0000-0000-0000-000000000098',
      assetId: null,
      title: 'Incidencia general'
    };

    flushLoad(
      fixture,
      [missingRelations, generalIncident],
      [],
      []
    );

    const rows = element.querySelectorAll('tbody tr');

    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain(
      'Instalación no disponible'
    );
    expect(rows[0].textContent).toContain(
      'Activo no disponible'
    );
    expect(rows[1].textContent).toContain(
      'Incidencia general'
    );
  });

  it('should disable creation when no facilities exist', () => {
    const { fixture, element } = setup();

    flushLoad(fixture, [], [], []);

    const button = element.querySelector<HTMLButtonElement>(
      '.create-button'
    );

    expect(button?.disabled).toBe(true);
    expect(
      element.querySelector('app-incident-create-form')
    ).toBeNull();
  });

  it('should show loading errors and allow retrying', () => {
    const { fixture, element } = setup();

    const incidentsRequest = httpMock.expectOne(
      '/api/incidents'
    );

    httpMock.expectOne('/api/facilities').flush(facilities);
    httpMock.expectOne('/api/assets').flush(assets);

    incidentsRequest.flush(
      { title: 'Internal Server Error' },
      {
        status: 500,
        statusText: 'Internal Server Error'
      }
    );

    fixture.detectChanges();

    expect(
      element.querySelector('[role="alert"]')?.textContent
    ).toContain(
      'No se pudieron cargar las incidencias'
    );

    const retryButton = element.querySelector<HTMLButtonElement>(
      '.error button'
    );

    expect(retryButton).not.toBeNull();

    retryButton!.click();

    flushLoad(fixture);

    expect(element.querySelector('tbody tr')).not.toBeNull();
    expect(element.querySelector('.error')).toBeNull();
  });

  it('should filter incidents by facility', () => {
    const { fixture, element } = setup();

    flushLoad(fixture);

    changeSelect(
      element,
      '#filter-incident-facility',
      facilityId
    );

    flushLoad(
      fixture,
      [incident],
      facilities,
      assets,
      { facilityId }
    );

    expect(
      element.querySelectorAll('tbody tr').length
    ).toBe(1);
  });

  it('should filter incidents by status', () => {
    const { fixture, element } = setup();

    flushLoad(fixture);

    changeSelect(
      element,
      '#filter-incident-status',
      String(IncidentStatus.Open)
    );

    flushLoad(
      fixture,
      [incident],
      facilities,
      assets,
      { status: '1' }
    );

    expect(
      element.querySelectorAll('tbody tr').length
    ).toBe(1);
  });

  it('should filter incidents by priority', () => {
    const { fixture, element } = setup();

    flushLoad(fixture);

    changeSelect(
      element,
      '#filter-incident-priority',
      String(IncidentPriority.Critical)
    );

    flushLoad(
      fixture,
      [],
      facilities,
      assets,
      { priority: '4' }
    );

    expect(element.querySelector('tbody tr')).toBeNull();
    expect(element.textContent).toContain(
      'No hay incidencias que coincidan'
    );
  });

  it('should open and close the create form', () => {
    const { fixture, element } = setup();

    flushLoad(fixture);

    const button = element.querySelector<HTMLButtonElement>(
      '.create-button'
    );

    expect(button).not.toBeNull();

    button!.click();
    fixture.detectChanges();

    expect(
      element.querySelector('app-incident-create-form')
    ).not.toBeNull();

    expect(button!.textContent).toContain('Cancelar');

    button!.click();
    fixture.detectChanges();

    expect(
      element.querySelector('app-incident-create-form')
    ).toBeNull();

    httpMock.expectNone('/api/incidents');
  });

  it('should create an incident and reload the list', () => {
    const { fixture, element } = setup();

    flushLoad(fixture, []);

    const button = element.querySelector<HTMLButtonElement>(
      '.create-button'
    );

    button!.click();
    fixture.detectChanges();

    fillField(
      element,
      '#incident-facility',
      facilityId
    );

    // Actualizar los activos disponibles tras cambiar instalacion.
    fixture.detectChanges();

    fillField(
      element,
      '#incident-asset',
      assetId
    );

    fillField(
      element,
      '#incident-title',
      'Nueva incidencia de prueba'
    );

    fillField(
      element,
      '#incident-description',
      'Descripcion de prueba'
    );

    fillField(
      element,
      '#incident-priority',
      String(IncidentPriority.High)
    );

    submitForm(element);

    const createRequest = httpMock.expectOne(
      '/api/incidents'
    );

    expect(createRequest.request.method).toBe('POST');

    expect(createRequest.request.body).toEqual({
      facilityId,
      assetId,
      title: 'Nueva incidencia de prueba',
      description: 'Descripcion de prueba',
      priority: IncidentPriority.High
    });

    const newIncident: Incident = {
      ...incident,
      title: 'Nueva incidencia de prueba',
      description: 'Descripcion de prueba'
    };

    createRequest.flush(newIncident, {
      status: 201,
      statusText: 'Created'
    });

    flushLoad(fixture, [newIncident]);

    expect(
      element.querySelector('app-incident-create-form')
    ).toBeNull();

    expect(element.textContent).toContain(
      'creada correctamente'
    );

    expect(element.querySelector('tbody tr')?.textContent)
      .toContain('Nueva incidencia de prueba');
  });

  it('should open and cancel the edit form', () => {
    const { fixture, element } = setup();

    flushLoad(fixture);

    const editButton = element.querySelector<HTMLButtonElement>(
      '.edit-button'
    );

    expect(editButton?.disabled).toBe(false);

    editButton!.click();
    fixture.detectChanges();

    expect(
      element.querySelector('app-incident-edit-form')
    ).not.toBeNull();

    const cancelButton = element.querySelector<HTMLButtonElement>(
      '.cancel-button'
    );

    expect(cancelButton).not.toBeNull();

    cancelButton!.click();
    fixture.detectChanges();

    expect(
      element.querySelector('app-incident-edit-form')
    ).toBeNull();

    httpMock.expectNone(
      `/api/incidents/${incidentId}`
    );
  });

  it('should update an incident and reload the list', () => {
    const { fixture, element } = setup();

    flushLoad(fixture);

    const editButton = element.querySelector<HTMLButtonElement>(
      '.edit-button'
    );

    editButton!.click();
    fixture.detectChanges();

    fillField(
      element,
      '#edit-incident-title',
      'Tractor reparado'
    );

    fillField(
      element,
      '#edit-incident-description',
      'Pendiente de comprobacion'
    );

    fillField(
      element,
      '#edit-incident-priority',
      String(IncidentPriority.Medium)
    );

    submitForm(element);

    const updateRequest = httpMock.expectOne(
      `/api/incidents/${incidentId}`
    );

    expect(updateRequest.request.method).toBe('PUT');

    expect(updateRequest.request.body).toEqual({
      title: 'Tractor reparado',
      description: 'Pendiente de comprobacion',
      priority: IncidentPriority.Medium
    });

    updateRequest.flush(null, {
      status: 204,
      statusText: 'No Content'
    });

    const updatedIncident: Incident = {
      ...incident,
      title: 'Tractor reparado',
      description: 'Pendiente de comprobacion',
      priority: IncidentPriority.Medium
    };

    flushLoad(fixture, [updatedIncident]);

    expect(
      element.querySelector('app-incident-edit-form')
    ).toBeNull();

    expect(element.textContent).toContain(
      'Incidencia actualizada correctamente'
    );

    expect(element.querySelector('tbody tr')?.textContent)
      .toContain('Tractor reparado');
  });

  it('should disable editing for a closed incident', () => {
    const { fixture, element } = setup();

    const closedIncident: Incident = {
      ...incident,
      status: IncidentStatus.Closed,
      closedAtUtc: '2026-11-23T14:00:00+00:00'
    };

    flushLoad(fixture, [closedIncident]);

    const editButton = element.querySelector<HTMLButtonElement>(
      '.edit-button'
    );

    expect(editButton?.disabled).toBe(true);

    editButton!.click();
    fixture.detectChanges();

    expect(
      element.querySelector('app-incident-edit-form')
    ).toBeNull();

    httpMock.expectNone(
      `/api/incidents/${incidentId}`
    );
  });

  // ============================================================
  // INCIDENT STATUS TRANSITIONS
  // ============================================================

  for (const testCase of [
    {
      status: IncidentStatus.Open,
      name: 'Open',
      actions: ['Iniciar']
    },
    {
      status: IncidentStatus.InProgress,
      name: 'InProgress',
      actions: ['Resolver']
    },
    {
      status: IncidentStatus.Resolved,
      name: 'Resolved',
      actions: ['Cerrar', 'Reabrir']
    },
    {
      status: IncidentStatus.Closed,
      name: 'Closed',
      actions: ['Reabrir']
    }
  ]) {
    it(`should show only the available actions for ${testCase.name}`, () => {
      const { fixture, element } = setup();

      flushLoad(fixture, [{
        ...incident,
        status: testCase.status
      }]);

      const buttons = Array.from(
        element.querySelectorAll<HTMLButtonElement>(
          'tbody .status-button'
        )
      );

      const labels = buttons.map(
        button => button.textContent?.trim()
      );

      expect(labels).toEqual(testCase.actions);
    });
  }

  it('should cancel a status change without calling the API', () => {
    const { fixture, element } = setup();

    flushLoad(fixture);

    const startButton =
      element.querySelector<HTMLButtonElement>(
        'tbody .status-button'
      );

    expect(startButton).not.toBeNull();

    startButton!.click();
    fixture.detectChanges();

    const panel = element.querySelector('.status-panel');

    expect(panel).not.toBeNull();
    expect(panel?.textContent).toContain(
      'Confirmar cambio de estado'
    );

    expect(panel?.textContent).toContain(
      'Fallo de arranque del tractor'
    );

    const cancelButton =
      element.querySelector<HTMLButtonElement>(
        '.cancel-status'
      );

    expect(cancelButton).not.toBeNull();

    cancelButton!.click();
    fixture.detectChanges();

    expect(
      element.querySelector('.status-panel')
    ).toBeNull();

    httpMock.expectNone(
      `/api/incidents/${incidentId}/start`
    );
  });

  for (const testCase of [
    {
      from: IncidentStatus.Open,
      action: 'start',
      label: 'Iniciar',
      to: IncidentStatus.InProgress,
      resultLabel: 'En curso'
    },
    {
      from: IncidentStatus.InProgress,
      action: 'resolve',
      label: 'Resolver',
      to: IncidentStatus.Resolved,
      resultLabel: 'Resuelta'
    },
    {
      from: IncidentStatus.Resolved,
      action: 'close',
      label: 'Cerrar',
      to: IncidentStatus.Closed,
      resultLabel: 'Cerrada'
    },
    {
      from: IncidentStatus.Resolved,
      action: 'reopen',
      label: 'Reabrir',
      to: IncidentStatus.Open,
      resultLabel: 'Abierta'
    },
    {
      from: IncidentStatus.Closed,
      action: 'reopen',
      label: 'Reabrir',
      to: IncidentStatus.Open,
      resultLabel: 'Abierta'
    }
  ]) {
    it(`should execute ${testCase.action} and reload incidents`, () => {
      const { fixture, element } = setup();

      const currentIncident: Incident = {
        ...incident,
        status: testCase.from
      };

      flushLoad(fixture, [currentIncident]);

      const button = Array.from(
        element.querySelectorAll<HTMLButtonElement>(
          'tbody .status-button'
        )
      ).find(
        item => item.textContent?.trim() === testCase.label
      );

      expect(button).toBeDefined();

      button!.click();
      fixture.detectChanges();

      const confirmationPanel =
        element.querySelector('.status-panel');

      expect(confirmationPanel).not.toBeNull();
      expect(confirmationPanel?.textContent).toContain(
        testCase.label
      );

      // No debe enviarse PATCH antes de confirmar.
      httpMock.expectNone(
        `/api/incidents/${incidentId}/${testCase.action}`
      );

      const confirmButton =
        element.querySelector<HTMLButtonElement>(
          '.confirm-status'
        );

      expect(confirmButton).not.toBeNull();

      confirmButton!.click();

      const request = httpMock.expectOne(
        `/api/incidents/${incidentId}/${testCase.action}`
      );

      expect(request.request.method).toBe('PATCH');
      expect(request.request.body).toEqual({});

      request.flush(null, {
        status: 204,
        statusText: 'No Content'
      });

      const updatedIncident: Incident = {
        ...currentIncident,
        status: testCase.to
      };

      flushLoad(fixture, [updatedIncident]);

      const row = element.querySelector('tbody tr');

      expect(row?.textContent).toContain(
        testCase.resultLabel
      );

      expect(element.textContent).toContain(
        'actualizado correctamente'
      );

      expect(
        element.querySelector('.status-panel')
      ).toBeNull();
    });
  }

  for (const testCase of [
    {
      status: 404,
      name: 'missing incident',
      message: 'La incidencia ya no existe.'
    },
    {
      status: 409,
      name: 'invalid state transition',
      message: 'la transición no está permitida'
    },
    {
      status: 0,
      name: 'network failure',
      message: 'No se pudo conectar con el servidor.'
    },
    {
      status: 500,
      name: 'server failure',
      message: 'Se produjo un error al cambiar el estado.'
    }
  ]) {
    it(`should handle ${testCase.name} and allow refresh`, () => {
      const { fixture, element } = setup();

      flushLoad(fixture);

      const startButton =
        element.querySelector<HTMLButtonElement>(
          'tbody .status-button'
        );

      startButton!.click();
      fixture.detectChanges();

      const confirmButton =
        element.querySelector<HTMLButtonElement>(
          '.confirm-status'
        );

      confirmButton!.click();

      const request = httpMock.expectOne(
        `/api/incidents/${incidentId}/start`
      );

      expect(request.request.method).toBe('PATCH');

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

      const error = element.querySelector(
        '.status-error[role="alert"]'
      );

      expect(error?.textContent).toContain(
        testCase.message
      );

      // Mantener el panel abierto para que se vea el error.
      expect(
        element.querySelector('.status-panel')
      ).not.toBeNull();

      const refreshButton =
        element.querySelector<HTMLButtonElement>(
          '.refresh-status'
        );

      expect(refreshButton).not.toBeNull();

      refreshButton!.click();

      // Simular datos actuales del servidor.
      const refreshedRecords: Incident[] =
        testCase.status === 404
          ? []
          : testCase.status === 409
            ? [{
                ...incident,
                status: IncidentStatus.InProgress
              }]
            : [incident];

      flushLoad(fixture, refreshedRecords);

      expect(
        element.querySelector('.status-panel')
      ).toBeNull();

      expect(
        element.querySelector('.status-error')
      ).toBeNull();
    });
  }

  it('should prevent duplicate PATCH requests while updating', () => {
    const { fixture, element } = setup();

    flushLoad(fixture);

    const startButton =
      element.querySelector<HTMLButtonElement>(
        'tbody .status-button'
      );

    startButton!.click();
    fixture.detectChanges();

    const confirmButton =
      element.querySelector<HTMLButtonElement>(
        '.confirm-status'
      );

    const cancelButton =
      element.querySelector<HTMLButtonElement>(
        '.cancel-status'
      );

    confirmButton!.click();
    fixture.detectChanges();

    expect(confirmButton?.disabled).toBe(true);
    expect(cancelButton?.disabled).toBe(true);

    expect(confirmButton?.textContent).toContain(
      'Actualizando...'
    );

    // Simular un segundo intento de confirmacion.
    confirmButton!.dispatchEvent(
      new MouseEvent('click', { bubbles: true })
    );

    // Debe existir exactamente una peticion pendiente.
    const request = httpMock.expectOne(
      `/api/incidents/${incidentId}/start`
    );

    expect(request.request.method).toBe('PATCH');

    request.flush(null, {
      status: 204,
      statusText: 'No Content'
    });

    flushLoad(fixture, [{
      ...incident,
      status: IncidentStatus.InProgress
    }]);

    expect(
      element.querySelector('.status-panel')
    ).toBeNull();

    httpMock.expectNone(
      `/api/incidents/${incidentId}/start`
    );
  });

  it('should disable editing, creation and filters during confirmation', () => {
    const { fixture, element } = setup();

    flushLoad(fixture);

    const startButton =
      element.querySelector<HTMLButtonElement>(
        'tbody .status-button'
      );

    startButton!.click();
    fixture.detectChanges();

    const createButton =
      element.querySelector<HTMLButtonElement>(
        '.create-button'
      );

    const editButton =
      element.querySelector<HTMLButtonElement>(
        '.edit-button'
      );

    expect(createButton?.disabled).toBe(true);
    expect(editButton?.disabled).toBe(true);
    expect(startButton?.disabled).toBe(true);

    const filters = element.querySelectorAll<HTMLSelectElement>(
      '.filters select'
    );

    expect(filters.length).toBe(3);

    for (const filter of filters) {
      expect(filter.disabled).toBe(true);
    }

    // No debe ser posible abrir el formulario de creacion.
    createButton!.click();
    fixture.detectChanges();

    expect(
      element.querySelector('app-incident-create-form')
    ).toBeNull();

    const cancelButton =
      element.querySelector<HTMLButtonElement>(
        '.cancel-status'
      );

    cancelButton!.click();
    fixture.detectChanges();

    expect(createButton?.disabled).toBe(false);
    expect(editButton?.disabled).toBe(false);

    for (const filter of filters) {
      expect(filter.disabled).toBe(false);
    }
  });

  it('should preserve facility filters after a status transition', () => {
    const { fixture, element } = setup();

    flushLoad(fixture);

    changeSelect(
      element,
      '#filter-incident-facility',
      facilityId
    );

    flushLoad(
      fixture,
      [incident],
      facilities,
      assets,
      { facilityId }
    );

    const startButton =
      element.querySelector<HTMLButtonElement>(
        'tbody .status-button'
      );

    startButton!.click();
    fixture.detectChanges();

    const confirmButton =
      element.querySelector<HTMLButtonElement>(
        '.confirm-status'
      );

    confirmButton!.click();

    const request = httpMock.expectOne(
      `/api/incidents/${incidentId}/start`
    );

    request.flush(null, {
      status: 204,
      statusText: 'No Content'
    });

    flushLoad(
      fixture,
      [{
        ...incident,
        status: IncidentStatus.InProgress
      }],
      facilities,
      assets,
      { facilityId }
    );

    const facilitySelect =
      element.querySelector<HTMLSelectElement>(
        '#filter-incident-facility'
      );

    expect(facilitySelect?.value).toBe(facilityId);

    expect(
      element.querySelector('tbody tr')?.textContent
    ).toContain('En curso');
  });

  it('should keep the create form open while POST is pending', () => {
    const { fixture, element } = setup();

    flushLoad(fixture, []);

    const toggle = element.querySelector<HTMLButtonElement>(
      '.create-button'
    );

    expect(toggle).not.toBeNull();

    toggle!.click();
    fixture.detectChanges();

    fillField(element, '#incident-facility', facilityId);
    fixture.detectChanges();

    fillField(
      element,
      '#incident-title',
      'Incidencia con guardado pendiente'
    );

    submitForm(element);

    const request = httpMock.expectOne('/api/incidents');

    expect(request.request.method).toBe('POST');

    fixture.detectChanges();

    expect(toggle!.disabled).toBe(true);
    expect(toggle!.textContent).toContain('Cancelar');

    expect(
      element.querySelector('app-incident-create-form')
    ).not.toBeNull();

    // Incluso un evento de clic programatico debe ser ignorado.
    toggle!.dispatchEvent(
      new MouseEvent('click', { bubbles: true })
    );

    fixture.detectChanges();

    expect(
      element.querySelector('app-incident-create-form')
    ).not.toBeNull();

    const savedIncident: Incident = {
      ...incident,
      assetId: null,
      title: 'Incidencia con guardado pendiente',
      priority: IncidentPriority.Medium
    };

    request.flush(savedIncident, {
      status: 201,
      statusText: 'Created'
    });

    flushLoad(fixture, [savedIncident]);

    expect(
      element.querySelector('app-incident-create-form')
    ).toBeNull();

    expect(toggle!.disabled).toBe(false);
    expect(element.textContent).toContain(
      'creada correctamente'
    );
  });

  it('should enable cancellation after a failed POST', () => {
    const { fixture, element } = setup();

    flushLoad(fixture);

    const toggle = element.querySelector<HTMLButtonElement>(
      '.create-button'
    );

    toggle!.click();
    fixture.detectChanges();

    fillField(element, '#incident-facility', facilityId);
    fixture.detectChanges();

    fillField(
      element,
      '#incident-title',
      'Incidencia con error'
    );

    submitForm(element);

    const request = httpMock.expectOne('/api/incidents');

    fixture.detectChanges();

    expect(toggle!.disabled).toBe(true);

    request.flush(
      { title: 'Server error' },
      {
        status: 500,
        statusText: 'Internal Server Error'
      }
    );

    fixture.detectChanges();

    expect(toggle!.disabled).toBe(false);

    expect(
      element.querySelector('[role="alert"]')?.textContent
    ).toContain('Se produjo un error al crear la incidencia.');

    toggle!.click();
    fixture.detectChanges();

    expect(
      element.querySelector('app-incident-create-form')
    ).toBeNull();

    httpMock.expectNone('/api/incidents');
  });

  it('should allow cancellation after form validation fails', () => {
    const { fixture, element } = setup();

    flushLoad(fixture);

    const toggle = element.querySelector<HTMLButtonElement>(
      '.create-button'
    );

    toggle!.click();
    fixture.detectChanges();

    // Enviar sin instalacion ni titulo.
    submitForm(element);
    fixture.detectChanges();

    expect(toggle!.disabled).toBe(false);

    expect(
      element.querySelectorAll('.field-error').length
    ).toBeGreaterThan(0);

    httpMock.expectNone('/api/incidents');

    toggle!.click();
    fixture.detectChanges();

    expect(
      element.querySelector('app-incident-create-form')
    ).toBeNull();
  });
});
