export interface Asset {
  id: string;
  facilityId: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

export interface CreateAssetRequest {
  facilityId: string;
  code: string;
  name: string;
  description: string | null;
}

export interface UpdateAssetRequest {
  name: string;
  description: string | null;
}