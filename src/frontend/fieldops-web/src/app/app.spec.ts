import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { App } from './app';
import { routes } from './app.routes';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes)]
    }).compileComponents();
  });

  it('should create the application shell', () => {
    const fixture = TestBed.createComponent(App);

    fixture.detectChanges();

    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should register the technicians lazy-loaded route', () => {
    const route = routes.find(
      route => route.path === 'technicians'
    );

    expect(route).toBeDefined();
    expect(route?.title).toBe('Técnicos | FieldOps 360');
    expect(typeof route?.loadComponent).toBe('function');
  });

  it('should register the work orders lazy-loaded route', () => {
    const route = routes.find(
      route => route.path === 'work-orders'
    );

    expect(route).toBeDefined();
    expect(route?.title).toBe('Órdenes de trabajo | FieldOps 360');
    expect(typeof route?.loadComponent).toBe('function');
  });
  it('should display navigation links', () => {
    const fixture = TestBed.createComponent(App);

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    const links = compiled.querySelectorAll(
      '.primary-nav a'
    );

    expect(links.length).toBe(6);
    expect(links[0].getAttribute('href')).toBe('/');
    expect(links[1].getAttribute('href')).toBe('/facilities');
    expect(links[2].getAttribute('href')).toBe('/assets');
    expect(links[3].getAttribute('href')).toBe('/incidents');
    expect(links[4].getAttribute('href')).toBe('/technicians');
    expect(links[5].getAttribute('href')).toBe('/work-orders');
    expect(compiled.querySelector('router-outlet')).not.toBeNull();
  });
});
