import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import Topbar from '../components/layout/Topbar';
import api from '../services/api';
import { fetchMyPetPlusLeads } from '../services/myPetPlusApi';
import type { Project } from '../types/project.types';
import type {
  MyPetPlusLead,
  MyPetPlusLeadFilters,
  MyPetPlusLeadResponse,
} from '../types/myPetPlusLead';

const EMPTY_FILTERS: MyPetPlusLeadFilters = {
  search: '',
  name: '',
  email: '',
  role: '',
  status: '',
  specialization: '',
  city: '',
  country: '',
  area: '',
  region: '',
  documentType: '',
};

const EMPTY_RESPONSE: MyPetPlusLeadResponse = {
  users: [],
  pagination: { page: 1, limit: 25, total: 0, totalPages: 1 },
  filterOptions: {
    roles: [],
    statuses: [],
    specializations: [],
    cities: [],
    countries: [],
    regions: [],
    areas: [],
    documentTypes: [],
  },
  stats: {
    subscriptionRevenue: {
      totalRevenue: 0,
      totalPayments: 0,
      veterinarianRevenue: 0,
      pharmacyRevenue: 0,
      currency: 'EUR',
    },
  },
  generatedAt: '',
};

const USER_ROLE_OPTIONS = ['VETERINARIAN', 'PET_OWNER', 'PET_STORE', 'PARAPHARMACY', 'ADMIN'];
const REGISTRATION_STATUS_OPTIONS = ['PENDING', 'APPROVED', 'REJECTED', 'BLOCKED'];

const display = (value?: string | null) => String(value || '').trim() || '—';
const label = (value?: string | null) => display(value).replace(/_/g, ' ');

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatMoney(amount = 0, currency = 'EUR'): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${Number(amount || 0).toFixed(2)} ${currency}`;
  }
}

function statusClass(status?: string | null): string {
  switch (String(status || '').toUpperCase()) {
    case 'APPROVED':
    case 'ACTIVE':
      return 'bg-ok/15 text-ok border-ok/30';
    case 'PENDING':
      return 'bg-warn/15 text-warn border-warn/30';
    case 'REJECTED':
    case 'BLOCKED':
    case 'EXPIRED':
      return 'bg-bad/15 text-bad border-bad/30';
    default:
      return 'bg-muted/15 text-muted border-muted/30';
  }
}

function roleClass(role?: string | null): string {
  const styles: Record<string, string> = {
    VETERINARIAN: 'bg-blue-100 text-blue-800 border-blue-300',
    PET_OWNER: 'bg-green-100 text-green-800 border-green-300',
    PET_STORE: 'bg-purple-100 text-purple-800 border-purple-300',
    PARAPHARMACY: 'bg-orange-100 text-orange-800 border-orange-300',
    ADMIN: 'bg-red-100 text-red-800 border-red-300',
  };
  return styles[String(role || '').toUpperCase()] || 'bg-gray-100 text-gray-800 border-gray-300';
}

function location(lead: MyPetPlusLead): string {
  return [lead.city, lead.region, lead.country].filter(Boolean).join(' · ') || '—';
}

function profileSummary(lead: MyPetPlusLead): string {
  if (lead.role === 'VETERINARIAN') {
    return lead.specializations.map(label).join(', ') || '—';
  }

  if (lead.role === 'PET_STORE') {
    return lead.business?.name || '—';
  }

  return lead.business?.name || location(lead);
}

function StatusBadge({ status }: { status?: string | null }) {
  const { t } = useTranslation();
  const key = String(status || '').toUpperCase() || 'NOT_SUBSCRIBED';
  return <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${statusClass(status)}`}>{t(`myPetPlusLeads.values.${key}`, { defaultValue: label(status) })}</span>;
}

function DetailItem({ label: itemLabel, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-white p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">{itemLabel}</p>
      <div className="mt-1 break-words text-sm font-medium text-ink">{value}</div>
    </div>
  );
}

