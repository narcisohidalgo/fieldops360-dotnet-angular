import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import {
  Asset,
  CreateAssetRequest,
  UpdateAssetRequest
} from '../models/asset.model';

@Injectable({
  providedIn: 'root'
})
export class AssetService {
  private readonly http = inject(HttpClient);

  private readonly apiUrl = '/api/assets';

  getAll(): Observable<Asset[]> {
    return this.http.get<Asset[]>(this.apiUrl);
  }

  getById(id: string): Observable<Asset> {
    return this.http.get<Asset>(
      `${this.apiUrl}/${encodeURIComponent(id)}`
    );
  }

  getByFacilityId(facilityId: string): Observable<Asset[]> {
    return this.http.get<Asset[]>(this.apiUrl, {
      params: { facilityId }
    });
  }

  create(request: CreateAssetRequest): Observable<Asset> {
    return this.http.post<Asset>(
      this.apiUrl,
      request
    );
  }

  update(id: string, request: UpdateAssetRequest): Observable<void> {
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