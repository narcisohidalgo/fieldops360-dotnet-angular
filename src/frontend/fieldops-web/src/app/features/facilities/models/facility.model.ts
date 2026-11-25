export interface Facility {
  id: string;
  code: string;
  name: string;
  city: string;
  address: string | null;
  isActive: boolean;
  latitude?: number | null;
  longitude?: number | null;
}

export interface CreateFacilityRequest {
  code: string;
  name: string;
  city: string;
  address: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface UpdateFacilityRequest {
  name: string;
  city: string;
  address: string | null;
  latitude?: number | null;
  longitude?: number | null;
}
