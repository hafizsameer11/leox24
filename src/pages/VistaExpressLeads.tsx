import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Topbar from '../components/layout/Topbar';
import Modal from '../components/ui/Modal';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import api from '../services/api';
import {
  fetchVistaExpressAds,
  fetchVistaExpressLeads,
  fetchVistaExpressOrder,
  fetchVistaExpressOrders,
  fetchVistaExpressOverview,
  fetchVistaExpressProduct,
  fetchVistaExpressProducts,
  fetchVistaExpressSellers,
  fetchVistaExpressUsers,
  fetchVistaExpressWarehouse,
  fetchVistaExpressWarehouseOrders,
  fetchVistaExpressWarehouseProducts,
} from '../services/vistaExpressApi';
import type {
  VistaExpressAdCampaign,
  VistaExpressLead,
  VistaExpressOrder,
  VistaExpressOverview,
  VistaExpressPagination,
  VistaExpressProduct,
  VistaExpressSeller,
  VistaExpressUser,
  VistaExpressWarehouseOrder,
  VistaExpressWarehouseProduct,
} from '../types/vistaExpress';
import type { Project } from '../types/project.types';

const PROJECT_SLUG = 'vista-express';

type TabKey = 'overview' | 'leads' | 'users' | 'sellers' | 'products' | 'orders' | 'warehouse' | 'ads';

type Filters = Record<string, string>;

/**
 * Summary blocks are server-shaped interfaces rather than plain records, so
 * they are normalised to a flat map once at the point they are stored.
 */
type SummaryRecord = Record<string, number | null | undefined>;

const toSummary = (value: object): SummaryRecord => value as SummaryRecord;

/** Quiet period before a typed search is committed and sent to the API. */
const SEARCH_DEBOUNCE_MS = 400;

/**
 * Pull the CRM's upstream error message out of an axios rejection, so the user
 * sees why a specific panel failed rather than a generic string.
 */
function messageFor(error: unknown): string {
  const candidate = error as { response?: { data?: { message?: string } }; message?: string };
  return candidate?.response?.data?.message || candidate?.message || String(error);
}

const EMPTY_FILTERS: Filters = {
  search: '',
  status: '',
  from: '',
  to: '',
  page: '1',
  per_page: '25',
};

const EMPTY_PAGINATION: VistaExpressPagination = {
  page: 1,
  per_page: 25,
  total: 0,
  last_page: 1,
  from: null,
  to: null,
};

/* ------------------------------------------------------------------ */
/* Formatting helpers                                                  */
/* ------------------------------------------------------------------ */

function formatDate(value?: string | null, fallback = '—'): string {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? fallback
    : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
}

