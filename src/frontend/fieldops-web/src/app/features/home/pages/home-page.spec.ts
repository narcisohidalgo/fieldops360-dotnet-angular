import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { HomePage } from './home-page';
import { SystemStatus } from '../../../core/models/system-status';

describe('HomePage', () => {
  let httpTesting: HttpTestingController;

  const mockStatus: SystemStatus = {
    application: 'FieldOps 360',
    status: 'online',
    framework: '.NET 10',
    timestampUtc: '2026-11-19T15:44:44Z'
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomePage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    }).compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(HomePage);

    expect(fixture.componentInstance).toBeTruthy();

    httpTesting.expectOne('/api/system/status').flush(mockStatus);
  });

  it('should display the loading state', () => {
    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('[role="status"]')?.textContent)
      .toContain('Conectando con la API .NET...');

    httpTesting.expectOne('/api/system/status').flush(mockStatus);
  });

  it('should display backend data after successful response', () => {
    const fixture = TestBed.createComponent(HomePage);

    httpTesting.expectOne('/api/system/status').flush(mockStatus);

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('h1')?.textContent?.trim())
      .toBe('FieldOps 360');

    expect(compiled.querySelector('.api-details')?.textContent)
      .toContain('online');

    expect(compiled.querySelector('.api-details')?.textContent)
      .toContain('.NET 10');
  });

  it('should display an error when the API is unavailable', () => {
    const fixture = TestBed.createComponent(HomePage);

    httpTesting.expectOne('/api/system/status').flush(
      { message: 'Service unavailable' },
      { status: 503, statusText: 'Service Unavailable' }
    );

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('[role="alert"]')?.textContent)
      .toContain('No se pudo conectar con la API .NET.');
  });
});
