import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Topbar from '../components/layout/Topbar';
import { fetchTgRegistrations } from '../services/tgCalabriaApi';
import type { TgRegistrationUser } from '../types/tgRegistration';

const ROWS_PER_PAGE = 25;
const FETCH_LIMIT = 200;

function displayCell(value?: string | null): string {
  const s = value != null ? String(value).trim() : '';
  return s || '—';
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function formatPackage(pkg: string | null): string {
  if (!pkg) return '—';
  return pkg.replace(/_/g, ' ');
}

function getStatusBadgeClass(status: string | null): string {
  if (!status) return 'bg-muted/15 text-muted border-muted/30';
  const upper = status.toUpperCase();
  if (upper === 'APPROVED') return 'bg-ok/15 text-ok border-ok/30';
  if (upper === 'REJECTED') return 'bg-bad/15 text-bad border-bad/30';
  if (upper === 'PENDING') return 'bg-warn/15 text-warn border-warn/30';
  return 'bg-aqua-1/65 text-ink border-line';
}

function getRoleBadgeClass(role: string): string {
  const styles: Record<string, string> = {
    ADVERTISER: 'bg-blue-100 text-blue-800 border-blue-300',
    PROLOCO: 'bg-green-100 text-green-800 border-green-300',
    EDITOR: 'bg-purple-100 text-purple-800 border-purple-300',
    USER: 'bg-gray-100 text-gray-800 border-gray-300',
    ADMIN: 'bg-orange-100 text-orange-800 border-orange-300',
    SUPER_ADMIN: 'bg-red-100 text-red-800 border-red-300',
  };
  return styles[role] || 'bg-gray-100 text-gray-800 border-gray-300';
}

export default function TGLeads() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<TgRegistrationUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalFromApi, setTotalFromApi] = useState(0);
  const [tablePage, setTablePage] = useState(1);
  const [filters, setFilters] = useState({
    search: '',
    role: 'all',
    status: 'all',
  });
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.search), 300);
    return () => clearTimeout(timer);
  }, [filters.search]);

  useEffect(() => {
    setTablePage(1);
  }, [debouncedSearch, filters.role, filters.status]);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: { page: number; limit: number; role?: string } = {
        page: 1,
        limit: FETCH_LIMIT,
      };
      if (filters.role !== 'all') {
        params.role = filters.role;
      }
      const response = await fetchTgRegistrations(params);
      if (!response.success) {
        throw new Error(response.message || t('tgLeads.loadError'));
      }
      setUsers(response.data.users);
      setTotalFromApi(response.data.meta.total);
    } catch (err) {
      console.error('Failed to fetch TG leads:', err);
      setUsers([]);
      setTotalFromApi(0);
      setError(t('tgLeads.loadError'));
    } finally {
      setLoading(false);
    }
  }, [filters.role, t]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    let list = users;
    const q = debouncedSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((u) => {
        const haystack = [
          u.name,
          u.email,
          u.companyName,
          u.prolocoName,
          u.prolocoCity,
          u.prolocoCode,
          u.advertiserPurchasedPackage,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      });
    }
    if (filters.status !== 'all') {
      list = list.filter((u) => {
        const advertiserStatus = u.advertiserStatus?.toUpperCase() ?? '';
        const prolocoStatus = u.prolocoStatus?.toUpperCase() ?? '';
        const target = filters.status.toUpperCase();
        if (u.role === 'ADVERTISER') return advertiserStatus === target;
        if (u.role === 'PROLOCO') return prolocoStatus === target;
        return false;
      });
    }
    return list;
  }, [users, debouncedSearch, filters.status]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / ROWS_PER_PAGE));
  const paginatedUsers = useMemo(() => {
    const start = (tablePage - 1) * ROWS_PER_PAGE;
    return filteredUsers.slice(start, start + ROWS_PER_PAGE);
  }, [filteredUsers, tablePage]);

  const roleOptions = useMemo(() => {
    const roles = new Set(users.map((u) => u.role));
    return Array.from(roles).sort();
  }, [users]);

  return (
    <div className="space-y-6">
      <Topbar
        title={t('tgLeads.title')}
        subtitle={t('tgLeads.subtitle')}
        actions={
          <button
            type="button"
            onClick={() => void loadUsers()}
            disabled={loading}
            className="px-4 py-2 text-sm border border-line rounded-xl hover:bg-aqua-1/30 transition-colors text-ink font-medium disabled:opacity-50"
          >
            {loading ? t('common.loading') : t('tgLeads.refresh')}
          </button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-line rounded-2xl p-4">
          <p className="text-xs font-bold text-muted uppercase">{t('tgLeads.totalRegistrations')}</p>
          <p className="text-2xl font-bold text-ink mt-1">{totalFromApi}</p>
        </div>
        <div className="bg-white border border-line rounded-2xl p-4">
          <p className="text-xs font-bold text-muted uppercase">{t('tgLeads.showing')}</p>
          <p className="text-2xl font-bold text-ink mt-1">{filteredUsers.length}</p>
        </div>
        <div className="bg-white border border-line rounded-2xl p-4">
          <p className="text-xs font-bold text-muted uppercase">{t('tgLeads.source')}</p>
          <p className="text-sm text-ink mt-2 truncate" title="api.tgcalabriareport.com">
            TG Calabria Report
          </p>
        </div>
      </div>

      <div className="bg-white border border-line rounded-2xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            type="text"
            placeholder={t('tgLeads.searchPlaceholder')}
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="px-4 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none text-sm"
          />
          <select
            value={filters.role}
            onChange={(e) => setFilters({ ...filters, role: e.target.value })}
            className="px-4 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none text-sm"
          >
            <option value="all">{t('tgLeads.allRoles')}</option>
            {roleOptions.map((role) => (
              <option key={role} value={role}>
                {role.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="px-4 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none text-sm"
          >
            <option value="all">{t('tgLeads.allStatuses')}</option>
            <option value="APPROVED">{t('tgLeads.approved')}</option>
            <option value="REJECTED">{t('tgLeads.rejected')}</option>
            <option value="PENDING">{t('tgLeads.pending')}</option>
          </select>
          <button
            type="button"
            onClick={() => setFilters({ search: '', role: 'all', status: 'all' })}
            className="px-4 py-2 text-sm border border-line rounded-xl hover:bg-aqua-1/30 transition-colors text-ink font-medium"
          >
            {t('common.clearFilters')}
          </button>
        </div>
      </div>

      <div className="bg-white border border-line rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-aqua-5" />
          </div>
        ) : error ? (
          <div className="p-8 text-center text-bad">{error}</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead className="bg-aqua-1/30 border-b border-line">
                  <tr>
                    <th className="text-left text-xs font-bold text-muted uppercase py-3 px-4">
                      {t('common.name')}
                    </th>
                    <th className="text-left text-xs font-bold text-muted uppercase py-3 px-4">
                      {t('common.email')}
                    </th>
                    <th className="text-left text-xs font-bold text-muted uppercase py-3 px-4">
                      {t('tgLeads.role')}
                    </th>
                    <th className="text-left text-xs font-bold text-muted uppercase py-3 px-4">
                      {t('tgLeads.companyOrProloco')}
                    </th>
                    <th className="text-left text-xs font-bold text-muted uppercase py-3 px-4">
                      {t('common.status')}
                    </th>
                    <th className="text-left text-xs font-bold text-muted uppercase py-3 px-4">
                      {t('tgLeads.package')}
                    </th>
                    <th className="text-left text-xs font-bold text-muted uppercase py-3 px-4">
                      {t('tgLeads.emailVerified')}
                    </th>
                    <th className="text-left text-xs font-bold text-muted uppercase py-3 px-4">
                      {t('tgLeads.registeredAt')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedUsers.map((user) => {
                    const status =
                      user.role === 'ADVERTISER'
                        ? user.advertiserStatus
                        : user.role === 'PROLOCO'
                          ? user.prolocoStatus
                          : null;
                    const companyOrProloco =
                      user.role === 'PROLOCO'
                        ? [user.prolocoName, user.prolocoCity, user.prolocoCode]
                            .filter(Boolean)
                            .join(' · ') || '—'
                        : displayCell(user.companyName);

                    return (
                      <tr
                        key={user.id}
                        className="border-b border-line/50 hover:bg-aqua-1/10 transition-colors"
                      >
                        <td className="py-3 px-4 font-semibold text-ink">{displayCell(user.name)}</td>
                        <td className="py-3 px-4 text-sm text-ink">{displayCell(user.email)}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`text-xs px-2 py-1 rounded-full border font-medium ${getRoleBadgeClass(user.role)}`}
                          >
                            {user.role.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-muted max-w-[200px] truncate" title={companyOrProloco}>
                          {companyOrProloco}
                        </td>
                        <td className="py-3 px-4">
                          {status ? (
                            <span
                              className={`text-xs px-2 py-1 rounded-full border font-medium ${getStatusBadgeClass(status)}`}
                            >
                              {status}
                            </span>
                          ) : (
                            <span className="text-sm text-muted">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-muted">
                          {formatPackage(user.advertiserPurchasedPackage)}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`text-xs px-2 py-1 rounded-full border font-medium ${
                              user.emailVerified
                                ? 'bg-ok/15 text-ok border-ok/30'
                                : 'bg-muted/15 text-muted border-muted/30'
                            }`}
                          >
                            {user.emailVerified ? t('common.yes') : t('common.no')}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-muted whitespace-nowrap">
                          {formatDate(user.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredUsers.length === 0 && (
              <div className="p-8 text-center text-muted">{t('common.noData')}</div>
            )}

            {filteredUsers.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-line bg-aqua-1/10">
                <p className="text-sm text-muted">
                  {t('tgLeads.pageInfo', {
                    from: (tablePage - 1) * ROWS_PER_PAGE + 1,
                    to: Math.min(tablePage * ROWS_PER_PAGE, filteredUsers.length),
                    total: filteredUsers.length,
                  })}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={tablePage <= 1}
                    onClick={() => setTablePage((p) => p - 1)}
                    className="px-3 py-1.5 text-sm border border-line rounded-lg hover:bg-white disabled:opacity-40"
                  >
                    {t('common.previous')}
                  </button>
                  <span className="text-sm text-ink">
                    {tablePage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={tablePage >= totalPages}
                    onClick={() => setTablePage((p) => p + 1)}
                    className="px-3 py-1.5 text-sm border border-line rounded-lg hover:bg-white disabled:opacity-40"
                  >
                    {t('common.next')}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
