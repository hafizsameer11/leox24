import api from './api';
import type {
  VistaExpressAdsResponse,
  VistaExpressLeadsResponse,
  VistaExpressOrderDetailResponse,
  VistaExpressOrdersResponse,
  VistaExpressOverview,
  VistaExpressProductDetailResponse,
  VistaExpressProductsResponse,
  VistaExpressResource,
  VistaExpressSellersResponse,
  VistaExpressUsersResponse,
  VistaExpressWarehouseOrdersResponse,
  VistaExpressWarehouseOverviewResponse,
  VistaExpressWarehouseProductsResponse,
} from '../types/vistaExpress';

/**
 * The CRM backend proxies every one of these calls through the configured
 * Vista Express project, using the project's own API settings server-side.
 * The external project's read-only key is never sent to the browser — the same
 * arrangement used by the MyPet Plus integration.
 */

type Filters = Record<string, string | number | boolean | null | undefined>;

function get<T>(projectId: number, resource: VistaExpressResource, filters: Filters = {}): Promise<T> {
  return api.get<T>(`/projects/${projectId}/vista-express/${resource}`, { params: filters }).then((r) => r.data);
}

function getOne<T>(projectId: number, resource: 'products' | 'orders', id: number): Promise<T> {
  return api.get<T>(`/projects/${projectId}/vista-express/${resource}/${id}`).then((r) => r.data);
}

/** Aggregated totals, the three revenue sources, trends and operations. */
export const fetchVistaExpressOverview = (projectId: number, months = 12) =>
  get<VistaExpressOverview>(projectId, 'overview', { months });

/** Buyers, sellers and administrators. */
export const fetchVistaExpressUsers = (projectId: number, filters: Filters = {}) =>
  get<VistaExpressUsersResponse>(projectId, 'users', filters);

/** Seller stores with per-seller revenue and subscription state. */
export const fetchVistaExpressSellers = (projectId: number, filters: Filters = {}) =>
  get<VistaExpressSellersResponse>(projectId, 'sellers', filters);

/** Product catalogue with aggregated sales figures. */
export const fetchVistaExpressProducts = (projectId: number, filters: Filters = {}) =>
  get<VistaExpressProductsResponse>(projectId, 'products', filters);

export const fetchVistaExpressProduct = (projectId: number, id: number) =>
  getOne<VistaExpressProductDetailResponse>(projectId, 'products', id);

/** Buyer orders. */
export const fetchVistaExpressOrders = (projectId: number, filters: Filters = {}) =>
  get<VistaExpressOrdersResponse>(projectId, 'orders', filters);

export const fetchVistaExpressOrder = (projectId: number, id: number) =>
  getOne<VistaExpressOrderDetailResponse>(projectId, 'orders', id);

/** Warehouse stock, low-stock alerts, purchases and revenue. */
export const fetchVistaExpressWarehouse = (projectId: number) =>
  get<VistaExpressWarehouseOverviewResponse>(projectId, 'warehouse');

export const fetchVistaExpressWarehouseProducts = (projectId: number, filters: Filters = {}) =>
  get<VistaExpressWarehouseProductsResponse>(projectId, 'warehouse/products', filters);

export const fetchVistaExpressWarehouseOrders = (projectId: number, filters: Filters = {}) =>
  get<VistaExpressWarehouseOrdersResponse>(projectId, 'warehouse/orders', filters);

/** Boost ad spend and performance, in EUR. */
export const fetchVistaExpressAds = (projectId: number, filters: Filters = {}) =>
  get<VistaExpressAdsResponse>(projectId, 'ads', filters);

/** Derived lead register: registrations plus the referral funnel. */
export const fetchVistaExpressLeads = (projectId: number, filters: Filters = {}) =>
  get<VistaExpressLeadsResponse>(projectId, 'leads', filters);
