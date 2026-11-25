import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  TestRequest
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ManagedUser } from '../models/managed-user.model';
import { UserCreateForm } from './user-create-form';
import { UserEditForm } from './user-edit-form';
import { UserResetPasswordForm } from './user-reset-password-form';

describe('User forms security and validation', () => {
  let http: HttpTestingController;

  const password = 'OnlyForUnitTests123!';

  const user: ManagedUser = {
    id: '00000000-0000-0000-0000-000000000101',
    displayName: 'Test User',
    email: 'user@example.invalid',
    isActive: true,
    technicianId: null,
    roles: ['Supervisor']
  };

  const technician = {
    id: '00000000-0000-0000-0000-000000000201',
    code: 'TEC-201',
    name: 'Test Technician',
    email: 'technician@example.invalid',
    phone: null,
    specialty: null,
    isActive: true
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        UserCreateForm,
        UserEditForm,
        UserResetPasswordForm
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });

    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  function input(root: HTMLElement, id: string): HTMLInputElement {
    const element = root.querySelector<HTMLInputElement>(`#${id}`);
    expect(element).not.toBeNull();
    return element!;
  }

  function fill(root: HTMLElement, id: string, value: string): void {
    const element = input(root, id);
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function select(root: HTMLElement, id: string, value: string): void {
    const element = root.querySelector<HTMLSelectElement>(`#${id}`)!;
    expect(element).not.toBeNull();
    element.value = value;
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function submit(root: HTMLElement): void {
    root.querySelector<HTMLFormElement>('form')!
      .dispatchEvent(new Event('submit', {
        bubbles: true,
        cancelable: true
      }));
  }

  function cancel(root: HTMLElement): void {
    root.querySelector<HTMLButtonElement>(
      '.form-actions button[type="button"]'
    )!.click();
  }

  function submitButton(root: HTMLElement): HTMLButtonElement {
    return root.querySelector<HTMLButtonElement>(
      'button[type="submit"]'
    )!;
  }

  function fail(request: TestRequest, status: number): void {
    if (status === 0) {
      request.error(new ProgressEvent('error'));
    } else {
      request.flush(null, {
        status,
        statusText: 'Test error'
      });
    }
  }

  function createForm() {
    const fixture = TestBed.createComponent(UserCreateForm);
    fixture.componentRef.setInput('existingUsers', []);
    fixture.detectChanges();
    return fixture;
  }

  function fillCreate(root: HTMLElement): void {
    fill(root, 'user-create-name', '  Test User  ');
    fill(root, 'user-create-email', user.email);
    fill(root, 'user-create-password', password);
  }

  function editForm(target: ManagedUser = user) {
    const fixture = TestBed.createComponent(UserEditForm);
    fixture.componentRef.setInput('user', target);
    fixture.componentRef.setInput('existingUsers', [target]);
    fixture.detectChanges();
    return fixture;
  }

  function resetForm() {
    const fixture = TestBed.createComponent(UserResetPasswordForm);
    fixture.componentRef.setInput('user', user);
    fixture.detectChanges();
    return fixture;
  }

  function fillReset(root: HTMLElement, value = password): void {
    fill(root, 'reset-new-password', value);
    fill(root, 'reset-confirm-password', value);
  }

  // CREATE USER

  it.each([
    ['user-create-name', '   '],
    ['user-create-email', 'invalid-email'],
    ['user-create-password', 'weak']
  ])('rejects invalid create field %s', (id, value) => {
    const fixture = createForm();
    http.expectOne('/api/technicians').flush([]);

    const root = fixture.nativeElement as HTMLElement;

    fillCreate(root);
    fill(root, id, value);
    submit(root);
    fixture.detectChanges();

    expect(root.querySelector('.field-error')).not.toBeNull();
    http.expectNone('/api/users');
  });

  it('requires a valid technician before creating a Technician', () => {
    const fixture = createForm();
    http.expectOne('/api/technicians').flush([technician]);

    const root = fixture.nativeElement as HTMLElement;

    fillCreate(root);
    select(root, 'user-create-role', 'Technician');
    fixture.detectChanges();

    submit(root);
    fixture.detectChanges();

    expect(root.querySelector('.save-error')).not.toBeNull();
    http.expectNone('/api/users');

    select(root, 'user-create-technician', technician.id);
    submit(root);

    const request = http.expectOne('/api/users');

    expect(request.request.method).toBe('POST');
    expect(request.request.body.technicianId).toBe(technician.id);
    expect(request.request.body.role).toBe('Technician');

    request.flush({
      ...user,
      technicianId: technician.id,
      roles: ['Technician']
    });
  });

  it('retries a failed technician lookup', () => {
    const fixture = createForm();

    fail(http.expectOne('/api/technicians'), 503);

    const root = fixture.nativeElement as HTMLElement;

    select(root, 'user-create-role', 'Technician');
    fixture.detectChanges();

    expect(submitButton(root).disabled).toBe(true);

    root.querySelector<HTMLButtonElement>('.retry-button')!.click();

    http.expectOne('/api/technicians').flush([technician]);

    fixture.detectChanges();

    expect(submitButton(root).disabled).toBe(false);
    expect(root.querySelector('#user-create-technician')).not.toBeNull();
  });

  it('creates a user once and clears the password after success', () => {
    const fixture = createForm();
    http.expectOne('/api/technicians').flush([]);

    const created = vi.fn();
    fixture.componentInstance.created.subscribe(created);

    const root = fixture.nativeElement as HTMLElement;

    fillCreate(root);
    submit(root);
    fixture.detectChanges();

    expect(submitButton(root).disabled).toBe(true);

    const request = http.expectOne('/api/users');

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      displayName: 'Test User',
      email: user.email,
      password,
      role: 'Supervisor',
      technicianId: null
    });

    submit(root);
    http.expectNone('/api/users');

    request.flush(user, { status: 201, statusText: 'Created' });
    fixture.detectChanges();

    expect(created).toHaveBeenCalledExactlyOnceWith(user);
    expect(input(root, 'user-create-password').value).toBe('');
  });

  it.each([400, 401, 403, 409, 0, 500])(
    'clears the initial password after HTTP error %s',
    status => {
      const fixture = createForm();
      http.expectOne('/api/technicians').flush([]);

      const created = vi.fn();
      fixture.componentInstance.created.subscribe(created);

      const root = fixture.nativeElement as HTMLElement;

      fillCreate(root);
      submit(root);

      fail(http.expectOne('/api/users'), status);
      fixture.detectChanges();

      expect(input(root, 'user-create-password').value).toBe('');
      expect(input(root, 'user-create-password').disabled).toBe(false);
      expect(input(root, 'user-create-email').value).toBe(user.email);
      expect(root.querySelector('.save-error')).not.toBeNull();
      expect(created).not.toHaveBeenCalled();
    }
  );

  it('clears the initial password when cancelling', () => {
    const fixture = createForm();
    http.expectOne('/api/technicians').flush([]);

    const cancelled = vi.fn();
    fixture.componentInstance.cancelled.subscribe(cancelled);

    const root = fixture.nativeElement as HTMLElement;

    fillCreate(root);
    cancel(root);
    fixture.detectChanges();

    expect(input(root, 'user-create-password').value).toBe('');
    expect(cancelled).toHaveBeenCalledTimes(1);
    http.expectNone('/api/users');
  });

  // EDIT USER

  it('rejects an empty display name when editing', () => {
    const fixture = editForm();
    http.expectOne('/api/technicians').flush([]);

    const root = fixture.nativeElement as HTMLElement;

    fill(root, 'user-edit-name', '   ');
    submit(root);
    fixture.detectChanges();

    expect(root.querySelector('.field-error')).not.toBeNull();
    http.expectNone(`/api/users/${user.id}`);
  });

  it('rejects an inactive linked technician', () => {
    const target: ManagedUser = {
      ...user,
      technicianId: technician.id,
      roles: ['Technician']
    };

    const fixture = editForm(target);

    http.expectOne('/api/technicians').flush([
      { ...technician, isActive: false }
    ]);

    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;

    const unavailable = root.querySelector<HTMLOptionElement>(
      '#user-edit-technician option[disabled]'
    );

    expect(unavailable?.value).toBe(technician.id);
    expect(submitButton(root).disabled).toBe(true);

    submit(root);
    fixture.detectChanges();

    expect(root.querySelector('.save-error')).not.toBeNull();
    http.expectNone(`/api/users/${user.id}`);
  });

  it('updates the editable fields and prevents duplicate submission', () => {
    const fixture = editForm();
    http.expectOne('/api/technicians').flush([]);

    const updated = vi.fn();
    fixture.componentInstance.updated.subscribe(updated);

    const root = fixture.nativeElement as HTMLElement;

    fill(root, 'user-edit-name', '  Updated User  ');
    submit(root);
    fixture.detectChanges();

    const request = http.expectOne(`/api/users/${user.id}`);

    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({
      displayName: 'Updated User',
      role: 'Supervisor',
      technicianId: null
    });

    expect(submitButton(root).disabled).toBe(true);

    submit(root);
    http.expectNone(`/api/users/${user.id}`);

    const response = { ...user, displayName: 'Updated User' };

    request.flush(response);

    expect(updated).toHaveBeenCalledExactlyOnceWith(response);
  });

  it.each([400, 401, 403, 404, 409, 0, 500])(
    'restores the edit form after HTTP error %s',
    status => {
      const fixture = editForm();
      http.expectOne('/api/technicians').flush([]);

      const updated = vi.fn();
      fixture.componentInstance.updated.subscribe(updated);

      const root = fixture.nativeElement as HTMLElement;

      fill(root, 'user-edit-name', 'Updated User');
      submit(root);

      fail(http.expectOne(`/api/users/${user.id}`), status);
      fixture.detectChanges();

      expect(input(root, 'user-edit-name').disabled).toBe(false);
      expect(input(root, 'user-edit-name').value).toBe('Updated User');
      expect(input(root, 'user-edit-email').readOnly).toBe(true);
      expect(root.querySelector('.save-error')).not.toBeNull();
      expect(updated).not.toHaveBeenCalled();
    }
  );

  it('cancels editing without sending an update', () => {
    const fixture = editForm();
    http.expectOne('/api/technicians').flush([]);

    const cancelled = vi.fn();
    fixture.componentInstance.cancelled.subscribe(cancelled);

    const root = fixture.nativeElement as HTMLElement;

    cancel(root);

    expect(cancelled).toHaveBeenCalledTimes(1);
    http.expectNone(`/api/users/${user.id}`);
  });

  // RESET PASSWORD

  it.each(['weak', 'lowercaseonly123!'])(
    'rejects a password that fails complexity requirements',
    value => {
      const fixture = resetForm();
      const root = fixture.nativeElement as HTMLElement;

      fillReset(root, value);
      submit(root);
      fixture.detectChanges();

      expect(root.querySelector('.field-error')).not.toBeNull();
      http.expectNone(`/api/users/${user.id}/reset-password`);
    }
  );

  it('prevents duplicate password reset submissions', () => {
    const fixture = resetForm();

    const reset = vi.fn();
    fixture.componentInstance.passwordReset.subscribe(reset);

    const root = fixture.nativeElement as HTMLElement;

    fillReset(root);
    submit(root);
    fixture.detectChanges();

    const request = http.expectOne(
      `/api/users/${user.id}/reset-password`
    );

    expect(submitButton(root).disabled).toBe(true);

    submit(root);
    http.expectNone(`/api/users/${user.id}/reset-password`);

    request.flush(null, {
      status: 204,
      statusText: 'No Content'
    });

    fixture.detectChanges();

    expect(reset).toHaveBeenCalledExactlyOnceWith(user);
    expect(input(root, 'reset-new-password').value).toBe('');
    expect(input(root, 'reset-confirm-password').value).toBe('');
  });

  it.each([400, 401, 403, 404, 409, 0, 500])(
    'clears both password fields after HTTP error %s',
    status => {
      const fixture = resetForm();

      const reset = vi.fn();
      fixture.componentInstance.passwordReset.subscribe(reset);

      const root = fixture.nativeElement as HTMLElement;

      fillReset(root);
      submit(root);

      fail(
        http.expectOne(`/api/users/${user.id}/reset-password`),
        status
      );

      fixture.detectChanges();

      expect(input(root, 'reset-new-password').value).toBe('');
      expect(input(root, 'reset-confirm-password').value).toBe('');
      expect(input(root, 'reset-new-password').disabled).toBe(false);
      expect(input(root, 'reset-confirm-password').disabled).toBe(false);
      expect(root.querySelector('.save-error')).not.toBeNull();
      expect(reset).not.toHaveBeenCalled();
    }
  );

  it('clears both passwords when cancelling a reset', () => {
    const fixture = resetForm();

    const cancelled = vi.fn();
    fixture.componentInstance.cancelled.subscribe(cancelled);

    const root = fixture.nativeElement as HTMLElement;

    fillReset(root);
    cancel(root);
    fixture.detectChanges();

    expect(input(root, 'reset-new-password').value).toBe('');
    expect(input(root, 'reset-confirm-password').value).toBe('');
    expect(cancelled).toHaveBeenCalledTimes(1);

    http.expectNone(`/api/users/${user.id}/reset-password`);
  });
});
