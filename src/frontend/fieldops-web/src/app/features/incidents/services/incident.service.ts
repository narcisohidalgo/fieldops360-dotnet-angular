import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import {
  Incident,
  IncidentFilters,
  CreateIncidentRequest,
  UpdateIncidentRequest
} from '../models/incident.model';

@Injectable({
  providedIn: 'root'
})
export class IncidentService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/incidents';

  getAll(filters: IncidentFilters = {}): Observable<Incident[]> {
    let params = new HttpParams();

    if (filters.facilityId) {
      params = params.set('facilityId', filters.facilityId);
    }

    if (filters.assetId) {
      params = params.set('assetId', filters.assetId);
    }

    if (filters.status !== undefined) {
      params = params.set('status', String(filters.status));
    }

    if (filters.priority !== undefined) {
      params = params.set('priority', String(filters.priority));
    }

    return this.http.get<Incident[]>(this.apiUrl, { params });
  }

  getById(id: string): Observable<Incident> {
    return this.http.get<Incident>(
      `${this.apiUrl}/${encodeURIComponent(id)}`
    );
  }

  create(request: CreateIncidentRequest): Observable<Incident> {
    return this.http.post<Incident>(this.apiUrl, request);
  }

  update(
    id: string,
    request: UpdateIncidentRequest
  ): Observable<void> {
    return this.http.put<void>(
      `${this.apiUrl}/${encodeURIComponent(id)}`,
      request
    );
  }

  startProgress(id: string): Observable<void> {
    return this.changeStatus(id, 'start');
  }

  resolve(id: string): Observable<void> {
    return this.changeStatus(id, 'resolve');
  }

  close(id: string): Observable<void> {
    return this.changeStatus(id, 'close');
  }

  reopen(id: string): Observable<void> {
    return this.changeStatus(id, 'reopen');
  }

  private changeStatus(
    id: string,
    action: 'start' | 'resolve' | 'close' | 'reopen'
  ): Observable<void> {
    return this.http.patch<void>(
      `${this.apiUrl}/${encodeURIComponent(id)}/${action}`,
      {}
    );
  }
}
