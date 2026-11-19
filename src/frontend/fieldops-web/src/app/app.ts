import { Component, DestroyRef, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { SystemStatus } from './core/models/system-status';
import { SystemService } from './core/services/system.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly title = signal('FieldOps 360');

  protected readonly apiStatus = signal<SystemStatus | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);

  private readonly systemService = inject(SystemService);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.systemService.getStatus()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (status) => {
          this.apiStatus.set(status);
          this.isLoading.set(false);
        },
        error: () => {
          this.errorMessage.set('No se pudo conectar con la API .NET.');
          this.isLoading.set(false);
        }
      });
  }
}
