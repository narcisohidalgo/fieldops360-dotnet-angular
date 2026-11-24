import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { UserCreateForm } from './user-create-form';

describe('UserCreateForm', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [UserCreateForm],
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

  it('should default to Supervisor and load technicians', () => {
    const fixture = TestBed.createComponent(UserCreateForm);

    fixture.componentRef.setInput('existingUsers', []);
    fixture.detectChanges();

    const request = httpMock.expectOne('/api/technicians');
    expect(request.request.method).toBe('GET');

    request.flush([]);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const role = element.querySelector<HTMLSelectElement>(
      '#user-create-role'
    );

    expect(role?.value).toBe('Supervisor');
    expect(
      element.querySelector('#user-create-technician')
    ).toBeNull();
  });

  it('should only offer active, unlinked technicians', () => {
    const linkedId = '00000000-0000-0000-0000-000000000002';
    const availableId = '00000000-0000-0000-0000-000000000003';

    const fixture = TestBed.createComponent(UserCreateForm);

    fixture.componentRef.setInput('existingUsers', [{
      id: '00000000-0000-0000-0000-000000000099',
      email: 'linked@example.invalid',
      displayName: 'Cuenta vinculada',
      isActive: true,
      technicianId: linkedId,
      roles: ['Technician']
    }]);

    fixture.detectChanges();

    httpMock.expectOne('/api/technicians').flush([
      {
        id: linkedId,
        code: 'TEC-002',
        name: 'Técnico vinculado',
        email: 'linked@example.invalid',
        phone: null,
        specialty: null,
        isActive: true
      },
      {
        id: availableId,
        code: 'TEC-003',
        name: 'Técnico disponible',
        email: 'available@example.invalid',
        phone: null,
        specialty: null,
        isActive: true
      },
      {
        id: '00000000-0000-0000-0000-000000000004',
        code: 'TEC-004',
        name: 'Técnico inactivo',
        email: 'inactive@example.invalid',
        phone: null,
        specialty: null,
        isActive: false
      }
    ]);

    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const role = element.querySelector<HTMLSelectElement>(
      '#user-create-role'
    )!;

    role.value = 'Technician';
    role.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const selector = element.querySelector<HTMLSelectElement>(
      '#user-create-technician'
    )!;

    const values = Array.from(selector.options)
      .map(option => option.value);

    expect(values).toContain(availableId);
    expect(values).not.toContain(linkedId);
    expect(values).toHaveLength(2);
  });
});
