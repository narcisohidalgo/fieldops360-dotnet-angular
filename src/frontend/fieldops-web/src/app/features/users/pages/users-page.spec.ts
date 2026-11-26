import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { ManagedUser } from '../models/managed-user.model';
import { UsersPage } from './users-page';

describe('UsersPage', () => {
  let httpMock: HttpTestingController;

  const supervisor: ManagedUser = {
    id: '00000000-0000-0000-0000-000000000101',
    email: 'supervisor@example.invalid',
    displayName: 'Supervisor de prueba',
    isActive: true,
    technicianId: null,
    roles: ['Supervisor']
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [UsersPage],
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

  it('should display managed users', () => {
    const fixture = TestBed.createComponent(UsersPage);

    fixture.detectChanges();

    httpMock.expectOne('/api/users').flush([supervisor]);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Supervisor de prueba');
    expect(element.textContent).toContain('supervisor@example.invalid');
    expect(element.querySelectorAll('tbody tr').length).toBe(1);
  });

  it('should deactivate only after confirmation', () => {
    const fixture = TestBed.createComponent(UsersPage);

    fixture.detectChanges();
    httpMock.expectOne('/api/users').flush([supervisor]);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    element.querySelector<HTMLButtonElement>(
      '.status-button'
    )!.click();

    fixture.detectChanges();

    httpMock.expectNone(
      `/api/users/${supervisor.id}/deactivate`
    );

    element.querySelector<HTMLButtonElement>(
      '.confirm-button'
    )!.click();

    const patch = httpMock.expectOne(
      `/api/users/${supervisor.id}/deactivate`
    );

    expect(patch.request.method).toBe('PATCH');

    patch.flush({
      ...supervisor,
      isActive: false
    });

    httpMock.expectOne('/api/users').flush([
      { ...supervisor, isActive: false }
    ]);

    fixture.detectChanges();

    expect(element.textContent).toContain(
      'Supervisor de prueba desactivado correctamente.'
    );
  });

  it('should show conflicts without changing the list', () => {
    const fixture = TestBed.createComponent(UsersPage);

    fixture.detectChanges();
    httpMock.expectOne('/api/users').flush([supervisor]);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    element.querySelector<HTMLButtonElement>(
      '.status-button'
    )!.click();

    fixture.detectChanges();

    element.querySelector<HTMLButtonElement>(
      '.confirm-button'
    )!.click();

    httpMock.expectOne(
      `/api/users/${supervisor.id}/deactivate`
    ).flush(
      { title: 'Conflict' },
      { status: 409, statusText: 'Conflict' }
    );

    fixture.detectChanges();

    expect(element.textContent).toContain('Operación no permitida');
    expect(element.querySelector('.confirmation-panel')).not.toBeNull();
    httpMock.expectNone('/api/users');
  });

  const pendingSaveCases = [
    { mode: 'create', succeeds: true },
    { mode: 'create', succeeds: false },
    { mode: 'edit', succeeds: true },
    { mode: 'edit', succeeds: false },
    { mode: 'password', succeeds: true },
    { mode: 'password', succeeds: false }
  ];

  it.each(pendingSaveCases)(
    'protects $mode while saving (success=$succeeds)',
    ({ mode, succeeds }) => {
      const fixture = TestBed.createComponent(UsersPage);
      fixture.detectChanges();

      httpMock.expectOne('/api/users').flush([supervisor]);
      fixture.detectChanges();

      const root = fixture.nativeElement as HTMLElement;

      const creating = mode === 'create';
      const editing = mode === 'edit';

      const openSelector = creating
        ? '.create-user-button'
        : editing ? '.edit-button' : '.password-button';

      const childSelector = creating
        ? 'app-user-create-form'
        : editing
          ? 'app-user-edit-form'
          : 'app-user-reset-password-form';

      root.querySelector<HTMLButtonElement>(openSelector)!.click();
      fixture.detectChanges();

      if (creating || editing) {
        httpMock.expectOne('/api/technicians').flush([]);
        fixture.detectChanges();
      }

      const child = root.querySelector<HTMLElement>(childSelector)!;
      expect(child).not.toBeNull();

      const password = 'OnlyForUnitTests123!';

      const fill = (id: string, value: string) => {
        const input = child.querySelector<HTMLInputElement>(
          `#${id}`
        )!;

        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      };

      if (creating) {
        fill('user-create-name', 'Audit user');
        fill('user-create-email', 'new-user@example.invalid');
        fill('user-create-password', password);
      } else if (editing) {
        fill('user-edit-name', 'Updated audit user');
      } else {
        fill('reset-new-password', password);
        fill('reset-confirm-password', password);
      }

      fixture.detectChanges();

      const controls = Array.from(
        child.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
          'form input:not([readonly]), form select'
        )
      );

      expect(controls.length).toBeGreaterThan(0);
      expect(controls.every(control => !control.disabled)).toBe(true);

      const submit = () => child.querySelector('form')!.dispatchEvent(
        new Event('submit', {
          bubbles: true,
          cancelable: true
        })
      );

      submit();
      fixture.detectChanges();

      expect(controls.every(control => control.disabled)).toBe(true);

      const url = creating
        ? '/api/users'
        : editing
          ? `/api/users/${supervisor.id}`
          : `/api/users/${supervisor.id}/reset-password`;

      const request = httpMock.expectOne(url);

      expect(request.request.method).toBe(editing ? 'PUT' : 'POST');

      const childDebug = fixture.debugElement.query(
        By.css(childSelector)
      );

      expect(childDebug.componentInstance.saving()).toBe(true);

      const competingButtons = Array.from(
        root.querySelectorAll<HTMLButtonElement>(
          '.create-user-button, .refresh-button, .edit-button, ' +
          '.password-button, .status-button'
        )
      );

      expect(competingButtons.every(button => button.disabled))
        .toBe(true);

      const cancelButton = child.querySelector<HTMLButtonElement>(
        '.form-actions .secondary-button'
      )!;

      expect(cancelButton.disabled).toBe(true);

      // Attempt duplicate submission and cancellation.
      submit();
      cancelButton.click();

      // Exercise the parent's actual cancellation handler.
      childDebug.componentInstance.cancelled.emit();

      if (creating) {
        // Bypass the native disabled state of the outer button.
        fixture.debugElement.query(
          By.css('.create-user-button')
        ).triggerEventHandler('click', new MouseEvent('click'));
      }

      fixture.detectChanges();

      expect(root.querySelector(childSelector)).toBe(child);
      expect(request.cancelled).toBe(false);

      httpMock.expectNone(url);

      if (succeeds) {
        if (creating) {
          const created: ManagedUser = {
            ...supervisor,
            id: '00000000-0000-0000-0000-000000000102',
            email: 'new-user@example.invalid',
            displayName: 'Audit user'
          };

          request.flush(created, {
            status: 201,
            statusText: 'Created'
          });

          httpMock.expectOne('/api/users').flush([
            supervisor, created
          ]);
        } else if (editing) {
          const updated = {
            ...supervisor,
            displayName: 'Updated audit user'
          };

          request.flush(updated);
          httpMock.expectOne('/api/users').flush([updated]);
        } else {
          request.flush(null, {
            status: 204,
            statusText: 'No Content'
          });
        }

        fixture.detectChanges();

        expect(root.querySelector(childSelector)).toBeNull();
        expect(root.querySelector('.success-message')).not.toBeNull();
      } else {
        request.flush(
          { title: 'Conflict' },
          { status: 409, statusText: 'Conflict' }
        );

        fixture.detectChanges();

        expect(root.querySelector(childSelector)).toBe(child);
        expect(childDebug.componentInstance.saving()).toBe(false);
        expect(controls.every(control => !control.disabled)).toBe(true);
        expect(cancelButton.disabled).toBe(false);
        expect(child.querySelector('.save-error')).not.toBeNull();

        if (creating) {
          expect(
            child.querySelector<HTMLInputElement>(
              '#user-create-name'
            )!.value
          ).toBe('Audit user');

          expect(
            child.querySelector<HTMLInputElement>(
              '#user-create-password'
            )!.value
          ).toBe('');

          expect(
            root.querySelector<HTMLButtonElement>(
              '.create-user-button'
            )!.disabled
          ).toBe(false);
        } else if (editing) {
          expect(
            child.querySelector<HTMLInputElement>(
              '#user-edit-name'
            )!.value
          ).toBe('Updated audit user');
        } else {
          for (const id of [
            'reset-new-password',
            'reset-confirm-password'
          ]) {
            expect(
              child.querySelector<HTMLInputElement>(`#${id}`)!.value
            ).toBe('');
          }
        }

        cancelButton.click();
        fixture.detectChanges();

        expect(root.querySelector(childSelector)).toBeNull();
      }

      httpMock.expectNone(url);
    }
  );
});
