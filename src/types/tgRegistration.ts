export type TgUserRole =
  | 'ADVERTISER'
  | 'PROLOCO'
  | 'EDITOR'
  | 'USER'
  | 'ADMIN'
  | 'SUPER_ADMIN';

export interface TgRegistrationUser {
  id: string;
  email: string;
  name: string;
  role: TgUserRole;
  isActive: boolean;
  emailVerified: boolean;
  companyName: string | null;
  advertiserStatus: string | null;
  advertiserPurchasedPackage: string | null;
  advertiserPackageConfirmedAt: string | null;
  prolocoCity: string | null;
  prolocoName: string | null;
  prolocoCode: string | null;
  prolocoStatus: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TgRegistrationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TgRegistrationResponse {
  success: boolean;
  message: string;
  data: {
    users: TgRegistrationUser[];
    meta: TgRegistrationMeta;
  };
}
