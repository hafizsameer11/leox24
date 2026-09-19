import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import Topbar from '../components/layout/Topbar';
import Modal from '../components/ui/Modal';
import CustomerFormFields, { createEmptyCustomerForm, customerFormPayload, customerToForm, type CustomerCategory, type CustomerFormData } from '../components/customers/CustomerFormFields';

interface Customer extends Omit<Partial<CustomerFormData>, 'email' | 'phone' | 'first_name' | 'last_name' | 'second_last_name' | 'category_id'> {
  id: number;
  email: string;
  phone: string;
  first_name: string | null;
  last_name: string | null;
  second_last_name?: string | null;
  city?: string | null;
  customer_code?: string | null;
  customer_group?: string | null;
  category_id?: number | null;
  category?: CustomerCategory | null;
  mobile?: string | null;
  gender?: string | null;
  country?: string | null;
  date_of_birth?: string | null;
  created_at?: string;
}

function getCustomerAge(dateOfBirth?: string | null): string {
  if (!dateOfBirth) return '';
  const match = String(dateOfBirth).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '';

  const birthYear = Number(match[1]);
  const birthMonth = Number(match[2]) - 1;
  const birthDay = Number(match[3]);
  const today = new Date();
  let age = today.getFullYear() - birthYear;
  if (today.getMonth() < birthMonth || (today.getMonth() === birthMonth && today.getDate() < birthDay)) {
    age -= 1;
  }

  return age >= 0 && age <= 130 ? String(age) : '';
}

