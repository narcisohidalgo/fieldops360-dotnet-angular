import type { FieldOpsRole } from '../../../core/models/auth-user';

/**
 * Datos administrables de una cuenta.
 * Nunca contiene contrasenas ni hashes.
 */
export interface ManagedUser {
  id: string;
  email: string;
  displayName: string;
  isActive: boolean;
  technicianId: string | null;
  roles: FieldOpsRole[];
}

export interface CreateManagedUserRequest {
  email: string;
  displayName: string;
  password: string;
  role: FieldOpsRole;
  technicianId: string | null;
}

export interface UpdateManagedUserRequest {
  displayName: string;
  role: FieldOpsRole;
  technicianId: string | null;
}

export interface ResetManagedUserPasswordRequest {
  newPassword: string;
}

export const managedUserRoles: readonly FieldOpsRole[] = [
  'Administrator',
  'Supervisor',
  'Technician'
];
