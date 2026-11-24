import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Technician } from '../models/technician.model';
import { TechniciansPage } from './technicians-page';

describe('TechniciansPage', () => {
  let httpMock: HttpTestingController;

  const active: Technician = {
    id: '00000000-0000-0000-0000-000000000001',
    code: 'TEC-001',
    name: 'Ana Lopez',
    email: 'ana@example.com',
    phone: '600123456',
    specialty: 'Electricidad',
    isActive: true
  };

  const inactive: Technician = {
    id: '00000000-0000-0000-0000-000000000002',
    code: 'TEC-002',
    name: 'Luis Garcia',
    email: 'luis@example.com',
    phone: null,
    specialty: null,
    isActive: false
  };

  const url = '/api/technicians';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TechniciansPage],
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

  function setup() {
    const fixture = TestBed.createComponent(TechniciansPage);
    fixture.detectChanges();

    return {
      fixture,
      element: fixture.nativeElement as HTMLElement
    };
  }

  function flushLoad(
    fixture: ComponentFixture<TechniciansPage>,
    records: Technician[] = [active, inactive]
  ): void {
    const request = httpMock.expectOne(url);

    expect(request.request.method).toBe('GET');

    request.flush(records);
    fixture.detectChanges();
  }

  function click(element: HTMLElement, selector: string): void {
    const button = element.querySelector<HTMLButtonElement>(selector);

    if (!button) {
      throw new Error(`Button not found: ${selector}`);
    }

    button.click();
  }

  function fillField(
    element: HTMLElement,
    selector: string,
    value: string
  ): void {
    const input = element.querySelector<HTMLInputElement>(selector);

    if (!input) {
      throw new Error(`Input not found: ${selector}`);
    }

    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function submitForm(
    element: HTMLElement,
    selector: string
  ): void {
    const form = element.querySelector<HTMLFormElement>(selector);

    if (!form) {
      throw new Error(`Form not found: ${selector}`);
    }

    form.dispatchEvent(new Event('submit', {
      bubbles: true,
      cancelable: true
    }));
  }

  it('should load technicians and display their states', () => {
    const { fixture, element } = setup();

    flushLoad(fixture);

    const rows = element.querySelectorAll('tbody tr');

    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('TEC-001');
    expect(rows[0].textContent).toContain('Activo');
    expect(rows[1].textContent).toContain('TEC-002');
    expect(rows[1].textContent).toContain('Inactivo');
    expect(rows[1].textContent).toContain('Sin teléfono');

    expect(element.querySelectorAll('.deactivate-button').length).toBe(1);
    expect(element.querySelectorAll('.activate-button').length).toBe(1);
  });

  it('should show an empty state', () => {
    const { fixture, element } = setup();

    flushLoad(fixture, []);

    expect(element.textContent).toContain(
      'Todavía no hay técnicos registrados.'
    );
  });

  it('should handle a failed load and allow retry', () => {
    const { fixture, element } = setup();

    httpMock.expectOne(url).error(new ProgressEvent('error'));
    fixture.detectChanges();

    expect(element.querySelector('[role="alert"]')?.textContent)
      .toContain('No se pudieron cargar los técnicos.');

    click(element, '.message.error button');
    flushLoad(fixture);

    expect(element.querySelectorAll('tbody tr').length).toBe(2);
  });

  it('should create a technician and refresh the list', () => {
    const { fixture, element } = setup();

    flushLoad(fixture, []);

    click(element, '.create-button');
    fixture.detectChanges();

    fillField(element, '#technician-code', 'TEC-003');
    fillField(element, '#technician-name', 'Maria Ruiz');
    fillField(element, '#technician-email', 'maria@example.com');

    submitForm(element, 'app-technician-create-form form');

    const request = httpMock.expectOne(url);

    expect(request.request.method).toBe('POST');
    expect(request.request.body.code).toBe('TEC-003');

    const created: Technician = {
      ...active,
      id: '00000000-0000-0000-0000-000000000003',
      code: 'TEC-003',
      name: 'Maria Ruiz',
      email: 'maria@example.com',
      phone: null,
      specialty: null
    };

    request.flush(created, {
      status: 201,
      statusText: 'Created'
    });

    flushLoad(fixture, [created]);

    expect(
      element.querySelector('app-technician-create-form')
    ).toBeNull();

    expect(element.querySelector('.success-message')?.textContent)
      .toContain('Técnico TEC-003 creado correctamente.');
  });

  it('should update a technician and refresh the list', () => {
    const { fixture, element } = setup();

    flushLoad(fixture);

    click(element, '[aria-label="Editar técnico TEC-001"]');
    fixture.detectChanges();

    fillField(element, '#edit-technician-name', 'Ana Actualizada');

    submitForm(element, 'app-technician-edit-form form');

    const request = httpMock.expectOne(`${url}/${active.id}`);

    expect(request.request.method).toBe('PUT');
    expect(request.request.body.name).toBe('Ana Actualizada');
    expect(request.request.body.code).toBeUndefined();

    request.flush(null, {
      status: 204,
      statusText: 'No Content'
    });

    flushLoad(fixture, [{
      ...active,
      name: 'Ana Actualizada'
    }, inactive]);

    expect(
      element.querySelector('app-technician-edit-form')
    ).toBeNull();

    expect(element.textContent).toContain('Ana Actualizada');
    expect(element.textContent).toContain(
      'Técnico TEC-001 actualizado correctamente.'
    );
  });

  it('should cancel editing without PUT', () => {
    const { fixture, element } = setup();

    flushLoad(fixture);

    click(element, '[aria-label="Editar técnico TEC-001"]');
    fixture.detectChanges();

    click(element, '.cancel-button');
    fixture.detectChanges();

    expect(
      element.querySelector('app-technician-edit-form')
    ).toBeNull();

    httpMock.expectNone(`${url}/${active.id}`);
  });

  it('should confirm deactivation and refresh', () => {
    const { fixture, element } = setup();

    flushLoad(fixture);

    click(element, '[aria-label="Desactivar técnico TEC-001"]');
    fixture.detectChanges();

    expect(
      element.querySelector('.deactivation-panel')
    ).not.toBeNull();

    httpMock.expectNone(`${url}/${active.id}/deactivate`);

    click(element, '.confirm-status');

    const request = httpMock.expectOne(
      `${url}/${active.id}/deactivate`
    );

    expect(request.request.method).toBe('PATCH');

    request.flush(null, {
      status: 204,
      statusText: 'No Content'
    });

    flushLoad(fixture, [{ ...active, isActive: false }, inactive]);

    expect(element.querySelector('.deactivation-panel')).toBeNull();
    expect(element.querySelectorAll('.deactivate-button').length).toBe(0);
    expect(element.textContent).toContain(
      'Técnico TEC-001 desactivado correctamente.'
    );
  });

  it('should confirm activation and refresh', () => {
    const { fixture, element } = setup();

    flushLoad(fixture);

    click(element, '[aria-label="Activar técnico TEC-002"]');
    fixture.detectChanges();

    expect(element.querySelector('.activation-panel')).not.toBeNull();
    httpMock.expectNone(`${url}/${inactive.id}/activate`);

    click(element, '.confirm-status');

    const request = httpMock.expectOne(
      `${url}/${inactive.id}/activate`
    );

    expect(request.request.method).toBe('PATCH');

    request.flush(null, {
      status: 204,
      statusText: 'No Content'
    });

    flushLoad(fixture, [active, { ...inactive, isActive: true }]);

    expect(element.querySelector('.activation-panel')).toBeNull();
    expect(element.querySelectorAll('.activate-button').length).toBe(0);
    expect(element.textContent).toContain(
      'Técnico TEC-002 activado correctamente.'
    );
  });

  it('should cancel status confirmation without PATCH', () => {
    const { fixture, element } = setup();

    flushLoad(fixture);

    click(element, '.deactivate-button');
    fixture.detectChanges();

    click(element, '.cancel-status');
    fixture.detectChanges();

    expect(element.querySelector('.deactivation-panel')).toBeNull();

    httpMock.expectNone(`${url}/${active.id}/deactivate`);
  });

  for (const testCase of [
    {
      status: 404,
      message: 'El técnico ya no existe.'
    },
    {
      status: 0,
      message: 'No se pudo conectar con el servidor.'
    },
    {
      status: 500,
      message: 'Se produjo un error al cambiar el estado del técnico.'
    }
  ]) {
    it(`should handle status error HTTP ${testCase.status}`, () => {
      const { fixture, element } = setup();

      flushLoad(fixture);

      click(element, '.deactivate-button');
      fixture.detectChanges();

      click(element, '.confirm-status');

      const request = httpMock.expectOne(
        `${url}/${active.id}/deactivate`
      );

      if (testCase.status === 0) {
        request.error(new ProgressEvent('error'));
      } else {
        request.flush(
          { title: 'Request failed' },
          {
            status: testCase.status,
            statusText: 'Error'
          }
        );
      }

      fixture.detectChanges();

      expect(element.querySelector('.status-error')?.textContent)
        .toContain(testCase.message);

      expect(element.querySelector('.deactivation-panel'))
        .not.toBeNull();

      expect(
        element.querySelector<HTMLButtonElement>(
          '.confirm-status'
        )?.disabled
      ).toBe(false);

      httpMock.expectNone(url);
    });
  }

  it('should prevent duplicate PATCH requests', () => {
    const { fixture, element } = setup();

    flushLoad(fixture);

    click(element, '.deactivate-button');
    fixture.detectChanges();

    click(element, '.confirm-status');
    fixture.detectChanges();

    const confirm = element.querySelector<HTMLButtonElement>(
      '.confirm-status'
    );

    const cancel = element.querySelector<HTMLButtonElement>(
      '.cancel-status'
    );

    expect(confirm?.disabled).toBe(true);
    expect(cancel?.disabled).toBe(true);
    expect(confirm?.textContent).toContain('Desactivando...');

    // Intentar confirmar de nuevo, incluso programaticamente.
    confirm?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const requests = httpMock.match(
      `${url}/${active.id}/deactivate`
    );

    expect(requests.length).toBe(1);

    requests[0].flush(null, {
      status: 204,
      statusText: 'No Content'
    });

    flushLoad(fixture, [{ ...active, isActive: false }, inactive]);
  });

  it('should block other actions during status confirmation', () => {
    const { fixture, element } = setup();

    flushLoad(fixture);

    click(element, '.deactivate-button');
    fixture.detectChanges();

    expect(
      element.querySelector<HTMLButtonElement>(
        '.create-button'
      )?.disabled
    ).toBe(true);

    expect(
      element.querySelector<HTMLButtonElement>(
        '.edit-button'
      )?.disabled
    ).toBe(true);

    click(element, '.cancel-status');
    fixture.detectChanges();

    expect(
      element.querySelector<HTMLButtonElement>(
        '.create-button'
      )?.disabled
    ).toBe(false);
  });

  it('should refresh after a status error', () => {
    const { fixture, element } = setup();

    flushLoad(fixture);

    click(element, '.deactivate-button');
    fixture.detectChanges();

    click(element, '.confirm-status');

    httpMock.expectOne(
      `${url}/${active.id}/deactivate`
    ).flush(
      { title: 'Not Found' },
      { status: 404, statusText: 'Not Found' }
    );

    fixture.detectChanges();

    click(element, '.refresh-status');

    flushLoad(fixture, [inactive]);

    expect(element.querySelector('.deactivation-panel')).toBeNull();
    expect(element.querySelectorAll('tbody tr').length).toBe(1);
  });
  it('should prevent competing actions during creation', () => {
    const { fixture, element } = setup();

    flushLoad(fixture);

    click(element, '.create-button');
    fixture.detectChanges();

    fillField(element, '#technician-code', 'TEC-003');
    fillField(element, '#technician-name', 'Maria Ruiz');
    fillField(element, '#technician-email', 'maria@example.com');

    submitForm(element, 'app-technician-create-form form');

    const request = httpMock.expectOne(url);

    expect(request.request.method).toBe('POST');

    fixture.detectChanges();

    expect(
      element.querySelector<HTMLButtonElement>('.create-button')?.disabled
    ).toBe(true);

    expect(
      element.querySelector<HTMLButtonElement>('.edit-button')?.disabled
    ).toBe(true);

    expect(
      element.querySelector<HTMLButtonElement>('.deactivate-button')?.disabled
    ).toBe(true);

    element.querySelector<HTMLButtonElement>('.edit-button')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    fixture.detectChanges();

    expect(
      element.querySelector('app-technician-create-form')
    ).not.toBeNull();

    expect(
      element.querySelector('app-technician-edit-form')
    ).toBeNull();

    request.flush({
      ...active,
      id: '00000000-0000-0000-0000-000000000003',
      code: 'TEC-003',
      name: 'Maria Ruiz',
      email: 'maria@example.com',
      phone: null,
      specialty: null
    }, {
      status: 201,
      statusText: 'Created'
    });

    flushLoad(fixture);

    expect(
      element.querySelector('app-technician-create-form')
    ).toBeNull();
  });

  it('should prevent competing actions during editing', () => {
    const { fixture, element } = setup();

    flushLoad(fixture);

    click(element, '[aria-label="Editar técnico TEC-001"]');
    fixture.detectChanges();

    fillField(element, '#edit-technician-name', 'Ana Actualizada');

    submitForm(element, 'app-technician-edit-form form');

    const request = httpMock.expectOne(`${url}/${active.id}`);

    expect(request.request.method).toBe('PUT');

    fixture.detectChanges();

    expect(
      element.querySelector<HTMLButtonElement>('.create-button')?.disabled
    ).toBe(true);

    expect(
      element.querySelector<HTMLButtonElement>('.deactivate-button')?.disabled
    ).toBe(true);

    element.querySelector<HTMLButtonElement>('.deactivate-button')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    fixture.detectChanges();

    expect(
      element.querySelector('.deactivation-panel')
    ).toBeNull();

    expect(
      element.querySelector('app-technician-edit-form')
    ).not.toBeNull();

    request.flush(null, {
      status: 204,
      statusText: 'No Content'
    });

    flushLoad(fixture, [
      { ...active, name: 'Ana Actualizada' },
      inactive
    ]);

    expect(
      element.querySelector('app-technician-edit-form')
    ).toBeNull();
  });

});