function formatDateTime(value?: string | null, fallback = '—'): string {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? fallback
    : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function money(value?: number | null): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function number(value?: number | null): string {
  return new Intl.NumberFormat().format(Number(value || 0));
}

function percent(value?: number | null): string {
  return `${Number(value || 0).toFixed(1)}%`;
}

const text = (value?: string | null, fallback = '—') => String(value || '').trim() || fallback;

function titleize(value?: string | null): string {
  return text(value).replace(/[_-]+/g, ' ');
}

export default function VistaExpressLeads() {
  const { t } = useTranslation();

  const [projectId, setProjectId] = useState<number | null>(null);
  const [projectError, setProjectError] = useState<string | null>(null);

  const [tab, setTab] = useState<TabKey>('overview');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [rangeMonths, setRangeMonths] = useState(12);

  const [overview, setOverview] = useState<VistaExpressOverview | null>(null);
  const [warehouse, setWarehouse] = useState<VistaExpressOverview['warehouse'] | null>(null);
  const [lowStock, setLowStock] = useState<{ id: number; name: string; sku: string; stock_quantity: number; low_stock_threshold: number }[]>([]);
  const [stockByCategory, setStockByCategory] = useState<Record<string, number>>({});
  const [warehouseTrend, setWarehouseTrend] = useState<{ month: string; label: string; orders: number; revenue: number }[]>([]);

  const [users, setUsers] = useState<VistaExpressUser[]>([]);
  const [sellers, setSellers] = useState<VistaExpressSeller[]>([]);
  const [products, setProducts] = useState<VistaExpressProduct[]>([]);
  const [orders, setOrders] = useState<VistaExpressOrder[]>([]);
  const [ads, setAds] = useState<VistaExpressAdCampaign[]>([]);
  const [leads, setLeads] = useState<VistaExpressLead[]>([]);
  const [warehouseProducts, setWarehouseProducts] = useState<VistaExpressWarehouseProduct[]>([]);
  const [warehouseOrders, setWarehouseOrders] = useState<VistaExpressWarehouseOrder[]>([]);

  const [summaries, setSummaries] = useState<Record<string, SummaryRecord>>({});
  const [pagination, setPagination] = useState<VistaExpressPagination>(EMPTY_PAGINATION);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  // The search box is uncontrolled by `filters` so that typing does not fire a
  // request per keystroke. The committed value lands in `filters` only after
  // SEARCH_DEBOUNCE_MS of quiet.
  const [searchDraft, setSearchDraft] = useState('');
  const latestRequestRef = useRef(0);

  const [detailProduct, setDetailProduct] = useState<Awaited<ReturnType<typeof fetchVistaExpressProduct>> | null>(null);
  const [detailOrder, setDetailOrder] = useState<Awaited<ReturnType<typeof fetchVistaExpressOrder>> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  /* Resolve the project id, exactly as MyPetPlusLeads does. */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await api.get('/projects');
        const raw = response.data;
        const list: Project[] = Array.isArray(raw) ? raw : (raw?.data ?? []);
        const project = list.find((entry) => entry.slug === PROJECT_SLUG);

        if (cancelled) return;

        if (!project) {
          setProjectError(t('vistaExpress.projectUnavailable'));
          return;
        }

        setProjectId(project.id);
      } catch {
        if (!cancelled) setProjectError(t('vistaExpress.projectUnavailable'));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [t]);

  const load = useCallback(async () => {
    if (!projectId) return;

    // Sequence guard: a slow response for an old filter value must never
    // overwrite a newer one.
    const requestId = ++latestRequestRef.current;

    setLoading(true);
    setError(null);
    setWarnings([]);

    try {
      if (tab === 'overview') {
        const data = await fetchVistaExpressOverview(projectId, rangeMonths);
        if (requestId !== latestRequestRef.current) return;
        setOverview(data);
      } else if (tab === 'leads') {
        const data = await fetchVistaExpressLeads(projectId, filters);
        if (requestId !== latestRequestRef.current) return;
        setLeads(data.rows ?? []);
        setSummaries((s) => ({ ...s, leads: toSummary(data.summary) }));
        setPagination(data.pagination ?? EMPTY_PAGINATION);
      } else if (tab === 'users') {
        const data = await fetchVistaExpressUsers(projectId, { ...filters, role: filters.status });
        if (requestId !== latestRequestRef.current) return;
        setUsers(data.rows ?? []);
        setSummaries((s) => ({ ...s, users: toSummary(data.summary) }));
        setPagination(data.pagination ?? EMPTY_PAGINATION);
      } else if (tab === 'sellers') {
        const data = await fetchVistaExpressSellers(projectId, filters);
        if (requestId !== latestRequestRef.current) return;
        setSellers(data.rows ?? []);
        setSummaries((s) => ({ ...s, sellers: toSummary(data.summary) }));
        setPagination(data.pagination ?? EMPTY_PAGINATION);
      } else if (tab === 'products') {
        const data = await fetchVistaExpressProducts(projectId, filters);
        if (requestId !== latestRequestRef.current) return;
        setProducts(data.rows ?? []);
        setSummaries((s) => ({ ...s, products: toSummary(data.summary) }));
        setPagination(data.pagination ?? EMPTY_PAGINATION);
      } else if (tab === 'orders') {
        const data = await fetchVistaExpressOrders(projectId, filters);
        if (requestId !== latestRequestRef.current) return;
        setOrders(data.rows ?? []);
        setSummaries((s) => ({ ...s, orders: toSummary(data.summary) }));
        setPagination(data.pagination ?? EMPTY_PAGINATION);
      } else if (tab === 'ads') {
        const data = await fetchVistaExpressAds(projectId, filters);
        if (requestId !== latestRequestRef.current) return;
        setAds(data.rows ?? []);
        setSummaries((s) => ({ ...s, ads: toSummary(data.summary) }));
        setPagination(data.pagination ?? EMPTY_PAGINATION);
      } else if (tab === 'warehouse') {
        // allSettled, not all: the three warehouse calls are independent, and
        // one failing must not blank the whole tab.
        const [summaryResult, stockResult, purchasesResult] = await Promise.allSettled([
          fetchVistaExpressWarehouse(projectId),
          fetchVistaExpressWarehouseProducts(projectId, filters),
          fetchVistaExpressWarehouseOrders(projectId, filters),
        ]);

        if (requestId !== latestRequestRef.current) return;

        const problems: string[] = [];

        if (summaryResult.status === 'fulfilled') {
          setWarehouse(summaryResult.value.stats ?? null);
          setLowStock(summaryResult.value.low_stock ?? []);
          setStockByCategory(summaryResult.value.stock_by_category ?? {});
          setWarehouseTrend(summaryResult.value.orders_trend ?? []);
        } else {
          problems.push(messageFor(summaryResult.reason));
        }

        if (stockResult.status === 'fulfilled') {
          setWarehouseProducts(stockResult.value.rows ?? []);
        } else {
          problems.push(messageFor(stockResult.reason));
        }

        if (purchasesResult.status === 'fulfilled') {
          setWarehouseOrders(purchasesResult.value.rows ?? []);
        } else {
          problems.push(messageFor(purchasesResult.reason));
        }

        setWarnings(problems);
        setPagination(stockResult.status === 'fulfilled' ? stockResult.value.pagination ?? EMPTY_PAGINATION : EMPTY_PAGINATION);
      }
    } catch (err) {
      if (requestId !== latestRequestRef.current) return;
      // Keep whatever is already on screen: a failed filter change should not
      // look like the page reloaded empty.
      setError(messageFor(err) || t('vistaExpress.loadFailed'));
    } finally {
      if (requestId === latestRequestRef.current) setLoading(false);
    }
  }, [projectId, tab, filters, rangeMonths, t]);

  useEffect(() => {
    void load();
  }, [load]);

  /* Switching tab resets paging, filters and the in-progress search text. */
  const changeTab = (next: TabKey) => {
    setTab(next);
    setFilters(EMPTY_FILTERS);
    setSearchDraft('');
    setPagination(EMPTY_PAGINATION);
  };

  const setFilter = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: '1' }));
  };

  /* Commit the debounced search term into the filters, once typing settles. */
  useEffect(() => {
    if (searchDraft === (filters.search ?? '')) return;

    const timer = window.setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: searchDraft, page: '1' }));
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [searchDraft, filters.search]);

  const openProduct = async (id: number) => {
    if (!projectId) return;
    setDetailLoading(true);
    try {
      setDetailProduct(await fetchVistaExpressProduct(projectId, id));
    } catch {
      setError(t('vistaExpress.loadFailed'));
    } finally {
      setDetailLoading(false);
    }
  };

  const openOrder = async (id: number) => {
    if (!projectId) return;
    setDetailLoading(true);
    try {
      setDetailOrder(await fetchVistaExpressOrder(projectId, id));
    } catch {
      setError(t('vistaExpress.loadFailed'));
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * Whether the active tab already has something rendered. Used to decide
   * between a full-page spinner (first load) and a quiet "Updating…" hint
   * (refresh/filter change), so filtering never blanks the tab.
   */
  const hasContent = useMemo(() => {
    switch (tab) {
      case 'overview':
        return overview !== null;
      case 'leads':
        return leads.length > 0;
      case 'users':
        return users.length > 0;
      case 'sellers':
        return sellers.length > 0;
      case 'products':
        return products.length > 0;
      case 'orders':
        return orders.length > 0;
      case 'ads':
        return ads.length > 0;
      case 'warehouse':
        return warehouseProducts.length > 0 || warehouseOrders.length > 0 || warehouse !== null;
      default:
        return false;
    }
  }, [tab, overview, leads, users, sellers, products, orders, ads, warehouseProducts, warehouseOrders, warehouse]);

  const tabs = useMemo(
    () => [
      { key: 'overview' as const, label: t('vistaExpress.tabs.overview') },
      { key: 'leads' as const, label: t('vistaExpress.tabs.leads') },
      { key: 'users' as const, label: t('vistaExpress.tabs.users') },
      { key: 'sellers' as const, label: t('vistaExpress.tabs.sellers') },
      { key: 'products' as const, label: t('vistaExpress.tabs.products') },
      { key: 'orders' as const, label: t('vistaExpress.tabs.orders') },
      { key: 'warehouse' as const, label: t('vistaExpress.tabs.warehouse') },
      { key: 'ads' as const, label: t('vistaExpress.tabs.ads') },
    ],
    [t],
  );

  if (projectError) {
    return (
      <>
        <Topbar title={t('vistaExpress.title')} subtitle={t('vistaExpress.subtitle')} />
        <div className="rounded-2xl border border-bad/30 bg-bad/5 p-6 text-center">
          <p className="font-semibold text-bad">{t('vistaExpress.projectUnavailableTitle')}</p>
          <p className="mt-2 text-sm text-muted">{projectError}</p>
          <p className="mt-3 text-xs text-muted">{t('vistaExpress.projectUnavailableHint')}</p>
        </div>
      </>
    );
  }

  if (!projectId && !overview) {
    return (
      <>
        <Topbar title={t('vistaExpress.title')} subtitle={t('vistaExpress.subtitle')} />
        <LoadingSpinner />
      </>
    );
  }

  return (
    <>
      <Topbar
        title={t('vistaExpress.title')}
        subtitle={t('vistaExpress.subtitle')}
        actions={
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-xl border border-line bg-white px-3 py-2 text-sm font-medium text-ink hover:border-aqua-4"
          >
            {t('vistaExpress.refresh')}
          </button>
        }
      />

      {/* Tab strip */}
      <div className="mb-4 flex flex-wrap gap-1.5 rounded-2xl border border-line bg-white p-1.5">
        {tabs.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => changeTab(entry.key)}
            className={`rounded-xl px-3 py-1.5 text-sm font-medium transition ${
              tab === entry.key
                ? 'bg-aqua-4 text-white shadow-sm'
                : 'text-muted hover:bg-aqua-1 hover:text-ink'
            }`}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-bad/30 bg-bad/5 p-3 text-sm text-bad">
          <span className="min-w-0 break-words">{error}</span>
          <button type="button" onClick={() => void load()} className="shrink-0 font-semibold underline">
            {t('vistaExpress.retry')}
          </button>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="mb-4 rounded-xl border border-warn/30 bg-warn/5 p-3 text-sm text-warn">
          {warnings.map((warning) => (
            <div key={warning} className="break-words">{warning}</div>
          ))}
        </div>
      )}

      {/* A refresh keeps the existing rows on screen instead of blanking the
          tab, so filtering never looks like the page reloaded. The spinner is
          reserved for the first load of a tab. */}
      {loading && !hasContent && <LoadingSpinner />}
      {loading && hasContent && (
        <p className="mb-2 text-xs text-muted">{t('vistaExpress.updating')}</p>
      )}

      {tab === 'overview' && overview && (
        <OverviewTab
          overview={overview}
          rangeMonths={rangeMonths}
          onRangeChange={setRangeMonths}
        />
      )}

      {tab === 'leads' && (
        <ListPanel
          filters={filters}
          onFilter={setFilter}
          searchDraft={searchDraft}
          onSearchDraft={setSearchDraft}
          searchPlaceholder={t('vistaExpress.searchPlaceholder')}
          pagination={pagination}
          onPage={(page) => setFilters((p) => ({ ...p, page: String(page) }))}
          summary={summaries.leads}
          summaryKeys={[
            ['total_buyers', t('vistaExpress.leads.buyers')],
            ['total_sellers', t('vistaExpress.leads.sellers')],
            ['new_buyers_this_month', t('vistaExpress.leads.newBuyers')],
            ['referral_clicks', t('vistaExpress.leads.referralClicks')],
            ['referral_conversions', t('vistaExpress.leads.referralConversions')],
          ]}
        >
          <Table headers={[t('vistaExpress.leads.name'), t('vistaExpress.leads.source'), t('vistaExpress.leads.role'), t('vistaExpress.leads.status'), t('vistaExpress.leads.value'), t('vistaExpress.common.date')]}>
            {leads.map((lead) => (
              <tr key={`${lead.source}-${lead.id}`} className="border-t border-line">
                <Td>
                  <div className="font-medium text-ink">{text(lead.name, '—')}</div>
                  <div className="text-xs text-muted">{text(lead.email)}</div>
                </Td>
                <Td><Badge>{titleize(lead.source)}</Badge></Td>
                <Td>{titleize(lead.role)}</Td>
                <Td><Badge tone={lead.converted ? 'ok' : lead.status === 'unverified' ? 'warn' : 'muted'}>{titleize(lead.status)}</Badge></Td>
                <Td>{money(lead.lifetime_value)}</Td>
                <Td>{formatDate(lead.created_at)}</Td>
              </tr>
            ))}
          </Table>
          {leads.length === 0 && <Empty message={t('vistaExpress.empty')} />}
        </ListPanel>
      )}

      {tab === 'users' && (
        <ListPanel
          filters={filters}
          onFilter={setFilter}
          searchDraft={searchDraft}
          onSearchDraft={setSearchDraft}
          searchPlaceholder={t('vistaExpress.searchPlaceholder')}
          selectKey="status"
          selectOptions={[
            ['', t('vistaExpress.allRoles')],
            ['buyer', t('vistaExpress.roles.buyer')],
            ['seller', t('vistaExpress.roles.seller')],
            ['admin', t('vistaExpress.roles.admin')],
          ]}
          pagination={pagination}
          onPage={(page) => setFilters((p) => ({ ...p, page: String(page) }))}
          summary={summaries.users}
          summaryKeys={[
            ['buyers', t('vistaExpress.leads.buyers')],
            ['sellers', t('vistaExpress.leads.sellers')],
            ['new_this_month', t('vistaExpress.leads.newThisMonth')],
            ['unverified_email', t('vistaExpress.leads.unverified')],
          ]}
        >
          <Table headers={[t('vistaExpress.common.name'), t('vistaExpress.common.email'), t('vistaExpress.common.role'), t('vistaExpress.users.store'), t('vistaExpress.users.lifetime'), t('vistaExpress.common.joined')]}>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-line">
                <Td>
                  <div className="font-medium text-ink">{text(user.name)}</div>
                  {user.is_blocked && <Badge tone="bad">{t('vistaExpress.users.blocked')}</Badge>}
                </Td>
                <Td>
                  {text(user.email)}
                  {user.email_verified && <span className="ml-1 text-xs text-ok">✓</span>}
                </Td>
                <Td><Badge>{titleize(user.role)}</Badge></Td>
                <Td>{text(user.store?.name)}</Td>
                <Td>
                  {money(user.lifetime_value)}
                  <div className="text-xs text-muted">{number(user.paid_orders_count)} {t('vistaExpress.users.orders')}</div>
                </Td>
                <Td>{formatDate(user.created_at)}</Td>
              </tr>
            ))}
          </Table>
          {users.length === 0 && <Empty message={t('vistaExpress.empty')} />}
        </ListPanel>
      )}

      {tab === 'sellers' && (
        <ListPanel
          filters={filters}
          onFilter={setFilter}
          searchDraft={searchDraft}
          onSearchDraft={setSearchDraft}
          searchPlaceholder={t('vistaExpress.searchPlaceholder')}
          pagination={pagination}
          onPage={(page) => setFilters((p) => ({ ...p, page: String(page) }))}
          summary={summaries.sellers}
          summaryKeys={[
            ['total_stores', t('vistaExpress.sellers.total')],
            ['active', t('vistaExpress.sellers.active')],
            ['pending_review', t('vistaExpress.sellers.pending')],
            ['suspended', t('vistaExpress.sellers.suspended')],
          ]}
        >
          <Table headers={[t('vistaExpress.common.name'), t('vistaExpress.sellers.owner'), t('vistaExpress.sellers.status'), t('vistaExpress.sellers.products'), t('vistaExpress.sellers.orders'), t('vistaExpress.sellers.revenue'), t('vistaExpress.sellers.plan')]}>
            {sellers.map((seller) => (
              <tr key={seller.id} className="border-t border-line">
                <Td>
                  <div className="font-medium text-ink">{text(seller.name)}</div>
                  <div className="text-xs text-muted">{seller.slug}</div>
                </Td>
                <Td>
                  {text(seller.owner?.name)}
                  <div className="text-xs text-muted">{text(seller.owner?.email)}</div>
                </Td>
                <Td>
                  <Badge tone={seller.status === 'active' ? 'ok' : seller.status === 'suspended' ? 'bad' : 'warn'}>
                    {titleize(seller.status)}
                  </Badge>
                  <div className="mt-0.5 text-xs text-muted">{titleize(seller.onboarding_status)}</div>
                </Td>
                <Td>{number(seller.products_count)}</Td>
                <Td>{number(seller.paid_orders_count)}</Td>
                <Td className="font-medium text-ink">{money(seller.revenue)}</Td>
                <Td>
                  {seller.subscription ? (
                    <>
                      <div className="text-sm">{text(seller.subscription.plan)}</div>
                      <div className="text-xs text-muted">{titleize(seller.subscription.status)}</div>
                    </>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
          {sellers.length === 0 && <Empty message={t('vistaExpress.empty')} />}
        </ListPanel>
      )}

      {tab === 'products' && (
        <ListPanel
          filters={filters}
          onFilter={setFilter}
          searchDraft={searchDraft}
          onSearchDraft={setSearchDraft}
          searchPlaceholder={t('vistaExpress.searchPlaceholder')}
          selectKey="status"
          selectOptions={[
            ['', t('vistaExpress.all')],
            ['live', t('vistaExpress.products.live')],
            ['pending', t('vistaExpress.products.pending')],
            ['inactive', t('vistaExpress.products.inactive')],
            ['boosted', t('vistaExpress.products.boosted')],
            ['out_of_stock', t('vistaExpress.products.outOfStock')],
          ]}
          pagination={pagination}
          onPage={(page) => setFilters((p) => ({ ...p, page: String(page) }))}
          summary={summaries.products}
          summaryKeys={[
            ['total', t('vistaExpress.products.total')],
            ['live', t('vistaExpress.products.live')],
            ['pending_review', t('vistaExpress.products.pending')],
            ['boosted', t('vistaExpress.products.boosted')],
          ]}
        >
          <Table headers={[t('vistaExpress.common.name'), t('vistaExpress.products.store'), t('vistaExpress.products.type'), t('vistaExpress.products.price'), t('vistaExpress.products.stock'), t('vistaExpress.products.sold'), t('vistaExpress.products.revenue'), '']}>
            {products.map((product) => (
              <tr key={product.id} className="border-t border-line">
                <Td>
                  <div className="font-medium text-ink">{text(product.name)}</div>
                  <div className="text-xs text-muted">{product.sku}</div>
                </Td>
                <Td>{text(product.store?.name)}</Td>
                <Td>
                  <Badge>{titleize(product.product_type)}</Badge>
                  {product.is_boosted && <Badge tone="warn">{t('vistaExpress.products.boosted')}</Badge>}
                </Td>
                <Td>{money(product.price)}</Td>
                <Td>
                  <Badge tone={product.stock_quantity <= 0 ? 'bad' : 'muted'}>
                    {number(product.stock_quantity)}
                  </Badge>
                </Td>
                <Td>{number(product.units_sold)}</Td>
                <Td className="font-medium text-ink">{money(product.revenue)}</Td>
                <Td>
                  <button
                    type="button"
                    onClick={() => void openProduct(product.id)}
                    className="rounded-lg border border-line px-2 py-1 text-xs font-medium text-ink hover:border-aqua-4"
                  >
                    {t('vistaExpress.view')}
                  </button>
                </Td>
              </tr>
            ))}
          </Table>
          {products.length === 0 && <Empty message={t('vistaExpress.empty')} />}
        </ListPanel>
      )}

      {tab === 'orders' && (
        <ListPanel
          filters={filters}
          onFilter={setFilter}
          searchDraft={searchDraft}
          onSearchDraft={setSearchDraft}
          searchPlaceholder={t('vistaExpress.searchPlaceholder')}
          selectKey="status"
          selectOptions={[
            ['', t('vistaExpress.all')],
            ['pending', t('vistaExpress.orders.pending')],
            ['paid', t('vistaExpress.orders.paid')],
            ['refunded', t('vistaExpress.orders.refunded')],
            ['cancelled', t('vistaExpress.orders.cancelled')],
          ]}
          pagination={pagination}
          onPage={(page) => setFilters((p) => ({ ...p, page: String(page) }))}
          summary={summaries.orders}
          summaryKeys={[
            ['total_orders', t('vistaExpress.orders.total')],
            ['paid', t('vistaExpress.orders.paid')],
            ['pending', t('vistaExpress.orders.pending')],
            ['average_order_value', t('vistaExpress.orders.aov')],
          ]}
          isMoneySummary
        >
          <Table headers={[t('vistaExpress.orders.number'), t('vistaExpress.orders.customer'), t('vistaExpress.orders.items'), t('vistaExpress.orders.total'), t('vistaExpress.orders.payment'), t('vistaExpress.common.date'), '']}>
            {orders.map((order) => (
              <tr key={order.id} className="border-t border-line">
                <Td className="font-mono text-xs">{order.order_no}</Td>
                <Td>
                  <div className="text-sm">{text(order.customer?.name)}</div>
                  <div className="text-xs text-muted">{text(order.customer?.email)}</div>
                </Td>
                <Td>
                  {money(order.items_total)}
                  {order.discount_total > 0 && (
                    <div className="text-xs text-muted">−{money(order.discount_total)}</div>
                  )}
                </Td>
                <Td className="font-medium text-ink">{money(order.grand_total)}</Td>
                <Td>
                  <Badge tone={order.payment_status === 'paid' ? 'ok' : order.payment_status === 'pending' ? 'warn' : 'bad'}>
                    {titleize(order.payment_status)}
                  </Badge>
                  <div className="mt-0.5 text-xs text-muted">{titleize(order.payment_method)}</div>
                </Td>
                <Td>{formatDate(order.created_at)}</Td>
                <Td>
                  <button
                    type="button"
                    onClick={() => void openOrder(order.id)}
                    className="rounded-lg border border-line px-2 py-1 text-xs font-medium text-ink hover:border-aqua-4"
                  >
                    {t('vistaExpress.view')}
                  </button>
                </Td>
              </tr>
            ))}
          </Table>
          {orders.length === 0 && <Empty message={t('vistaExpress.empty')} />}
        </ListPanel>
      )}

      {tab === 'warehouse' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label={t('vistaExpress.warehouse.stock')} value={number(warehouse?.total_stock)} />
            <Stat label={t('vistaExpress.warehouse.products')} value={number(warehouse?.published_products)} />
            <Stat label={t('vistaExpress.warehouse.lowStock')} value={number(warehouse?.low_stock)} tone={warehouse && warehouse.low_stock > 0 ? 'warn' : 'plain'} />
            <Stat label={t('vistaExpress.warehouse.outOfStock')} value={number(warehouse?.out_of_stock)} tone={warehouse && warehouse.out_of_stock > 0 ? 'bad' : 'plain'} />
            <Stat label={t('vistaExpress.warehouse.orders')} value={number(warehouse?.orders)} />
            <Stat label={t('vistaExpress.warehouse.revenue')} value={money(warehouse?.revenue)} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title={t('vistaExpress.warehouse.lowStockTitle')}>
              {lowStock.length === 0 ? (
                <Empty message={t('vistaExpress.warehouse.noLowStock')} />
              ) : (
                <ul className="space-y-2">
                  {lowStock.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate text-ink">{item.name}</span>
                      <span className="shrink-0 text-xs text-muted">
                        {item.stock_quantity} / {item.low_stock_threshold}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title={t('vistaExpress.warehouse.stockByCategory')}>
              {Object.keys(stockByCategory).length === 0 ? (
                <Empty message={t('vistaExpress.empty')} />
              ) : (
                <ul className="space-y-2">
                  {Object.entries(stockByCategory).map(([name, stock]) => (
                    <li key={name}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="min-w-0 truncate text-ink">{name}</span>
                        <span className="shrink-0 text-xs text-muted">{number(stock)}</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full rounded-full bg-aqua-1">
                        <div
                          className="h-1.5 rounded-full bg-aqua-4"
                          style={{ width: `${(stock / Math.max(...Object.values(stockByCategory), 1)) * 100}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card title={t('vistaExpress.overview.revenueTrend')}>
            <div className="space-y-2">
              {warehouseTrend.length === 0 && <Empty message={t('vistaExpress.empty')} />}
              {warehouseTrend.map((point) => (
                <div key={point.month} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted">{point.label}</span>
                  <span className="flex items-center gap-3">
                    <span className="text-xs text-muted">
                      {number(point.orders)} {t('vistaExpress.warehouse.orders').toLowerCase()}
                    </span>
                    <span className="font-medium text-ink">{money(point.revenue)}</span>
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card title={t('vistaExpress.warehouse.purchases')}>
            <Table headers={[t('vistaExpress.warehouse.orderNumber'), t('vistaExpress.warehouse.seller'), t('vistaExpress.warehouse.items'), t('vistaExpress.common.total'), t('vistaExpress.orders.payment'), t('vistaExpress.common.date')]}>
              {warehouseOrders.map((order) => (
                <tr key={order.id} className="border-t border-line">
                  <Td className="font-mono text-xs">{order.order_number}</Td>
                  <Td>{text(order.seller?.name)}</Td>
                  <Td>{number(order.items_count)}</Td>
                  <Td className="font-medium text-ink">{money(order.total)}</Td>
                  <Td><Badge tone={order.payment_status === 'paid' ? 'ok' : 'bad'}>{titleize(order.payment_status)}</Badge></Td>
                  <Td>{formatDate(order.created_at)}</Td>
                </tr>
              ))}
            </Table>
            {warehouseOrders.length === 0 && <Empty message={t('vistaExpress.empty')} />}
          </Card>

          <Card title={t('vistaExpress.products.title')}>
            <Table headers={[t('vistaExpress.common.name'), t('vistaExpress.products.sku'), t('vistaExpress.warehouse.category'), t('vistaExpress.products.price'), t('vistaExpress.products.stock'), t('vistaExpress.warehouse.availability')]}>
              {warehouseProducts.map((product) => (
                <tr key={product.id} className="border-t border-line">
                  <Td className="font-medium text-ink">{text(product.name)}</Td>
                  <Td className="font-mono text-xs">{product.sku}</Td>
                  <Td>{text(product.category)}</Td>
                  <Td>{money(product.price)}</Td>
                  <Td>{number(product.stock_quantity)}</Td>
                  <Td>
                    <Badge tone={product.availability === 'in_stock' ? 'ok' : product.availability === 'low_stock' ? 'warn' : 'bad'}>
                      {titleize(product.availability)}
                    </Badge>
                  </Td>
                </tr>
              ))}
            </Table>
            {warehouseProducts.length === 0 && <Empty message={t('vistaExpress.empty')} />}
          </Card>
        </div>
      )}

      {tab === 'ads' && (
        <ListPanel
          filters={filters}
          onFilter={setFilter}
          searchDraft={searchDraft}
          onSearchDraft={setSearchDraft}
          searchPlaceholder={t('vistaExpress.searchPlaceholder')}
          selectKey="status"
          selectOptions={[
            ['', t('vistaExpress.all')],
            ['active', t('vistaExpress.ads.active')],
            ['paused', t('vistaExpress.ads.paused')],
            ['pending_review', t('vistaExpress.ads.pending')],
            ['completed', t('vistaExpress.ads.completed')],
            ['rejected', t('vistaExpress.ads.rejected')],
          ]}
          pagination={pagination}
          onPage={(page) => setFilters((p) => ({ ...p, page: String(page) }))}
          summary={summaries.ads}
          summaryKeys={[
            ['campaigns', t('vistaExpress.ads.campaigns')],
            ['total_spent', t('vistaExpress.ads.spent')],
            ['clicks', t('vistaExpress.ads.clicks')],
            ['ctr', t('vistaExpress.ads.ctr')],
            ['roas', t('vistaExpress.ads.roas')],
          ]}
          isMoneySummary
          percentKeys={['ctr']}
        >
          <Table headers={[t('vistaExpress.ads.campaign'), t('vistaExpress.ads.seller'), t('vistaExpress.ads.status'), t('vistaExpress.ads.budget'), t('vistaExpress.ads.spent'), t('vistaExpress.ads.impressions'), t('vistaExpress.ads.clicks'), t('vistaExpress.ads.ctr'), t('vistaExpress.ads.roas')]}>
            {ads.map((campaign) => (
              <tr key={campaign.id} className="border-t border-line">
                <Td>
                  <div className="font-medium text-ink">{text(campaign.name)}</div>
                  <div className="text-xs text-muted">{text(campaign.product?.name)}</div>
                </Td>
                <Td>{text(campaign.seller?.name)}</Td>
                <Td><Badge tone={campaign.status === 'active' ? 'ok' : campaign.status === 'paused' ? 'warn' : 'muted'}>{titleize(campaign.status)}</Badge></Td>
                <Td>{money(campaign.budget)}</Td>
                <Td className="font-medium text-ink">{money(campaign.spent)}</Td>
                <Td>{number(campaign.impressions)}</Td>
                <Td>{number(campaign.clicks)}</Td>
                <Td>{percent(campaign.ctr)}</Td>
                <Td>{campaign.roas.toFixed(2)}×</Td>
              </tr>
            ))}
          </Table>
          {ads.length === 0 && <Empty message={t('vistaExpress.empty')} />}
        </ListPanel>
      )}

      {/* Product detail */}
      <Modal
        isOpen={Boolean(detailProduct)}
        onClose={() => setDetailProduct(null)}
        title={text(detailProduct?.product?.name)}
        size="lg"
      >
        {detailLoading && <LoadingSpinner />}
        {!detailLoading && detailProduct && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat small label={t('vistaExpress.products.price')} value={money(detailProduct.product.price)} />
              <Stat small label={t('vistaExpress.products.stock')} value={number(detailProduct.product.stock_quantity)} />
              <Stat small label={t('vistaExpress.products.sold')} value={number(detailProduct.sales.units_sold)} />
              <Stat small label={t('vistaExpress.products.revenue')} value={money(detailProduct.sales.revenue)} />
            </div>

            {detailProduct.product.description && (
              <p className="text-sm text-muted">{detailProduct.product.description}</p>
            )}

            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <Field label={t('vistaExpress.products.store')} value={text(detailProduct.product.store?.name)} />
              <Field label={t('vistaExpress.products.category')} value={text(detailProduct.product.category)} />
              <Field label={t('vistaExpress.common.type')} value={titleize(detailProduct.product.product_type)} />
              <Field label={t('vistaExpress.common.gender')} value={titleize(detailProduct.product.gender)} />
              <Field label={t('vistaExpress.products.frameShape')} value={text(detailProduct.product.frame_shape)} />
              <Field label={t('vistaExpress.products.frameMaterial')} value={text(detailProduct.product.frame_material)} />
            </div>

            {detailProduct.variants.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-semibold text-ink">{t('vistaExpress.products.variants')}</h4>
                <ul className="space-y-1.5">
                  {detailProduct.variants.map((variant) => (
                    <li key={variant.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate text-ink">
                        {text(variant.color_name)}
                        {variant.is_default && <span className="ml-1 text-xs text-aqua-5">({t('vistaExpress.products.default')})</span>}
                      </span>
                      <span className="shrink-0 text-muted">
                        {money(variant.price)} · {number(variant.stock_quantity)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Order detail */}
      <Modal
        isOpen={Boolean(detailOrder)}
        onClose={() => setDetailOrder(null)}
        title={t('vistaExpress.orders.number') + ' ' + text(detailOrder?.order?.order_no)}
        size="lg"
      >
        {detailLoading && <LoadingSpinner />}
        {!detailLoading && detailOrder && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat small label={t('vistaExpress.orders.itemsTotal')} value={money(detailOrder.order.items_total)} />
              <Stat small label={t('vistaExpress.orders.shipping')} value={money(detailOrder.order.shipping_total)} />
              <Stat small label={t('vistaExpress.orders.discount')} value={money(detailOrder.order.discount_total)} />
              <Stat small label={t('vistaExpress.orders.grandTotal')} value={money(detailOrder.order.grand_total)} />
            </div>

            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <Field label={t('vistaExpress.orders.customer')} value={text(detailOrder.order.customer?.name)} />
              <Field label={t('vistaExpress.orders.payment')} value={titleize(detailOrder.order.payment_status)} />
              <Field label={t('vistaExpress.common.email')} value={text(detailOrder.order.customer?.email)} />
              <Field label={t('vistaExpress.common.date')} value={formatDateTime(detailOrder.order.created_at)} />
            </div>

            {detailOrder.store_orders.map((storeOrder) => (
              <div key={storeOrder.id} className="rounded-xl border border-line p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-ink">{text(storeOrder.store?.name)}</span>
                  <div className="flex items-center gap-1.5">
                    <Badge tone={storeOrder.status === 'delivered' ? 'ok' : 'warn'}>{titleize(storeOrder.status)}</Badge>
                    <Badge>{titleize(storeOrder.payment_status)}</Badge>
                  </div>
                </div>

                <ul className="mb-2 space-y-1 text-sm">
                  {storeOrder.items.map((item, index) => (
                    <li key={`${storeOrder.id}-${index}`} className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate text-ink">
                        {text(item.product_name)} × {item.quantity}
                      </span>
                      <span className="shrink-0 text-muted">{money(item.line_total)}</span>
                    </li>
                  ))}
                </ul>

                <div className="flex items-center justify-between border-t border-line pt-2 text-sm font-semibold text-ink">
                  <span>{t('vistaExpress.orders.sellerTotal')}</span>
                  <span>{money(storeOrder.total)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Overview tab                                                        */
/* ------------------------------------------------------------------ */

function OverviewTab({
  overview,
  rangeMonths,
  onRangeChange,
}: {
  overview: VistaExpressOverview;
  rangeMonths: number;
  onRangeChange: (months: number) => void;
}) {
  const { t } = useTranslation();
  const { totals, revenue, changes, operations } = overview;

  const maxTrend = Math.max(...overview.revenue_trend.map((p) => p.total_revenue), 1);
  const maxSource = Math.max(...revenue.sources.map((s) => s.value), 1);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {[6, 12, 24].map((months) => (
          <button
            key={months}
            type="button"
            onClick={() => onRangeChange(months)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              rangeMonths === months
                ? 'bg-aqua-4 text-white'
                : 'border border-line bg-white text-muted hover:border-aqua-4'
            }`}
          >
            {months} {t('vistaExpress.months')}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label={t('vistaExpress.overview.totalUsers')} value={number(totals.total_users)} delta={changes.users} />
        <Stat label={t('vistaExpress.overview.sellers')} value={number(totals.total_sellers)} delta={changes.sellers} />
        <Stat label={t('vistaExpress.overview.buyers')} value={number(totals.total_buyers)} delta={changes.buyers} />
        <Stat label={t('vistaExpress.overview.products')} value={number(totals.total_products)} delta={changes.products} />
        <Stat label={t('vistaExpress.overview.orders')} value={number(totals.total_orders)} delta={changes.orders} />
        <Stat label={t('vistaExpress.overview.totalRevenue')} value={money(totals.total_revenue)} delta={changes.revenue} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t('vistaExpress.overview.revenueBreakdown')}>
          <div className="space-y-3">
            <div className="rounded-xl bg-aqua-1 p-3">
              <div className="text-xs uppercase tracking-wide text-muted">{t('vistaExpress.overview.totalRevenue')}</div>
              <div className="mt-1 text-2xl font-bold text-ink">{money(revenue.total)}</div>
            </div>

            {revenue.sources.map((source) => (
              <div key={source.key}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink">{source.label}</span>
                  <span className="text-muted">
                    {money(source.value)}
                    <span className="ml-1 text-xs">
                      ({percent(revenue.total > 0 ? (source.value / revenue.total) * 100 : 0)})
                    </span>
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full rounded-full bg-aqua-1">
                  <div
                    className="h-1.5 rounded-full bg-aqua-4"
                    style={{ width: `${(source.value / maxSource) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title={t('vistaExpress.overview.operations')}>
          <div className="grid grid-cols-2 gap-3">
            <Stat small label={t('vistaExpress.overview.openOrders')} value={number(operations.open_orders)} />
            <Stat small label={t('vistaExpress.overview.sellerApprovals')} value={number(operations.pending_seller_approvals)} tone={operations.pending_seller_approvals > 0 ? 'warn' : 'plain'} />
            <Stat small label={t('vistaExpress.overview.productReviews')} value={number(operations.pending_product_reviews)} tone={operations.pending_product_reviews > 0 ? 'warn' : 'plain'} />
            <Stat small label={t('vistaExpress.overview.supportTickets')} value={number(operations.open_support_tickets)} tone={operations.open_support_tickets > 0 ? 'warn' : 'plain'} />
          </div>
        </Card>
      </div>

      <Card title={t('vistaExpress.overview.revenueTrend')}>
        <div className="space-y-2">
          {overview.revenue_trend.map((point) => (
            <div key={point.month}>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted">{point.label}</span>
                <span className="font-medium text-ink">{money(point.total_revenue)}</span>
              </div>
              <div className="mt-1 flex h-2 w-full overflow-hidden rounded-full bg-aqua-1">
                <div className="h-2 bg-aqua-4" style={{ width: `${(point.order_revenue / maxTrend) * 100}%` }} />
                <div className="h-2 bg-ok" style={{ width: `${(point.ad_revenue / maxTrend) * 100}%` }} />
                <div className="h-2 bg-warn" style={{ width: `${(point.warehouse_revenue / maxTrend) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted">
          <span className="flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-full bg-aqua-4" />{t('vistaExpress.revenue.orders')}</span>
          <span className="flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-full bg-ok" />{t('vistaExpress.revenue.ads')}</span>
          <span className="flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-full bg-warn" />{t('vistaExpress.revenue.warehouse')}</span>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t('vistaExpress.overview.bestSellers')}>
          <Table headers={[t('vistaExpress.common.name'), t('vistaExpress.products.store'), t('vistaExpress.products.sold'), t('vistaExpress.common.revenue')]}>
            {overview.best_selling_products.map((product) => (
              <tr key={`${product.product_id}-${product.sku}`} className="border-t border-line">
                <Td>
                  <div className="text-sm font-medium text-ink">{text(product.name)}</div>
                  <div className="text-xs text-muted">{product.sku}</div>
                </Td>
                <Td>{text(product.store_name)}</Td>
                <Td>{number(product.units_sold)}</Td>
                <Td className="font-medium text-ink">{money(product.revenue)}</Td>
              </tr>
            ))}
          </Table>
          {overview.best_selling_products.length === 0 && <Empty message={t('vistaExpress.empty')} />}
        </Card>

        <Card title={t('vistaExpress.overview.recentActivity')}>
          <ul className="space-y-2">
            {overview.recent_activity.map((entry, index) => (
              <li key={`${entry.kind}-${index}`} className="flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium text-ink">{text(entry.reference)}</div>
                  <div className="text-xs text-muted">
                    {titleize(entry.kind)}
                    {entry.actor ? ` · ${entry.actor}` : ''}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  {entry.amount !== null && <div className="text-sm text-ink">{money(entry.amount)}</div>}
                  <div className="text-xs text-muted">{formatDateTime(entry.occurred_at)}</div>
                </div>
              </li>
            ))}
          </ul>
          {overview.recent_activity.length === 0 && <Empty message={t('vistaExpress.empty')} />}
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared presentational bits                                           */
/* ------------------------------------------------------------------ */

type BadgeTone = 'ok' | 'warn' | 'bad' | 'muted';

function ListPanel({
  children,
  filters,
  onFilter,
  searchDraft,
  onSearchDraft,
  searchPlaceholder,
  selectKey,
  selectOptions,
  pagination,
  onPage,
  summary,
  summaryKeys,
  isMoneySummary = false,
  percentKeys = [],
}: {
  children: React.ReactNode;
  filters: Filters;
  onFilter: (key: string, value: string) => void;
  searchDraft: string;
  onSearchDraft: (value: string) => void;
  searchPlaceholder: string;
  selectKey?: string;
  selectOptions?: [string, string][];
  pagination: VistaExpressPagination;
  onPage: (page: number) => void;
  summary?: SummaryRecord;
  summaryKeys?: [string, string][];
  isMoneySummary?: boolean;
  percentKeys?: string[];
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      {summary && summaryKeys && summaryKeys.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {summaryKeys.map(([key, label]) => (
            <Stat
              key={key}
              small
              label={label}
              value={
                summary[key] === null || summary[key] === undefined
                  ? '—'
                  : isMoneySummary || key.includes('value') || key.includes('revenue') || key.includes('spent') || key.includes('budget') || key === 'average_order_value'
                    ? money(summary[key])
                    : percentKeys.includes(key)
                      ? percent(summary[key])
                      : number(summary[key])
              }
            />
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          value={searchDraft}
          onChange={(event) => onSearchDraft(event.target.value)}
          placeholder={searchPlaceholder}
          className="min-w-[180px] flex-1 rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-aqua-4 focus:outline-none"
        />

        {selectKey && selectOptions && (
          <select
            value={filters[selectKey] ?? ''}
            onChange={(event) => onFilter(selectKey, event.target.value)}
            className="rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink focus:border-aqua-4 focus:outline-none"
          >
            {selectOptions.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        )}

        <input
          type="date"
          value={filters.from ?? ''}
          onChange={(event) => onFilter('from', event.target.value)}
          className="rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink focus:border-aqua-4 focus:outline-none"
        />
        <input
          type="date"
          value={filters.to ?? ''}
          onChange={(event) => onFilter('to', event.target.value)}
          className="rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink focus:border-aqua-4 focus:outline-none"
        />
      </div>

      {children}

      {pagination.last_page > 1 && (
        <div className="flex items-center justify-between gap-3 text-sm">
          <button
            type="button"
            disabled={pagination.page <= 1}
            onClick={() => onPage(pagination.page - 1)}
            className="rounded-lg border border-line px-3 py-1.5 disabled:opacity-40"
          >
            {t('vistaExpress.previous')}
          </button>
          <span className="text-muted">
            {t('vistaExpress.page')} {pagination.page} / {pagination.last_page} · {number(pagination.total)}
          </span>
          <button
            type="button"
            disabled={pagination.page >= pagination.last_page}
            onClick={() => onPage(pagination.page + 1)}
            className="rounded-lg border border-line px-3 py-1.5 disabled:opacity-40"
          >
            {t('vistaExpress.next')}
          </button>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  delta,
  tone = 'plain',
  small = false,
}: {
  label: string;
  value: string;
  delta?: number;
  tone?: 'plain' | 'warn' | 'bad';
  small?: boolean;
}) {
  const toneClass =
    tone === 'warn' ? 'text-warn' : tone === 'bad' ? 'text-bad' : 'text-ink';

  return (
    <div className={`rounded-2xl border border-line bg-white ${small ? 'p-3' : 'p-4'}`}>
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-1 font-bold ${small ? 'text-lg' : 'text-2xl'} ${toneClass}`}>{value}</div>
      {delta !== undefined && Number.isFinite(delta) && delta !== 0 && (
        <div className={`mt-0.5 text-xs ${delta > 0 ? 'text-ok' : 'text-bad'}`}>
          {delta > 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}%
        </div>
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-ink">{title}</h3>
      {children}
    </div>
  );
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-aqua-1 text-xs uppercase tracking-wide text-muted">
          <tr>
            {headers.map((header, index) => (
              <th key={`${header}-${index}`} className="whitespace-nowrap px-3 py-2 font-semibold">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 align-top ${className}`}>{children}</td>;
}

function Badge({ children, tone = 'muted' }: { children: React.ReactNode; tone?: BadgeTone }) {
  const classes: Record<BadgeTone, string> = {
    ok: 'bg-ok/10 text-ok',
    warn: 'bg-warn/10 text-warn',
    bad: 'bg-bad/10 text-bad',
    muted: 'bg-aqua-1 text-muted',
  };

  return (
    <span className={`mr-1 inline-block rounded-md px-1.5 py-0.5 text-xs font-medium ${classes[tone]}`}>
      {children}
    </span>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs uppercase tracking-wide text-muted">{label}</span>
      <div className="text-ink">{value}</div>
    </div>
  );
}

function Empty({ message }: { message: string }) {
  return <div className="py-6 text-center text-sm text-muted">{message}</div>;
}
