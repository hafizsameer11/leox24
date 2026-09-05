import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Sidebar from './Sidebar';
import { useAuthStore } from '../../stores/authStore';
import LanguageSwitcher from '../LanguageSwitcher';

export default function Layout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const checkAuth = useAuthStore((state) => state.checkAuth);

  useEffect(() => {
    // Small delay to allow auth refresh to complete after subscription activation
    const timeoutId = setTimeout(() => {
      // Redirect to subscription if company needs subscription
      if (user && user.role !== 'super_admin' && user.company) {
        // Check if subscription is needed:
        // 1. Company is approved (waiting for subscription)
        // 2. Company is active but subscription_status is not 'active' (no active subscription)
        const subscriptionStatus = user.company.subscription_status;
        const companyStatus = user.company.status;
        const hasActiveSubscription = subscriptionStatus === 'active';
        
        // Needs subscription if:
        // - Company is approved (waiting for subscription)
        // - Company is active but doesn't have active subscription (subscription_status is null, 'none', 'approved', etc.)
        const needsSubscription = !hasActiveSubscription && 
                                 (companyStatus === 'approved' || 
                                  subscriptionStatus === 'approved' ||
                                  (companyStatus === 'active' && subscriptionStatus !== 'active'));
        
        // Don't redirect if already on subscription pages or success page
        const isSubscriptionPage = location.pathname.startsWith('/subscribe') || 
                                  location.pathname.startsWith('/subscription');
        
        // Don't redirect if we're on dashboard (let user see it)
        const isDashboard = location.pathname === '/dashboard';
        
        if (needsSubscription && !isSubscriptionPage && !isDashboard) {
          console.log('Redirecting to subscribe - subscription_status:', subscriptionStatus, 'company_status:', companyStatus);
          navigate('/subscribe', { replace: true });
        }
      }
    }, 1000); // Delay to allow auth refresh after subscription activation
    
    return () => clearTimeout(timeoutId);
  }, [user, location.pathname, navigate]);

  // Periodically refresh auth to check subscription status (every 10 seconds)
  useEffect(() => {
    if (user && user.role !== 'super_admin' && user.company) {
      const interval = setInterval(async () => {
        try {
          await checkAuth();
        } catch (error) {
          console.error('Failed to refresh auth:', error);
        }
      }, 10000); // Check every 10 seconds

      return () => clearInterval(interval);
    }
  }, [user, checkAuth]);

  const hasActiveSubscription = user?.company?.subscription_status === 'active';
  const needsSubscription = user && user.role !== 'super_admin' && user.company && 
                           !hasActiveSubscription &&
                           (user.company.status === 'approved' || 
                            user.company.subscription_status === 'approved' ||
                            (user.company.status === 'active' && user.company.subscription_status !== 'active'));
  
  const isSubscriptionPage = location.pathname.startsWith('/subscribe') || 
                            location.pathname.startsWith('/subscription');
  
  // Check if we're on doctor or TG Calabria project page (show icon-only sidebar for all users)
  const isProjectIframe = !!(location.pathname.match(/^\/projects\/\d+\/doctor$/) ||
                           location.pathname.match(/^\/projects\/\d+\/tg-calabria$/) ||
                           location.pathname.match(/^\/projects\/\d+\/tg-calabria\/try$/));

  return (
    <div className={`min-h-screen grid ${isProjectIframe ? 'grid-cols-[80px_1fr]' : 'grid-cols-[280px_1fr]'}`}>
      <Sidebar iconOnly={isProjectIframe} />
      <main className={`flex-1 overflow-y-auto ${isProjectIframe ? 'overflow-hidden' : ''} bg-gradient-to-br from-aqua-1/20 via-white to-white`}>
        {needsSubscription && !isSubscriptionPage && (
          <div className="mx-6 mt-6 mb-4 bg-yellow-50 border-2 border-yellow-400 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <h3 className="font-semibold text-yellow-900">{t('layout.subscriptionRequired')}</h3>
                  <p className="text-sm text-yellow-800">{t('layout.subscriptionMessage')}</p>
                </div>
              </div>
              <button
                onClick={() => navigate('/subscribe')}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-medium text-sm"
              >
                {t('layout.subscribeNow')}
              </button>
            </div>
          </div>
        )}
        <div className={`${isProjectIframe ? 'p-0' : 'p-6'}`}>
          <Outlet />
        </div>
      </main>
      <LanguageSwitcher />
    </div>
  );
}
