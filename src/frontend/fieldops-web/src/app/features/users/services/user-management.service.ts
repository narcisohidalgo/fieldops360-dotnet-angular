import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import {
  CreateManagedUserRequest,
  ManagedUser,
  ResetManagedUserPasswordRequest,
  UpdateManagedUserRequest
} from '../models/managed-user.model';

@Injectable({
  providedIn: 'root'
})
export class UserManagementService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/users';

  getAll(): Observable<ManagedUser[]> {
    return this.http.get<ManagedUser[]>(this.apiUrl);
  }

  getById(id: string): Observable<ManagedUser> {
    return this.http.get<ManagedUser>(
      this.userUrl(id)
    );
  }

  create(
    request: CreateManagedUserRequest
  ): Observable<ManagedUser> {
    return this.http.post<ManagedUser>(
      this.apiUrl,
      request
    );
  }

  update(
    id: string,
    request: UpdateManagedUserRequest
  ): Observable<ManagedUser> {
    return this.http.put<ManagedUser>(
      this.userUrl(id),
      request
    );
  }

  activate(id: string): Observable<ManagedUser> {
    return this.http.patch<ManagedUser>(
      `${this.userUrl(id)}/activate`,
      {}
    );
  }

  deactivate(id: string): Observable<ManagedUser> {
    return this.http.patch<ManagedUser>(
      `${this.userUrl(id)}/deactivate`,
      {}
    );
  }

  resetPassword(
    id: string,
    request: ResetManagedUserPasswordRequest
  ): Observable<void> {
    return this.http.post<void>(
      `${this.userUrl(id)}/reset-password`,
      request
    );
  }

  private userUrl(id: string): string {
    return `${this.apiUrl}/${encodeURIComponent(id)}`;
  }
}
