import { useCallback, useEffect, useState, type ReactNode } from 'react';
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
    return lead.specializations.map(label).join(', ') || 'Veterinarian';
  }

  if (lead.role === 'PET_STORE') {
    return lead.subscription?.planName || lead.business?.name || 'No subscription recorded';
  }

  return lead.business?.name || location(lead);
}

function StatusBadge({ status }: { status?: string | null }) {
  return <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${statusClass(status)}`}>{label(status)}</span>;
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
  if (!lead) return null;

  const isSubscriptionRole = ['VETERINARIAN', 'PET_STORE'].includes(lead.role);
  const subscription = lead.subscription;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="MyPet Plus lead details">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-line bg-white px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-aqua-5">MyPet Plus registration</p>
            <h2 className="mt-1 text-xl font-bold text-ink">{display(lead.name)}</h2>
            <p className="mt-1 text-sm text-muted">{display(lead.email)}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-1 text-2xl leading-none text-muted hover:bg-aqua-1/40 hover:text-ink" aria-label="Close details">×</button>
        </div>

        <div className="space-y-6 p-6">
          <section>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Registration</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DetailItem label="User type" value={label(lead.role)} />
              <DetailItem label="Registration status" value={<StatusBadge status={lead.status} />} />
              <DetailItem label="Registered" value={formatDate(lead.createdAt)} />
              <DetailItem label="Last updated" value={formatDate(lead.updatedAt)} />
              <DetailItem label="Email verified" value={lead.emailVerified ? 'Yes' : 'No'} />
              <DetailItem label="Phone verified" value={lead.phoneVerified ? 'Yes' : 'No'} />
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Contact and location</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DetailItem label="Email" value={display(lead.email)} />
              <DetailItem label="Phone" value={display(lead.phone)} />
              <DetailItem label="City" value={display(lead.city)} />
              <DetailItem label="Area" value={display(lead.area)} />
              <DetailItem label="Region" value={display(lead.region)} />
              <DetailItem label="Country" value={display(lead.country)} />
            </div>
          </section>

          {(lead.veterinarian || lead.business) && (
            <section>
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Profile</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {lead.veterinarian && <>
                  <DetailItem label="Specializations" value={lead.specializations.map(label).join(', ') || '—'} />
                  <DetailItem label="Experience" value={lead.veterinarian.experienceYears === null ? '—' : `${lead.veterinarian.experienceYears} years`} />
                  <DetailItem label="Veterinarian verified" value={lead.veterinarian.isVerified ? 'Yes' : 'No'} />
                  <DetailItem label="Profile complete" value={lead.veterinarian.profileCompleted ? 'Yes' : 'No'} />
                </>}
                {lead.business && <>
                  <DetailItem label="Business name" value={display(lead.business.name)} />
                  <DetailItem label="Business active" value={lead.business.isActive ? 'Yes' : 'No'} />
                  <DetailItem label="Profile complete" value={lead.business.profileCompleted ? 'Yes' : 'No'} />
                  <DetailItem label="Public listing" value={lead.business.isPublic ? 'Yes' : 'No'} />
                </>}
              </div>
            </section>
          )}

          <section>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Subscription and agreement</h3>
            {subscription ? (
              <div className="space-y-4 rounded-xl border border-aqua-5/20 bg-aqua-1/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-ink">{display(subscription.planName)}</p>
                  <StatusBadge status={subscription.status} />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <DetailItem label="Plan price" value={formatMoney(subscription.planPrice, subscription.currency)} />
                  <DetailItem label="Plan duration" value={subscription.durationInDays ? `${subscription.durationInDays} days` : '—'} />
                  <DetailItem label="Subscription start" value={formatDate(subscription.startDate)} />
                  <DetailItem label="Subscription end" value={formatDate(subscription.endDate)} />
                  <DetailItem label="Plan type" value={label(subscription.planType)} />
                  <DetailItem label="Subscription status" value={label(subscription.status)} />
                </div>
                <DetailItem label="Included features" value={subscription.features.length ? subscription.features.join(', ') : 'No plan features recorded'} />
                <p className="text-xs leading-relaxed text-muted">No separate signed contract file is stored in MyPet Plus. The plan, dates, price, and included features above are the subscription agreement details currently recorded.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-line bg-gray-50 p-4 text-sm text-muted">
                {isSubscriptionRole ? 'No current subscription is recorded for this lead.' : 'This registration type does not currently use a MyPet Plus subscription plan.'}
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Documents</h3>
            <p className="rounded-xl border border-line bg-gray-50 p-4 text-sm text-ink">{lead.documentTypes.length ? lead.documentTypes.map(label).join(', ') : 'No document types recorded'}</p>
          </section>
        </div>

        <div className="sticky bottom-0 border-t border-line bg-white p-4">
          <button type="button" onClick={onClose} className="w-full rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-aqua-1/30">Close details</button>
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
      throw new Error('MyPet Plus is not available in your Projects list. Ask an administrator to activate or grant access to it.');
    }
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
      const params: MyPetPlusLeadFilters = { ...debouncedFilters, page, limit: 25 };
      Object.keys(params).forEach((key) => {
        const typedKey = key as keyof MyPetPlusLeadFilters;
        if (params[typedKey] === '') delete params[typedKey];
      });
      setResult(await fetchMyPetPlusLeads(id, params));
    } catch (loadError: any) {
      console.error('Failed to load MyPet Plus leads:', loadError);
      setResult(EMPTY_RESPONSE);
      setError(loadError?.response?.data?.message || loadError?.message || 'Unable to load MyPet Plus leads.');
    } finally {
      setLoading(false);
    }
  }, [debouncedFilters, page, resolveProjectId]);

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
        title="MyPet Plus Leads"
        subtitle="Registrations and subscription activity from the MyPet Plus platform"
        actions={<button type="button" onClick={() => void loadLeads()} disabled={loading} className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-aqua-1/30 disabled:opacity-50">{loading ? 'Loading…' : 'Refresh'}</button>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total registrations" value={result.pagination.total.toLocaleString()} />
        <StatCard label="Subscription revenue" value={formatMoney(revenue.totalRevenue, revenue.currency)} detail="Successful doctor + pharmacy plan payments only" highlight />
        <StatCard label="Subscription payments" value={revenue.totalPayments.toLocaleString()} detail={`Doctors ${formatMoney(revenue.veterinarianRevenue, revenue.currency)} · Pharmacies ${formatMoney(revenue.pharmacyRevenue, revenue.currency)}`} />
        <StatCard label="Source" value="MyPet Plus" detail="Live registration integration" />
      </div>

      <div className="rounded-2xl border border-line bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">Filters update automatically while you type or select an option.</p>
          <button type="button" onClick={clearFilters} className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-aqua-1/30">Clear filters</button>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input className={inputClass} placeholder="General search" value={filters.search || ''} onChange={(event) => updateFilters({ search: event.target.value })} />
          <input className={inputClass} placeholder="Name" value={filters.name || ''} onChange={(event) => updateFilters({ name: event.target.value })} />
          <input className={inputClass} placeholder="Email" type="email" value={filters.email || ''} onChange={(event) => updateFilters({ email: event.target.value })} />
          <select className={inputClass} value={filters.role || ''} onChange={(event) => updateFilters({ role: event.target.value })}>
            <option value="">All user types</option>
            {USER_ROLE_OPTIONS.map((role) => <option key={role} value={role}>{label(role)}</option>)}
          </select>
          <select className={inputClass} value={filters.status || ''} onChange={(event) => updateFilters({ status: event.target.value })}>
            <option value="">All registration statuses</option>
            {REGISTRATION_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{label(status)}</option>)}
          </select>
          <input list="mypet-specializations" className={inputClass} placeholder="Veterinarian specialization" value={filters.specialization || ''} onChange={(event) => updateFilters({ specialization: event.target.value })} />
          <input list="mypet-cities" className={inputClass} placeholder="City" value={filters.city || ''} onChange={(event) => updateFilters({ city: event.target.value })} />
          <input list="mypet-countries" className={inputClass} placeholder="Country" value={filters.country || ''} onChange={(event) => updateFilters({ country: event.target.value })} />
          <input list="mypet-regions" className={inputClass} placeholder="Region" value={filters.region || ''} onChange={(event) => updateFilters({ region: event.target.value })} />
          <input list="mypet-areas" className={inputClass} placeholder="Area" value={filters.area || ''} onChange={(event) => updateFilters({ area: event.target.value })} />
          <input list="mypet-documents" className={inputClass} placeholder="Document type" value={filters.documentType || ''} onChange={(event) => updateFilters({ documentType: event.target.value })} />
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
                  <th className="w-[30%] px-4 py-3 text-left text-xs font-bold uppercase text-muted">Lead</th>
                  <th className="w-[14%] px-3 py-3 text-left text-xs font-bold uppercase text-muted">User type</th>
                  <th className="hidden w-[22%] px-3 py-3 text-left text-xs font-bold uppercase text-muted md:table-cell">Profile / plan</th>
                  <th className="w-[13%] px-3 py-3 text-left text-xs font-bold uppercase text-muted">Status</th>
                  <th className="hidden w-[11%] px-3 py-3 text-left text-xs font-bold uppercase text-muted lg:table-cell">Registered</th>
                  <th className="w-[10%] px-3 py-3 text-right text-xs font-bold uppercase text-muted">Action</th>
                </tr>
              </thead>
              <tbody>
                {result.users.map((lead) => (
                  <tr key={lead.id} className="border-b border-line/50 transition-colors hover:bg-aqua-1/10">
                    <td className="px-4 py-3 align-top"><p className="truncate font-semibold text-ink" title={display(lead.name)}>{display(lead.name)}</p><p className="truncate text-sm text-muted" title={display(lead.email)}>{display(lead.email)}</p></td>
                    <td className="px-3 py-3 align-top"><span className={`inline-flex max-w-full truncate rounded-full border px-2 py-1 text-xs font-medium ${roleClass(lead.role)}`}>{label(lead.role)}</span></td>
                    <td className="hidden px-3 py-3 align-top text-sm text-muted md:table-cell"><p className="line-clamp-2" title={profileSummary(lead)}>{profileSummary(lead)}</p></td>
                    <td className="px-3 py-3 align-top"><StatusBadge status={lead.status} /></td>
                    <td className="hidden px-3 py-3 align-top text-sm text-muted lg:table-cell"><span className="line-clamp-2">{formatDate(lead.createdAt)}</span></td>
                    <td className="px-3 py-3 text-right align-top"><button type="button" onClick={() => setSelectedLead(lead)} className="whitespace-nowrap rounded-lg border border-aqua-5/35 bg-aqua-1/30 px-3 py-1.5 text-xs font-semibold text-aqua-5 transition-colors hover:bg-aqua-1/60">View details</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {result.users.length === 0 && <div className="p-8 text-center text-muted">No MyPet Plus registrations match these filters.</div>}
            {result.users.length > 0 && (
              <div className="flex items-center justify-between gap-3 border-t border-line bg-aqua-1/10 px-4 py-3">
                <p className="text-sm text-muted">Showing {(result.pagination.page - 1) * result.pagination.limit + 1}–{Math.min(result.pagination.page * result.pagination.limit, result.pagination.total)} of {result.pagination.total}</p>
                <div className="flex items-center gap-2">
                  <button type="button" disabled={result.pagination.page <= 1} onClick={() => setPage((current) => current - 1)} className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-white disabled:opacity-40">Previous</button>
                  <span className="text-sm text-ink">{result.pagination.page} / {result.pagination.totalPages}</span>
                  <button type="button" disabled={result.pagination.page >= result.pagination.totalPages} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-white disabled:opacity-40">Next</button>
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
