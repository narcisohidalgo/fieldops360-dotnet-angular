import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-access-denied-page',
  imports: [RouterLink],
  template: `
    <section class="access-denied">
      <div class="panel">
        <p class="code">403 · ACCESO DENEGADO</p>
        <h1>No tienes permiso para acceder</h1>
        <p>
          Tu cuenta no dispone de los permisos necesarios
          para consultar esta sección de FieldOps 360.
        </p>
        <a routerLink="/">Volver al inicio</a>
      </div>
    </section>
  `,
  styles: [`
    :host {
      display: block;
    }

    .access-denied {
      display: flex;
      justify-content: center;
      padding: 5rem 1.5rem;
    }

    .panel {
      width: 100%;
      max-width: 520px;
      padding: 2.5rem;
      text-align: center;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      box-sizing: border-box;
    }

    .code {
      color: #b91c1c;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 1px;
    }

    h1 {
      color: #17253d;
      font-size: 26px;
    }

    .panel > p:not(.code) {
      color: #64748b;
      line-height: 1.7;
    }

    a {
      display: inline-block;
      margin-top: 1rem;
      padding: 0.8rem 1.25rem;
      border-radius: 8px;
      background: #2563eb;
      color: white;
      text-decoration: none;
      font-weight: 600;
    }
  `]
})
export class AccessDeniedPage {}
