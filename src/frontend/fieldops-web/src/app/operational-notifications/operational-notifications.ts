import {
  Component,
  inject,
  input,
  output
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';

import {
  OperationalNotificationsService
} from '../core/services/operational-notifications.service';

@Component({
  selector: 'app-operational-notifications',
  imports: [DatePipe, RouterLink],
  templateUrl: './operational-notifications.html',
  styleUrl: './operational-notifications.scss'
})
export class OperationalNotifications {
  readonly notificationsOpen = input.required<boolean>();

  readonly toggled = output<void>();
  readonly closed = output<void>();
  readonly notificationSelected = output<number>();

  protected readonly notificationCenter =
    inject(OperationalNotificationsService);
}
