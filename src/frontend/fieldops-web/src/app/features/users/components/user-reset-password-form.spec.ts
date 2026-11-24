import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ManagedUser } from '../models/managed-user.model';
import { UserResetPasswordForm } from './user-reset-password-form';

describe('UserResetPasswordForm', () => {
  let httpMock: HttpTestingController;

  const user: ManagedUser = {
    id: '00000000-0000-0000-0000-000000000101',
    displayName: 'Usuario de prueba',
    email: 'usuario@example.invalid',
    isActive: true,
    technicianId: null,
    roles: ['Supervisor']
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [UserResetPasswordForm],
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

  function setInput(
    element: HTMLInputElement,
    value: string
  ): void {
    element.value = value;
    element.dispatchEvent(new Event('input', {
      bubbles: true
    }));
  }

  it('should reject mismatched passwords', () => {
    const fixture = TestBed.createComponent(
      UserResetPasswordForm
    );

    fixture.componentRef.setInput('user', user);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    setInput(
      element.querySelector<HTMLInputElement>(
        '#reset-new-password'
      )!,
      'OnlyForUnitTests123!'
    );

    setInput(
      element.querySelector<HTMLInputElement>(
        '#reset-confirm-password'
      )!,
      'DifferentUnitTest123!'
    );

    element.querySelector<HTMLFormElement>('form')!
      .dispatchEvent(new Event('submit', {
        bubbles: true,
        cancelable: true
      }));

    fixture.detectChanges();

    expect(element.textContent).toContain(
      'Las contraseñas no coinciden'
    );

    httpMock.expectNone(
      `/api/users/${user.id}/reset-password`
    );
  });

  it('should submit a valid password and clear the fields', () => {
    const fixture = TestBed.createComponent(
      UserResetPasswordForm
    );

    fixture.componentRef.setInput('user', user);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const password = 'OnlyForUnitTests123!';

    setInput(
      element.querySelector<HTMLInputElement>(
        '#reset-new-password'
      )!,
      password
    );

    setInput(
      element.querySelector<HTMLInputElement>(
        '#reset-confirm-password'
      )!,
      password
    );

    element.querySelector<HTMLFormElement>('form')!
      .dispatchEvent(new Event('submit', {
        bubbles: true,
        cancelable: true
      }));

    const request = httpMock.expectOne(
      `/api/users/${user.id}/reset-password`
    );

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      newPassword: password
    });

    request.flush(null, {
      status: 204,
      statusText: 'No Content'
    });

    fixture.detectChanges();

    expect(
      element.querySelector<HTMLInputElement>(
        '#reset-new-password'
      )?.value
    ).toBe('');

    expect(
      element.querySelector<HTMLInputElement>(
        '#reset-confirm-password'
      )?.value
    ).toBe('');
  });
});
