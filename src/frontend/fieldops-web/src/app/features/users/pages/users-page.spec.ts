import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

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
});
