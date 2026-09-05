import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import Topbar from '../components/layout/Topbar';

interface Customer {
  id: number;
  email: string;
  phone: string;
  first_name: string | null;
  last_name: string | null;
  vat: string | null;
  address?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export default function Customers() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    first_name: '',
    last_name: '',
    vat: '',
    address: '',
    notes: '',
  });
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchCustomers();
  }, [searchTerm]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const params: any = {};
      
      if (searchTerm) {
        params.search = searchTerm;
      }

      const response = await api.get('/customers', { params });
      // Handle paginated response
      const data = response.data.data || response.data || [];
      setCustomers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch customers:', error);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCustomer = async () => {
    try {
      const payload: any = {
        email: formData.email,
        phone: formData.phone,
      };

      if (formData.first_name) {
        payload.first_name = formData.first_name;
      }
      if (formData.last_name) {
        payload.last_name = formData.last_name;
      }
      if (formData.vat) {
        payload.vat = formData.vat;
      }
      if (formData.address) {
        payload.address = formData.address;
      }
      if (formData.notes) {
        payload.notes = formData.notes;
      }

      await api.post('/customers', payload);
      setShowCreateModal(false);
      resetForm();
      fetchCustomers();
    } catch (error: any) {
      console.error('Failed to create customer:', error);
      const errorMessage = error.response?.data?.message || t('customers.createFailed');
      alert(errorMessage);
    }
  };

  const handleUpdateCustomer = async () => {
    if (!editingCustomer) return;

    try {
      const payload: any = {};

      if (formData.email !== editingCustomer.email) {
        payload.email = formData.email;
      }
      if (formData.phone !== editingCustomer.phone) {
        payload.phone = formData.phone;
      }
      if (formData.first_name !== (editingCustomer.first_name || '')) {
        payload.first_name = formData.first_name || null;
      }
      if (formData.last_name !== (editingCustomer.last_name || '')) {
        payload.last_name = formData.last_name || null;
      }
      if (formData.vat !== (editingCustomer.vat || '')) {
        payload.vat = formData.vat || null;
      }
      if (formData.address !== (editingCustomer.address || '')) {
        payload.address = formData.address || null;
      }
      if (formData.notes !== (editingCustomer.notes || '')) {
        payload.notes = formData.notes || null;
      }

      await api.put(`/customers/${editingCustomer.id}`, payload);
      setEditingCustomer(null);
      resetForm();
      fetchCustomers();
    } catch (error: any) {
      console.error('Failed to update customer:', error);
      const errorMessage = error.response?.data?.message || t('customers.updateFailed');
      alert(errorMessage);
    }
  };

  const handleDeleteCustomer = async (customerId: number) => {
    if (!confirm(t('customers.deleteConfirm'))) {
      return;
    }

    try {
      await api.delete(`/customers/${customerId}`);
      fetchCustomers();
    } catch (error: any) {
      console.error('Failed to delete customer:', error);
      const errorMessage = error.response?.data?.message || t('customers.deleteFailed');
      alert(errorMessage);
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      phone: '',
      first_name: '',
      last_name: '',
      vat: '',
      address: '',
      notes: '',
    });
  };

  const openEditModal = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      email: customer.email,
      phone: customer.phone,
      first_name: customer.first_name || '',
      last_name: customer.last_name || '',
      vat: customer.vat || '',
      address: customer.address || '',
      notes: customer.notes || '',
    });
  };

  const getCustomerName = (customer: Customer): string => {
    if (customer.first_name || customer.last_name) {
      return `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
    }
    return customer.email;
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
        title={t('customers.title')}
        subtitle={t('customers.subtitle')}
        actions={
          <button 
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 text-sm border border-aqua-5/35 bg-gradient-to-r from-aqua-3/45 to-aqua-5/14 rounded-xl hover:shadow-lg hover:shadow-aqua-5/10 transition-all text-ink font-semibold"
          >
            + {t('customers.newCustomer')}
          </button>
        }
      />

      {/* Search */}
      <div className="bg-white border border-line rounded-2xl p-4">
        <input
          type="text"
          placeholder={t('customers.searchPlaceholder')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none text-sm"
        />
      </div>

      {/* Customers Table */}
      <div className="bg-white border border-line rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-aqua-1/30 border-b border-line">
              <tr>
                <th className="text-left text-xs font-bold text-muted uppercase py-3 px-4">{t('common.name')}</th>
                <th className="text-left text-xs font-bold text-muted uppercase py-3 px-4">{t('common.email')}</th>
                <th className="text-left text-xs font-bold text-muted uppercase py-3 px-4">{t('common.phone')}</th>
                <th className="text-left text-xs font-bold text-muted uppercase py-3 px-4">{t('common.vatNumber')}</th>
                <th className="text-right text-xs font-bold text-muted uppercase py-3 px-4">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id} className="border-b border-line/50 hover:bg-aqua-1/10 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-ink">{getCustomerName(customer)}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-sm text-ink">{customer.email}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-sm text-muted">{customer.phone}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-sm text-muted">{customer.vat || '-'}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => navigate(`/customers/${customer.id}`)}
                        className="p-1.5 hover:bg-aqua-1 rounded-lg transition-colors" 
                        title={t('customers.viewDetails')}
                      >
                        👁️
                      </button>
                      <button 
                        onClick={() => openEditModal(customer)}
                        className="p-1.5 hover:bg-aqua-1 rounded-lg transition-colors" 
                        title={t('common.edit')}
                      >
                        ✏️
                      </button>
                      <button 
                        onClick={() => handleDeleteCustomer(customer.id)}
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
        {customers.length === 0 && !loading && (
          <div className="p-8 text-center text-muted">
            {t('customers.noCustomersFound')}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || editingCustomer) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-ink mb-4">
              {editingCustomer ? t('customers.editCustomer') : t('customers.createNewCustomer')}
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink mb-1">{t('common.email')} *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink mb-1">{t('common.phone')} *</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-ink mb-1">{t('common.firstName')}</label>
                  <input
                    type="text"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className="w-full px-4 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink mb-1">{t('common.lastName')}</label>
                  <input
                    type="text"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="w-full px-4 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink mb-1">{t('common.vatNumber')}</label>
                <input
                  type="text"
                  value={formData.vat}
                  onChange={(e) => setFormData({ ...formData, vat: e.target.value })}
                  className="w-full px-4 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink mb-1">{t('common.address')}</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink mb-1">{t('common.notes')}</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingCustomer(null);
                  resetForm();
                }}
                className="flex-1 px-4 py-2 border border-line rounded-xl hover:bg-aqua-1/30 transition-colors text-ink font-medium"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={editingCustomer ? handleUpdateCustomer : handleCreateCustomer}
                className="flex-1 px-4 py-2 bg-aqua-5 text-white rounded-xl hover:bg-aqua-4 transition-colors font-semibold"
              >
                {editingCustomer ? t('common.update') : t('common.create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
