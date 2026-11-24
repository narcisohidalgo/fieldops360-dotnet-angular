import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ManagedUser } from '../models/managed-user.model';
import { UserEditForm } from './user-edit-form';

describe('UserEditForm', () => {
  let httpMock: HttpTestingController;

  const technicianId = '00000000-0000-0000-0000-000000000010';

  const user: ManagedUser = {
    id: '00000000-0000-0000-0000-000000000101',
    email: 'tech@example.invalid',
    displayName: 'Técnico de prueba',
    isActive: true,
    technicianId,
    roles: ['Technician']
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [UserEditForm],
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

  it('should preserve email and current technician', () => {
    const fixture = TestBed.createComponent(UserEditForm);

    fixture.componentRef.setInput('user', user);
    fixture.componentRef.setInput('existingUsers', [user]);

    fixture.detectChanges();

    httpMock.expectOne('/api/technicians').flush([{
      id: technicianId,
      code: 'TEC-010',
      name: 'Técnico de prueba',
      email: user.email,
      phone: null,
      specialty: null,
      isActive: true
    }]);

    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    const email = element.querySelector<HTMLInputElement>(
      '#user-edit-email'
    );

    const technician = element.querySelector<HTMLSelectElement>(
      '#user-edit-technician'
    );

    expect(email?.readOnly).toBe(true);
    expect(email?.value).toBe(user.email);
    expect(technician?.value).toBe(technicianId);
  });

  it('should remove technician link when switching role', () => {
    const fixture = TestBed.createComponent(UserEditForm);

    fixture.componentRef.setInput('user', user);
    fixture.componentRef.setInput('existingUsers', [user]);

    fixture.detectChanges();

    httpMock.expectOne('/api/technicians').flush([]);

    const element = fixture.nativeElement as HTMLElement;
    const role = element.querySelector<HTMLSelectElement>(
      '#user-edit-role'
    )!;

    role.value = 'Supervisor';
    role.dispatchEvent(new Event('change'));

    fixture.detectChanges();

    expect(
      element.querySelector('#user-edit-technician')
    ).toBeNull();

    element.querySelector<HTMLFormElement>('form')!
      .dispatchEvent(new Event('submit', {
        bubbles: true,
        cancelable: true
      }));

    const request = httpMock.expectOne(
      `/api/users/${user.id}`
    );

    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({
      displayName: user.displayName,
      role: 'Supervisor',
      technicianId: null
    });

    request.flush({
      ...user,
      technicianId: null,
      roles: ['Supervisor']
    });
  });
});
