import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  // Every data table keeps its desktop table at larger sizes, but becomes a
  // labelled record card on a phone. Labels are read from the real table
  // headers so translations and newly-added columns work automatically.
  useEffect(() => {
    const root = mainRef.current;
    if (!root) return undefined;

    const decorateResponsiveContent = () => {
      root.querySelectorAll<HTMLTableElement>('table').forEach((table) => {
        table.dataset.crmResponsiveTable = 'true';
        const headers = Array.from(table.querySelectorAll('thead th')).map((header) =>
          (header.textContent || '').replace(/\s+/g, ' ').trim() || 'Details',
        );

        table.querySelectorAll('tbody tr').forEach((row) => {
          Array.from(row.children).forEach((cell, index) => {
            if (!(cell instanceof HTMLTableCellElement)) return;
            cell.dataset.crmLabel = headers[index] || 'Details';
          });
        });
      });

      // Several older pages have custom dialogs rather than the shared Modal.
      // Applying these classes keeps their phone behaviour consistent too.
      root.querySelectorAll<HTMLElement>('div.fixed.inset-0.z-50').forEach((overlay) => {
        overlay.classList.add('crm-mobile-sheet-overlay');
        const panel = Array.from(overlay.children).find((child): child is HTMLElement => child instanceof HTMLElement);
        panel?.classList.add('crm-mobile-sheet-panel');
      });
    };

    decorateResponsiveContent();
    const observer = new MutationObserver(decorateResponsiveContent);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMobileMenuOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, []);

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
    <div className={`min-h-[100dvh] ${isProjectIframe ? 'lg:grid lg:grid-cols-[80px_minmax(0,1fr)]' : 'lg:grid lg:grid-cols-[280px_minmax(0,1fr)]'}`}>
      <Sidebar
        iconOnly={isProjectIframe}
        mobileOpen={isMobileMenuOpen}
        onNavigate={() => setIsMobileMenuOpen(false)}
      />
      {isMobileMenuOpen && (
        <button
          type="button"
          aria-label={t('layout.closeNavigation', { defaultValue: 'Close navigation' })}
          className="fixed inset-0 z-40 bg-ink/35 backdrop-blur-[1px] lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
      <main
        ref={mainRef}
        data-crm-main
        className={`min-w-0 flex-1 overflow-x-hidden overflow-y-auto ${isProjectIframe ? 'overflow-hidden' : ''} bg-gradient-to-br from-aqua-1/20 via-white to-white`}
      >
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
          <button
            type="button"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line bg-white text-ink shadow-sm transition hover:bg-aqua-1/40"
            aria-label={t('layout.openNavigation', { defaultValue: 'Open navigation' })}
            aria-expanded={isMobileMenuOpen}
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-ink">LEO24 CRM</p>
            <p className="truncate text-xs text-muted">{t('sidebar.enterprisePlatform')}</p>
          </div>
        </header>
        {needsSubscription && !isSubscriptionPage && (
          <div className="mx-4 mb-4 mt-4 rounded-xl border-2 border-yellow-400 bg-yellow-50 p-4 shadow-sm sm:mx-6 sm:mt-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                className="w-full rounded-lg bg-yellow-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-yellow-700 sm:w-auto"
              >
                {t('layout.subscribeNow')}
              </button>
            </div>
          </div>
        )}
        <div className={`${isProjectIframe ? 'p-0' : 'p-4 sm:p-6'}`}>
          <Outlet />
        </div>
      </main>
      <LanguageSwitcher />
    </div>
  );
}
