import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import {
  WorkOrder,
  WorkOrderFilters,
  CreateWorkOrderRequest,
  UpdateWorkOrderRequest
} from '../models/work-order.model';

@Injectable({
  providedIn: 'root'
})
export class WorkOrderService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/work-orders';

  getAll(filters: WorkOrderFilters = {}): Observable<WorkOrder[]> {
    let params = new HttpParams();

    if (filters.facilityId) {
      params = params.set('facilityId', filters.facilityId);
    }

    if (filters.assetId) {
      params = params.set('assetId', filters.assetId);
    }

    if (filters.incidentId) {
      params = params.set('incidentId', filters.incidentId);
    }

    if (filters.technicianId) {
      params = params.set('technicianId', filters.technicianId);
    }

    if (filters.status !== undefined) {
      params = params.set('status', String(filters.status));
    }

    if (filters.priority !== undefined) {
      params = params.set('priority', String(filters.priority));
    }

    return this.http.get<WorkOrder[]>(this.apiUrl, { params });
  }

  getById(id: string): Observable<WorkOrder> {
    return this.http.get<WorkOrder>(this.orderUrl(id));
  }

  create(request: CreateWorkOrderRequest): Observable<WorkOrder> {
    return this.http.post<WorkOrder>(this.apiUrl, request);
  }

  update(
    id: string,
    request: UpdateWorkOrderRequest
  ): Observable<void> {
    return this.http.put<void>(this.orderUrl(id), request);
  }

  assignTechnician(
    id: string,
    technicianId: string | null
  ): Observable<void> {
    return this.http.patch<void>(
      `${this.orderUrl(id)}/assign-technician`,
      { technicianId }
    );
  }

  start(id: string): Observable<void> {
    return this.changeStatus(id, 'start');
  }

  complete(id: string): Observable<void> {
    return this.changeStatus(id, 'complete');
  }

  cancel(id: string, reason: string): Observable<void> {
    return this.http.patch<void>(
      `${this.orderUrl(id)}/cancel`,
      { reason }
    );
  }

  private changeStatus(
    id: string,
    action: 'start' | 'complete'
  ): Observable<void> {
    return this.http.patch<void>(
      `${this.orderUrl(id)}/${action}`,
      {}
    );
  }

  private orderUrl(id: string): string {
    return `${this.apiUrl}/${encodeURIComponent(id)}`;
  }
}
