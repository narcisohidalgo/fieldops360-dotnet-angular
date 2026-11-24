export interface Technician {
  id: string;
  code: string;
  name: string;
  email: string;
  phone: string | null;
  specialty: string | null;
  isActive: boolean;
}

export interface CreateTechnicianRequest {
  code: string;
  name: string;
  email: string;
  phone: string | null;
  specialty: string | null;
}

export interface UpdateTechnicianRequest {
  name: string;
  email: string;
  phone: string | null;
  specialty: string | null;
}