export default function Customers() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState<CustomerFormData>(createEmptyCustomerForm());
  const [filters, setFilters] = useState({
    search: '',
    age: '',
    gender: '',
    country: '',
  });
  const [debouncedFilters, setDebouncedFilters] = useState(filters);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedFilters(filters), 300);
    return () => window.clearTimeout(timeout);
  }, [filters]);

  useEffect(() => {
    void fetchCustomers();
  }, [debouncedFilters]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const params = Object.fromEntries(
        Object.entries(debouncedFilters).filter(([, value]) => value.trim() !== '')
      );
      const response = await api.get('/customers', { params });
      const data = response.data?.data || response.data || [];
      setCustomers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch customers:', error);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingCustomer(null);
    setFormData(createEmptyCustomerForm());
  };

  const openCreateForm = () => {
    setEditingCustomer(null);
    setFormData(createEmptyCustomerForm());
    setShowForm(true);
  };

  const openEditForm = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData(customerToForm(customer as unknown as Record<string, unknown>));
    setShowForm(true);
  };

  const saveCustomer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setSaving(true);
      if (editingCustomer) {
        await api.put(`/customers/${editingCustomer.id}`, customerFormPayload(formData));
      } else {
        await api.post('/customers', customerFormPayload(formData));
      }
      closeForm();
      await fetchCustomers();
    } catch (error: any) {
      console.error('Failed to save customer:', error);
      alert(error.response?.data?.message || (editingCustomer ? t('customers.updateFailed') : t('customers.createFailed')));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCustomer = async (customerId: number) => {
    if (!confirm(t('customers.deleteConfirm'))) return;
    try {
      await api.delete(`/customers/${customerId}`);
      await fetchCustomers();
    } catch (error: any) {
      console.error('Failed to delete customer:', error);
      alert(error.response?.data?.message || t('customers.deleteFailed'));
    }
  };

  const getCustomerName = (customer: Customer) => {
    const name = [customer.first_name, customer.last_name, customer.second_last_name].filter(Boolean).join(' ').trim();
    return name || customer.email;
  };

  if (loading && customers.length === 0) {
    return <div className="flex h-64 items-center justify-center"><div className="h-12 w-12 animate-spin rounded-full border-b-2 border-aqua-5" /></div>;
  }

  return (
    <div className="space-y-6">
      <Topbar
        title={t('customers.title')}
        subtitle={t('customers.subtitle')}
        actions={<button type="button" onClick={openCreateForm} className="rounded-xl border border-aqua-5/35 bg-gradient-to-r from-aqua-3/45 to-aqua-5/14 px-4 py-2 text-sm font-semibold text-ink transition-all hover:shadow-lg hover:shadow-aqua-5/10">+ {t('customers.newCustomer')}</button>}
      />

      <div className="rounded-2xl border border-line bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="block md:col-span-2">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted">{t('customers.name')}</span>
            <input type="search" placeholder={t('customers.searchPlaceholder')} value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} className="w-full rounded-xl border border-line px-4 py-2 text-sm outline-none focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted">{t('customers.age')}</span>
            <input type="text" inputMode="numeric" placeholder={t('customers.ageFilterPlaceholder')} value={filters.age} onChange={(event) => setFilters({ ...filters, age: event.target.value })} className="w-full rounded-xl border border-line px-4 py-2 text-sm outline-none focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted">{t('customers.gender')}</span>
            <input type="text" placeholder={t('customers.genderFilterPlaceholder')} value={filters.gender} onChange={(event) => setFilters({ ...filters, gender: event.target.value })} className="w-full rounded-xl border border-line px-4 py-2 text-sm outline-none focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted">{t('customers.country')}</span>
            <input type="text" placeholder={t('customers.countryFilterPlaceholder')} value={filters.country} onChange={(event) => setFilters({ ...filters, country: event.target.value })} className="w-full rounded-xl border border-line px-4 py-2 text-sm outline-none focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20" />
          </label>
          <button type="button" onClick={() => setFilters({ search: '', age: '', gender: '', country: '' })} className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-aqua-1/30 md:self-end">
            {t('common.clearFilters')}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
        <table className="w-full table-fixed">
          <thead className="border-b border-line bg-aqua-1/30">
            <tr>
              <th className="w-[32%] px-4 py-3 text-left text-xs font-bold uppercase text-muted">{t('customers.customer')}</th>
              <th className="w-[22%] px-3 py-3 text-left text-xs font-bold uppercase text-muted">{t('customers.contact')}</th>
              <th className="hidden w-[18%] px-3 py-3 text-left text-xs font-bold uppercase text-muted md:table-cell">{t('customers.demographics')}</th>
              <th className="hidden w-[18%] px-3 py-3 text-left text-xs font-bold uppercase text-muted md:table-cell">{t('customers.location')}</th>
              <th className="hidden w-[16%] px-3 py-3 text-left text-xs font-bold uppercase text-muted lg:table-cell">{t('customers.categoryGroupCode')}</th>
              <th className="w-[12%] px-3 py-3 text-right text-xs font-bold uppercase text-muted">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr key={customer.id} className="border-b border-line/50 transition-colors hover:bg-aqua-1/10">
                <td className="px-4 py-3 align-top"><p className="truncate font-semibold text-ink" title={getCustomerName(customer)}>{getCustomerName(customer)}</p><p className="truncate text-sm text-muted" title={customer.email}>{customer.email}</p></td>
                <td className="px-3 py-3 align-top"><p className="truncate text-sm text-ink">{customer.phone}</p>{customer.mobile && <p className="truncate text-xs text-muted">{customer.mobile}</p>}</td>
                <td className="hidden px-3 py-3 align-top text-sm text-muted md:table-cell"><p className="truncate text-ink">{getCustomerAge(customer.date_of_birth) || '—'}{customer.gender ? ` · ${customer.gender}` : ''}</p></td>
                <td className="hidden px-3 py-3 align-top text-sm text-muted md:table-cell"><span className="truncate">{customer.city || '—'}</span></td>
                <td className="hidden px-3 py-3 align-top text-sm text-muted lg:table-cell"><p className="truncate font-medium text-ink">{customer.category?.name || t('customers.noCategory')}</p><p className="truncate text-xs">{[customer.customer_group, customer.customer_code].filter(Boolean).join(' · ') || t('customers.noGroupCode')}</p></td>
                <td className="px-3 py-3 text-right align-top"><div className="flex justify-end gap-1"><button type="button" onClick={() => navigate(`/customers/${customer.id}`)} className="rounded-lg px-2 py-1.5 text-xs font-semibold text-aqua-5 hover:bg-aqua-1/50">{t('common.view')}</button><button type="button" onClick={() => openEditForm(customer)} className="rounded-lg px-2 py-1.5 text-xs font-semibold text-ink hover:bg-aqua-1/50">{t('common.edit')}</button><button type="button" onClick={() => void handleDeleteCustomer(customer.id)} className="rounded-lg px-2 py-1.5 text-xs font-semibold text-bad hover:bg-red-50">{t('common.delete')}</button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {customers.length === 0 && <div className="p-10 text-center text-muted">{t('customers.noCustomersFound')}</div>}
      </div>

      <Modal isOpen={showForm} onClose={closeForm} title={editingCustomer ? t('customers.editCustomer') : t('customers.createNewCustomer')} size="xl">
        <form onSubmit={saveCustomer} className="space-y-5">
          <CustomerFormFields value={formData} onChange={setFormData} />
          <div className="sticky bottom-0 flex gap-3 border-t border-line bg-white pt-4">
            <button type="button" onClick={closeForm} className="flex-1 rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink hover:bg-aqua-1/30">{t('common.cancel')}</button>
            <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-aqua-5 px-4 py-2.5 text-sm font-semibold text-white hover:bg-aqua-4 disabled:opacity-50">{saving ? t('customers.saving') : (editingCustomer ? t('common.update') : t('common.create'))}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
