export interface DashboardEntityCounts {
  total: number;
  active: number;
}

export interface DashboardIncidentCounts {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
}

export interface DashboardWorkOrderCounts {
  total: number;
  planned: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  overdue: number;
  unassignedPlanned: number;
}

export interface DashboardSummary {
  facilities: DashboardEntityCounts;
  assets: DashboardEntityCounts;
  technicians: DashboardEntityCounts;
  incidents: DashboardIncidentCounts;
  workOrders: DashboardWorkOrderCounts;
  generatedAtUtc: string;
}