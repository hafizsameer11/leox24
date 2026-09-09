import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';

export interface CustomerCategory {
  id: number;
  name: string;
  description?: string | null;
}

export interface CustomerFormData {
  email: string;
  phone: string;
  vat: string;
  first_name: string;
  last_name: string;
  second_last_name: string;
  title: string;
  category_id: string;
  customer_group: string;
  customer_code: string;
  gender: string;
  address: string;
  city: string;
  zip_code: string;
  state_province: string;
  country: string;
  date_of_birth: string;
  place_of_birth: string;
  branch: string;
  date_added: string;
  tax_code: string;
  pec_email: string;
  tax_code_fe: string;
  phone_secondary: string;
  mobile: string;
  fax: string;
  privacy_date: string;
  privacy_consent_processing: boolean;
  marketing_consent: boolean;
  profiling_consent: boolean;
  send_sms: boolean;
  send_mail: boolean;
  send_newsletter: boolean;
  billing_address: string;
  billing_city: string;
  billing_zip_code: string;
  billing_state: string;
  billing_country: string;
  family_members: string;
  language: string;
  private_notes: string;
  notes: string;
  occupation: string;
  vision_problem: string;
  hobbies: string;
  acquired_by: string;
  promotion: string;
  referred_by: string;
}

export const createEmptyCustomerForm = (): CustomerFormData => ({
  email: '', phone: '', vat: '', first_name: '', last_name: '', second_last_name: '', title: '', category_id: '',
  customer_group: '', customer_code: '', gender: '', address: '', city: '', zip_code: '',
  state_province: '', country: '', date_of_birth: '', place_of_birth: '', branch: '',
  date_added: new Date().toISOString().slice(0, 10), tax_code: '', pec_email: '', tax_code_fe: '',
  phone_secondary: '', mobile: '', fax: '', privacy_date: '', privacy_consent_processing: false,
  marketing_consent: false, profiling_consent: false, send_sms: false, send_mail: false,
  send_newsletter: false, billing_address: '', billing_city: '', billing_zip_code: '', billing_state: '',
  billing_country: '', family_members: '', language: 'en', private_notes: '', notes: '', occupation: '',
  vision_problem: '', hobbies: '', acquired_by: '', promotion: '', referred_by: '',
});

export const customerToForm = (customer: Record<string, unknown> | null | undefined): CustomerFormData => ({
  ...createEmptyCustomerForm(),
  ...(Object.fromEntries(Object.entries(customer || {}).map(([key, value]) => [key, value ?? ''])) as Partial<CustomerFormData>),
  privacy_consent_processing: Boolean(customer?.privacy_consent_processing),
  marketing_consent: Boolean(customer?.marketing_consent),
  profiling_consent: Boolean(customer?.profiling_consent),
  send_sms: Boolean(customer?.send_sms),
  send_mail: Boolean(customer?.send_mail),
  send_newsletter: Boolean(customer?.send_newsletter),
  date_of_birth: dateInputValue(customer?.date_of_birth),
  date_added: dateInputValue(customer?.date_added) || createEmptyCustomerForm().date_added,
  privacy_date: dateInputValue(customer?.privacy_date),
  category_id: customer?.category_id ? String(customer.category_id) : '',
});

/** Convert local form values to the customer API's expected data types. */
export const customerFormPayload = (form: CustomerFormData) => ({
  ...form,
  category_id: form.category_id ? Number(form.category_id) : null,
});

function dateInputValue(value: unknown): string {
  return typeof value === 'string' ? value.slice(0, 10) : '';
}

interface Props {
  value: CustomerFormData;
  onChange: (value: CustomerFormData) => void;
}

type ConsentField = keyof Pick<CustomerFormData, 'privacy_consent_processing' | 'marketing_consent' | 'profiling_consent' | 'send_sms' | 'send_mail' | 'send_newsletter'>;

/** These must be module-level components so inputs are not remounted on each keystroke. */
function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-ink hover:bg-aqua-1/20">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 rounded border-line text-aqua-5 focus:ring-aqua-5" />
      {label}
    </label>
  );
}

