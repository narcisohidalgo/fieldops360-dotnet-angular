export type FieldOpsRole =
  | 'Administrator'
  | 'Supervisor'
  | 'Technician';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  technicianId: string | null;
  roles: FieldOpsRole[];
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface CsrfTokenResponse {
  requestToken: string;
}
