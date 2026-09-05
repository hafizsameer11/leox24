import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Topbar from '../components/layout/Topbar';
import Button from '../components/ui/Button';
import api from '../services/api';
import { useAuthStore } from '../stores/authStore';

export default function Sms() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const isSuperAdmin = user?.role === 'super_admin';

  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (user && !isSuperAdmin) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, isSuperAdmin, navigate]);

  const handleSend = async () => {
    if (!phoneNumber.trim() || !message.trim()) {
      alert(t('sms.fillRequired'));
      return;
    }

    try {
      setSending(true);
      const response = await api.post('/sms/send', {
        phone_number: phoneNumber.trim(),
        message: message.trim(),
      });
      alert(response.data.message || t('sms.sentSuccess'));
      setPhoneNumber('');
      setMessage('');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message || t('sms.sentError'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <Topbar
        title={t('sms.title')}
        subtitle={t('sms.subtitle')}
      />

      <div className="bg-white border border-line rounded-2xl p-6 max-w-2xl shadow-sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-2">
              {t('sms.phoneNumber')} <span className="text-bad">*</span>
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+39 333 1234567"
              className="w-full px-4 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-2">
              {t('sms.message')} <span className="text-bad">*</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t('sms.messagePlaceholder')}
              rows={6}
              maxLength={1600}
              className="w-full px-4 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none"
            />
            <p className="text-xs text-muted mt-1">{message.length}/1600</p>
          </div>

          <div className="bg-aqua-1/30 border border-line rounded-xl p-4 text-sm text-muted">
            {t('sms.callsHint')}{' '}
            <button
              type="button"
              onClick={() => navigate('/calls')}
              className="text-aqua-5 font-medium hover:underline"
            >
              {t('sidebar.calls')}
            </button>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              onClick={handleSend}
              variant="primary"
              isLoading={sending}
              disabled={!phoneNumber.trim() || !message.trim()}
            >
              {t('sms.send')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
