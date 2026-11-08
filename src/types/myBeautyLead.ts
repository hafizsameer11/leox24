export interface MyBeautyBusiness {
  id?: string | null;
  slug?: string | null;
  name: string | null;
  category?: string | null;
  isActive: boolean;
  profileCompleted: boolean;
  isPublic: boolean;
  salonStatus?: string | null;
  city?: string | null;
}

export interface MyBeautyLead {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  status: string;
  registrationType: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  city: string | null;
  country: string | null;
  region: string | null;
  area: string | null;
  business?: MyBeautyBusiness | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string | null;
}

export interface MyBeautyLeadFilters {
  page?: number;
  limit?: number;
  search?: string;
  name?: string;
  email?: string;
  role?: string;
  status?: string;
  city?: string;
  country?: string;
}

export interface MyBeautyLeadResponse {
  users: MyBeautyLead[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filterOptions: {
    roles: string[];
    statuses: string[];
    cities: string[];
    countries: string[];
  };
  generatedAt: string;
}
