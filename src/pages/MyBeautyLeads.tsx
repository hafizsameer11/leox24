import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import Topbar from '../components/layout/Topbar';
import api from '../services/api';
import { fetchMyBeautyLeads } from '../services/myBeautyApi';
import type { Project } from '../types/project.types';
import type {
  MyBeautyLead,
  MyBeautyLeadFilters,
  MyBeautyLeadResponse,
} from '../types/myBeautyLead';

const EMPTY_FILTERS: MyBeautyLeadFilters = {
  search: '',
  name: '',
  email: '',
  role: '',
  status: '',
  city: '',
  country: '',
};

const EMPTY_RESPONSE: MyBeautyLeadResponse = {
  users: [],
  pagination: { page: 1, limit: 25, total: 0, totalPages: 1 },
  filterOptions: {
    roles: [],
    statuses: [],
    cities: [],
    countries: [],
  },
  generatedAt: '',
};

const USER_ROLE_OPTIONS = ['customer', 'salon'];
const REGISTRATION_STATUS_OPTIONS = ['active', 'pending', 'blocked', 'rejected', 'suspended'];

const display = (value?: string | null, fallback = '') => String(value || '').trim() || fallback;
const label = (value?: string | null, fallback = '') => display(value, fallback).replace(/_/g, ' ');

