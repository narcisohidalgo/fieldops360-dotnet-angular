import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import {
  Facility,
  CreateFacilityRequest,
  UpdateFacilityRequest
} from '../models/facility.model';

@Injectable({
  providedIn: 'root'
})
export class FacilityService {
  private readonly http = inject(HttpClient);

  private readonly apiUrl = '/api/facilities';

  getAll(): Observable<Facility[]> {
    return this.http.get<Facility[]>(this.apiUrl);
  }

  getById(id: string): Observable<Facility> {
    return this.http.get<Facility>(
      `${this.apiUrl}/${encodeURIComponent(id)}`
    );
  }

  create(request: CreateFacilityRequest): Observable<Facility> {
    return this.http.post<Facility>(
      this.apiUrl,
      request
    );
  }

  update(id: string, request: UpdateFacilityRequest): Observable<void> {
    return this.http.put<void>(
      `${this.apiUrl}/${encodeURIComponent(id)}`,
      request
    );
  }

  activate(id: string): Observable<void> {
    return this.http.patch<void>(
      `${this.apiUrl}/${encodeURIComponent(id)}/activate`,
      {}
    );
  }
  deactivate(id: string): Observable<void> {
    return this.http.patch<void>(
      `${this.apiUrl}/${encodeURIComponent(id)}/deactivate`,
      {}
    );
  }
}
