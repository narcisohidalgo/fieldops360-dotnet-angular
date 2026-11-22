export interface Facility {
  id: string;
  code: string;
  name: string;
  city: string;
  address: string | null;
  isActive: boolean;
}

export interface CreateFacilityRequest {
  code: string;
  name: string;
  city: string;
  address: string | null;
}

export interface UpdateFacilityRequest {
  name: string;
  city: string;
  address: string | null;
}
