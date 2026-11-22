import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it
} from 'vitest';

import {
  Asset,
  CreateAssetRequest,
  UpdateAssetRequest
} from '../models/asset.model';

import { AssetService } from './asset.service';

describe('AssetService', () => {
  let service: AssetService;
  let httpMock: HttpTestingController;

  const facilityId = '00000000-0000-0000-0000-000000000001';
  const assetId = '00000000-0000-0000-0000-000000000002';

  const exampleAsset: Asset = {
    id: assetId,
    facilityId,
    code: 'EQ-001',
    name: 'Tractor agricola',
    description: 'Equipo de mantenimiento',
    isActive: true
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AssetService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });

    service = TestBed.inject(AssetService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should retrieve all assets using GET', () => {
    const expectedAssets: Asset[] = [exampleAsset];

    let actualAssets: Asset[] | undefined;

    service.getAll().subscribe(assets => {
      actualAssets = assets;
    });

    const request = httpMock.expectOne('/api/assets');

    expect(request.request.method).toBe('GET');

    request.flush(expectedAssets);

    expect(actualAssets).toEqual(expectedAssets);
  });

  it('should retrieve an asset by ID using GET', () => {
    let actualAsset: Asset | undefined;

    service.getById(assetId).subscribe(asset => {
      actualAsset = asset;
    });

    const request = httpMock.expectOne(
      `/api/assets/${assetId}`
    );

    expect(request.request.method).toBe('GET');

    request.flush(exampleAsset);

    expect(actualAsset).toEqual(exampleAsset);
  });

  it('should filter assets by facility ID using GET', () => {
    const expectedAssets: Asset[] = [exampleAsset];

    let actualAssets: Asset[] | undefined;

    service.getByFacilityId(facilityId).subscribe(assets => {
      actualAssets = assets;
    });

    const request = httpMock.expectOne(req =>
      req.url === '/api/assets' &&
      req.params.get('facilityId') === facilityId
    );

    expect(request.request.method).toBe('GET');

    request.flush(expectedAssets);

    expect(actualAssets).toEqual(expectedAssets);
  });

  it('should create an asset using POST', () => {
    const createRequest: CreateAssetRequest = {
      facilityId,
      code: 'EQ-001',
      name: 'Tractor agricola',
      description: 'Equipo de mantenimiento'
    };

    let createdAsset: Asset | undefined;

    service.create(createRequest).subscribe(asset => {
      createdAsset = asset;
    });

    const request = httpMock.expectOne('/api/assets');

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(createRequest);

    request.flush(exampleAsset, {
      status: 201,
      statusText: 'Created'
    });

    expect(createdAsset).toEqual(exampleAsset);
  });

  it('should update an asset using PUT', () => {
    const updateRequest: UpdateAssetRequest = {
      name: 'Tractor agricola actualizado',
      description: 'Equipo revisado'
    };

    let completed = false;

    service.update(assetId, updateRequest).subscribe({
      next: () => {
        completed = true;
      }
    });

    const request = httpMock.expectOne(
      `/api/assets/${assetId}`
    );

    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(updateRequest);

    request.flush(null, {
      status: 204,
      statusText: 'No Content'
    });

    expect(completed).toBe(true);
  });

  it('should activate an asset using PATCH', () => {
    let completed = false;

    service.activate(assetId).subscribe({
      next: () => {
        completed = true;
      }
    });

    const request = httpMock.expectOne(
      `/api/assets/${assetId}/activate`
    );

    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({});

    request.flush(null, {
      status: 204,
      statusText: 'No Content'
    });

    expect(completed).toBe(true);
  });

  it('should deactivate an asset using PATCH', () => {
    let completed = false;

    service.deactivate(assetId).subscribe({
      next: () => {
        completed = true;
      }
    });

    const request = httpMock.expectOne(
      `/api/assets/${assetId}/deactivate`
    );

    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({});

    request.flush(null, {
      status: 204,
      statusText: 'No Content'
    });

    expect(completed).toBe(true);
  });
});