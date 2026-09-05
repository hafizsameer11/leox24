import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import Topbar from '../components/layout/Topbar';
import { useAuthStore } from '../stores/authStore';

interface User {
  id: number;
  name: string;
  email: string;
  role: 'super_admin' | 'company_admin' | 'manager' | 'staff' | 'readonly';
  status: 'active' | 'inactive' | 'suspended';
  permissions?: string[] | null;
  company_id?: number | null;
  company?: {
    id: number;
    name: string;
  } | null;
  created_at?: string;
  updated_at?: string;
}

interface Company {
  id: number;
  name: string;
}

export default function Users() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const isSuperAdmin = user?.role === 'super_admin';
  const isCompanyAdmin = user?.role === 'company_admin';

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'staff' as User['role'],
    status: 'active' as User['status'],
    permissions: [] as string[],
    company_id: null as number | null,
  });
  const [filters, setFilters] = useState({
    search: '',
    role: 'all',
    status: 'all',
  });

  useEffect(() => {
    fetchUsers();
  }, [filters.role, filters.status]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers();
    }, 300);

    return () => clearTimeout(timer);
  }, [filters.search]);

  // Fetch companies when modal opens (for super admin and company admin)
  useEffect(() => {
    if ((isSuperAdmin || isCompanyAdmin) && (showCreateModal || editingUser)) {
      fetchCompanies();
    }
  }, [isSuperAdmin, isCompanyAdmin, showCreateModal, editingUser]);

  const fetchCompanies = async () => {
    try {
      const response = await api.get('/companies', { params: { per_page: 1000 } });
      const data = response.data.data || response.data || [];
      setCompanies(Array.isArray(data) ? data : []);
      
      // If company admin, set their company_id automatically after fetching
      if (isCompanyAdmin && user?.company_id) {
        setFormData(prev => ({ ...prev, company_id: user.company_id || null }));
      }
    } catch (error) {
      console.error('Failed to fetch companies:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params: any = {};
      
      if (filters.search) {
        params.search = filters.search;
      }
      
      if (filters.role !== 'all') {
        params.role = filters.role;
      }
      
      if (filters.status !== 'all') {
        params.status = filters.status;
      }

      const response = await api.get('/users', { params });
      // Handle paginated response
      const data = response.data.data || response.data || [];
      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    try {
      const payload: any = {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
        status: formData.status,
      };

      if (formData.permissions.length > 0) {
        payload.permissions = formData.permissions;
      }

      // Include company_id if super admin selected one
      if (isSuperAdmin && formData.company_id) {
        payload.company_id = formData.company_id;
      }

      await api.post('/users', payload);
      setShowCreateModal(false);
      resetForm();
      fetchUsers();
    } catch (error: any) {
      console.error('Failed to create user:', error);
      const errorMessage = error.response?.data?.message || error.response?.data?.error || t('users.createFailed');
      alert(errorMessage);
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;

    try {
      const payload: any = {};

      if (formData.name !== editingUser.name) {
        payload.name = formData.name;
      }
      if (formData.email !== editingUser.email) {
        payload.email = formData.email;
      }
      if (formData.password) {
        payload.password = formData.password;
      }
      if (formData.role !== editingUser.role) {
        payload.role = formData.role;
      }
      if (formData.status !== editingUser.status) {
        payload.status = formData.status;
      }
      if (JSON.stringify(formData.permissions) !== JSON.stringify(editingUser.permissions || [])) {
        payload.permissions = formData.permissions.length > 0 ? formData.permissions : null;
      }
      // Include company_id if super admin changed it
      if (isSuperAdmin && formData.company_id !== editingUser.company_id) {
        payload.company_id = formData.company_id;
      }

      await api.put(`/users/${editingUser.id}`, payload);
      setEditingUser(null);
      resetForm();
      fetchUsers();
    } catch (error: any) {
      console.error('Failed to update user:', error);
      const errorMessage = error.response?.data?.message || error.response?.data?.error || t('users.updateFailed');
      alert(errorMessage);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm(t('users.deleteConfirm'))) {
      return;
    }

    try {
      await api.delete(`/users/${userId}`);
      fetchUsers();
    } catch (error: any) {
      console.error('Failed to delete user:', error);
      const errorMessage = error.response?.data?.message || error.response?.data?.error || t('users.deleteFailed');
      alert(errorMessage);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'staff',
      status: 'active',
      permissions: [],
      company_id: null,
    });
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '', // Don't pre-fill password
      role: user.role,
      status: user.status,
      permissions: user.permissions || [],
      company_id: user.company_id || null,
    });
  };

  const getRoleBadge = (role: string) => {
    const styles = {
      super_admin: 'bg-purple-100 text-purple-800 border-purple-300',
      company_admin: 'bg-blue-100 text-blue-800 border-blue-300',
      manager: 'bg-green-100 text-green-800 border-green-300',
      staff: 'bg-gray-100 text-gray-800 border-gray-300',
      readonly: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    };
    return styles[role as keyof typeof styles] || styles.staff;
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      active: 'bg-ok/15 text-ok border-ok/30',
      inactive: 'bg-muted/15 text-muted border-muted/30',
      suspended: 'bg-bad/15 text-bad border-bad/30',
    };
    return styles[status as keyof typeof styles] || styles.inactive;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-aqua-5"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Topbar
        title={t('users.managementTitle')}
        subtitle={t('users.managementSubtitle')}
        actions={
          <>
            <button className="px-4 py-2 text-sm border border-line rounded-xl hover:bg-aqua-1/30 transition-colors text-ink font-medium">
              {t('common.export')}
            </button>
            <button 
              onClick={() => {
                resetForm();
                setShowCreateModal(true);
              }}
              className="px-4 py-2 text-sm border border-aqua-5/35 bg-gradient-to-r from-aqua-3/45 to-aqua-5/14 rounded-xl hover:shadow-lg hover:shadow-aqua-5/10 transition-all text-ink font-semibold"
            >
              ➕ {t('users.inviteUser')}
            </button>
          </>
        }
      />

      {/* Filters */}
      <div className="bg-white border border-line rounded-2xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            type="text"
            placeholder={t('users.searchPlaceholder')}
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="px-4 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none text-sm"
          />
          <select
            value={filters.role}
            onChange={(e) => setFilters({ ...filters, role: e.target.value })}
            className="px-4 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none text-sm"
          >
            <option value="all">{t('users.allRoles')}</option>
            <option value="super_admin">{t('users.superAdmin')}</option>
            <option value="company_admin">{t('users.companyAdmin')}</option>
            <option value="manager">{t('users.manager')}</option>
            <option value="staff">{t('users.staff')}</option>
            <option value="readonly">{t('users.readonly')}</option>
          </select>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="px-4 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none text-sm"
          >
            <option value="all">{t('users.allStatus')}</option>
            <option value="active">{t('users.active')}</option>
            <option value="inactive">{t('users.inactive')}</option>
            <option value="suspended">{t('users.suspended')}</option>
          </select>
          <button 
            onClick={() => setFilters({ search: '', role: 'all', status: 'all' })}
            className="px-4 py-2 text-sm border border-line rounded-xl hover:bg-aqua-1/30 transition-colors text-ink font-medium"
          >
            {t('common.clearFilters')}
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white border border-line rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-aqua-1/30 border-b border-line">
              <tr>
                <th className="text-left text-xs font-bold text-muted uppercase py-3 px-4">{t('common.name')}</th>
                <th className="text-left text-xs font-bold text-muted uppercase py-3 px-4">{t('common.email')}</th>
                <th className="text-left text-xs font-bold text-muted uppercase py-3 px-4">{t('users.role')}</th>
                <th className="text-left text-xs font-bold text-muted uppercase py-3 px-4">{t('common.status')}</th>
                <th className="text-left text-xs font-bold text-muted uppercase py-3 px-4">{t('users.company')}</th>
                <th className="text-right text-xs font-bold text-muted uppercase py-3 px-4">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-line/50 hover:bg-aqua-1/10 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-ink">{user.name}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-sm text-ink">{user.email}</div>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`text-xs px-2 py-1 rounded-full border font-medium ${getRoleBadge(user.role)}`}>
                      {user.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`text-xs px-2 py-1 rounded-full border font-medium ${getStatusBadge(user.status)}`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm text-muted">{user.company?.name || '-'}</span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => openEditModal(user)}
                        className="p-1.5 hover:bg-aqua-1 rounded-lg transition-colors" 
                        title={t('common.edit')}
                      >
                        ✏️
                      </button>
                      <button 
                        onClick={() => handleDeleteUser(user.id)}
                        className="p-1.5 hover:bg-aqua-1 rounded-lg transition-colors text-red-500" 
                        title={t('common.delete')}
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {users.length === 0 && !loading && (
          <div className="p-8 text-center text-muted">
            {t('users.noUsersFound')}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || editingUser) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-ink mb-4">
              {editingUser ? t('users.editUser') : t('users.inviteUser')}
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink mb-1">{t('users.nameRequired')}</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink mb-1">{t('users.emailRequired')}</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink mb-1">
                  {t('common.password')} {editingUser ? t('common.passwordKeepCurrent') : '*'}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none"
                  required={!editingUser}
                  minLength={8}
                />
                {!editingUser && (
                  <p className="text-xs text-muted mt-1">{t('common.minPassword')}</p>
                )}
              </div>

              {(isSuperAdmin || isCompanyAdmin) && (
                <div>
                  <label className="block text-sm font-medium text-ink mb-1">{t('users.companyRequired')}</label>
                  <select
                    value={formData.company_id || ''}
                    onChange={(e) => setFormData({ ...formData, company_id: e.target.value ? parseInt(e.target.value) : null })}
                    className="w-full px-4 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none"
                    required
                    disabled={isCompanyAdmin && !isSuperAdmin}
                  >
                    <option value="">{t('common.selectCompany')}</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                  {isCompanyAdmin && !isSuperAdmin && (
                    <p className="text-xs text-muted mt-1">{t('common.companyAutoAssigned')}</p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-ink mb-1">{t('users.role')} *</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as User['role'] })}
                  className="w-full px-4 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none"
                  required
                >
                  <option value="staff">{t('users.staff')}</option>
                  <option value="manager">{t('users.manager')}</option>
                  <option value="company_admin">{t('users.companyAdmin')}</option>
                  <option value="readonly">{t('users.readonly')}</option>
                  {isSuperAdmin && <option value="super_admin">{t('users.superAdmin')}</option>}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink mb-1">{t('common.status')} *</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as User['status'] })}
                  className="w-full px-4 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none"
                  required
                >
                  <option value="active">{t('users.active')}</option>
                  <option value="pending">{t('common.pending')}</option>
                  <option value="suspended">{t('users.suspended')}</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingUser(null);
                  resetForm();
                }}
                className="flex-1 px-4 py-2 border border-line rounded-xl hover:bg-aqua-1/30 transition-colors text-ink font-medium"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={editingUser ? handleUpdateUser : handleCreateUser}
                className="flex-1 px-4 py-2 bg-aqua-5 text-white rounded-xl hover:bg-aqua-4 transition-colors font-semibold"
              >
                {editingUser ? t('common.update') : t('common.create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
