import {
  HttpErrorResponse,
  provideHttpClient
} from '@angular/common/http';

import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';

import { TestBed } from '@angular/core/testing';

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it
} from 'vitest';

import {
  CreateManagedUserRequest,
  ManagedUser,
  UpdateManagedUserRequest
} from '../models/managed-user.model';

import { UserManagementService } from './user-management.service';

describe('UserManagementService', () => {
  let service: UserManagementService;
  let httpMock: HttpTestingController;

  const apiUrl = '/api/users';
  const userId = '00000000-0000-0000-0000-000000000101';

  const user: ManagedUser = {
    id: userId,
    email: 'test@example.invalid',
    displayName: 'Usuario de prueba',
    isActive: true,
    technicianId: null,
    roles: ['Supervisor']
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        UserManagementService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });

    service = TestBed.inject(UserManagementService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should retrieve managed users', () => {
    let actual: ManagedUser[] | undefined;

    service.getAll().subscribe(result => {
      actual = result;
    });

    const request = httpMock.expectOne(apiUrl);

    expect(request.request.method).toBe('GET');

    request.flush([user]);

    expect(actual).toEqual([user]);
  });

  it('should retrieve a user by ID', () => {
    let actual: ManagedUser | undefined;

    service.getById(userId).subscribe(result => {
      actual = result;
    });

    const request = httpMock.expectOne(
      `${apiUrl}/${userId}`
    );

    expect(request.request.method).toBe('GET');

    request.flush(user);

    expect(actual).toEqual(user);
  });

  it('should create a user with the selected role', () => {
    const body: CreateManagedUserRequest = {
      email: 'new@example.invalid',
      displayName: 'Nuevo usuario',
      password: 'OnlyForUnitTests123!',
      role: 'Supervisor',
      technicianId: null
    };

    let actual: ManagedUser | undefined;

    service.create(body).subscribe(result => {
      actual = result;
    });

    const request = httpMock.expectOne(apiUrl);

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(body);

    request.flush(user, {
      status: 201,
      statusText: 'Created'
    });

    expect(actual).toEqual(user);
    expect(actual).not.toHaveProperty('password');
  });

  it('should update the profile and role', () => {
    const body: UpdateManagedUserRequest = {
      displayName: 'Usuario actualizado',
      role: 'Administrator',
      technicianId: null
    };

    service.update(userId, body).subscribe(result => {
      expect(result.displayName).toBe('Usuario actualizado');
      expect(result.roles).toEqual(['Administrator']);
    });

    const request = httpMock.expectOne(
      `${apiUrl}/${userId}`
    );

    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(body);

    request.flush({
      ...user,
      displayName: body.displayName,
      roles: ['Administrator']
    });
  });

  it('should activate a user', () => {
    service.activate(userId).subscribe(result => {
      expect(result.isActive).toBe(true);
    });

    const request = httpMock.expectOne(
      `${apiUrl}/${userId}/activate`
    );

    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({});

    request.flush(user);
  });

  it('should deactivate a user', () => {
    service.deactivate(userId).subscribe(result => {
      expect(result.isActive).toBe(false);
    });

    const request = httpMock.expectOne(
      `${apiUrl}/${userId}/deactivate`
    );

    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({});

    request.flush({
      ...user,
      isActive: false
    });
  });

  it('should reset a password without returning it', () => {
    const body = {
      newPassword: 'AnotherTestOnly123!'
    };

    let completed = false;

    service.resetPassword(userId, body).subscribe(() => {
      completed = true;
    });

    const request = httpMock.expectOne(
      `${apiUrl}/${userId}/reset-password`
    );

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(body);

    request.flush(null, {
      status: 204,
      statusText: 'No Content'
    });

    expect(completed).toBe(true);
  });

  it('should propagate business conflicts', () => {
    let status: number | undefined;

    service.deactivate(userId).subscribe({
      error: (error: HttpErrorResponse) => {
        status = error.status;
      }
    });

    const request = httpMock.expectOne(
      `${apiUrl}/${userId}/deactivate`
    );

    request.flush(
      {
        title: 'User management operation rejected.'
      },
      {
        status: 409,
        statusText: 'Conflict'
      }
    );

    expect(status).toBe(409);
  });

  it('should propagate forbidden access', () => {
    let status: number | undefined;

    service.getAll().subscribe({
      error: (error: HttpErrorResponse) => {
        status = error.status;
      }
    });

    const request = httpMock.expectOne(apiUrl);

    request.flush(
      {
        title: 'Forbidden'
      },
      {
        status: 403,
        statusText: 'Forbidden'
      }
    );

    expect(status).toBe(403);
  });
});
