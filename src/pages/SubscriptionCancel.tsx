import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Button from '../components/ui/Button';

export default function SubscriptionCancel() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-aqua-2 to-aqua-1">
      <div className="bg-white p-8 rounded-2xl shadow-lg border border-line w-full max-w-md text-center">
        <div className="mb-4">
          <svg
            className="mx-auto h-16 w-16 text-yellow-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-ink mb-2">{t('subscriptionCancel.title')}</h1>
        <p className="text-muted mb-6">
          {t('subscriptionCancel.message')}
        </p>
        <div className="space-y-3">
          <Button onClick={() => navigate('/subscribe')} variant="primary" className="w-full">
            {t('common.tryAgain')}
          </Button>
          <Button onClick={() => navigate('/dashboard')} variant="secondary" className="w-full">
            {t('subscriptionCancel.goToDashboard')}
          </Button>
        </div>
      </div>
    </div>
  );
}
