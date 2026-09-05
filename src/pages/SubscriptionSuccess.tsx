import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { useAuthStore } from '../stores/authStore';
import Button from '../components/ui/Button';

export default function SubscriptionSuccess() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    if (sessionId) {
      verifySession();
    } else {
      setError(t('subscriptionSuccess.missingSessionId'));
      setLoading(false);
    }
  }, [sessionId, t]);

  const checkAuth = useAuthStore((state) => state.checkAuth);

  const verifySession = async () => {
    try {
      if (!sessionId) {
        setError(t('subscriptionSuccess.missingSessionId'));
        setLoading(false);
        return;
      }
      
      const response = await api.get('/subscription/success', {
        params: {
          session_id: sessionId,
        },
      });
      
      if (response.data.message && response.data.subscription) {
        await checkAuth();
        
        const successMessage = response.data.message || t('subscriptionSuccess.activatedSuccess');
        navigate('/dashboard?success=true&message=' + encodeURIComponent(successMessage), { replace: true });
        return;
      } else {
        const companyId = searchParams.get('company_id');
        const planId = searchParams.get('plan_id');
        const paymentIntentId = searchParams.get('payment_intent');
        
        if (companyId && planId) {
          const activateResponse = await api.post('/subscription/activate', {
            session_id: sessionId,
            company_id: parseInt(companyId),
            plan_id: parseInt(planId),
            payment_intent_id: paymentIntentId || null,
          });
          
          await checkAuth();
          const successMessage = activateResponse.data.message || t('subscriptionSuccess.activatedSuccess');
          navigate('/dashboard?success=true&message=' + encodeURIComponent(successMessage), { replace: true });
          return;
        } else {
          setError(t('subscriptionSuccess.missingRedirectInfo'));
          setLoading(false);
        }
      }
      
    } catch (err: any) {
      console.error('Failed to activate subscription:', err);
      const errorMessage = err.response?.data?.message || err.response?.data?.error || err.message || t('subscriptionSuccess.activateFailed');
      setError(errorMessage + '. ' + t('subscriptionSuccess.contactSupport'));
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-aqua-2 to-aqua-1">
        <div className="bg-white p-8 rounded-2xl shadow-lg border border-line w-full max-w-md text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-aqua-5 mx-auto mb-4"></div>
          <p className="text-muted mb-2">{t('subscriptionSuccess.processingPayment')}</p>
          <p className="text-sm text-muted">{t('subscriptionSuccess.savingSubscription')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-aqua-2 to-aqua-1">
        <div className="bg-white p-8 rounded-2xl shadow-lg border border-line w-full max-w-md text-center">
          <div className="mb-4">
            <svg
              className="mx-auto h-16 w-16 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-ink mb-2">{t('subscriptionSuccess.verificationFailed')}</h1>
          <p className="text-muted mb-6">{error}</p>
          <Button onClick={() => navigate('/subscribe')} variant="primary">
            {t('common.tryAgain')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-aqua-2 to-aqua-1">
      <div className="bg-white p-8 rounded-2xl shadow-lg border border-line w-full max-w-md text-center">
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
        <h1 className="text-2xl font-bold text-ink mb-2">{t('subscriptionSuccess.paymentSuccessful')}</h1>
        <p className="text-muted mb-4">
          {t('subscriptionSuccess.paymentProcessed')}
        </p>
        <p className="text-sm text-muted mb-6">
          {t('subscriptionSuccess.redirectingDashboard')}
        </p>
        <Button 
          onClick={() => {
            navigate('/dashboard?success=true&message=' + encodeURIComponent(t('subscriptionSuccess.activatedSuccess')), { replace: true });
          }} 
          variant="primary"
        >
          {t('subscriptionSuccess.goToDashboard')}
        </Button>
      </div>
    </div>
  );
}
