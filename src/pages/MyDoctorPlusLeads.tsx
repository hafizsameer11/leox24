import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Topbar from '../components/layout/Topbar';
import api from '../services/api';
import { fetchMyDoctorPlusLeads } from '../services/myDoctorPlusApi';
import type { Project } from '../types/project.types';
import type { MyDoctorLead, MyDoctorLeadFilters, MyDoctorLeadResponse } from '../types/myDoctorPlusLead';

const EMPTY_FILTERS: MyDoctorLeadFilters = {
  search: '', name: '', email: '', role: '', status: '', city: '', country: '',
  region: '', area: '', subscriptionPlan: '', subscriptionStatus: '',
  paymentStatus: '', fromDate: '', toDate: '', sortBy: 'createdAt', sortDirection: 'desc',
};

const EMPTY_RESPONSE: MyDoctorLeadResponse = {
  users: [],
  pagination: { page: 1, limit: 25, total: 0, totalPages: 1 },
  filterOptions: {
    roles: [], statuses: [], cities: [], countries: [], regions: [], areas: [],
    subscriptionPlans: [], subscriptionStatuses: [], paymentStatuses: [],
  },
  stats: {
    registrations: 0,
    roleCounts: { ADMIN: 0, DOCTOR: 0, PATIENT: 0, PHARMACY: 0, PARAPHARMACY: 0 },
    subscriptionCounts: { ACTIVE: 0, EXPIRED: 0, CANCELLED: 0, NOT_SUBSCRIBED: 0 },
    payments: { successful: 0, revenue: { total: 0, subscriptions: 0, orders: 0, appointments: 0, other: 0, currency: 'EUR' } },
    products: { total: 0, lowStock: 0 },
    orders: { total: 0, paidRevenue: 0 },
  },
  generatedAt: '',
};

const display = (value?: string | number | null, fallback = 'Not provided') => String(value ?? '').trim() || fallback;
const label = (value?: string | null, fallback = '—') => display(value, fallback).replace(/_/g, ' ');

function formatDate(value?: string | null): string {
  if (!value) return 'Not provided';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatMoney(amount = 0, currency = 'EUR'): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${Number(amount || 0).toFixed(2)} ${currency}`;
  }
}

function statusClass(status?: string | null): string {
  switch (String(status || '').toUpperCase()) {
    case 'ACTIVE':
    case 'APPROVED':
    case 'SUCCESS':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'PENDING':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'EXPIRED':
    case 'CANCELLED':
    case 'REJECTED':
    case 'BLOCKED':
    case 'FAILED':
    case 'REFUNDED':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-600';
  }
}

function roleClass(role?: string | null): string {
  const classes: Record<string, string> = {
    PATIENT: 'border-sky-200 bg-sky-50 text-sky-700',
    DOCTOR: 'border-violet-200 bg-violet-50 text-violet-700',
    PHARMACY: 'border-teal-200 bg-teal-50 text-teal-700',
    PARAPHARMACY: 'border-orange-200 bg-orange-50 text-orange-700',
    ADMIN: 'border-slate-300 bg-slate-100 text-slate-700',
  };
  return classes[String(role || '').toUpperCase()] || 'border-slate-200 bg-slate-50 text-slate-600';
}

function Badge({ value, role = false }: { value?: string | null; role?: boolean }) {
  return <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${role ? roleClass(value) : statusClass(value)}`}>{label(value)}</span>;
}