export default function CustomerFormFields({ value, onChange }: Props) {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<CustomerCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const loadCategories = useCallback(async () => {
    try {
      setCategoriesLoading(true);
      const response = await api.get('/categories');
      const data = Array.isArray(response.data) ? response.data : response.data?.data;
      setCategories(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load customer categories:', error);
      setCategories([]);
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  const age = useMemo(() => {
    if (!value.date_of_birth) return '—';
    const birth = new Date(value.date_of_birth);
    if (Number.isNaN(birth.getTime())) return '—';
    const today = new Date();
    let years = today.getFullYear() - birth.getFullYear();
    const beforeBirthday = today.getMonth() < birth.getMonth()
      || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
    if (beforeBirthday) years -= 1;
    return years >= 0 ? String(years) : '—';
  }, [value.date_of_birth]);
  const inputClass = 'w-full rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20';
  const update = <K extends keyof CustomerFormData>(key: K, fieldValue: CustomerFormData[K]) => onChange({ ...value, [key]: fieldValue });

  const updateConsent = (field: ConsentField, checked: boolean) => update(field, checked);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-aqua-1/10 p-4">
        <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-aqua-5">{t('customerForm.identity')}</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Field label={t('customerForm.title')}><select className={inputClass} value={value.title} onChange={(event) => update('title', event.target.value)}><option value="">{t('customerForm.select')}</option><option value="Mr.">{t('customerForm.mr')}</option><option value="Ms.">{t('customerForm.ms')}</option><option value="Other">{t('customerForm.other')}</option></select></Field>
          <Field label={t('customerForm.category')} className="sm:col-start-1"><select className={inputClass} value={value.category_id} onFocus={() => void loadCategories()} onChange={(event) => update('category_id', event.target.value)}><option value="">{categoriesLoading ? t('customerForm.loadingCategories') : t('customerForm.selectCategory')}</option>{categories.map((category) => <option key={category.id} value={String(category.id)}>{category.name}</option>)}</select></Field>
          <Field label={`${t('customerForm.firstName')} *`}><input required className={inputClass} value={value.first_name} onChange={(event) => update('first_name', event.target.value)} /></Field>
          <Field label={t('customerForm.lastName')}><input className={inputClass} value={value.last_name} onChange={(event) => update('last_name', event.target.value)} /></Field>
          <Field label={t('customerForm.secondLastName')}><input className={inputClass} value={value.second_last_name} onChange={(event) => update('second_last_name', event.target.value)} /></Field>
          <Field label={t('customerForm.group')}><input className={inputClass} value={value.customer_group} onChange={(event) => update('customer_group', event.target.value)} /></Field>
          <Field label={t('customerForm.code')}><input className={inputClass} value={value.customer_code} onChange={(event) => update('customer_code', event.target.value)} /></Field>
          <Field label={t('customerForm.gender')}><select className={inputClass} value={value.gender} onChange={(event) => update('gender', event.target.value)}><option value="">{t('customerForm.select')}</option><option value="female">{t('customerForm.female')}</option><option value="male">{t('customerForm.male')}</option><option value="other">{t('customerForm.other')}</option></select></Field>
          <Field label={t('customerForm.language')}><select className={inputClass} value={value.language} onChange={(event) => update('language', event.target.value)}><option value="en">English</option><option value="it">Italiano</option></select></Field>
          <Field label={t('customerForm.dateOfBirth')}><input type="date" className={inputClass} value={value.date_of_birth} onChange={(event) => update('date_of_birth', event.target.value)} /></Field>
          <Field label={t('customerForm.age')}><input readOnly className={`${inputClass} bg-gray-50 text-muted`} value={age} /></Field>
          <Field label={t('customerForm.placeOfBirth')} className="sm:col-span-2"><input className={inputClass} value={value.place_of_birth} onChange={(event) => update('place_of_birth', event.target.value)} /></Field>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-white p-4">
        <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-aqua-5">{t('customerForm.contactAddress')}</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Field label={`${t('customerForm.email')} *`} className="xl:col-span-2"><input type="email" required className={inputClass} value={value.email} onChange={(event) => update('email', event.target.value)} /></Field>
          <Field label={`${t('customerForm.phone')} *`}><input required className={inputClass} value={value.phone} onChange={(event) => update('phone', event.target.value)} /></Field>
          <Field label={t('customerForm.mobile')}><input className={inputClass} value={value.mobile} onChange={(event) => update('mobile', event.target.value)} /></Field>
          <Field label={t('customerForm.phone2')}><input className={inputClass} value={value.phone_secondary} onChange={(event) => update('phone_secondary', event.target.value)} /></Field>
          <Field label={t('customerForm.fax')}><input className={inputClass} value={value.fax} onChange={(event) => update('fax', event.target.value)} /></Field>
          <Field label={t('customerForm.pecEmail')} className="sm:col-span-2"><input type="email" className={inputClass} value={value.pec_email} onChange={(event) => update('pec_email', event.target.value)} /></Field>
          <Field label={t('customerForm.address')} className="xl:col-span-2"><input className={inputClass} value={value.address} onChange={(event) => update('address', event.target.value)} /></Field>
          <Field label={t('customerForm.city')}><input className={inputClass} value={value.city} onChange={(event) => update('city', event.target.value)} /></Field>
          <Field label={t('customerForm.zipCode')}><input className={inputClass} value={value.zip_code} onChange={(event) => update('zip_code', event.target.value)} /></Field>
          <Field label={t('customerForm.stateProvince')}><input className={inputClass} value={value.state_province} onChange={(event) => update('state_province', event.target.value)} /></Field>
          <Field label={t('customerForm.country')}><input className={inputClass} value={value.country} onChange={(event) => update('country', event.target.value)} /></Field>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-white p-4">
        <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-aqua-5">{t('customerForm.generalInformation')}</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Field label={t('customerForm.branch')}><input className={inputClass} value={value.branch} onChange={(event) => update('branch', event.target.value)} /></Field>
          <Field label={t('customerForm.dateAdded')}><input type="date" className={inputClass} value={value.date_added} onChange={(event) => update('date_added', event.target.value)} /></Field>
          <Field label={t('customerForm.taxCode')}><input className={inputClass} value={value.tax_code} onChange={(event) => update('tax_code', event.target.value)} /></Field>
          <Field label={t('customerForm.vatNumber')}><input className={inputClass} value={value.vat} onChange={(event) => update('vat', event.target.value)} /></Field>
          <Field label={t('customerForm.taxCodeFe')}><input className={inputClass} value={value.tax_code_fe} onChange={(event) => update('tax_code_fe', event.target.value)} /></Field>
          <Field label={t('customerForm.privacyDate')}><input type="date" className={inputClass} value={value.privacy_date} onChange={(event) => update('privacy_date', event.target.value)} /></Field>
          <div className="rounded-xl border border-line bg-gray-50 p-2 sm:col-span-2">
            <p className="mb-1 px-2 text-xs font-bold uppercase tracking-wide text-muted">{t('customerForm.privacyGdpr')}</p>
            <Toggle checked={value.privacy_consent_processing} onChange={(checked) => updateConsent('privacy_consent_processing', checked)} label={t('customerForm.processingConsent')} />
            <Toggle checked={value.marketing_consent} onChange={(checked) => updateConsent('marketing_consent', checked)} label={t('customerForm.marketingConsent')} />
            <Toggle checked={value.profiling_consent} onChange={(checked) => updateConsent('profiling_consent', checked)} label={t('customerForm.profilingConsent')} />
          </div>
          <div className="rounded-xl border border-line bg-gray-50 p-2 sm:col-span-2">
            <p className="mb-1 px-2 text-xs font-bold uppercase tracking-wide text-muted">{t('customerForm.communicationPreferences')}</p>
            <Toggle checked={value.send_sms} onChange={(checked) => updateConsent('send_sms', checked)} label={t('customerForm.sendSms')} />
            <Toggle checked={value.send_mail} onChange={(checked) => updateConsent('send_mail', checked)} label={t('customerForm.sendMail')} />
            <Toggle checked={value.send_newsletter} onChange={(checked) => updateConsent('send_newsletter', checked)} label={t('customerForm.sendNewsletter')} />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-white p-4">
        <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-aqua-5">{t('customerForm.billingInformation')}</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Field label={t('customerForm.billingAddress')} className="xl:col-span-2"><input className={inputClass} value={value.billing_address} onChange={(event) => update('billing_address', event.target.value)} /></Field>
          <Field label={t('customerForm.billingCity')}><input className={inputClass} value={value.billing_city} onChange={(event) => update('billing_city', event.target.value)} /></Field>
          <Field label={t('customerForm.billingZipCode')}><input className={inputClass} value={value.billing_zip_code} onChange={(event) => update('billing_zip_code', event.target.value)} /></Field>
          <Field label={t('customerForm.billingState')}><input className={inputClass} value={value.billing_state} onChange={(event) => update('billing_state', event.target.value)} /></Field>
          <Field label={t('customerForm.billingCountry')}><input className={inputClass} value={value.billing_country} onChange={(event) => update('billing_country', event.target.value)} /></Field>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-white p-4">
        <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-aqua-5">{t('customerForm.additionalInformation')}</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Field label={t('customerForm.familyMembers')} className="xl:col-span-2"><input className={inputClass} value={value.family_members} onChange={(event) => update('family_members', event.target.value)} /></Field>
          <Field label={t('customerForm.occupation')}><input className={inputClass} value={value.occupation} onChange={(event) => update('occupation', event.target.value)} /></Field>
          <Field label={t('customerForm.visionProblem')}><input className={inputClass} value={value.vision_problem} onChange={(event) => update('vision_problem', event.target.value)} /></Field>
          <Field label={t('customerForm.hobbies')}><input className={inputClass} value={value.hobbies} onChange={(event) => update('hobbies', event.target.value)} /></Field>
          <Field label={t('customerForm.acquiredBy')}><input className={inputClass} value={value.acquired_by} onChange={(event) => update('acquired_by', event.target.value)} /></Field>
          <Field label={t('customerForm.promotion')}><input className={inputClass} value={value.promotion} onChange={(event) => update('promotion', event.target.value)} /></Field>
          <Field label={t('customerForm.referredBy')}><input className={inputClass} value={value.referred_by} onChange={(event) => update('referred_by', event.target.value)} /></Field>
          <Field label={t('customerForm.notes')} className="xl:col-span-2"><textarea rows={3} className={inputClass} value={value.notes} onChange={(event) => update('notes', event.target.value)} /></Field>
          <Field label={t('customerForm.privateNotes')}><textarea rows={3} className={inputClass} value={value.private_notes} onChange={(event) => update('private_notes', event.target.value)} /></Field>
        </div>
      </section>
    </div>
  );
}
