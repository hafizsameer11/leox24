/**
 * Types for the Opti Amazon / Vista Express read-only CRM API.
 *
 * Every figure arrives in EUR euros: the upstream API normalises the ads
 * subsystem (stored internally as integer cents) to euros at its boundary, so
 * no conversion is needed in the browser.
 */

export type VistaExpressResource =
  | 'overview'
  | 'users'
  | 'sellers'
  | 'products'
  | 'orders'
  | 'warehouse'
  | 'warehouse/products'
  | 'warehouse/orders'
  | 'ads'
  | 'leads';

/** Shape shared by every paginated list response. */
export interface VistaExpressPagination {
  page: number;
  per_page: number;
  total: number;
  last_page: number;
  from: number | null;
  to: number | null;
}

/* ------------------------------------------------------------------ */
/* Overview                                                            */
/* ------------------------------------------------------------------ */

export interface VistaExpressTotals {
  total_users: number;
  total_sellers: number;
  total_buyers: number;
  total_admins: number;
  total_stores: number;
  total_products: number;
  total_orders: number;
  paid_orders: number;
  total_revenue: number;
  order_revenue: number;
  ad_revenue: number;
  warehouse_revenue: number;
}

export interface VistaExpressRevenueSource {
  key: 'orders' | 'ads' | 'warehouse';
  label: string;
  value: number;
}

export interface VistaExpressRevenue {
  total: number;
  from_orders: number;
  from_ads: number;
  from_warehouse: number;
  sources: VistaExpressRevenueSource[];
  currency: string;
  in_window: number;
}

export interface VistaExpressChangeSet {
  users: number;
  sellers: number;
  buyers: number;
  products: number;
  orders: number;
  revenue: number;
}

export interface VistaExpressTrendPoint {
  month: string;
  label: string;
  order_revenue: number;
  ad_revenue: number;
  warehouse_revenue: number;
  total_revenue: number;
  orders: number;
  paid_orders: number;
  warehouse_orders: number;
}

export interface VistaExpressStatusCount {
  status: string;
  count: number;
}

export interface VistaExpressWarehouseStats {
  total_products: number;
  published_products: number;
  draft_products: number | null;
  total_stock: number;
  low_stock: number;
  out_of_stock: number;
  orders: number;
  revenue: number;
}

export interface VistaExpressBestSeller {
  product_id: number | null;
  name: string;
  sku: string;
  store_name: string;
  units_sold: number;
  revenue: number;
  order_count: number;
}

export interface VistaExpressActivity {
  kind: 'order' | 'warehouse' | 'campaign' | 'seller' | 'support';
  reference: string;
  actor: string | null;
  amount: number | null;
  currency: string;
  status: string;
  occurred_at: string;
}

export interface VistaExpressOperations {
  open_orders: number;
  pending_seller_approvals: number;
  pending_product_reviews: number;
  open_support_tickets: number;
}

export interface VistaExpressAdsSummary {
  campaigns: number;
  active_campaigns: number;
  budget: number;
  spent: number;
  remaining: number;
  attributed_revenue: number;
  impressions: number;
  clicks: number;
  ctr: number;
  conversions: number;
  roas: number;
  currency: string;
}

export interface VistaExpressOverview {
  generated_at: string;
  range: {
    months: number;
    period_start: string;
    window_from: string | null;
    window_to: string | null;
  };
  totals: VistaExpressTotals;
  revenue: VistaExpressRevenue;
  changes: VistaExpressChangeSet;
  revenue_trend: VistaExpressTrendPoint[];
  order_statuses: VistaExpressStatusCount[];
  warehouse: VistaExpressWarehouseStats;
  best_selling_products: VistaExpressBestSeller[];
  recent_activity: VistaExpressActivity[];
  operations: VistaExpressOperations;
  ads: VistaExpressAdsSummary;
}

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

export interface VistaExpressUser {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: 'buyer' | 'seller' | 'admin';
  is_blocked: boolean;
  email_verified: boolean;
  phone_verified: boolean;
  store: {
    id: number;
    name: string;
    status: string;
    onboarding_status: string;
  } | null;
  orders_count: number;
  paid_orders_count: number;
  lifetime_value: number;
  created_at: string | null;
  last_order_at: string | null;
}

export interface VistaExpressUsersSummary {
  buyers: number;
  sellers: number;
  admins: number;
  buyers_blocked: number;
  sellers_blocked: number;
  new_this_month: number;
  unverified_email: number;
}

export interface VistaExpressUsersResponse {
  rows: VistaExpressUser[];
  pagination: VistaExpressPagination;
  summary: VistaExpressUsersSummary;
  filter_options: { roles: string[]; statuses: string[] };
}

/* ------------------------------------------------------------------ */
/* Sellers                                                             */
/* ------------------------------------------------------------------ */

