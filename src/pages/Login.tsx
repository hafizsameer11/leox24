import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/authStore';
import LanguageSwitcher from '../components/LanguageSwitcher';

export default function Login() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      // Check if subscription is needed after login
      const user = useAuthStore.getState().user;
      if (user?.company && user.role !== 'super_admin') {
        const subscriptionStatus = user.company.subscription_status;
        const companyStatus = user.company.status;
        const hasActiveSubscription = subscriptionStatus === 'active';
        
        // Needs subscription if company is approved OR active but no active subscription
        const needsSubscription = !hasActiveSubscription && 
                                 (companyStatus === 'approved' || 
                                  subscriptionStatus === 'approved' ||
                                  (companyStatus === 'active' && subscriptionStatus !== 'active'));
        
        if (needsSubscription) {
          navigate('/subscribe');
        } else {
          navigate('/dashboard');
        }
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-aqua-2 to-aqua-1 p-4">
      <LanguageSwitcher />
      <div className="w-full max-w-md rounded-2xl border border-line bg-card p-5 shadow-lg sm:p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-ink mb-2">LEO24 CRM</h1>
          <p className="text-muted">{t('login.title')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-ink mb-1">
              {t('login.email')}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-aqua-4"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-ink mb-1">
              {t('login.password')}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-aqua-4"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-aqua-5 text-white py-2 px-4 rounded-lg font-medium hover:bg-aqua-4 transition-colors disabled:opacity-50"
          >
            {loading ? t('login.signingIn', 'Signing in...') : t('login.signIn')}
          </button>

          <div className="text-center mt-4">
            <Link
              to="/register"
              className="text-cyan-500 hover:text-cyan-600 text-sm"
            >
              {t('login.dontHaveAccount')} {t('login.signUp')}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
