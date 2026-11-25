import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { DashboardSummary } from '../models/dashboard-summary.model';
import { DashboardPage } from './dashboard-page';

describe('DashboardPage', () => {
  let httpMock: HttpTestingController;

  const summary: DashboardSummary = {
    facilities: { total: 3, active: 2 },
    assets: { total: 2, active: 2 },
    technicians: { total: 4, active: 1 },
    incidents: {
      total: 2, open: 1, inProgress: 1,
      resolved: 0, closed: 0
    },
    workOrders: {
      total: 5, planned: 2, inProgress: 1,
      completed: 1, cancelled: 1,
      overdue: 0, unassignedPlanned: 1
    },
    generatedAtUtc: '2026-11-25T10:00:00Z'
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([])
      ]
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('muestra el estado de carga', () => {
    const fixture = TestBed.createComponent(DashboardPage);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('[role="status"]')?.textContent)
      .toContain('Cargando indicadores');

    httpMock.expectOne('/api/dashboard/summary').flush(summary);
  });

  it('muestra seis tarjetas con datos de la API', () => {
    const fixture = TestBed.createComponent(DashboardPage);
    fixture.detectChanges();

    const request = httpMock.expectOne('/api/dashboard/summary');
    expect(request.request.method).toBe('GET');
    request.flush(summary);

    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const cards = element.querySelectorAll('.dashboard-card');

    expect(cards.length).toBe(6);
    expect(cards[0].textContent).toContain('Instalaciones');
    expect(cards[0].textContent).toContain('3');
    expect(cards[2].textContent).toContain('4');
    expect(cards[4].textContent).toContain('5');
    expect(cards[5].textContent).toContain('0');
  });

  it('muestra errores y permite reintentar', () => {
    const fixture = TestBed.createComponent(DashboardPage);
    fixture.detectChanges();

    httpMock.expectOne('/api/dashboard/summary').flush(
      { title: 'Service unavailable' },
      { status: 503, statusText: 'Service Unavailable' }
    );

    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('[role="alert"]')?.textContent)
      .toContain('No se pudieron cargar los indicadores');

    const retry = element.querySelector(
      '.retry-button'
    ) as HTMLButtonElement;

    retry.click();

    httpMock.expectOne('/api/dashboard/summary').flush(summary);
    fixture.detectChanges();

    expect(element.querySelectorAll('.dashboard-card').length)
      .toBe(6);
  });

  it('actualiza los indicadores al pulsar el boton', () => {
    const fixture = TestBed.createComponent(DashboardPage);
    fixture.detectChanges();

    httpMock.expectOne('/api/dashboard/summary').flush(summary);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const button = element.querySelector(
      '.refresh-button'
    ) as HTMLButtonElement;

    button.click();

    httpMock.expectOne('/api/dashboard/summary').flush({
      ...summary,
      facilities: { total: 4, active: 3 }
    });

    fixture.detectChanges();

    const firstCard = element.querySelector('.dashboard-card');

    expect(firstCard?.textContent).toContain('4');
    expect(firstCard?.textContent).toContain('3 activas');
  });

  it('muestra los graficos de distribucion', () => {
    const fixture = TestBed.createComponent(DashboardPage);
    fixture.detectChanges();

    httpMock.expectOne('/api/dashboard/summary').flush(summary);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const panels = element.querySelectorAll('.chart-panel');

    expect(panels.length).toBe(2);

    const incidentRows = panels[0].querySelectorAll('.chart-row');
    const orderRows = panels[1].querySelectorAll('.chart-row');

    expect(incidentRows.length).toBe(4);
    expect(orderRows.length).toBe(4);

    expect(incidentRows[0].textContent).toContain('Abiertas');
    expect(incidentRows[0].textContent).toContain('50%');

    expect(orderRows[0].textContent).toContain('Planificadas');
    expect(orderRows[0].textContent).toContain('40%');
  });
  it('informa de la falta de permisos', () => {
    const fixture = TestBed.createComponent(DashboardPage);
    fixture.detectChanges();

    httpMock.expectOne('/api/dashboard/summary').flush(
      { title: 'Forbidden' },
      { status: 403, statusText: 'Forbidden' }
    );

    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('[role="alert"]')?.textContent)
      .toContain('No tienes permisos');
  });
});