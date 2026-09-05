import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

export default function Register() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    // Company data
    company_name: '',
    company_vat: '',
    company_address: '',
    // Contact person
    contact_name: '',
    contact_email: '',
    contact_password: '',
    contact_password_confirmation: '',
    // Projects
    requested_projects: [] as number[],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setLoading(true);

    // Validation
    if (formData.contact_password !== formData.contact_password_confirmation) {
      setError(t('register.passwordMismatch'));
      setLoading(false);
      return;
    }

    if (formData.contact_password.length < 8) {
      setError(t('register.passwordMinLength'));
      setLoading(false);
      return;
    }

    try {
      const payload = {
        company_data: {
          name: formData.company_name,
          vat: formData.company_vat || null,
          address: formData.company_address || null,
        },
        contact_person: {
          name: formData.contact_name,
          email: formData.contact_email,
          password: formData.contact_password,
        },
        requested_projects: formData.requested_projects,
      };

      await api.post('/signup-requests', payload);
      setSuccess(true);
    } catch (err: any) {
      // Handle validation errors with field-specific messages
      if (err.response?.status === 422 && err.response?.data?.errors) {
        const errors = err.response.data.errors;
        const fieldErrorMap: Record<string, string> = {};
        const errorMessages: string[] = [];
        
        // Map errors to fields and collect general messages
        Object.keys(errors).forEach((field) => {
          const fieldErrors = Array.isArray(errors[field]) ? errors[field] : [errors[field]];
          
          // Map nested field errors (e.g., company_data.vat)
          if (field.includes('.')) {
            const [parent, child] = field.split('.');
            if (parent === 'company_data') {
              fieldErrorMap[`company_${child}`] = fieldErrors[0];
            } else if (parent === 'contact_person') {
              fieldErrorMap[`contact_${child}`] = fieldErrors[0];
            }
          } else {
            fieldErrorMap[field] = fieldErrors[0];
          }
          
          errorMessages.push(...fieldErrors);
        });
        
        setFieldErrors(fieldErrorMap);
        setError(errorMessages.join(' '));
      } else {
        // Handle other errors
        const errorMessage = err.response?.data?.message || 
                            err.response?.data?.error || 
                            t('register.registrationFailed');
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-aqua-2 to-aqua-1">
        <div className="bg-card p-8 rounded-2xl shadow-lg border border-line w-full max-w-md">
          <div className="text-center">
            <div className="mb-4">
              <svg
                className="mx-auto h-16 w-16 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-ink mb-2">{t('register.successTitle')}</h1>
            <p className="text-muted mb-6">
              {t('register.successMessage')}
            </p>
            <Link to="/login">
              <Button variant="primary">{t('register.goToLogin')}</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-aqua-2 to-aqua-1 py-12 px-4">
      <div className="bg-card p-8 rounded-2xl shadow-lg border border-line w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-ink mb-2">{t('register.brandTitle')}</h1>
          <p className="text-muted">{t('register.subtitle')}</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Company Information */}
          <div className="border-b border-line pb-6">
            <h2 className="text-lg font-semibold text-ink mb-4">{t('register.companyInfo')}</h2>
            <div className="space-y-4">
              <Input
                label={t('register.companyName')}
                type="text"
                value={formData.company_name}
                onChange={(e) => {
                  setFormData({ ...formData, company_name: e.target.value });
                  if (fieldErrors.company_name) setFieldErrors({ ...fieldErrors, company_name: '' });
                }}
                error={fieldErrors.company_name}
                required
              />
              <Input
                label={t('register.vat')}
                type="text"
                value={formData.company_vat}
                onChange={(e) => {
                  setFormData({ ...formData, company_vat: e.target.value });
                  if (fieldErrors.company_vat) setFieldErrors({ ...fieldErrors, company_vat: '' });
                }}
                error={fieldErrors.company_vat}
                helperText={t('common.optional')}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('register.address')}
                </label>
                <textarea
                  value={formData.company_address}
                  onChange={(e) => setFormData({ ...formData, company_address: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  rows={3}
                />
              </div>
            </div>
          </div>

          {/* Contact Person */}
          <div className="border-b border-line pb-6">
            <h2 className="text-lg font-semibold text-ink mb-4">{t('register.contactPersonAdmin')}</h2>
            <div className="space-y-4">
              <Input
                label={t('register.contactName')}
                type="text"
                value={formData.contact_name}
                onChange={(e) => {
                  setFormData({ ...formData, contact_name: e.target.value });
                  if (fieldErrors.contact_name) setFieldErrors({ ...fieldErrors, contact_name: '' });
                }}
                error={fieldErrors.contact_name}
                required
              />
              <Input
                label={t('register.contactEmail')}
                type="email"
                value={formData.contact_email}
                onChange={(e) => {
                  setFormData({ ...formData, contact_email: e.target.value });
                  if (fieldErrors.contact_email) setFieldErrors({ ...fieldErrors, contact_email: '' });
                }}
                error={fieldErrors.contact_email}
                required
              />
              <Input
                label={t('register.password')}
                type="password"
                value={formData.contact_password}
                onChange={(e) => {
                  setFormData({ ...formData, contact_password: e.target.value });
                  if (fieldErrors.contact_password) setFieldErrors({ ...fieldErrors, contact_password: '' });
                }}
                error={fieldErrors.contact_password}
                required
                helperText={t('common.minPassword')}
              />
              <Input
                label={t('register.confirmPassword')}
                type="password"
                value={formData.contact_password_confirmation}
                onChange={(e) => {
                  setFormData({ ...formData, contact_password_confirmation: e.target.value });
                  if (fieldErrors.contact_password_confirmation) setFieldErrors({ ...fieldErrors, contact_password_confirmation: '' });
                }}
                error={fieldErrors.contact_password_confirmation}
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Link to="/login" className="text-cyan-500 hover:text-cyan-600 text-sm">
              {t('register.alreadyHaveAccount')} {t('register.signIn')}
            </Link>
            <Button type="submit" isLoading={loading} variant="primary">
              {t('register.submit')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
