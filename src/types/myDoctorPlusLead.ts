export type MyDoctorRole = 'ADMIN' | 'DOCTOR' | 'PATIENT' | 'PHARMACY' | 'PARAPHARMACY';
export type MyDoctorSubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'NOT_SUBSCRIBED';

export interface MyDoctorSubscriptionPlan {
  id: string | null;
  name: string | null;
  targetRole: string | null;
  price: number;
  currency: string;
  durationInDays: number | null;
  features: string[];
  status: string | null;
}

export interface MyDoctorSubscription {
  id: string | null;
  plan: MyDoctorSubscriptionPlan | null;
  status: MyDoctorSubscriptionStatus;
  startDate: string | null;
  endDate: string | null;
  transactionId: string | null;
  createdAt: string | null;
}

export interface MyDoctorPayment {
  id: string;
  amount: number;
  currency: string;
  status: string | null;
  provider: string | null;
  reference: string | null;
  type: 'SUBSCRIPTION' | 'ORDER' | 'APPOINTMENT' | 'PRODUCT' | 'OTHER';
  createdAt: string | null;
}

export interface MyDoctorProduct {
  id: string;
  name: string | null;
  sku: string | null;
  sellerType: string | null;
  category: string | null;
  subCategory: string | null;
  price: number;
  discountPrice: number | null;
  stock: number | null;
  lowStockThreshold: number;
  lowStockAlertActive: boolean;
  image: string | null;
  isActive: boolean;
  createdAt: string | null;
  variants: Array<{ id: string; name: string | null; sku: string | null; price: number; stock: number; isActive: boolean }>;
}

export interface MyDoctorLead {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: MyDoctorRole;
  status: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  profileImage: string | null;
  address: { line1: string | null; line2: string | null; city: string | null; region: string | null; country: string | null; zip: string | null };
  doctor: null | {
    title: string | null;
    biography: string | null;
    specialization: string | null;
    experienceYears: number | null;
    isVerified: boolean;
    profileCompleted: boolean;
    isAvailableOnline: boolean;
    ratingAvg: number;
    ratingCount: number;
    consultationFees: { clinic: number | null; online: number | null };
    services: Array<{ name: string | null; price: number | null }>;
    clinics: Array<{ name: string | null; city: string | null; region: string | null; country: string | null; phone: string | null }>;
  };
  pharmacy: null | {
    kind: string | null;
    name: string | null;
    phone: string | null;
    isActive: boolean;
    address: { line1: string | null; line2: string | null; city: string | null; region: string | null; country: string | null; zip: string | null };
    logo: string | null;
  };
  subscription: MyDoctorSubscription | null;
  subscriptionHistory: MyDoctorSubscription[];
  payments: MyDoctorPayment[];
  products: MyDoctorProduct[];
  operations: {
    appointments: { total: number; confirmed: number; completed: number } | null;
    orders: { total: number; paid: number; paidRevenue: number } | null;
    products: { total: number; active: number; lowStock: number };
  };
  createdAt: string;
  updatedAt: string;
}

export interface MyDoctorLeadFilters {
  page?: number;
  limit?: number;
  search?: string;
  name?: string;
  email?: string;
  role?: string;
  status?: string;
  city?: string;
  country?: string;
  region?: string;
  area?: string;
  subscriptionPlan?: string;
  subscriptionStatus?: string;
  paymentStatus?: string;
  fromDate?: string;
  toDate?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'name' | 'role' | 'status';
  sortDirection?: 'asc' | 'desc';
}

export interface MyDoctorLeadResponse {
  users: MyDoctorLead[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  filterOptions: {
    roles: string[];
    statuses: string[];
    cities: string[];
    countries: string[];
    regions: string[];
    areas: string[];
    subscriptionPlans: string[];
    subscriptionStatuses: string[];
    paymentStatuses: string[];
  };
  stats: {
    registrations: number;
    roleCounts: Record<MyDoctorRole, number>;
    subscriptionCounts: Record<MyDoctorSubscriptionStatus, number>;
    payments: {
      successful: number;
      revenue: { total: number; subscriptions: number; orders: number; appointments: number; other: number; currency: string };
    };
    products: { total: number; lowStock: number };
    orders: { total: number; paidRevenue: number };
  };
  generatedAt: string;
}