export interface VistaExpressSeller {
  id: number;
  name: string;
  slug: string;
  status: string;
  onboarding_status: string;
  is_active: boolean;
  onboarding_percent: number;
  owner: { id: number; name: string; email: string; is_blocked: boolean } | null;
  products_count: number;
  orders_count: number;
  paid_orders_count: number;
  revenue: number;
  currency: string;
  subscription: {
    id: number;
    status: string;
    plan: string | null;
    billing_period: string | null;
    price: number | null;
    start_date: string | null;
    end_date: string | null;
  } | null;
  created_at: string | null;
}

export interface VistaExpressSellersSummary {
  total_stores: number;
  active: number;
  pending_review: number;
  suspended: number;
  rejected: number;
  new_this_month: number;
  total_revenue: number;
}

export interface VistaExpressSellersResponse {
  rows: VistaExpressSeller[];
  pagination: VistaExpressPagination;
  summary: VistaExpressSellersSummary;
  filter_options: { statuses: string[]; onboarding_statuses: string[] };
}

/* ------------------------------------------------------------------ */
/* Products                                                            */
/* ------------------------------------------------------------------ */

export interface VistaExpressProduct {
  id: number;
  name: string;
  sku: string;
  product_type: string;
  price: number;
  compare_at_price: number | null;
  stock_quantity: number;
  stock_status: string;
  is_active: boolean;
  is_approved: boolean;
  is_muted: boolean;
  is_boosted: boolean;
  is_featured: boolean;
  store: { id: number; name: string } | null;
  category: string | null;
  views: number;
  rating: number | null;
  review_count: number;
  units_sold: number;
  revenue: number;
  currency: string;
  created_at: string | null;
}

export interface VistaExpressProductDetail extends VistaExpressProduct {
  slug: string;
  short_description: string | null;
  description: string | null;
  images: unknown;
  frame_shape: string | null;
  frame_material: string | null;
  frame_color: string | null;
  gender: string;
  lens_type: string | null;
  sub_category: string | null;
  rejection_reason: string | null;
  boost_budget: number | null;
  boost_start_at: string | null;
  boost_end_at: string | null;
}

export interface VistaExpressProductDetailResponse {
  product: VistaExpressProductDetail;
  variants: {
    id: number;
    color_name: string | null;
    color_code: string | null;
    price: number;
    stock_quantity: number;
    stock_status: string;
    is_default: boolean;
  }[];
  sales: { units_sold: number; revenue: number; line_items: number };
}

export interface VistaExpressProductsSummary {
  total: number;
  live: number;
  pending_review: number;
  inactive: number;
  muted: number;
  boosted: number;
  out_of_stock: number;
  catalogue_value: number;
}

export interface VistaExpressProductsResponse {
  rows: VistaExpressProduct[];
  pagination: VistaExpressPagination;
  summary: VistaExpressProductsSummary;
  filter_options: { types: string[]; statuses: string[] };
}

/* ------------------------------------------------------------------ */
/* Orders                                                              */
/* ------------------------------------------------------------------ */

export interface VistaExpressOrder {
  id: number;
  order_no: string;
  customer: { id: number; name: string; email: string } | null;
  payment_method: string;
  payment_status: string;
  items_total: number;
  shipping_total: number;
  platform_fee: number;
  discount_total: number;
  grand_total: number;
  currency: string;
  sellers_count: number;
  created_at: string | null;
}

export interface VistaExpressOrderItem {
  product_id: number | null;
  product_name: string;
  product_sku: string;
  quantity: number;
  price: number;
  line_total: number;
  lens_configuration: unknown;
  product_variant: unknown;
}

export interface VistaExpressStoreOrder {
  id: number;
  store: { id: number; name: string } | null;
  status: string;
  payment_status: string;
  subtotal: number;
  delivery_fee: number;
  discount_total: number;
  total: number;
  currency: string;
  delivery_method: string | null;
  estimated_delivery_date: string | null;
  delivered_at: string | null;
  rejection_reason: string | null;
  escrow: { amount: number; status: string } | null;
  items: VistaExpressOrderItem[];
}

export interface VistaExpressOrderDetail extends VistaExpressOrder {
  phone: string | null;
  delivery_address: {
    full_name: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    postal_code: string | null;
  } | null;
}

export interface VistaExpressOrderDetailResponse {
  order: VistaExpressOrderDetail;
  store_orders: VistaExpressStoreOrder[];
}

export interface VistaExpressOrdersSummary {
  total_orders: number;
  paid: number;
  pending: number;
  refunded: number;
  cancelled: number;
  gross_value: number;
  paid_value: number;
  average_order_value: number;
}

