export interface MyPetPlusSubscription {
  id: string | null;
  planName: string | null;
  planType: string | null;
  planPrice: number;
  currency: string;
  durationInDays: number | null;
  features: string[];
  status: 'ACTIVE' | 'EXPIRED';
  startDate: string | null;
  endDate: string | null;
}

export interface MyPetPlusSubscriptionRevenue {
  totalRevenue: number;
  totalPayments: number;
  veterinarianRevenue: number;
  pharmacyRevenue: number;
  currency: string;
}

export interface MyPetPlusLead {
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
  specializations: string[];
  veterinarian: {
    title: string | null;
    biography: string | null;
    experienceYears: number | null;
    isVerified: boolean;
    profileCompleted: boolean;
    isAvailableOnline: boolean;
    ratingAvg: number;
    ratingCount: number;
    clinic: {
      name: string | null;
      address: string | null;
      city: string | null;
      region: string | null;
      country: string | null;
      phone: string | null;
    } | null;
  } | null;
  business: {
    name: string | null;
    isActive: boolean;
    profileCompleted: boolean;
    isPublic: boolean;
  } | null;
  documentTypes: string[];
  subscription: MyPetPlusSubscription | null;
  createdAt: string;
  updatedAt: string;
}

export interface MyPetPlusLeadFilters {
  page?: number;
  limit?: number;
  search?: string;
  name?: string;
  email?: string;
  role?: string;
  status?: string;
  specialization?: string;
  city?: string;
  country?: string;
  area?: string;
  region?: string;
  documentType?: string;
}

export interface MyPetPlusLeadResponse {
  users: MyPetPlusLead[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filterOptions: {
    roles: string[];
    statuses: string[];
    specializations: string[];
    cities: string[];
    countries: string[];
    regions: string[];
    areas: string[];
    documentTypes: string[];
  };
  stats: {
    subscriptionRevenue: MyPetPlusSubscriptionRevenue;
  };
  generatedAt: string;
}
