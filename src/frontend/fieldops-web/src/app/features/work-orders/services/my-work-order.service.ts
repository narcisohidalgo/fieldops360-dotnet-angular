import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { WorkOrder } from '../models/work-order.model';

@Injectable({
  providedIn: 'root'
})
export class MyWorkOrderService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/my/work-orders';

  getAll(): Observable<WorkOrder[]> {
    return this.http.get<WorkOrder[]>(this.apiUrl);
  }

  getById(id: string): Observable<WorkOrder> {
    return this.http.get<WorkOrder>(this.orderUrl(id));
  }

  start(id: string): Observable<void> {
    return this.http.patch<void>(
      `${this.orderUrl(id)}/start`,
      {}
    );
  }

  complete(id: string): Observable<void> {
    return this.http.patch<void>(
      `${this.orderUrl(id)}/complete`,
      {}
    );
  }

  private orderUrl(id: string): string {
    return `${this.apiUrl}/${encodeURIComponent(id)}`;
  }
}
