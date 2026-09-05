import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { useAuthStore } from '../stores/authStore';
import Topbar from '../components/layout/Topbar';
import Button from '../components/ui/Button';

interface SubscriptionPlan {
  id: number;
  name: string;
  description: string | null;
  amount: number;
  currency: string;
  interval: string;
  features: string[] | null;
  formatted_price?: string;
  is_active: boolean;
}

interface Subscription {
  id: number;
  status: string;
  current_period_end: string;
  plan: SubscriptionPlan;
}

export default function Subscribe() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((state) => state.user);
  
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const checkAuth = useAuthStore((state) => state.checkAuth);
  const successProcessed = useRef(false);

  useEffect(() => {
    const processParams = async () => {
    const success = searchParams.get('success');
    const message = searchParams.get('message');
    
      if (success === 'true' && message && !successProcessed.current) {
        successProcessed.current = true;
      setSuccessMessage(decodeURIComponent(message));
      setSearchParams({}, { replace: true });
        await fetchData();
        await checkAuth();
      } else if (!successProcessed.current) {
      fetchData();
    }
    };

    processParams();
    
    const interval = setInterval(async () => {
      try {
        if (!checkoutLoading) {
        await checkAuth();
        const currentUser = useAuthStore.getState().user;
        if (currentUser?.company?.subscription_status === 'active') {
          fetchData();
           }
        }
      } catch (error) {
        console.error('Failed to check subscription status:', error);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [checkAuth, navigate, searchParams, setSearchParams, checkoutLoading]);

  const fetchData = async () => {
    try {
      if (plans.length === 0) {
      setLoading(true);
      }
      
      const [plansRes, subscriptionRes] = await Promise.all([
        api.get('/subscription-plans'),
        api.get('/subscription').catch(() => null),
      ]);

      if (plansRes.data && Array.isArray(plansRes.data)) {
        setPlans(plansRes.data);
        if (!selectedPlan && plansRes.data.length > 0) {
          setSelectedPlan(plansRes.data[0]);
        }
      } else if (plansRes.data && plansRes.data.length > 0) {
        setPlans([plansRes.data[0]]);
        if (!selectedPlan) setSelectedPlan(plansRes.data[0]);
      }

      if (subscriptionRes?.data?.subscription) {
        setSubscription(subscriptionRes.data.subscription);
      }
    } catch (err: any) {
      console.error('Failed to fetch subscription data:', err);
      setError(err.response?.data?.message || t('subscribe.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (planToSubscribe: SubscriptionPlan) => {
    if (!planToSubscribe || !user?.company) {
      setError(t('subscribe.missingInfo'));
      return;
    }

    try {
      setCheckoutLoading(true);
      setError('');
      
      const response = await api.post('/subscription/checkout', {
        plan_id: planToSubscribe.id,
      });
      
      if (!response.data.checkout_url) {
        throw new Error(t('subscribe.checkoutSessionFailed'));
      }

      window.location.href = response.data.checkout_url;
    } catch (err: any) {
      console.error('Failed to create checkout session:', err);
      setError(err.message || t('subscribe.checkoutFailed'));
      setCheckoutLoading(false);
    }
  };

  if (loading && plans.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-aqua-5"></div>
      </div>
    );
  }

  if (subscription && subscription.status === 'active') {
    return (
      <div className="space-y-6">
        <Topbar
          title={t('subscribe.title')}
          subtitle={t('subscribe.currentSubtitle')}
        />
        
        <div className="bg-white border border-line rounded-2xl p-6 shadow-sm max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-ink">{t('subscribe.activeTitle')}</h3>
              <p className="text-sm text-muted">{t('subscribe.activeSubscription')}</p>
            </div>
            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
              {t('subscribe.activeBadge')}
            </span>
          </div>

          {subscription.plan && (
            <div className="border-t border-line pt-4 mt-4">
              <h4 className="font-semibold text-ink mb-2">{subscription.plan.name}</h4>
              <p className="text-sm text-muted mb-4">{subscription.plan.description}</p>
              
              <div className="text-2xl font-bold text-ink mb-4">
                €{(subscription.plan.amount / 100).toFixed(2)} / {subscription.plan.interval}
              </div>

              {subscription.current_period_end && (
                <p className="text-sm text-muted">
                  {t('subscribe.nextBillingDate', {
                    date: new Date(subscription.current_period_end).toLocaleDateString(),
                  })}
                </p>
              )}
            </div>
          )}

          <div className="mt-6">
            <Button onClick={() => navigate('/dashboard')} variant="primary" className="w-full sm:w-auto">
              {t('subscribe.goToDashboard')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="space-y-6">
        <Topbar title={t('subscribe.title')} subtitle={t('subscribe.subtitle')} />
        <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
          <p className="text-muted">{t('subscribe.noPlans')}</p>
        </div>
      </div>
    );
  }

  const hasActiveSubscription = user?.company?.subscription_status === 'active';
  const needsSubscription = user?.company && 
                           !hasActiveSubscription &&
                           (user.company.status === 'approved' || 
                            user.company.subscription_status === 'approved' ||
                            (user.company.status === 'active' && user.company.subscription_status !== 'active'));

  return (
    <div className="space-y-6">
      {needsSubscription && (
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-400 rounded-xl p-6 shadow-lg">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-yellow-900 mb-2">{t('subscribe.approvalComplete')}</h3>
              <p className="text-yellow-800 mb-4">
                {t('subscribe.approvalMessage', { name: user?.company?.name })}
              </p>
            </div>
          </div>
        </div>
      )}

      <Topbar
        title={t('sidebar.subscribe')}
        subtitle={needsSubscription ? t('subscribe.choosePlan') : t('subscribe.manageSubtitle')}
        actions={
          <button
            onClick={async () => {
              try {
                await checkAuth();
                await fetchData();
              } catch (error) {
                console.error('Failed to refresh:', error);
              }
            }}
            className="px-4 py-2 text-sm border border-line rounded-lg hover:bg-aqua-1/30 transition-colors text-ink font-medium"
          >
            🔄 {t('subscribe.refreshStatus')}
          </button>
        }
      />

      {successMessage && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-400 rounded-xl p-6 shadow-lg">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-green-900 mb-2">{t('subscribe.successTitle')}</h3>
              <p className="text-green-800 mb-4">{successMessage}</p>
              <p className="text-sm text-green-700">
                {t('subscribe.successDetail')}
              </p>
            </div>
            <button
              onClick={() => setSuccessMessage(null)}
              className="text-green-600 hover:text-green-800"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map((currentPlan) => (
          <div 
            key={currentPlan.id}
            className={`bg-white border rounded-2xl p-6 shadow-sm flex flex-col transition-all duration-200 hover:shadow-md ${
              selectedPlan?.id === currentPlan.id 
                ? 'border-aqua-5 ring-2 ring-aqua-5/20' 
                : 'border-line hover:border-aqua-3'
            }`}
            onClick={() => setSelectedPlan(currentPlan)}
          >
        <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-ink mb-2">{currentPlan.name}</h2>
              {currentPlan.description && (
                <p className="text-muted text-sm">{currentPlan.description}</p>
          )}
        </div>

        <div className="text-center mb-6">
          <div className="text-4xl font-bold text-ink mb-2">
                €{(currentPlan.amount / 100).toFixed(2)}
          </div>
              <div className="text-muted">{t('subscribe.perInterval', { interval: currentPlan.interval })}</div>
        </div>

            {currentPlan.features && currentPlan.features.length > 0 && (
              <div className="border-t border-line pt-6 mb-6 flex-grow">
                <h3 className="font-semibold text-ink mb-4 text-sm uppercase tracking-wider">{t('subscribe.featuresIncluded')}</h3>
                <ul className="space-y-3">
                  {currentPlan.features.map((feature, index) => (
                <li key={index} className="flex items-start">
                  <svg
                    className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                      <span className="text-ink text-sm">{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

            <div className="border-t border-line pt-6 mt-auto">
          <Button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSubscribe(currentPlan);
                }}
                isLoading={checkoutLoading && selectedPlan?.id === currentPlan.id}
            variant="primary"
            className="w-full"
                disabled={checkoutLoading}
          >
                {checkoutLoading && selectedPlan?.id === currentPlan.id ? t('subscribe.processing') : t('subscribe.subscribeNow')}
          </Button>
            </div>
        </div>
        ))}
      </div>
      
      <p className="text-xs text-muted text-center mt-8">
        {t('subscribe.stripeNote')}
      </p>
    </div>
  );
}