function formatDate(value?: string | null, fallback = ''): string {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function statusClass(status?: string | null): string {
  switch (String(status || '').toLowerCase()) {
    case 'active':
    case 'approved':
      return 'bg-ok/15 text-ok border-ok/30';
    case 'pending':
      return 'bg-warn/15 text-warn border-warn/30';
    case 'rejected':
    case 'blocked':
    case 'suspended':
      return 'bg-bad/15 text-bad border-bad/30';
    default:
      return 'bg-muted/15 text-muted border-muted/30';
  }
}

function roleClass(role?: string | null): string {
  const styles: Record<string, string> = {
    customer: 'bg-green-100 text-green-800 border-green-300',
    salon: 'bg-pink-100 text-pink-800 border-pink-300',
    seller: 'bg-pink-100 text-pink-800 border-pink-300',
  };
  return styles[String(role || '').toLowerCase()] || 'bg-gray-100 text-gray-800 border-gray-300';
}

function profileSummary(lead: MyBeautyLead, notProvided: string, notApplicable: string): string {
  if (lead.role === 'salon' || lead.role === 'seller') {
    return lead.business?.name || notProvided;
  }
  return notApplicable;
}

function StatusBadge({ status }: { status?: string | null }) {
  const { t } = useTranslation();
  const key = String(status || '').toLowerCase() || 'pending';
  return (
    <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${statusClass(status)}`}>
      {t(`myBeautyLeads.values.${key}`, { defaultValue: label(status) })}
    </span>
  );
}

function DetailItem({ label: itemLabel, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-white p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">{itemLabel}</p>
      <div className="mt-1 break-words text-sm font-medium text-ink">{value}</div>
    </div>
  );
}

function LeadDetailsModal({ lead, onClose }: { lead: MyBeautyLead | null; onClose: () => void }) {
  const { t } = useTranslation();
  if (!lead) return null;

  const notProvided = t('myBeautyLeads.notProvided');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label={t('myBeautyLeads.ariaLeadDetails')}>
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-line bg-white px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-aqua-5">{t('myBeautyLeads.registration')}</p>
            <h2 className="mt-1 text-xl font-bold text-ink">{display(lead.name, notProvided)}</h2>
            <p className="mt-1 text-sm text-muted">{display(lead.email, notProvided)}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-1 text-2xl leading-none text-muted hover:bg-aqua-1/40 hover:text-ink" aria-label={t('myBeautyLeads.closeDetails')}>×</button>
        </div>

        <div className="space-y-6 p-6">
          <section>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">{t('myBeautyLeads.registration')}</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DetailItem label={t('myBeautyLeads.userType')} value={t(`myBeautyLeads.values.${lead.role}`, { defaultValue: label(lead.role) })} />
              <DetailItem label={t('myBeautyLeads.registrationStatus')} value={<StatusBadge status={lead.status} />} />
              <DetailItem label={t('myBeautyLeads.registered')} value={formatDate(lead.createdAt, notProvided)} />
              <DetailItem label={t('myBeautyLeads.lastUpdated')} value={formatDate(lead.updatedAt, notProvided)} />
              <DetailItem label={t('myBeautyLeads.lastLogin')} value={formatDate(lead.lastLoginAt, notProvided)} />
              <DetailItem label={t('myBeautyLeads.emailVerified')} value={lead.emailVerified ? t('myBeautyLeads.yes') : t('myBeautyLeads.no')} />
              <DetailItem label={t('myBeautyLeads.phoneVerified')} value={lead.phoneVerified ? t('myBeautyLeads.yes') : t('myBeautyLeads.no')} />
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">{t('myBeautyLeads.contactLocation')}</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DetailItem label={t('myBeautyLeads.email')} value={display(lead.email, notProvided)} />
              <DetailItem label={t('myBeautyLeads.phone')} value={display(lead.phone, notProvided)} />
              <DetailItem label={t('myBeautyLeads.city')} value={display(lead.city, notProvided)} />
              <DetailItem label={t('myBeautyLeads.area')} value={display(lead.area, notProvided)} />
              <DetailItem label={t('myBeautyLeads.region')} value={display(lead.region, notProvided)} />
              <DetailItem label={t('myBeautyLeads.country')} value={display(lead.country, notProvided)} />
            </div>
          </section>

          {lead.business && (
            <section>
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">{t('myBeautyLeads.salonProfile')}</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DetailItem label={t('myBeautyLeads.businessName')} value={display(lead.business.name, notProvided)} />
                <DetailItem label={t('myBeautyLeads.salonCategory')} value={display(lead.business.category, notProvided)} />
                <DetailItem label={t('myBeautyLeads.salonStatus')} value={<StatusBadge status={lead.business.salonStatus || (lead.business.isActive ? 'active' : 'pending')} />} />
                <DetailItem label={t('myBeautyLeads.businessActive')} value={lead.business.isActive ? t('myBeautyLeads.yes') : t('myBeautyLeads.no')} />
                <DetailItem label={t('myBeautyLeads.profileComplete')} value={lead.business.profileCompleted ? t('myBeautyLeads.yes') : t('myBeautyLeads.no')} />
                <DetailItem label={t('myBeautyLeads.publicListing')} value={lead.business.isPublic ? t('myBeautyLeads.yes') : t('myBeautyLeads.no')} />
                <DetailItem label={t('myBeautyLeads.city')} value={display(lead.business.city, notProvided)} />
                <DetailItem label={t('myBeautyLeads.salonSlug')} value={display(lead.business.slug, notProvided)} />
              </div>
            </section>
          )}
        </div>

        <div className="sticky bottom-0 border-t border-line bg-white p-4">
          <button type="button" onClick={onClose} className="w-full rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-aqua-1/30">{t('myBeautyLeads.closeDetails')}</button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label: cardLabel, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <p className="text-xs font-bold uppercase text-muted">{cardLabel}</p>
      <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
      {detail && <p className="mt-2 text-xs leading-relaxed text-muted">{detail}</p>}
    </div>
  );
}

export default function MyBeautyLeads() {
  const { t } = useTranslation();
  const [projectId, setProjectId] = useState<number | null>(null);
  const [result, setResult] = useState<MyBeautyLeadResponse>(EMPTY_RESPONSE);
  const [filters, setFilters] = useState<MyBeautyLeadFilters>(EMPTY_FILTERS);
  const [debouncedFilters, setDebouncedFilters] = useState<MyBeautyLeadFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<MyBeautyLead | null>(null);

  const resolveProjectId = useCallback(async (): Promise<number> => {
    if (projectId) return projectId;
    const response = await api.get<Project[]>('/projects');
    const projects = Array.isArray(response.data) ? response.data : [];
    const project = projects.find((entry) => entry.slug === 'mybeauty');
    if (!project) {
      throw new Error(t('myBeautyLeads.projectUnavailable'));
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
      const params: MyBeautyLeadFilters = { ...debouncedFilters, page, limit: 25 };
      Object.keys(params).forEach((key) => {
        const typedKey = key as keyof MyBeautyLeadFilters;
        if (params[typedKey] === '') delete params[typedKey];
      });
      setResult(await fetchMyBeautyLeads(id, params));
    } catch (loadError: any) {
      console.error('Failed to load My Beauty leads:', loadError);
      setResult(EMPTY_RESPONSE);
      setError(loadError?.response?.data?.message || loadError?.message || t('myBeautyLeads.loadError'));
    } finally {
      setLoading(false);
    }
  }, [debouncedFilters, page, resolveProjectId, t]);

  useEffect(() => {
    void loadLeads();
  }, [loadLeads]);

  const updateFilters = (updates: Partial<MyBeautyLeadFilters>) => {
    setPage(1);
    setFilters((current) => ({ ...current, ...updates }));
  };

  const clearFilters = () => {
    setPage(1);
    setFilters({ ...EMPTY_FILTERS });
  };

  const options = result.filterOptions;
  const inputClass = 'w-full px-3 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none text-sm';
  const roleChoices = options.roles.length ? options.roles : USER_ROLE_OPTIONS;
  const statusChoices = options.statuses.length ? options.statuses : REGISTRATION_STATUS_OPTIONS;

  return (
    <div className="space-y-6">
      <Topbar
        title={t('myBeautyLeads.title')}
        subtitle={t('myBeautyLeads.subtitle')}
        actions={<button type="button" onClick={() => void loadLeads()} disabled={loading} className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-aqua-1/30 disabled:opacity-50">{loading ? t('myBeautyLeads.loading') : t('myBeautyLeads.refresh')}</button>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label={t('myBeautyLeads.totalRegistrations')} value={result.pagination.total.toLocaleString()} />
        <StatCard label={t('myBeautyLeads.source')} value="My Beauty" detail={t('myBeautyLeads.liveIntegration')} />
        <StatCard label={t('myBeautyLeads.generatedAt')} value={result.generatedAt ? formatDate(result.generatedAt, '—') : '—'} />
      </div>

      <div className="rounded-2xl border border-line bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">{t('myBeautyLeads.autoFilterHelp')}</p>
          <button type="button" onClick={clearFilters} className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-aqua-1/30">{t('myBeautyLeads.clearFilters')}</button>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input className={inputClass} placeholder={t('myBeautyLeads.generalSearch')} value={filters.search || ''} onChange={(event) => updateFilters({ search: event.target.value })} />
          <input className={inputClass} placeholder={t('myBeautyLeads.name')} value={filters.name || ''} onChange={(event) => updateFilters({ name: event.target.value })} />
          <input className={inputClass} placeholder={t('myBeautyLeads.email')} type="email" value={filters.email || ''} onChange={(event) => updateFilters({ email: event.target.value })} />
          <select className={inputClass} value={filters.role || ''} onChange={(event) => updateFilters({ role: event.target.value })}>
            <option value="">{t('myBeautyLeads.allUserTypes')}</option>
            {roleChoices.map((role) => <option key={role} value={role}>{t(`myBeautyLeads.values.${role}`, { defaultValue: label(role) })}</option>)}
          </select>
          <select className={inputClass} value={filters.status || ''} onChange={(event) => updateFilters({ status: event.target.value })}>
            <option value="">{t('myBeautyLeads.allRegistrationStatuses')}</option>
            {statusChoices.map((status) => <option key={status} value={status}>{t(`myBeautyLeads.values.${status}`, { defaultValue: label(status) })}</option>)}
          </select>
          <input list="mybeauty-cities" className={inputClass} placeholder={t('myBeautyLeads.city')} value={filters.city || ''} onChange={(event) => updateFilters({ city: event.target.value })} />
          <input list="mybeauty-countries" className={inputClass} placeholder={t('myBeautyLeads.country')} value={filters.country || ''} onChange={(event) => updateFilters({ country: event.target.value })} />
        </div>
        <datalist id="mybeauty-cities">{(options.cities || []).map((value) => <option key={value} value={value} />)}</datalist>
        <datalist id="mybeauty-countries">{(options.countries || []).map((value) => <option key={value} value={value} />)}</datalist>
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
                  <th className="w-[28%] px-4 py-3 text-left text-xs font-bold uppercase text-muted">{t('myBeautyLeads.lead')}</th>
                  <th className="w-[14%] px-3 py-3 text-left text-xs font-bold uppercase text-muted">{t('myBeautyLeads.userType')}</th>
                  <th className="hidden w-[22%] px-3 py-3 text-left text-xs font-bold uppercase text-muted md:table-cell">{t('myBeautyLeads.profile')}</th>
                  <th className="w-[12%] px-3 py-3 text-left text-xs font-bold uppercase text-muted">{t('myBeautyLeads.status')}</th>
                  <th className="hidden w-[14%] px-3 py-3 text-left text-xs font-bold uppercase text-muted lg:table-cell">{t('myBeautyLeads.registered')}</th>
                  <th className="w-[10%] px-3 py-3 text-right text-xs font-bold uppercase text-muted">{t('myBeautyLeads.action')}</th>
                </tr>
              </thead>
              <tbody>
                {result.users.map((lead) => (
                  <tr key={lead.id} className="border-b border-line/50 transition-colors hover:bg-aqua-1/10">
                    <td className="px-4 py-3 align-top">
                      <p className="truncate font-semibold text-ink" title={display(lead.name, t('myBeautyLeads.notProvided'))}>{display(lead.name, t('myBeautyLeads.notProvided'))}</p>
                      <p className="truncate text-sm text-muted" title={display(lead.email, t('myBeautyLeads.notProvided'))}>{display(lead.email, t('myBeautyLeads.notProvided'))}</p>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <span className={`inline-flex max-w-full truncate rounded-full border px-2 py-1 text-xs font-medium ${roleClass(lead.role)}`}>
                        {t(`myBeautyLeads.values.${lead.role}`, { defaultValue: label(lead.role) })}
                      </span>
                    </td>
                    <td className="hidden px-3 py-3 align-top text-sm text-muted md:table-cell">
                      <p className="line-clamp-2" title={profileSummary(lead, t('myBeautyLeads.notProvided'), t('myBeautyLeads.notApplicable'))}>
                        {profileSummary(lead, t('myBeautyLeads.notProvided'), t('myBeautyLeads.notApplicable'))}
                      </p>
                    </td>
                    <td className="px-3 py-3 align-top"><StatusBadge status={lead.status} /></td>
                    <td className="hidden px-3 py-3 align-top text-sm text-muted lg:table-cell">
                      <span className="line-clamp-2">{formatDate(lead.createdAt, t('myBeautyLeads.notProvided'))}</span>
                    </td>
                    <td className="px-2 py-3 text-right align-middle">
                      <button type="button" onClick={() => setSelectedLead(lead)} className="inline-flex h-8 items-center justify-center whitespace-nowrap rounded-lg border border-aqua-5/35 bg-aqua-1/30 px-2 text-xs font-semibold leading-none text-aqua-5 transition-colors hover:bg-aqua-1/60">
                        {t('myBeautyLeads.viewDetails')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {result.users.length === 0 && <div className="p-8 text-center text-muted">{t('myBeautyLeads.noMatches')}</div>}
            {result.users.length > 0 && (
              <div className="flex items-center justify-between gap-3 border-t border-line bg-aqua-1/10 px-4 py-3">
                <p className="text-sm text-muted">{t('myBeautyLeads.showing', { from: (result.pagination.page - 1) * result.pagination.limit + 1, to: Math.min(result.pagination.page * result.pagination.limit, result.pagination.total), total: result.pagination.total })}</p>
                <div className="flex items-center gap-2">
                  <button type="button" disabled={result.pagination.page <= 1} onClick={() => setPage((current) => current - 1)} className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-white disabled:opacity-40">{t('myBeautyLeads.previous')}</button>
                  <span className="text-sm text-ink">{t('myBeautyLeads.pageOf', { current: result.pagination.page, total: result.pagination.totalPages })}</span>
                  <button type="button" disabled={result.pagination.page >= result.pagination.totalPages} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-white disabled:opacity-40">{t('myBeautyLeads.next')}</button>
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
