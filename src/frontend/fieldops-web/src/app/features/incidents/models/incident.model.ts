export enum IncidentPriority {
  Low = 1,
  Medium = 2,
  High = 3,
  Critical = 4
}

export enum IncidentStatus {
  Open = 1,
  InProgress = 2,
  Resolved = 3,
  Closed = 4
}

export interface Incident {
  id: string;
  facilityId: string;
  assetId: string | null;
  title: string;
  description: string | null;
  priority: IncidentPriority;
  status: IncidentStatus;
  createdAtUtc: string;
  updatedAtUtc: string;
  resolvedAtUtc: string | null;
  closedAtUtc: string | null;
}

export interface IncidentFilters {
  facilityId?: string;
  assetId?: string;
  status?: IncidentStatus;
  priority?: IncidentPriority;
}

export interface CreateIncidentRequest {
  facilityId: string;
  assetId: string | null;
  title: string;
  description: string | null;
  priority: IncidentPriority;
}

export interface UpdateIncidentRequest {
  title: string;
  description: string | null;
  priority: IncidentPriority;
}
