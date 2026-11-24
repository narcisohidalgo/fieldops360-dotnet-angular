import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  WorkOrder,
  WorkOrderPriority,
  WorkOrderStatus
} from '../models/work-order.model';

import { WorkOrderEditForm } from './work-order-edit-form';

describe('WorkOrderEditForm', () => {
  let httpMock: HttpTestingController;

  const orderId = '00000000-0000-0000-0000-000000000005';

  const order: WorkOrder = {
    id: orderId,
    facilityId: '00000000-0000-0000-0000-000000000001',
    assetId: '00000000-0000-0000-0000-000000000002',
    incidentId: '00000000-0000-0000-0000-000000000003',
    technicianId: '00000000-0000-0000-0000-000000000004',
    code: 'WO-001',
    title: 'Revisar sensor',
    description: 'Mantenimiento preventivo',
    priority: WorkOrderPriority.High,
    status: WorkOrderStatus.Planned,
    scheduledStartUtc: '2026-12-01T09:00:00Z',
    dueAtUtc: '2026-12-01T12:00:00Z',
    createdAtUtc: '2026-11-24T08:00:00Z',
    updatedAtUtc: '2026-11-24T08:00:00Z',
    startedAtUtc: null,
    completedAtUtc: null,
    cancelledAtUtc: null,
    cancellationReason: null
  };

  const apiUrl = `/api/work-orders/${orderId}`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [WorkOrderEditForm],
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

  function setup(selectedOrder: WorkOrder = order) {
    const fixture = TestBed.createComponent(WorkOrderEditForm);

    fixture.componentRef.setInput(
      'workOrder',
      selectedOrder
    );

    fixture.detectChanges();

    return {
      fixture,
      element: fixture.nativeElement as HTMLElement
    };
  }

  function fill(
    element: HTMLElement,
    field: string,
    value: string
  ): void {
    const control = element.querySelector<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >(`#edit-work-order-${field}`);

    if (!control) {
      throw new Error(`Campo no encontrado: ${field}`);
    }

    control.value = value;

    control.dispatchEvent(new Event(
      control.tagName === 'SELECT' ? 'change' : 'input',
      { bubbles: true }
    ));
  }

  function submit(element: HTMLElement): void {
    const form = element.querySelector('form');

    if (!form) {
      throw new Error('Formulario no encontrado');
    }

    form.dispatchEvent(new Event('submit', {
      bubbles: true,
      cancelable: true
    }));
  }

  function localValue(utc: string): string {
    const date = new Date(utc);
    const pad = (value: number): string =>
      String(value).padStart(2, '0');

    return [
      date.getFullYear(),
      '-',
      pad(date.getMonth() + 1),
      '-',
      pad(date.getDate()),
      'T',
      pad(date.getHours()),
      ':',
      pad(date.getMinutes())
    ].join('');
  }

  it('loads editable fields from the selected order', () => {
    const { element } = setup();

    expect(
      element.querySelector<HTMLInputElement>(
        '#edit-work-order-title'
      )?.value
    ).toBe('Revisar sensor');

    expect(
      element.querySelector<HTMLTextAreaElement>(
        '#edit-work-order-description'
      )?.value
    ).toBe('Mantenimiento preventivo');

    expect(
      element.querySelector<HTMLSelectElement>(
        '#edit-work-order-priority'
      )?.value
    ).toBe('3');
  });

  it('converts stored UTC dates into local input values', () => {
    const { element } = setup();

    expect(
      element.querySelector<HTMLInputElement>(
        '#edit-work-order-start-date'
      )?.value
    ).toBe(localValue(order.scheduledStartUtc!));

    expect(
      element.querySelector<HTMLInputElement>(
        '#edit-work-order-due-date'
      )?.value
    ).toBe(localValue(order.dueAtUtc!));
  });

  it('displays empty inputs for null dates', () => {
    const { element } = setup({
      ...order,
      scheduledStartUtc: null,
      dueAtUtc: null
    });

    expect(
      element.querySelector<HTMLInputElement>(
        '#edit-work-order-start-date'
      )?.value
    ).toBe('');

    expect(
      element.querySelector<HTMLInputElement>(
        '#edit-work-order-due-date'
      )?.value
    ).toBe('');
  });

  it('does not expose immutable references as editable fields', () => {
    const { element } = setup();

    for (const field of [
      'code',
      'facility',
      'asset',
      'incident',
      'technician',
      'status'
    ]) {
      expect(
        element.querySelector(`#edit-work-order-${field}`)
      ).toBeNull();
    }

    expect(element.textContent).toContain('WO-001');
  });

  it('resets the form when another order is selected', () => {
    const { fixture, element } = setup();

    fill(element, 'title', 'Cambio sin guardar');

    fixture.componentRef.setInput('workOrder', {
      ...order,
      id: '00000000-0000-0000-0000-000000000099',
      code: 'WO-002',
      title: 'Revisar compresor',
      description: null,
      priority: WorkOrderPriority.Critical,
      scheduledStartUtc: null,
      dueAtUtc: null
    });

    fixture.detectChanges();

    expect(
      element.querySelector<HTMLInputElement>(
        '#edit-work-order-title'
      )?.value
    ).toBe('Revisar compresor');

    expect(
      element.querySelector<HTMLTextAreaElement>(
        '#edit-work-order-description'
      )?.value
    ).toBe('');

    expect(
      element.querySelector<HTMLSelectElement>(
        '#edit-work-order-priority'
      )?.value
    ).toBe('4');

    httpMock.expectNone('/api/work-orders');
  });

  it('updates the order using PUT and emits saved', () => {
    const { fixture, element } = setup();

    fill(element, 'title', '  Sensor revisado  ');
    fill(element, 'description', '  Trabajo actualizado  ');
    fill(element, 'priority', '2');

    let saved = false;

    fixture.componentInstance.saved.subscribe(() => {
      saved = true;
    });

    submit(element);

    const request = httpMock.expectOne(apiUrl);

    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({
      title: 'Sensor revisado',
      description: 'Trabajo actualizado',
      priority: WorkOrderPriority.Medium,
      scheduledStartUtc: order.scheduledStartUtc,
      dueAtUtc: order.dueAtUtc
    });

    expect(request.request.body.code).toBeUndefined();
    expect(request.request.body.facilityId).toBeUndefined();
    expect(request.request.body.assetId).toBeUndefined();
    expect(request.request.body.incidentId).toBeUndefined();
    expect(request.request.body.technicianId).toBeUndefined();
    expect(request.request.body.status).toBeUndefined();

    request.flush(null, {
      status: 204,
      statusText: 'No Content'
    });

    fixture.detectChanges();

    expect(saved).toBe(true);
  });

  it('preserves original date precision when editing only the title', () => {
    const original: WorkOrder = {
      ...order,
      scheduledStartUtc: '2026-12-01T09:00:42.123+00:00',
      dueAtUtc: '2026-12-01T12:00:59.987+00:00'
    };

    const { element } = setup(original);

    const startInput = element.querySelector<HTMLInputElement>(
      '#edit-work-order-start-date'
    );

    const dueInput = element.querySelector<HTMLInputElement>(
      '#edit-work-order-due-date'
    );

    expect(startInput?.value.endsWith(':42')).toBe(true);
    expect(dueInput?.value.endsWith(':59')).toBe(true);
    expect(startInput?.step).toBe('1');
    expect(dueInput?.step).toBe('1');

    fill(element, 'title', 'Título modificado');
    submit(element);

    const request = httpMock.expectOne(apiUrl);

    expect(request.request.method).toBe('PUT');
    expect(request.request.body.title).toBe('Título modificado');
    expect(request.request.body.scheduledStartUtc).toBe(
      original.scheduledStartUtc
    );
    expect(request.request.body.dueAtUtc).toBe(
      original.dueAtUtc
    );

    request.flush(null, {
      status: 204,
      statusText: 'No Content'
    });
  });

  it('accepts explicitly edited dates with seconds', () => {
    const { element } = setup();

    fill(element, 'start-date', '2026-12-02T09:30:45');
    fill(element, 'due-date', '2026-12-02T10:45:12');

    submit(element);

    const request = httpMock.expectOne(apiUrl);

    expect(request.request.body.scheduledStartUtc).toBe(
      new Date('2026-12-02T09:30:45').toISOString()
    );

    expect(request.request.body.dueAtUtc).toBe(
      new Date('2026-12-02T10:45:12').toISOString()
    );

    request.flush(null, {
      status: 204,
      statusText: 'No Content'
    });
  });
  it('converts edited local dates to UTC', () => {
    const { element } = setup();

    fill(element, 'start-date', '2026-12-02T09:30');
    fill(element, 'due-date', '2026-12-02T12:45');

    submit(element);

    const request = httpMock.expectOne(apiUrl);

    expect(request.request.body.scheduledStartUtc).toBe(
      new Date('2026-12-02T09:30').toISOString()
    );

    expect(request.request.body.dueAtUtc).toBe(
      new Date('2026-12-02T12:45').toISOString()
    );

    request.flush(null, {
      status: 204,
      statusText: 'No Content'
    });
  });

  it('sends null for blank description and dates', () => {
    const { element } = setup();

    fill(element, 'description', '   ');
    fill(element, 'start-date', '');
    fill(element, 'due-date', '');

    submit(element);

    const request = httpMock.expectOne(apiUrl);

    expect(request.request.body.description).toBeNull();
    expect(request.request.body.scheduledStartUtc).toBeNull();
    expect(request.request.body.dueAtUtc).toBeNull();

    request.flush(null, {
      status: 204,
      statusText: 'No Content'
    });
  });

  it('cancels editing without a PUT request', () => {
    const { fixture, element } = setup();

    let cancelled = false;

    fixture.componentInstance.cancelled.subscribe(() => {
      cancelled = true;
    });

    element.querySelector<HTMLButtonElement>(
      '.cancel-button'
    )!.click();

    expect(cancelled).toBe(true);
    httpMock.expectNone(apiUrl);
  });

  it('rejects a blank title', () => {
    const { fixture, element } = setup();

    fill(element, 'title', '   ');
    submit(element);
    fixture.detectChanges();

    expect(
      element.querySelector('#edit-work-order-title')
        ?.closest('.form-field')
        ?.querySelector('.field-error')
    ).not.toBeNull();

    httpMock.expectNone(apiUrl);
  });

  it('rejects a title longer than 150 characters', () => {
    const { fixture, element } = setup();

    fill(element, 'title', 'X'.repeat(151));
    submit(element);
    fixture.detectChanges();

    expect(
      element.querySelector('#edit-work-order-title')
        ?.closest('.form-field')
        ?.querySelector('.field-error')
    ).not.toBeNull();

    httpMock.expectNone(apiUrl);
  });

  it('rejects a description longer than 2000 characters', () => {
    const { fixture, element } = setup();

    fill(element, 'description', 'X'.repeat(2001));
    submit(element);
    fixture.detectChanges();

    expect(
      element.querySelector('#edit-work-order-description')
        ?.closest('.form-field')
        ?.querySelector('.field-error')
    ).not.toBeNull();

    httpMock.expectNone(apiUrl);
  });

  it('rejects an invalid priority', () => {
    const { fixture, element } = setup();

    fill(element, 'priority', '');
    submit(element);
    fixture.detectChanges();

    expect(
      element.querySelector('#edit-work-order-priority')
        ?.closest('.form-field')
        ?.querySelector('.field-error')
    ).not.toBeNull();

    httpMock.expectNone(apiUrl);
  });

  it('rejects a due date earlier than the planned start', () => {
    const { fixture, element } = setup();

    fill(element, 'start-date', '2026-12-10T10:00');
    fill(element, 'due-date', '2026-12-10T09:00');

    submit(element);
    fixture.detectChanges();

    expect(element.textContent).toContain(
      'no puede ser anterior'
    );

    httpMock.expectNone(apiUrl);
  });

  for (const status of [
    WorkOrderStatus.InProgress,
    WorkOrderStatus.Completed,
    WorkOrderStatus.Cancelled
  ]) {
    it(`blocks editing when status is ${status}`, () => {
      const { fixture, element } = setup({
        ...order,
        status
      });

      const button = element.querySelector<HTMLButtonElement>(
        '.save-button'
      );

      const fieldset = element.querySelector<HTMLFieldSetElement>(
        'fieldset'
      );

      expect(button?.disabled).toBe(true);
      expect(fieldset?.disabled).toBe(true);
      expect(element.textContent).toContain(
        'Solo se pueden editar órdenes planificadas'
      );

      submit(element);
      fixture.detectChanges();

      httpMock.expectNone(apiUrl);
    });
  }

  for (const testCase of [
    { status: 400, text: 'Los datos introducidos' },
    { status: 404, text: 'ya no existe' },
    { status: 409, text: 'La orden ha cambiado' },
    { status: 0, text: 'No se pudo conectar' },
    { status: 500, text: 'No se pudo actualizar' }
  ]) {
    it(`handles HTTP ${testCase.status}`, () => {
      const { fixture, element } = setup();

      fill(element, 'title', 'Cambio pendiente');
      submit(element);

      const request = httpMock.expectOne(apiUrl);

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

      expect(
        element.querySelector('[role="alert"]')?.textContent
      ).toContain(testCase.text);

      expect(
        element.querySelector<HTMLInputElement>(
          '#edit-work-order-title'
        )?.value
      ).toBe('Cambio pendiente');

      expect(
        element.querySelector<HTMLButtonElement>(
          '.save-button'
        )?.disabled
      ).toBe(false);
    });
  }

  it('prevents duplicate PUT requests while saving', () => {
    const { fixture, element } = setup();

    submit(element);
    fixture.detectChanges();

    const button = element.querySelector<HTMLButtonElement>(
      '.save-button'
    );

    const cancelButton = element.querySelector<HTMLButtonElement>(
      '.cancel-button'
    );

    const fieldset = element.querySelector<HTMLFieldSetElement>(
      'fieldset'
    );

    expect(button?.disabled).toBe(true);
    expect(cancelButton?.disabled).toBe(true);
    expect(fieldset?.disabled).toBe(true);

    submit(element);

    const request = httpMock.expectOne(apiUrl);

    httpMock.expectNone(apiUrl);

    request.flush(null, {
      status: 204,
      statusText: 'No Content'
    });

    fixture.detectChanges();

    expect(button?.disabled).toBe(false);
    expect(cancelButton?.disabled).toBe(false);
    expect(fieldset?.disabled).toBe(false);
  });
});
