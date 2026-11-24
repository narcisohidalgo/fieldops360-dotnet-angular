export enum WorkOrderPriority {
  Low = 1,
  Medium = 2,
  High = 3,
  Critical = 4
}

export enum WorkOrderStatus {
  Planned = 1,
  InProgress = 2,
  Completed = 3,
  Cancelled = 4
}

export interface WorkOrder {
  id: string;
  facilityId: string;
  assetId: string | null;
  incidentId: string | null;
  technicianId: string | null;

  code: string;
  title: string;
  description: string | null;

  priority: WorkOrderPriority;
  status: WorkOrderStatus;

  scheduledStartUtc: string | null;
  dueAtUtc: string | null;

  createdAtUtc: string;
  updatedAtUtc: string;
  startedAtUtc: string | null;
  completedAtUtc: string | null;
  cancelledAtUtc: string | null;

  cancellationReason: string | null;
}

export interface WorkOrderFilters {
  facilityId?: string;
  assetId?: string;
  incidentId?: string;
  technicianId?: string;
  status?: WorkOrderStatus;
  priority?: WorkOrderPriority;
}

export interface CreateWorkOrderRequest {
  facilityId: string;
  assetId: string | null;
  incidentId: string | null;
  technicianId: string | null;

  code: string;
  title: string;
  description: string | null;
  priority: WorkOrderPriority;

  scheduledStartUtc: string | null;
  dueAtUtc: string | null;
}

export interface UpdateWorkOrderRequest {
  title: string;
  description: string | null;
  priority: WorkOrderPriority;

  scheduledStartUtc: string | null;
  dueAtUtc: string | null;
}
