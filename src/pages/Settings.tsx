import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuthStore } from '../stores/authStore';
import Topbar from '../components/layout/Topbar';
import Button from '../components/ui/Button';

interface Subscription {
  id: number;
  status: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  plan: {
    id: number;
    name: string;
    amount: number;
    currency: string;
    interval: string;
  };
}

interface SubscriptionPlan {
  id: number;
  name: string;
  description: string | null;
  amount: number;
  currency: string;
  interval: string;
  features: string[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function Settings() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [plansLoading, setPlansLoading] = useState(false);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    amount: '',
    currency: 'eur',
    interval: 'month',
    features: '',
    is_active: true,
  });

  useEffect(() => {
    // Only fetch subscription for non-super-admin users
    if (user?.role !== 'super_admin') {
      fetchSubscription();
    } else {
      fetchSubscriptionPlans();
    }
  }, [user]);

  const fetchSubscription = async () => {
    try {
      const response = await api.get('/subscription');
      if (response.data.subscription) {
        setSubscription(response.data.subscription);
      }
    } catch (error) {
      console.error('Failed to fetch subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubscriptionPlans = async () => {
    try {
      setPlansLoading(true);
      const response = await api.get('/subscription-plans/admin');
      setSubscriptionPlans(response.data);
    } catch (error) {
      console.error('Failed to fetch subscription plans:', error);
    } finally {
      setPlansLoading(false);
      setLoading(false);
    }
  };

  const handleCreatePlan = async () => {
    try {
      const planData = {
        ...formData,
        amount: Math.round(parseFloat(formData.amount) * 100), // Convert to cents
        features: formData.features ? formData.features.split('\n').filter(f => f.trim()) : null,
      };

      if (editingPlan) {
        await api.put(`/subscription-plans/${editingPlan.id}`, planData);
      } else {
        await api.post('/subscription-plans', planData);
      }

      await fetchSubscriptionPlans();
      setShowPlanForm(false);
      setEditingPlan(null);
                setFormData({
                  name: '',
                  description: '',
                  amount: '',
                  currency: 'eur',
                  interval: 'month',
                  features: '',
                  is_active: true,
                });
    } catch (error: any) {
      console.error('Failed to save plan:', error);
      alert(error.response?.data?.message || t('settings.saveFailed'));
    }
  };

  const handleEditPlan = (plan: SubscriptionPlan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      description: plan.description || '',
      amount: (plan.amount / 100).toString(),
      currency: plan.currency,
      interval: plan.interval,
      features: plan.features ? plan.features.join('\n') : '',
      is_active: plan.is_active,
    });
    setShowPlanForm(true);
  };

  const handleDeletePlan = async (plan: SubscriptionPlan) => {
    if (!confirm(t('settings.deleteConfirmNamed', { name: plan.name }))) {
      return;
    }

    try {
      await api.delete(`/subscription-plans/${plan.id}`);
      await fetchSubscriptionPlans();
    } catch (error: any) {
      alert(error.response?.data?.message || t('settings.deleteFailed'));
    }
  };

  const isSuperAdmin = user?.role === 'super_admin';
  const needsSubscription = !isSuperAdmin && user?.company && 
                           (user.company.subscription_status === 'approved' || 
                            (user.company.status === 'approved' && user.company.subscription_status !== 'active'));

  return (
    <div className="space-y-6">
      <Topbar
        title={t('settings.title')}
        subtitle={t('settings.subtitle')}
      />

      {/* Subscription Section - Only show for non-super-admin users */}
      {!isSuperAdmin && (
        <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-ink mb-4">{t('settings.subscription')}</h3>
          
          {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-aqua-5"></div>
          </div>
        ) : needsSubscription ? (
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800 mb-4">
                {t('settings.subscriptionRequiredMessage')}
              </p>
              <Button onClick={() => navigate('/subscribe')} variant="primary">
                {t('settings.subscribeNow')}
              </Button>
            </div>
          </div>
        ) : subscription ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-aqua-1/20 rounded-lg">
              <div>
                <h4 className="font-semibold text-ink">{subscription.plan.name}</h4>
                <p className="text-sm text-muted">
                  €{(subscription.plan.amount / 100).toFixed(2)} / {subscription.plan.interval}
                </p>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                subscription.status === 'active' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {subscription.status === 'active' ? t('settings.active') : subscription.status}
              </span>
            </div>

            {subscription.current_period_end && (
              <div className="text-sm text-muted">
                <p>{t('settings.nextBillingDate', { date: new Date(subscription.current_period_end).toLocaleDateString() })}</p>
              </div>
            )}

            {subscription.cancel_at_period_end && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  {t('settings.cancelAtPeriodEnd')}
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <Button onClick={() => navigate('/subscribe')} variant="secondary">
                {t('settings.viewSubscriptionDetails')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-muted">
            <p>{t('settings.noActiveSubscription')}</p>
            <Button onClick={() => navigate('/subscribe')} variant="primary" className="mt-4">
              {t('settings.subscribeNow')}
            </Button>
          </div>
        )}
        </div>
      )}

      {/* Subscription Plans Management - Super Admin only */}
      {isSuperAdmin && (
        <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-ink">{t('settings.subscriptionPlans')}</h3>
            <Button 
              onClick={() => {
                setEditingPlan(null);
                setFormData({
                  name: '',
                  description: '',
                  amount: '',
                  currency: 'eur',
                  interval: 'month',
                  features: '',
                  is_active: true,
                });
                setShowPlanForm(true);
              }}
              variant="primary"
            >
              {t('settings.createPlan')}
            </Button>
          </div>

          {plansLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-aqua-5"></div>
            </div>
          ) : showPlanForm ? (
            <div className="space-y-4 border-t border-line pt-4">
              <h4 className="font-semibold text-ink">{editingPlan ? t('settings.editPlan') : t('settings.createNewPlan')}</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-ink mb-1">{t('common.name')} *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-line rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink mb-1">{t('settings.amountEur')}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full px-3 py-2 border border-line rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink mb-1">{t('settings.interval')}</label>
                  <select
                    value={formData.interval}
                    onChange={(e) => setFormData({ ...formData, interval: e.target.value })}
                    className="w-full px-3 py-2 border border-line rounded-lg"
                  >
                    <option value="month">{t('settings.monthly')}</option>
                    <option value="year">{t('settings.yearly')}</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-ink mb-1">{t('common.description')}</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-line rounded-lg"
                    rows={3}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-ink mb-1">{t('settings.featuresOnePerLine')}</label>
                  <textarea
                    value={formData.features}
                    onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                    className="w-full px-3 py-2 border border-line rounded-lg"
                    rows={4}
                    placeholder={t('settings.featuresPlaceholder')}
                  />
                </div>
                <div className="col-span-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm text-ink">{t('settings.active')}</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3">
                <Button onClick={handleCreatePlan} variant="primary">
                  {editingPlan ? t('settings.updatePlan') : t('settings.createPlanBtn')}
                </Button>
                <Button onClick={() => {
                  setShowPlanForm(false);
                  setEditingPlan(null);
                }} variant="secondary">
                  {t('common.cancel')}
                </Button>
              </div>
            </div>
          ) : subscriptionPlans.length > 0 ? (
            <div className="space-y-3">
              {subscriptionPlans.map((plan) => (
                <div key={plan.id} className="flex items-center justify-between p-4 border border-line rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h4 className="font-semibold text-ink">{plan.name}</h4>
                      <span className={`px-2 py-1 rounded text-xs ${
                        plan.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {plan.is_active ? t('settings.active') : t('settings.inactive')}
                      </span>
                    </div>
                    <p className="text-sm text-muted mt-1">
                      €{(plan.amount / 100).toFixed(2)} / {plan.interval}
                    </p>
                    {plan.description && (
                      <p className="text-sm text-muted mt-1">{plan.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => handleEditPlan(plan)} variant="secondary" className="text-sm">
                      {t('common.edit')}
                    </Button>
                    <Button onClick={() => handleDeletePlan(plan)} variant="secondary" className="text-sm text-red-600">
                      {t('common.delete')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted">{t('settings.noPlansFound')}</p>
          )}
        </div>
      )}

      {/* Other Settings */}
      <div className="bg-white border border-line rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-ink mb-4">{t('settings.accountSettings')}</h3>
        <p className="text-muted">{t('settings.comingSoon')}</p>
      </div>
    </div>
  );
}