function LeadDetailsModal({ lead, onClose }: { lead: MyPetPlusLead | null; onClose: () => void }) {
  const { t } = useTranslation();
  if (!lead) return null;

  const isSubscriptionRole = ['VETERINARIAN', 'PET_STORE'].includes(lead.role);
  const subscription = lead.subscription;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label={t('myPetPlusLeads.ariaLeadDetails')}>
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-line bg-white px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-aqua-5">{t('myPetPlusLeads.registration')}</p>
            <h2 className="mt-1 text-xl font-bold text-ink">{display(lead.name)}</h2>
            <p className="mt-1 text-sm text-muted">{display(lead.email)}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-1 text-2xl leading-none text-muted hover:bg-aqua-1/40 hover:text-ink" aria-label={t('myPetPlusLeads.closeDetails')}>×</button>
        </div>

        <div className="space-y-6 p-6">
          <section>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">{t('myPetPlusLeads.registration')}</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DetailItem label={t('myPetPlusLeads.userType')} value={t(`myPetPlusLeads.values.${lead.role}`, { defaultValue: label(lead.role) })} />
              <DetailItem label={t('myPetPlusLeads.registrationStatus')} value={<StatusBadge status={lead.status} />} />
              <DetailItem label={t('myPetPlusLeads.registered')} value={formatDate(lead.createdAt)} />
              <DetailItem label={t('myPetPlusLeads.lastUpdated')} value={formatDate(lead.updatedAt)} />
              <DetailItem label={t('myPetPlusLeads.emailVerified')} value={lead.emailVerified ? t('myPetPlusLeads.yes') : t('myPetPlusLeads.no')} />
              <DetailItem label={t('myPetPlusLeads.phoneVerified')} value={lead.phoneVerified ? t('myPetPlusLeads.yes') : t('myPetPlusLeads.no')} />
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">{t('myPetPlusLeads.contactLocation')}</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DetailItem label={t('myPetPlusLeads.email')} value={display(lead.email)} />
              <DetailItem label={t('myPetPlusLeads.phone')} value={display(lead.phone)} />
              <DetailItem label={t('myPetPlusLeads.city')} value={display(lead.city)} />
              <DetailItem label={t('myPetPlusLeads.area')} value={display(lead.area)} />
              <DetailItem label={t('myPetPlusLeads.region')} value={display(lead.region)} />
              <DetailItem label={t('myPetPlusLeads.country')} value={display(lead.country)} />
            </div>
          </section>

          {(lead.veterinarian || lead.business) && (
            <section>
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">{t('myPetPlusLeads.profile')}</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {lead.veterinarian && <>
                  <DetailItem label={t('myPetPlusLeads.specializations')} value={lead.specializations.map(label).join(', ') || '—'} />
                  <DetailItem label={t('myPetPlusLeads.experience')} value={lead.veterinarian.experienceYears === null ? '—' : t('myPetPlusLeads.years', { count: lead.veterinarian.experienceYears })} />
                  <DetailItem label={t('myPetPlusLeads.veterinarianVerified')} value={lead.veterinarian.isVerified ? t('myPetPlusLeads.yes') : t('myPetPlusLeads.no')} />
                  <DetailItem label={t('myPetPlusLeads.profileComplete')} value={lead.veterinarian.profileCompleted ? t('myPetPlusLeads.yes') : t('myPetPlusLeads.no')} />
                </>}
                {lead.business && <>
                  <DetailItem label={t('myPetPlusLeads.businessName')} value={display(lead.business.name)} />
                  <DetailItem label={t('myPetPlusLeads.businessActive')} value={lead.business.isActive ? t('myPetPlusLeads.yes') : t('myPetPlusLeads.no')} />
                  <DetailItem label={t('myPetPlusLeads.profileComplete')} value={lead.business.profileCompleted ? t('myPetPlusLeads.yes') : t('myPetPlusLeads.no')} />
                  <DetailItem label={t('myPetPlusLeads.publicListing')} value={lead.business.isPublic ? t('myPetPlusLeads.yes') : t('myPetPlusLeads.no')} />
                </>}
              </div>
            </section>
          )}

          <section>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">{t('myPetPlusLeads.subscriptionAgreement')}</h3>
            {subscription ? (
              <div className="space-y-4 rounded-xl border border-aqua-5/20 bg-aqua-1/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-ink">{display(subscription.planName)}</p>
                  <StatusBadge status={subscription.status} />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <DetailItem label={t('myPetPlusLeads.planPrice')} value={formatMoney(subscription.planPrice, subscription.currency)} />
                  <DetailItem label={t('myPetPlusLeads.planDuration')} value={subscription.durationInDays ? t('myPetPlusLeads.days', { count: subscription.durationInDays }) : '—'} />
                  <DetailItem label={t('myPetPlusLeads.subscriptionStart')} value={formatDate(subscription.startDate)} />
                  <DetailItem label={t('myPetPlusLeads.subscriptionEnd')} value={formatDate(subscription.endDate)} />
                  <DetailItem label={t('myPetPlusLeads.planType')} value={label(subscription.planType)} />
                  <DetailItem label={t('myPetPlusLeads.subscriptionStatus')} value={<StatusBadge status={subscription.status} />} />
                </div>
                <DetailItem label={t('myPetPlusLeads.includedFeatures')} value={subscription.features.length ? subscription.features.join(', ') : t('myPetPlusLeads.noPlanFeatures')} />
                <p className="text-xs leading-relaxed text-muted">{t('myPetPlusLeads.agreementNote')}</p>
              </div>
            ) : (
              <div className="rounded-xl border border-line bg-gray-50 p-4 text-sm text-muted">
                {isSubscriptionRole ? t('myPetPlusLeads.noCurrentSubscription') : t('myPetPlusLeads.noSubscriptionForRole')}
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">{t('myPetPlusLeads.documents')}</h3>
            <p className="rounded-xl border border-line bg-gray-50 p-4 text-sm text-ink">{lead.documentTypes.length ? lead.documentTypes.map(label).join(', ') : t('myPetPlusLeads.noDocumentsRecorded')}</p>
          </section>
        </div>

        <div className="sticky bottom-0 border-t border-line bg-white p-4">
          <button type="button" onClick={onClose} className="w-full rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-aqua-1/30">{t('myPetPlusLeads.closeDetails')}</button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label: cardLabel, value, detail, highlight = false }: { label: string; value: string; detail?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${highlight ? 'border-aqua-5/35 bg-aqua-1/30' : 'border-line bg-white'}`}>
      <p className="text-xs font-bold uppercase text-muted">{cardLabel}</p>
      <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
      {detail && <p className="mt-2 text-xs leading-relaxed text-muted">{detail}</p>}
    </div>
  );
}

export default function MyPetPlusLeads() {
  const { t } = useTranslation();
  const [projectId, setProjectId] = useState<number | null>(null);
  const [result, setResult] = useState<MyPetPlusLeadResponse>(EMPTY_RESPONSE);
  const [filters, setFilters] = useState<MyPetPlusLeadFilters>(EMPTY_FILTERS);
  const [debouncedFilters, setDebouncedFilters] = useState<MyPetPlusLeadFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<MyPetPlusLead | null>(null);

  const resolveProjectId = useCallback(async (): Promise<number> => {
    if (projectId) return projectId;
    const response = await api.get<Project[]>('/projects');
    const projects = Array.isArray(response.data) ? response.data : [];
    const project = projects.find((entry) => entry.slug === 'mypetplus');
    if (!project) {
      throw new Error(t('myPetPlusLeads.projectUnavailable'));
    }
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
      const params: MyPetPlusLeadFilters = { ...debouncedFilters, page, limit: 25 };
      Object.keys(params).forEach((key) => {
        const typedKey = key as keyof MyPetPlusLeadFilters;
        if (params[typedKey] === '') delete params[typedKey];
      });
      setResult(await fetchMyPetPlusLeads(id, params));
    } catch (loadError: any) {
      console.error('Failed to load MyPet Plus leads:', loadError);
      setResult(EMPTY_RESPONSE);
      setError(loadError?.response?.data?.message || loadError?.message || t('myPetPlusLeads.loadError'));
    } finally {
      setLoading(false);
    }
  }, [debouncedFilters, page, resolveProjectId, t]);

  useEffect(() => {
    void loadLeads();
  }, [loadLeads]);

  const updateFilters = (updates: Partial<MyPetPlusLeadFilters>) => {
    setPage(1);
    setFilters((current) => ({ ...current, ...updates }));
  };

  const clearFilters = () => {
    setPage(1);
    setFilters({ ...EMPTY_FILTERS });
  };

  const options = result.filterOptions;
  const revenue = result.stats.subscriptionRevenue;
  const inputClass = 'w-full px-3 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none text-sm';

  return (
    <div className="space-y-6">
      <Topbar
        title={t('myPetPlusLeads.title')}
        subtitle={t('myPetPlusLeads.subtitle')}
        actions={<button type="button" onClick={() => void loadLeads()} disabled={loading} className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-aqua-1/30 disabled:opacity-50">{loading ? t('myPetPlusLeads.loading') : t('myPetPlusLeads.refresh')}</button>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t('myPetPlusLeads.totalRegistrations')} value={result.pagination.total.toLocaleString()} />
        <StatCard label={t('myPetPlusLeads.subscriptionRevenue')} value={formatMoney(revenue.totalRevenue, revenue.currency)} detail={t('myPetPlusLeads.subscriptionRevenueDetail')} highlight />
        <StatCard label={t('myPetPlusLeads.subscriptionPayments')} value={revenue.totalPayments.toLocaleString()} detail={t('myPetPlusLeads.subscriptionPaymentDetail', { doctors: formatMoney(revenue.veterinarianRevenue, revenue.currency), pharmacies: formatMoney(revenue.pharmacyRevenue, revenue.currency) })} />
        <StatCard label={t('myPetPlusLeads.source')} value="MyPet Plus" detail={t('myPetPlusLeads.liveIntegration')} />
      </div>

      <div className="rounded-2xl border border-line bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">{t('myPetPlusLeads.autoFilterHelp')}</p>
          <button type="button" onClick={clearFilters} className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-aqua-1/30">{t('myPetPlusLeads.clearFilters')}</button>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input className={inputClass} placeholder={t('myPetPlusLeads.generalSearch')} value={filters.search || ''} onChange={(event) => updateFilters({ search: event.target.value })} />
          <input className={inputClass} placeholder={t('myPetPlusLeads.name')} value={filters.name || ''} onChange={(event) => updateFilters({ name: event.target.value })} />
          <input className={inputClass} placeholder={t('myPetPlusLeads.email')} type="email" value={filters.email || ''} onChange={(event) => updateFilters({ email: event.target.value })} />
          <select className={inputClass} value={filters.role || ''} onChange={(event) => updateFilters({ role: event.target.value })}>
            <option value="">{t('myPetPlusLeads.allUserTypes')}</option>
            {USER_ROLE_OPTIONS.map((role) => <option key={role} value={role}>{t(`myPetPlusLeads.values.${role}`, { defaultValue: label(role) })}</option>)}
          </select>
          <select className={inputClass} value={filters.status || ''} onChange={(event) => updateFilters({ status: event.target.value })}>
            <option value="">{t('myPetPlusLeads.allRegistrationStatuses')}</option>
            {REGISTRATION_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{t(`myPetPlusLeads.values.${status}`, { defaultValue: label(status) })}</option>)}
          </select>
          <input list="mypet-specializations" className={inputClass} placeholder={t('myPetPlusLeads.veterinarianSpecialization')} value={filters.specialization || ''} onChange={(event) => updateFilters({ specialization: event.target.value })} />
          <input list="mypet-cities" className={inputClass} placeholder={t('myPetPlusLeads.city')} value={filters.city || ''} onChange={(event) => updateFilters({ city: event.target.value })} />
          <input list="mypet-countries" className={inputClass} placeholder={t('myPetPlusLeads.country')} value={filters.country || ''} onChange={(event) => updateFilters({ country: event.target.value })} />
          <input list="mypet-regions" className={inputClass} placeholder={t('myPetPlusLeads.region')} value={filters.region || ''} onChange={(event) => updateFilters({ region: event.target.value })} />
          <input list="mypet-areas" className={inputClass} placeholder={t('myPetPlusLeads.area')} value={filters.area || ''} onChange={(event) => updateFilters({ area: event.target.value })} />
          <input list="mypet-documents" className={inputClass} placeholder={t('myPetPlusLeads.documentType')} value={filters.documentType || ''} onChange={(event) => updateFilters({ documentType: event.target.value })} />
        </div>
        <datalist id="mypet-specializations">{options.specializations.map((value) => <option key={value} value={value} />)}</datalist>
        <datalist id="mypet-cities">{options.cities.map((value) => <option key={value} value={value} />)}</datalist>
        <datalist id="mypet-countries">{options.countries.map((value) => <option key={value} value={value} />)}</datalist>
        <datalist id="mypet-regions">{options.regions.map((value) => <option key={value} value={value} />)}</datalist>
        <datalist id="mypet-areas">{options.areas.map((value) => <option key={value} value={value} />)}</datalist>
        <datalist id="mypet-documents">{options.documentTypes.map((value) => <option key={value} value={value} />)}</datalist>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
        {loading ? (
          <div className="flex h-64 items-center justify-center"><div className="h-12 w-12 animate-spin rounded-full border-b-2 border-aqua-5" /></div>
        ) : error ? (
          <div className="p-8 text-center text-bad">{error}</div>
        ) : (
          <>
            <table className="w-full table-fixed">
              <thead className="border-b border-line bg-aqua-1/30">
                <tr>
                  <th className="w-[26%] px-4 py-3 text-left text-xs font-bold uppercase text-muted">{t('myPetPlusLeads.lead')}</th>
                  <th className="w-[12%] px-3 py-3 text-left text-xs font-bold uppercase text-muted">{t('myPetPlusLeads.userType')}</th>
                  <th className="hidden w-[20%] px-3 py-3 text-left text-xs font-bold uppercase text-muted md:table-cell">{t('myPetPlusLeads.profile')}</th>
                  <th className="hidden w-[14%] px-3 py-3 text-left text-xs font-bold uppercase text-muted md:table-cell">{t('myPetPlusLeads.subscription')}</th>
                  <th className="w-[12%] px-3 py-3 text-left text-xs font-bold uppercase text-muted">{t('myPetPlusLeads.status')}</th>
                  <th className="hidden w-[8%] px-3 py-3 text-left text-xs font-bold uppercase text-muted lg:table-cell">{t('myPetPlusLeads.registered')}</th>
                  <th className="w-[8%] px-3 py-3 text-right text-xs font-bold uppercase text-muted">{t('myPetPlusLeads.action')}</th>
                </tr>
              </thead>
              <tbody>
                {result.users.map((lead) => (
                  <tr key={lead.id} className="border-b border-line/50 transition-colors hover:bg-aqua-1/10">
                    <td className="px-4 py-3 align-top"><p className="truncate font-semibold text-ink" title={display(lead.name)}>{display(lead.name)}</p><p className="truncate text-sm text-muted" title={display(lead.email)}>{display(lead.email)}</p></td>
                    <td className="px-3 py-3 align-top"><span className={`inline-flex max-w-full truncate rounded-full border px-2 py-1 text-xs font-medium ${roleClass(lead.role)}`}>{t(`myPetPlusLeads.values.${lead.role}`, { defaultValue: label(lead.role) })}</span></td>
                    <td className="hidden px-3 py-3 align-top text-sm text-muted md:table-cell"><p className="line-clamp-2" title={profileSummary(lead)}>{profileSummary(lead)}</p></td>
                    <td className="hidden px-3 py-3 align-top md:table-cell">{['VETERINARIAN', 'PET_STORE'].includes(lead.role) ? <StatusBadge status={lead.subscription?.status || 'NOT_SUBSCRIBED'} /> : <span className="text-sm text-muted">—</span>}</td>
                    <td className="px-3 py-3 align-top"><StatusBadge status={lead.status} /></td>
                    <td className="hidden px-3 py-3 align-top text-sm text-muted lg:table-cell"><span className="line-clamp-2">{formatDate(lead.createdAt)}</span></td>
                    <td className="px-3 py-3 text-right align-top"><button type="button" onClick={() => setSelectedLead(lead)} className="whitespace-nowrap rounded-lg border border-aqua-5/35 bg-aqua-1/30 px-3 py-1.5 text-xs font-semibold text-aqua-5 transition-colors hover:bg-aqua-1/60">{t('myPetPlusLeads.viewDetails')}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {result.users.length === 0 && <div className="p-8 text-center text-muted">{t('myPetPlusLeads.noMatches')}</div>}
            {result.users.length > 0 && (
              <div className="flex items-center justify-between gap-3 border-t border-line bg-aqua-1/10 px-4 py-3">
                <p className="text-sm text-muted">{t('myPetPlusLeads.showing', { from: (result.pagination.page - 1) * result.pagination.limit + 1, to: Math.min(result.pagination.page * result.pagination.limit, result.pagination.total), total: result.pagination.total })}</p>
                <div className="flex items-center gap-2">
                  <button type="button" disabled={result.pagination.page <= 1} onClick={() => setPage((current) => current - 1)} className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-white disabled:opacity-40">{t('myPetPlusLeads.previous')}</button>
                  <span className="text-sm text-ink">{t('myPetPlusLeads.pageOf', { current: result.pagination.page, total: result.pagination.totalPages })}</span>
                  <button type="button" disabled={result.pagination.page >= result.pagination.totalPages} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-white disabled:opacity-40">{t('myPetPlusLeads.next')}</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <LeadDetailsModal lead={selectedLead} onClose={() => setSelectedLead(null)} />
    </div>
  );
}
