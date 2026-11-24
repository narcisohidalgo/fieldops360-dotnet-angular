import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import {
  Technician,
  CreateTechnicianRequest,
  UpdateTechnicianRequest
} from '../models/technician.model';

@Injectable({
  providedIn: 'root'
})
export class TechnicianService {
  private readonly http = inject(HttpClient);

  private readonly apiUrl = '/api/technicians';

  getAll(): Observable<Technician[]> {
    return this.http.get<Technician[]>(this.apiUrl);
  }

  getById(id: string): Observable<Technician> {
    return this.http.get<Technician>(
      `${this.apiUrl}/${encodeURIComponent(id)}`
    );
  }

  create(request: CreateTechnicianRequest): Observable<Technician> {
    return this.http.post<Technician>(
      this.apiUrl,
      request
    );
  }

  update(
    id: string,
    request: UpdateTechnicianRequest
  ): Observable<void> {
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
