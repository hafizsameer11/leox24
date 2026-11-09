import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import Topbar from '../components/layout/Topbar';
import api from '../services/api';
import { fetchMyDoctorPlusLeads } from '../services/myDoctorPlusApi';
import type { Project } from '../types/project.types';
import type { MyDoctorLead, MyDoctorLeadFilters, MyDoctorLeadResponse } from '../types/myDoctorPlusLead';
import { normalizeLanguageCode } from '../utils/i18n';

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

const display = (value?: string | number | null, fallback = '') => String(value ?? '').trim() || fallback;
const label = (value?: string | null, fallback = '—') => display(value, fallback).replace(/_/g, ' ');

function formatDate(value?: string | null, fallback = '', locale = 'en-US'): string {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(locale);
}

function formatMoney(amount = 0, currency = 'EUR', locale = 'en-US'): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
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
  const { t } = useTranslation();
  const key = String(value || '').toUpperCase() || 'NOT_PROVIDED';
  return <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${role ? roleClass(value) : statusClass(value)}`}>{t(`myDoctorPlusLeads.values.${key}`, { defaultValue: label(value, t('myDoctorPlusLeads.notProvided')) })}</span>;
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
  const { t, i18n } = useTranslation();
  if (!lead) return null;
  const locale = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language) === 'it' ? 'it-IT' : 'en-US';
  const notProvided = t('myDoctorPlusLeads.notProvided');
  const notApplicable = t('myDoctorPlusLeads.notApplicable');
  const subscription = lead.subscription;
  const revenue = lead.payments.filter((payment) => payment.status === 'SUCCESS').reduce((total, payment) => total + payment.amount, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-label={t('myDoctorPlusLeads.ariaLeadDetails')}>
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-line bg-white px-6 py-5">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-aqua-5">{t('myDoctorPlusLeads.account')}</p>
            <h2 className="mt-1 truncate text-xl font-bold text-ink">{display(lead.name, notProvided)}</h2>
            <p className="mt-1 truncate text-sm text-muted">{display(lead.email, notProvided)}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t('myDoctorPlusLeads.closeDetails')} className="ml-4 rounded-lg px-3 py-1 text-2xl leading-none text-muted hover:bg-aqua-1/40 hover:text-ink">×</button>
        </div>

        <div className="space-y-6 p-6">
          <Section title={t('myDoctorPlusLeads.registrationAndContact')}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <DetailItem title={t('myDoctorPlusLeads.userType')}><Badge value={lead.role} role /></DetailItem>
              <DetailItem title={t('myDoctorPlusLeads.accountStatus')}><Badge value={lead.status} /></DetailItem>
              <DetailItem title={t('myDoctorPlusLeads.registered')}>{formatDate(lead.createdAt, notProvided, locale)}</DetailItem>
              <DetailItem title={t('myDoctorPlusLeads.emailVerified')}>{lead.emailVerified ? t('myDoctorPlusLeads.yes') : t('myDoctorPlusLeads.no')}</DetailItem>
              <DetailItem title={t('myDoctorPlusLeads.phoneVerified')}>{lead.phoneVerified ? t('myDoctorPlusLeads.yes') : t('myDoctorPlusLeads.no')}</DetailItem>
              <DetailItem title={t('myDoctorPlusLeads.phone')}>{display(lead.phone, notProvided)}</DetailItem>
              <DetailItem title={t('myDoctorPlusLeads.city')}>{display(lead.address.city, notProvided)}</DetailItem>
              <DetailItem title={t('myDoctorPlusLeads.region')}>{display(lead.address.region, notProvided)}</DetailItem>
              <DetailItem title={t('myDoctorPlusLeads.country')}>{display(lead.address.country, notProvided)}</DetailItem>
            </div>
          </Section>

          {lead.doctor && <Section title={t('myDoctorPlusLeads.doctorProfile')}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <DetailItem title={t('myDoctorPlusLeads.professionalTitle')}>{display(lead.doctor.title, notProvided)}</DetailItem>
              <DetailItem title={t('myDoctorPlusLeads.specialization')}>{display(lead.doctor.specialization, notProvided)}</DetailItem>
              <DetailItem title={t('myDoctorPlusLeads.experience')}>{lead.doctor.experienceYears === null ? notProvided : t('myDoctorPlusLeads.years', { count: lead.doctor.experienceYears })}</DetailItem>
              <DetailItem title={t('myDoctorPlusLeads.verified')}>{lead.doctor.isVerified ? t('myDoctorPlusLeads.yes') : t('myDoctorPlusLeads.no')}</DetailItem>
              <DetailItem title={t('myDoctorPlusLeads.profileCompleted')}>{lead.doctor.profileCompleted ? t('myDoctorPlusLeads.yes') : t('myDoctorPlusLeads.no')}</DetailItem>
              <DetailItem title={t('myDoctorPlusLeads.onlineConsultation')}>{lead.doctor.isAvailableOnline ? t('myDoctorPlusLeads.available') : t('myDoctorPlusLeads.notAvailable')}</DetailItem>
              <DetailItem title={t('myDoctorPlusLeads.clinicConsultationFee')}>{lead.doctor.consultationFees.clinic === null ? notProvided : formatMoney(lead.doctor.consultationFees.clinic, 'EUR', locale)}</DetailItem>
              <DetailItem title={t('myDoctorPlusLeads.onlineConsultationFee')}>{lead.doctor.consultationFees.online === null ? notProvided : formatMoney(lead.doctor.consultationFees.online, 'EUR', locale)}</DetailItem>
              <DetailItem title={t('myDoctorPlusLeads.appointments')}>{lead.operations.appointments ? t('myDoctorPlusLeads.appointmentSummary', { total: lead.operations.appointments.total, completed: lead.operations.appointments.completed }) : t('myDoctorPlusLeads.noOperationalRecords')}</DetailItem>
            </div>
            {lead.doctor.services.length > 0 && <div className="mt-3 rounded-xl border border-line bg-slate-50 p-4 text-sm text-ink"><span className="font-semibold">{t('myDoctorPlusLeads.services')}: </span>{lead.doctor.services.map((service) => `${display(service.name, notProvided)}${service.price === null ? '' : ` (${formatMoney(service.price, 'EUR', locale)})`}`).join(' · ')}</div>}
            {lead.doctor.biography && <p className="mt-3 rounded-xl border border-line bg-slate-50 p-4 text-sm leading-relaxed text-ink">{lead.doctor.biography}</p>}
          </Section>}

          {lead.pharmacy && <Section title={t('myDoctorPlusLeads.pharmacyProfile')}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <DetailItem title={t('myDoctorPlusLeads.businessName')}>{display(lead.pharmacy.name, notProvided)}</DetailItem>
              <DetailItem title={t('myDoctorPlusLeads.businessType')}>{t(`myDoctorPlusLeads.values.${String(lead.pharmacy.kind || '').toUpperCase()}`, { defaultValue: label(lead.pharmacy.kind, notProvided) })}</DetailItem>
              <DetailItem title={t('myDoctorPlusLeads.businessStatus')}>{lead.pharmacy.isActive ? t('myDoctorPlusLeads.active') : t('myDoctorPlusLeads.inactive')}</DetailItem>
              <DetailItem title={t('myDoctorPlusLeads.phone')}>{display(lead.pharmacy.phone, notProvided)}</DetailItem>
              <DetailItem title={t('myDoctorPlusLeads.orders')}>{lead.operations.orders ? t('myDoctorPlusLeads.orderSummary', { total: lead.operations.orders.total, paid: lead.operations.orders.paid }) : t('myDoctorPlusLeads.noOperationalRecords')}</DetailItem>
              <DetailItem title={t('myDoctorPlusLeads.paidOrderValue')}>{lead.operations.orders ? formatMoney(lead.operations.orders.paidRevenue, 'EUR', locale) : notProvided}</DetailItem>
            </div>
          </Section>}

          <Section title={t('myDoctorPlusLeads.subscriptionAndPayments')}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <DetailItem title={t('myDoctorPlusLeads.currentPlan')}>{display(subscription?.plan?.name, t('myDoctorPlusLeads.notSubscribed'))}</DetailItem>
              <DetailItem title={t('myDoctorPlusLeads.subscriptionStatus')}><Badge value={subscription?.status || 'NOT_SUBSCRIBED'} /></DetailItem>
              <DetailItem title={t('myDoctorPlusLeads.planPrice')}>{subscription?.plan ? formatMoney(subscription.plan.price, subscription.plan.currency, locale) : notApplicable}</DetailItem>
              <DetailItem title={t('myDoctorPlusLeads.started')}>{formatDate(subscription?.startDate, notProvided, locale)}</DetailItem>
              <DetailItem title={t('myDoctorPlusLeads.expires')}>{formatDate(subscription?.endDate, notProvided, locale)}</DetailItem>
              <DetailItem title={t('myDoctorPlusLeads.successfulPayments')}>{formatMoney(revenue, 'EUR', locale)}</DetailItem>
            </div>
            {lead.subscriptionHistory.length > 0 && <div className="mt-4 overflow-x-auto rounded-xl border border-line">
              <table className="min-w-full text-sm">
                <thead className="bg-aqua-1/30 text-left text-xs font-bold uppercase text-muted"><tr><th className="px-3 py-2">{t('myDoctorPlusLeads.plan')}</th><th className="px-3 py-2">{t('myDoctorPlusLeads.status')}</th><th className="px-3 py-2">{t('myDoctorPlusLeads.start')}</th><th className="px-3 py-2">{t('myDoctorPlusLeads.end')}</th></tr></thead>
                <tbody>{lead.subscriptionHistory.map((item, index) => <tr key={item.id || index} className="border-t border-line/70"><td className="px-3 py-2 font-medium text-ink">{display(item.plan?.name, notProvided)}</td><td className="px-3 py-2"><Badge value={item.status} /></td><td className="px-3 py-2 text-muted">{formatDate(item.startDate, notProvided, locale)}</td><td className="px-3 py-2 text-muted">{formatDate(item.endDate, notProvided, locale)}</td></tr>)}</tbody>
              </table>
            </div>}
            {lead.payments.length > 0 && <div className="mt-4 overflow-x-auto rounded-xl border border-line">
              <table className="min-w-full text-sm">
                <thead className="bg-aqua-1/30 text-left text-xs font-bold uppercase text-muted"><tr><th className="px-3 py-2">{t('myDoctorPlusLeads.type')}</th><th className="px-3 py-2">{t('myDoctorPlusLeads.amount')}</th><th className="px-3 py-2">{t('myDoctorPlusLeads.status')}</th><th className="px-3 py-2">{t('myDoctorPlusLeads.provider')}</th><th className="px-3 py-2">{t('myDoctorPlusLeads.date')}</th></tr></thead>
                <tbody>{lead.payments.map((payment) => <tr key={payment.id} className="border-t border-line/70"><td className="px-3 py-2 font-medium text-ink">{t(`myDoctorPlusLeads.values.${String(payment.type || '').toUpperCase()}`, { defaultValue: label(payment.type, notProvided) })}</td><td className="px-3 py-2 text-ink">{formatMoney(payment.amount, payment.currency, locale)}</td><td className="px-3 py-2"><Badge value={payment.status} /></td><td className="px-3 py-2 text-muted">{display(payment.provider, notProvided)}</td><td className="px-3 py-2 text-muted">{formatDate(payment.createdAt, notProvided, locale)}</td></tr>)}</tbody>
              </table>
            </div>}
          </Section>

          <Section title={t('myDoctorPlusLeads.productsAndInventory')}>
            {lead.products.length === 0 ? <div className="rounded-xl border border-line bg-slate-50 p-4 text-sm text-muted">{t('myDoctorPlusLeads.noProducts')}</div> : <div className="overflow-x-auto rounded-xl border border-line">
              <table className="min-w-full text-sm">
                <thead className="bg-aqua-1/30 text-left text-xs font-bold uppercase text-muted"><tr><th className="px-3 py-2">{t('myDoctorPlusLeads.product')}</th><th className="px-3 py-2">{t('myDoctorPlusLeads.category')}</th><th className="px-3 py-2">{t('myDoctorPlusLeads.price')}</th><th className="px-3 py-2">{t('myDoctorPlusLeads.stock')}</th><th className="px-3 py-2">{t('myDoctorPlusLeads.status')}</th></tr></thead>
                <tbody>{lead.products.map((product) => <tr key={product.id} className="border-t border-line/70"><td className="px-3 py-2"><p className="font-medium text-ink">{display(product.name, notProvided)}</p><p className="text-xs text-muted">{display(product.sku, notProvided)}</p></td><td className="px-3 py-2 text-muted">{display(product.category, notProvided)}</td><td className="px-3 py-2 text-ink">{formatMoney(product.discountPrice ?? product.price, 'EUR', locale)}</td><td className="px-3 py-2 text-ink">{product.stock === null ? t('myDoctorPlusLeads.notTracked') : product.stock}</td><td className="px-3 py-2">{product.lowStockAlertActive ? <Badge value="LOW_STOCK" /> : <Badge value={product.isActive ? 'ACTIVE' : 'INACTIVE'} />}</td></tr>)}</tbody>
              </table>
            </div>}
          </Section>

          <p className="rounded-xl border border-aqua-5/20 bg-aqua-1/20 p-4 text-xs leading-relaxed text-muted">{t('myDoctorPlusLeads.privacyBoundary')}</p>
        </div>
        <div className="sticky bottom-0 border-t border-line bg-white p-4">
          <button type="button" onClick={onClose} className="w-full rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink hover:bg-aqua-1/30">{t('myDoctorPlusLeads.closeDetails')}</button>
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
  const { t, i18n } = useTranslation();
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
    if (!project) throw new Error(t('myDoctorPlusLeads.projectUnavailable'));
    setProjectId(project.id);
    return project.id;
  }, [projectId, t]);

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
      setError(loadError?.response?.data?.message || loadError?.message || t('myDoctorPlusLeads.loadError'));
    } finally {
      setLoading(false);
    }
  }, [debouncedFilters, page, resolveProjectId, t]);

  useEffect(() => { void loadLeads(); }, [loadLeads]);

  const updateFilters = (updates: Partial<MyDoctorLeadFilters>) => {
    setPage(1);
    setFilters((current) => ({ ...current, ...updates }));
  };
  const inputClass = 'w-full rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20';
  const revenue = result.stats.payments.revenue;
  const locale = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language) === 'it' ? 'it-IT' : 'en-US';
  const options = result.filterOptions;

  return (
    <div className="space-y-6">
      <Topbar title={t('myDoctorPlusLeads.title')} subtitle={t('myDoctorPlusLeads.subtitle')} actions={<button type="button" onClick={() => void loadLeads()} disabled={loading} className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-aqua-1/30 disabled:opacity-50">{loading ? t('myDoctorPlusLeads.loading') : t('myDoctorPlusLeads.refresh')}</button>} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t('myDoctorPlusLeads.totalRegistrations')} value={result.stats.registrations.toLocaleString(locale)} detail={t('myDoctorPlusLeads.patientsDoctors', { patients: result.stats.roleCounts.PATIENT, doctors: result.stats.roleCounts.DOCTOR })} />
        <StatCard label={t('myDoctorPlusLeads.businessAccounts')} value={`${result.stats.roleCounts.PHARMACY + result.stats.roleCounts.PARAPHARMACY}`} detail={t('myDoctorPlusLeads.businessAccountsDetail', { pharmacies: result.stats.roleCounts.PHARMACY, parapharmacies: result.stats.roleCounts.PARAPHARMACY })} />
        <StatCard label={t('myDoctorPlusLeads.activeSubscriptions')} value={result.stats.subscriptionCounts.ACTIVE.toLocaleString(locale)} detail={t('myDoctorPlusLeads.subscriptionCountsDetail', { expired: result.stats.subscriptionCounts.EXPIRED, cancelled: result.stats.subscriptionCounts.CANCELLED })} />
        <StatCard label={t('myDoctorPlusLeads.successfulTransactionRevenue')} value={formatMoney(revenue.total, revenue.currency, locale)} detail={t('myDoctorPlusLeads.revenueBreakdown', { subscriptions: formatMoney(revenue.subscriptions, revenue.currency, locale), orders: formatMoney(revenue.orders, revenue.currency, locale) })} highlight />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t('myDoctorPlusLeads.subscriptionPayments')} value={result.stats.payments.successful.toLocaleString(locale)} />
        <StatCard label={t('myDoctorPlusLeads.products')} value={result.stats.products.total.toLocaleString(locale)} detail={t('myDoctorPlusLeads.lowStockAlerts', { count: result.stats.products.lowStock })} />
        <StatCard label={t('myDoctorPlusLeads.orders')} value={result.stats.orders.total.toLocaleString(locale)} detail={t('myDoctorPlusLeads.paidOrderValueDetail', { value: formatMoney(result.stats.orders.paidRevenue, revenue.currency, locale) })} />
        <StatCard label={t('myDoctorPlusLeads.appointmentsRevenue')} value={formatMoney(revenue.appointments, revenue.currency, locale)} detail={t('myDoctorPlusLeads.successfulAppointmentTransactions')} />
      </div>

      <div className="rounded-2xl border border-line bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">{t('myDoctorPlusLeads.autoFilterHelp')}</p>
          <button type="button" onClick={() => { setPage(1); setFilters({ ...EMPTY_FILTERS }); }} className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-aqua-1/30">{t('myDoctorPlusLeads.clearFilters')}</button>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input className={inputClass} placeholder={t('myDoctorPlusLeads.search')} value={filters.search || ''} onChange={(event) => updateFilters({ search: event.target.value })} />
          <input className={inputClass} placeholder={t('myDoctorPlusLeads.name')} value={filters.name || ''} onChange={(event) => updateFilters({ name: event.target.value })} />
          <input className={inputClass} type="email" placeholder={t('myDoctorPlusLeads.email')} value={filters.email || ''} onChange={(event) => updateFilters({ email: event.target.value })} />
          <select className={inputClass} value={filters.role || ''} onChange={(event) => updateFilters({ role: event.target.value })}><option value="">{t('myDoctorPlusLeads.allUserTypes')}</option>{['PATIENT', 'DOCTOR', 'PHARMACY', 'PARAPHARMACY', 'ADMIN'].map((role) => <option key={role} value={role}>{t(`myDoctorPlusLeads.values.${role}`)}</option>)}</select>
          <select className={inputClass} value={filters.status || ''} onChange={(event) => updateFilters({ status: event.target.value })}><option value="">{t('myDoctorPlusLeads.allAccountStatuses')}</option>{['PENDING', 'APPROVED', 'REJECTED', 'BLOCKED'].map((status) => <option key={status} value={status}>{t(`myDoctorPlusLeads.values.${status}`)}</option>)}</select>
          <select className={inputClass} value={filters.subscriptionPlan || ''} onChange={(event) => updateFilters({ subscriptionPlan: event.target.value })}><option value="">{t('myDoctorPlusLeads.allSubscriptionPlans')}</option>{options.subscriptionPlans.map((plan) => <option key={plan} value={plan}>{plan}</option>)}</select>
          <select className={inputClass} value={filters.subscriptionStatus || ''} onChange={(event) => updateFilters({ subscriptionStatus: event.target.value })}><option value="">{t('myDoctorPlusLeads.allSubscriptionStatuses')}</option>{options.subscriptionStatuses.map((status) => <option key={status} value={status}>{t(`myDoctorPlusLeads.values.${status}`, { defaultValue: label(status) })}</option>)}</select>
          <select className={inputClass} value={filters.paymentStatus || ''} onChange={(event) => updateFilters({ paymentStatus: event.target.value })}><option value="">{t('myDoctorPlusLeads.anyPaymentStatus')}</option>{options.paymentStatuses.map((status) => <option key={status} value={status}>{t(`myDoctorPlusLeads.values.${status}`, { defaultValue: label(status) })}</option>)}</select>
          <input className={inputClass} placeholder={t('myDoctorPlusLeads.city')} value={filters.city || ''} onChange={(event) => updateFilters({ city: event.target.value })} />
          <input className={inputClass} placeholder={t('myDoctorPlusLeads.country')} value={filters.country || ''} onChange={(event) => updateFilters({ country: event.target.value })} />
          <input className={inputClass} type="date" aria-label={t('myDoctorPlusLeads.registrationFrom')} value={filters.fromDate || ''} onChange={(event) => updateFilters({ fromDate: event.target.value })} />
          <input className={inputClass} type="date" aria-label={t('myDoctorPlusLeads.registrationTo')} value={filters.toDate || ''} onChange={(event) => updateFilters({ toDate: event.target.value })} />
          <select className={inputClass} value={filters.sortBy || 'createdAt'} onChange={(event) => updateFilters({ sortBy: event.target.value as MyDoctorLeadFilters['sortBy'] })}><option value="createdAt">{t('myDoctorPlusLeads.sortByRegistrationDate')}</option><option value="updatedAt">{t('myDoctorPlusLeads.sortByLastUpdate')}</option><option value="name">{t('myDoctorPlusLeads.sortByName')}</option><option value="role">{t('myDoctorPlusLeads.sortByUserType')}</option><option value="status">{t('myDoctorPlusLeads.sortByStatus')}</option></select>
          <select className={inputClass} value={filters.sortDirection || 'desc'} onChange={(event) => updateFilters({ sortDirection: event.target.value as MyDoctorLeadFilters['sortDirection'] })}><option value="desc">{t('myDoctorPlusLeads.descending')}</option><option value="asc">{t('myDoctorPlusLeads.ascending')}</option></select>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
        {loading ? <div className="flex h-64 items-center justify-center"><div className="h-12 w-12 animate-spin rounded-full border-b-2 border-aqua-5" /></div>
          : error ? <div className="p-8 text-center text-bad">{error}</div>
            : <><div className="overflow-x-auto"><table className="min-w-[800px] w-full table-fixed">
              <thead className="border-b border-line bg-aqua-1/30"><tr><th className="w-[25%] px-4 py-3 text-left text-xs font-bold uppercase text-muted">{t('myDoctorPlusLeads.user')}</th><th className="w-[13%] px-3 py-3 text-left text-xs font-bold uppercase text-muted">{t('myDoctorPlusLeads.userType')}</th><th className="w-[18%] px-3 py-3 text-left text-xs font-bold uppercase text-muted">{t('myDoctorPlusLeads.profile')}</th><th className="w-[14%] px-3 py-3 text-left text-xs font-bold uppercase text-muted">{t('myDoctorPlusLeads.subscription')}</th><th className="w-[12%] px-3 py-3 text-left text-xs font-bold uppercase text-muted">{t('myDoctorPlusLeads.status')}</th><th className="w-[10%] px-3 py-3 text-left text-xs font-bold uppercase text-muted">{t('myDoctorPlusLeads.registered')}</th><th className="w-[8%] px-3 py-3 text-right text-xs font-bold uppercase text-muted">{t('myDoctorPlusLeads.action')}</th></tr></thead>
              <tbody>{result.users.map((lead) => <tr key={lead.id} className="border-b border-line/50 transition-colors hover:bg-aqua-1/10">
                <td className="px-4 py-3 align-top"><p className="truncate font-semibold text-ink" title={display(lead.name, t('myDoctorPlusLeads.notProvided'))}>{display(lead.name, t('myDoctorPlusLeads.notProvided'))}</p><p className="truncate text-sm text-muted" title={display(lead.email, t('myDoctorPlusLeads.notProvided'))}>{display(lead.email, t('myDoctorPlusLeads.notProvided'))}</p></td>
                <td className="px-3 py-3 align-top"><Badge value={lead.role} role /></td>
                <td className="px-3 py-3 align-top text-sm text-muted"><p className="line-clamp-2">{lead.doctor?.specialization || lead.pharmacy?.name || t('myDoctorPlusLeads.patientAccount')}</p></td>
                <td className="px-3 py-3 align-top">{lead.subscription ? <><p className="truncate text-sm font-medium text-ink">{display(lead.subscription.plan?.name, t('myDoctorPlusLeads.notProvided'))}</p><Badge value={lead.subscription.status} /></> : <span className="text-sm text-muted">{t('myDoctorPlusLeads.notSubscribed')}</span>}</td>
                <td className="px-3 py-3 align-top"><Badge value={lead.status} /></td>
                <td className="px-3 py-3 align-top text-sm text-muted">{formatDate(lead.createdAt, t('myDoctorPlusLeads.notProvided'), locale)}</td>
                <td className="px-2 py-3 text-right align-middle"><button type="button" onClick={() => setSelectedLead(lead)} className="inline-flex h-8 items-center justify-center whitespace-nowrap rounded-lg border border-aqua-5/35 bg-aqua-1/30 px-2 text-xs font-semibold text-aqua-5 hover:bg-aqua-1/60">{t('myDoctorPlusLeads.viewDetails')}</button></td>
              </tr>)}</tbody>
            </table></div>
            {result.users.length === 0 && <div className="p-8 text-center text-muted">{t('myDoctorPlusLeads.noMatches')}</div>}
            {result.users.length > 0 && <div className="flex items-center justify-between gap-3 border-t border-line bg-aqua-1/10 px-4 py-3"><p className="text-sm text-muted">{t('myDoctorPlusLeads.showing', { from: (result.pagination.page - 1) * result.pagination.limit + 1, to: Math.min(result.pagination.page * result.pagination.limit, result.pagination.total), total: result.pagination.total })}</p><div className="flex items-center gap-2"><button type="button" disabled={result.pagination.page <= 1} onClick={() => setPage((current) => current - 1)} className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-white disabled:opacity-40">{t('myDoctorPlusLeads.previous')}</button><span className="text-sm text-ink">{t('myDoctorPlusLeads.pageOf', { current: result.pagination.page, total: result.pagination.totalPages })}</span><button type="button" disabled={result.pagination.page >= result.pagination.totalPages} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-white disabled:opacity-40">{t('myDoctorPlusLeads.next')}</button></div></div>}
          </>}
      </div>
      <LeadDetailsModal lead={selectedLead} onClose={() => setSelectedLead(null)} />
    </div>
  );
}