function DetailItem({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-white p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">{title}</p>
      <div className="mt-1 break-words text-sm font-medium text-ink">{children}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section>
    <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">{title}</h3>
    {children}
  </section>;
}

function LeadDetailsModal({ lead, onClose }: { lead: MyDoctorLead | null; onClose: () => void }) {
  if (!lead) return null;
  const subscription = lead.subscription;
  const revenue = lead.payments.filter((payment) => payment.status === 'SUCCESS').reduce((total, payment) => total + payment.amount, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-label="My Doctor Plus user details">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-line bg-white px-6 py-5">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-aqua-5">My Doctor Plus account</p>
            <h2 className="mt-1 truncate text-xl font-bold text-ink">{display(lead.name)}</h2>
            <p className="mt-1 truncate text-sm text-muted">{display(lead.email)}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close details" className="ml-4 rounded-lg px-3 py-1 text-2xl leading-none text-muted hover:bg-aqua-1/40 hover:text-ink">×</button>
        </div>

        <div className="space-y-6 p-6">
          <Section title="Registration and contact">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <DetailItem title="User type"><Badge value={lead.role} role /></DetailItem>
              <DetailItem title="Account status"><Badge value={lead.status} /></DetailItem>
              <DetailItem title="Registered">{formatDate(lead.createdAt)}</DetailItem>
              <DetailItem title="Email verified">{lead.emailVerified ? 'Yes' : 'No'}</DetailItem>
              <DetailItem title="Phone verified">{lead.phoneVerified ? 'Yes' : 'No'}</DetailItem>
              <DetailItem title="Phone">{display(lead.phone)}</DetailItem>
              <DetailItem title="City">{display(lead.address.city)}</DetailItem>
              <DetailItem title="Region">{display(lead.address.region)}</DetailItem>
              <DetailItem title="Country">{display(lead.address.country)}</DetailItem>
            </div>
          </Section>

          {lead.doctor && <Section title="Doctor profile">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <DetailItem title="Professional title">{display(lead.doctor.title)}</DetailItem>
              <DetailItem title="Specialization">{display(lead.doctor.specialization)}</DetailItem>
              <DetailItem title="Experience">{lead.doctor.experienceYears === null ? 'Not provided' : `${lead.doctor.experienceYears} years`}</DetailItem>
              <DetailItem title="Verified">{lead.doctor.isVerified ? 'Yes' : 'No'}</DetailItem>
              <DetailItem title="Profile completed">{lead.doctor.profileCompleted ? 'Yes' : 'No'}</DetailItem>
              <DetailItem title="Online consultation">{lead.doctor.isAvailableOnline ? 'Available' : 'Not available'}</DetailItem>
              <DetailItem title="Clinic consultation fee">{lead.doctor.consultationFees.clinic === null ? 'Not provided' : formatMoney(lead.doctor.consultationFees.clinic)}</DetailItem>
              <DetailItem title="Online consultation fee">{lead.doctor.consultationFees.online === null ? 'Not provided' : formatMoney(lead.doctor.consultationFees.online)}</DetailItem>
              <DetailItem title="Appointments">{lead.operations.appointments ? `${lead.operations.appointments.total} total · ${lead.operations.appointments.completed} completed` : 'No operational records'}</DetailItem>
            </div>
            {lead.doctor.services.length > 0 && <div className="mt-3 rounded-xl border border-line bg-slate-50 p-4 text-sm text-ink"><span className="font-semibold">Services: </span>{lead.doctor.services.map((service) => `${display(service.name)}${service.price === null ? '' : ` (${formatMoney(service.price)})`}`).join(' · ')}</div>}
            {lead.doctor.biography && <p className="mt-3 rounded-xl border border-line bg-slate-50 p-4 text-sm leading-relaxed text-ink">{lead.doctor.biography}</p>}
          </Section>}

          {lead.pharmacy && <Section title="Pharmacy profile">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <DetailItem title="Business name">{display(lead.pharmacy.name)}</DetailItem>
              <DetailItem title="Business type">{label(lead.pharmacy.kind)}</DetailItem>
              <DetailItem title="Business status">{lead.pharmacy.isActive ? 'Active' : 'Inactive'}</DetailItem>
              <DetailItem title="Phone">{display(lead.pharmacy.phone)}</DetailItem>
              <DetailItem title="Orders">{lead.operations.orders ? `${lead.operations.orders.total} total · ${lead.operations.orders.paid} paid` : 'No operational records'}</DetailItem>
              <DetailItem title="Paid order value">{lead.operations.orders ? formatMoney(lead.operations.orders.paidRevenue) : 'Not provided'}</DetailItem>
            </div>
          </Section>}

          <Section title="Subscription and payments">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <DetailItem title="Current plan">{display(subscription?.plan?.name, 'Not subscribed')}</DetailItem>
              <DetailItem title="Subscription status"><Badge value={subscription?.status || 'NOT_SUBSCRIBED'} /></DetailItem>
              <DetailItem title="Plan price">{subscription?.plan ? formatMoney(subscription.plan.price, subscription.plan.currency) : 'Not applicable'}</DetailItem>
              <DetailItem title="Started">{formatDate(subscription?.startDate)}</DetailItem>
              <DetailItem title="Expires">{formatDate(subscription?.endDate)}</DetailItem>
              <DetailItem title="Successful payments">{formatMoney(revenue)}</DetailItem>
            </div>
            {lead.subscriptionHistory.length > 0 && <div className="mt-4 overflow-x-auto rounded-xl border border-line">
              <table className="min-w-full text-sm">
                <thead className="bg-aqua-1/30 text-left text-xs font-bold uppercase text-muted"><tr><th className="px-3 py-2">Plan</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Start</th><th className="px-3 py-2">End</th></tr></thead>
                <tbody>{lead.subscriptionHistory.map((item, index) => <tr key={item.id || index} className="border-t border-line/70"><td className="px-3 py-2 font-medium text-ink">{display(item.plan?.name)}</td><td className="px-3 py-2"><Badge value={item.status} /></td><td className="px-3 py-2 text-muted">{formatDate(item.startDate)}</td><td className="px-3 py-2 text-muted">{formatDate(item.endDate)}</td></tr>)}</tbody>
              </table>
            </div>}
            {lead.payments.length > 0 && <div className="mt-4 overflow-x-auto rounded-xl border border-line">
              <table className="min-w-full text-sm">
                <thead className="bg-aqua-1/30 text-left text-xs font-bold uppercase text-muted"><tr><th className="px-3 py-2">Type</th><th className="px-3 py-2">Amount</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Provider</th><th className="px-3 py-2">Date</th></tr></thead>
                <tbody>{lead.payments.map((payment) => <tr key={payment.id} className="border-t border-line/70"><td className="px-3 py-2 font-medium text-ink">{label(payment.type)}</td><td className="px-3 py-2 text-ink">{formatMoney(payment.amount, payment.currency)}</td><td className="px-3 py-2"><Badge value={payment.status} /></td><td className="px-3 py-2 text-muted">{display(payment.provider)}</td><td className="px-3 py-2 text-muted">{formatDate(payment.createdAt)}</td></tr>)}</tbody>
              </table>
            </div>}
          </Section>

          <Section title="Products and inventory">
            {lead.products.length === 0 ? <div className="rounded-xl border border-line bg-slate-50 p-4 text-sm text-muted">This account has no product records.</div> : <div className="overflow-x-auto rounded-xl border border-line">
              <table className="min-w-full text-sm">
                <thead className="bg-aqua-1/30 text-left text-xs font-bold uppercase text-muted"><tr><th className="px-3 py-2">Product</th><th className="px-3 py-2">Category</th><th className="px-3 py-2">Price</th><th className="px-3 py-2">Stock</th><th className="px-3 py-2">Status</th></tr></thead>
                <tbody>{lead.products.map((product) => <tr key={product.id} className="border-t border-line/70"><td className="px-3 py-2"><p className="font-medium text-ink">{display(product.name)}</p><p className="text-xs text-muted">{display(product.sku)}</p></td><td className="px-3 py-2 text-muted">{display(product.category)}</td><td className="px-3 py-2 text-ink">{formatMoney(product.discountPrice ?? product.price)}</td><td className="px-3 py-2 text-ink">{product.stock === null ? 'Not tracked' : product.stock}</td><td className="px-3 py-2">{product.lowStockAlertActive ? <Badge value="LOW STOCK" /> : <Badge value={product.isActive ? 'ACTIVE' : 'INACTIVE'} />}</td></tr>)}</tbody>
              </table>
            </div>}
          </Section>

          <p className="rounded-xl border border-aqua-5/20 bg-aqua-1/20 p-4 text-xs leading-relaxed text-muted">Privacy boundary: this CRM view intentionally excludes prescriptions, uploaded documents, clinical notes, diagnoses, appointment notes, and patient-care content.</p>
        </div>
        <div className="sticky bottom-0 border-t border-line bg-white p-4">
          <button type="button" onClick={onClose} className="w-full rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink hover:bg-aqua-1/30">Close details</button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label: cardLabel, value, detail, highlight = false }: { label: string; value: string; detail?: string; highlight?: boolean }) {
  return <div className={`rounded-2xl border p-4 ${highlight ? 'border-aqua-5/35 bg-aqua-1/30' : 'border-line bg-white'}`}>
    <p className="text-xs font-bold uppercase tracking-wide text-muted">{cardLabel}</p>
    <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
    {detail && <p className="mt-2 text-xs leading-relaxed text-muted">{detail}</p>}
  </div>;
}

export default function MyDoctorPlusLeads() {
  const [projectId, setProjectId] = useState<number | null>(null);
  const [result, setResult] = useState<MyDoctorLeadResponse>(EMPTY_RESPONSE);
  const [filters, setFilters] = useState<MyDoctorLeadFilters>(EMPTY_FILTERS);
  const [debouncedFilters, setDebouncedFilters] = useState<MyDoctorLeadFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<MyDoctorLead | null>(null);

  const resolveProjectId = useCallback(async (): Promise<number> => {
    if (projectId) return projectId;
    const response = await api.get<Project[]>('/projects');
    const projects = Array.isArray(response.data) ? response.data : [];
    const project = projects.find((entry) => entry.slug === 'mydoctorplus');
    if (!project) throw new Error('My Doctor Plus is not available in Projects. Ask an administrator to activate it and grant access.');
    setProjectId(project.id);
    return project.id;
  }, [projectId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedFilters(filters), 350);
    return () => window.clearTimeout(timeout);
  }, [filters]);

  const loadLeads = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const id = await resolveProjectId();
      const params: MyDoctorLeadFilters = { ...debouncedFilters, page, limit: 25 };
      Object.keys(params).forEach((key) => {
        const typedKey = key as keyof MyDoctorLeadFilters;
        if (params[typedKey] === '') delete params[typedKey];
      });
      setResult(await fetchMyDoctorPlusLeads(id, params));
    } catch (loadError: any) {
      console.error('Failed to load My Doctor Plus analytics:', loadError);
      setResult(EMPTY_RESPONSE);
      setError(loadError?.response?.data?.message || loadError?.message || 'Unable to load My Doctor Plus analytics.');
    } finally {
      setLoading(false);
    }
  }, [debouncedFilters, page, resolveProjectId]);

  useEffect(() => { void loadLeads(); }, [loadLeads]);

  const updateFilters = (updates: Partial<MyDoctorLeadFilters>) => {
    setPage(1);
    setFilters((current) => ({ ...current, ...updates }));
  };
  const inputClass = 'w-full rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20';
  const revenue = result.stats.payments.revenue;

  return (
    <div className="space-y-6">
      <Topbar title="My Doctor Plus Leads & Analytics" subtitle="Live registrations, subscriptions, payments, products and operational totals from My Doctor Plus" actions={<button type="button" onClick={() => void loadLeads()} disabled={loading} className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-aqua-1/30 disabled:opacity-50">{loading ? 'Loading…' : 'Refresh'}</button>} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total registrations" value={result.stats.registrations.toLocaleString()} detail={`${result.stats.roleCounts.PATIENT} patients · ${result.stats.roleCounts.DOCTOR} doctors`} />
        <StatCard label="Business accounts" value={`${result.stats.roleCounts.PHARMACY + result.stats.roleCounts.PARAPHARMACY}`} detail={`${result.stats.roleCounts.PHARMACY} pharmacies · ${result.stats.roleCounts.PARAPHARMACY} parapharmacies`} />
        <StatCard label="Active subscriptions" value={result.stats.subscriptionCounts.ACTIVE.toLocaleString()} detail={`${result.stats.subscriptionCounts.EXPIRED} expired · ${result.stats.subscriptionCounts.CANCELLED} cancelled`} />
        <StatCard label="Successful transaction revenue" value={formatMoney(revenue.total, revenue.currency)} detail={`Subscriptions ${formatMoney(revenue.subscriptions, revenue.currency)} · Orders ${formatMoney(revenue.orders, revenue.currency)}`} highlight />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Subscription payments" value={result.stats.payments.successful.toLocaleString()} />
        <StatCard label="Products" value={result.stats.products.total.toLocaleString()} detail={`${result.stats.products.lowStock} low-stock alerts`} />
        <StatCard label="Orders" value={result.stats.orders.total.toLocaleString()} detail={`Paid order value ${formatMoney(result.stats.orders.paidRevenue)}`} />
        <StatCard label="Appointments revenue" value={formatMoney(revenue.appointments, revenue.currency)} detail="Successful appointment transactions" />
      </div>

      <div className="rounded-2xl border border-line bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">Filters update automatically. Records are read live from My Doctor Plus.</p>
          <button type="button" onClick={() => { setPage(1); setFilters({ ...EMPTY_FILTERS }); }} className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-aqua-1/30">Clear filters</button>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input className={inputClass} placeholder="Search name, email or phone" value={filters.search || ''} onChange={(event) => updateFilters({ search: event.target.value })} />
          <input className={inputClass} placeholder="Name" value={filters.name || ''} onChange={(event) => updateFilters({ name: event.target.value })} />
          <input className={inputClass} type="email" placeholder="Email" value={filters.email || ''} onChange={(event) => updateFilters({ email: event.target.value })} />
          <select className={inputClass} value={filters.role || ''} onChange={(event) => updateFilters({ role: event.target.value })}><option value="">All user types</option>{['PATIENT', 'DOCTOR', 'PHARMACY', 'PARAPHARMACY', 'ADMIN'].map((role) => <option key={role} value={role}>{label(role)}</option>)}</select>
          <select className={inputClass} value={filters.status || ''} onChange={(event) => updateFilters({ status: event.target.value })}><option value="">All account statuses</option>{['PENDING', 'APPROVED', 'REJECTED', 'BLOCKED'].map((status) => <option key={status} value={status}>{label(status)}</option>)}</select>
          <select className={inputClass} value={filters.subscriptionPlan || ''} onChange={(event) => updateFilters({ subscriptionPlan: event.target.value })}><option value="">All subscription plans</option>{result.filterOptions.subscriptionPlans.map((plan) => <option key={plan} value={plan}>{plan}</option>)}</select>
          <select className={inputClass} value={filters.subscriptionStatus || ''} onChange={(event) => updateFilters({ subscriptionStatus: event.target.value })}><option value="">All subscription statuses</option>{result.filterOptions.subscriptionStatuses.map((status) => <option key={status} value={status}>{label(status)}</option>)}</select>
          <select className={inputClass} value={filters.paymentStatus || ''} onChange={(event) => updateFilters({ paymentStatus: event.target.value })}><option value="">Any payment status</option>{result.filterOptions.paymentStatuses.map((status) => <option key={status} value={status}>{label(status)}</option>)}</select>
          <input className={inputClass} placeholder="City" value={filters.city || ''} onChange={(event) => updateFilters({ city: event.target.value })} />
          <input className={inputClass} placeholder="Country" value={filters.country || ''} onChange={(event) => updateFilters({ country: event.target.value })} />
          <input className={inputClass} type="date" aria-label="Registration from date" value={filters.fromDate || ''} onChange={(event) => updateFilters({ fromDate: event.target.value })} />
          <input className={inputClass} type="date" aria-label="Registration to date" value={filters.toDate || ''} onChange={(event) => updateFilters({ toDate: event.target.value })} />
          <select className={inputClass} value={filters.sortBy || 'createdAt'} onChange={(event) => updateFilters({ sortBy: event.target.value as MyDoctorLeadFilters['sortBy'] })}><option value="createdAt">Sort by registration date</option><option value="updatedAt">Sort by last update</option><option value="name">Sort by name</option><option value="role">Sort by user type</option><option value="status">Sort by status</option></select>
          <select className={inputClass} value={filters.sortDirection || 'desc'} onChange={(event) => updateFilters({ sortDirection: event.target.value as MyDoctorLeadFilters['sortDirection'] })}><option value="desc">Descending</option><option value="asc">Ascending</option></select>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
        {loading ? <div className="flex h-64 items-center justify-center"><div className="h-12 w-12 animate-spin rounded-full border-b-2 border-aqua-5" /></div>
          : error ? <div className="p-8 text-center text-bad">{error}</div>
            : <><div className="overflow-x-auto"><table className="min-w-[800px] w-full table-fixed">
              <thead className="border-b border-line bg-aqua-1/30"><tr><th className="w-[25%] px-4 py-3 text-left text-xs font-bold uppercase text-muted">User</th><th className="w-[13%] px-3 py-3 text-left text-xs font-bold uppercase text-muted">Type</th><th className="w-[18%] px-3 py-3 text-left text-xs font-bold uppercase text-muted">Profile</th><th className="w-[14%] px-3 py-3 text-left text-xs font-bold uppercase text-muted">Subscription</th><th className="w-[12%] px-3 py-3 text-left text-xs font-bold uppercase text-muted">Status</th><th className="w-[10%] px-3 py-3 text-left text-xs font-bold uppercase text-muted">Registered</th><th className="w-[8%] px-3 py-3 text-right text-xs font-bold uppercase text-muted">Action</th></tr></thead>
              <tbody>{result.users.map((lead) => <tr key={lead.id} className="border-b border-line/50 transition-colors hover:bg-aqua-1/10">
                <td className="px-4 py-3 align-top"><p className="truncate font-semibold text-ink" title={display(lead.name)}>{display(lead.name)}</p><p className="truncate text-sm text-muted" title={display(lead.email)}>{display(lead.email)}</p></td>
                <td className="px-3 py-3 align-top"><Badge value={lead.role} role /></td>
                <td className="px-3 py-3 align-top text-sm text-muted"><p className="line-clamp-2">{lead.doctor?.specialization || lead.pharmacy?.name || 'Patient account'}</p></td>
                <td className="px-3 py-3 align-top">{lead.subscription ? <><p className="truncate text-sm font-medium text-ink">{display(lead.subscription.plan?.name)}</p><Badge value={lead.subscription.status} /></> : <span className="text-sm text-muted">Not subscribed</span>}</td>
                <td className="px-3 py-3 align-top"><Badge value={lead.status} /></td>
                <td className="px-3 py-3 align-top text-sm text-muted">{formatDate(lead.createdAt)}</td>
                <td className="px-2 py-3 text-right align-middle"><button type="button" onClick={() => setSelectedLead(lead)} className="inline-flex h-8 items-center justify-center whitespace-nowrap rounded-lg border border-aqua-5/35 bg-aqua-1/30 px-2 text-xs font-semibold text-aqua-5 hover:bg-aqua-1/60">View</button></td>
              </tr>)}</tbody>
            </table></div>
            {result.users.length === 0 && <div className="p-8 text-center text-muted">No My Doctor Plus registrations match these filters.</div>}
            {result.users.length > 0 && <div className="flex items-center justify-between gap-3 border-t border-line bg-aqua-1/10 px-4 py-3"><p className="text-sm text-muted">Showing {(result.pagination.page - 1) * result.pagination.limit + 1}–{Math.min(result.pagination.page * result.pagination.limit, result.pagination.total)} of {result.pagination.total}</p><div className="flex items-center gap-2"><button type="button" disabled={result.pagination.page <= 1} onClick={() => setPage((current) => current - 1)} className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-white disabled:opacity-40">Previous</button><span className="text-sm text-ink">{result.pagination.page} / {result.pagination.totalPages}</span><button type="button" disabled={result.pagination.page >= result.pagination.totalPages} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-white disabled:opacity-40">Next</button></div></div>}
          </>}
      </div>
      <LeadDetailsModal lead={selectedLead} onClose={() => setSelectedLead(null)} />
    </div>
  );
}