export interface VistaExpressOrdersResponse {
  rows: VistaExpressOrder[];
  pagination: VistaExpressPagination;
  summary: VistaExpressOrdersSummary;
  filter_options: { payment_statuses: string[]; payment_methods: string[] };
}

/* ------------------------------------------------------------------ */
/* Warehouse                                                           */
/* ------------------------------------------------------------------ */

export interface VistaExpressLowStock {
  id: number;
  name: string;
  sku: string;
  stock_quantity: number;
  low_stock_threshold: number;
}

export interface VistaExpressWarehouseTrendPoint {
  month: string;
  label: string;
  orders: number;
  revenue: number;
}

export interface VistaExpressWarehouseOverviewResponse {
  stats: VistaExpressWarehouseStats & { currency: string };
  low_stock: VistaExpressLowStock[];
  stock_by_category: Record<string, number>;
  orders_trend: VistaExpressWarehouseTrendPoint[];
  top_sellers: { seller_id: number; name: string; orders: number; spend: number }[];
}

export interface VistaExpressWarehouseProduct {
  id: number;
  name: string;
  sku: string;
  category: string | null;
  price: number;
  shipping_fee: number;
  stock_quantity: number;
  low_stock_threshold: number;
  availability: 'in_stock' | 'low_stock' | 'out_of_stock';
  is_active: boolean;
  created_at: string | null;
}

export interface VistaExpressWarehouseProductsResponse {
  rows: VistaExpressWarehouseProduct[];
  pagination: VistaExpressPagination;
  filter_options: {
    categories: { id: number; name: string; type: string }[];
    availabilities: string[];
  };
}

export interface VistaExpressWarehouseOrder {
  id: number;
  order_number: string;
  seller: { id: number; name: string; email: string } | null;
  status: string;
  payment_status: string;
  subtotal: number;
  shipping_fee: number;
  total: number;
  currency: string;
  items_count: number;
  tracking_number: string | null;
  shipping_carrier: string | null;
  created_at: string | null;
  delivered_at: string | null;
}

export interface VistaExpressWarehouseOrdersResponse {
  rows: VistaExpressWarehouseOrder[];
  pagination: VistaExpressPagination;
  filter_options: { statuses: string[]; payment_statuses: string[] };
}

/* ------------------------------------------------------------------ */
/* Ads                                                                */
/* ------------------------------------------------------------------ */

export interface VistaExpressAdCampaign {
  id: number;
  name: string;
  status: string;
  payment_status: string;
  seller: { id: number; name: string; email: string } | null;
  product: { id: number; name: string; sku: string } | null;
  budget: number;
  spent: number;
  remaining: number;
  attributed_revenue: number;
  currency: string;
  impressions: number;
  clicks: number;
  product_views: number;
  conversions: number;
  ctr: number;
  roas: number;
  locations: unknown;
  placements: unknown;
  starts_at: string | null;
  ends_at: string | null;
}

export interface VistaExpressAdsSummary {
  campaigns: number;
  active: number;
  paused: number;
  pending_review: number;
  total_budget: number;
  total_spent: number;
  total_remaining: number;
  attributed_revenue: number;
  impressions: number;
  clicks: number;
  ctr: number;
  average_cpc: number;
  product_views: number;
  add_to_carts: number;
  conversions: number;
  conversion_rate: number;
  roas: number;
  currency: string;
}

export interface VistaExpressAdsResponse {
  rows: VistaExpressAdCampaign[];
  pagination: VistaExpressPagination;
  summary: VistaExpressAdsSummary;
  filter_options: { statuses: string[]; payment_statuses: string[] };
}

/* ------------------------------------------------------------------ */
/* Leads                                                               */
/* ------------------------------------------------------------------ */

export type VistaExpressLeadSource = 'registration' | 'referral_click' | 'referral_conversion';

export interface VistaExpressLead {
  id: number | string;
  source: VistaExpressLeadSource;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  referrer?: string | null;
  referral_code?: string | null;
  campaign?: string | null;
  token_prefix?: string;
  is_blocked?: boolean;
  email_verified?: boolean;
  phone_verified?: boolean;
  status: string;
  converted: boolean;
  paid_orders?: number;
  lifetime_value?: number;
  currency?: string;
  created_at: string | null;
  last_order_at: string | null;
}

export interface VistaExpressLeadsSummary {
  total_buyers: number;
  total_sellers: number;
  new_buyers_this_month: number;
  new_sellers_this_month: number;
  unverified: number;
  buyer_conversion_rate: number;
  referral_clicks: number | null;
  referral_clicks_this_month: number | null;
  referral_conversions: number | null;
}

export interface VistaExpressLeadsResponse {
  rows: VistaExpressLead[];
  pagination: VistaExpressPagination;
  summary: VistaExpressLeadsSummary;
  filter_options: { sources: string[]; roles: string[]; statuses: string[] };
}
