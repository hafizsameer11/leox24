import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Topbar from '../components/layout/Topbar';
import Button from '../components/ui/Button';
import api from '../services/api';
import { useAuthStore } from '../stores/authStore';

function normalizeInternationalPhoneNumber(value: string): string | null {
  let normalized = value.trim().replace(/[\s().-]/g, '');
  if (normalized.startsWith('00')) normalized = `+${normalized.slice(2)}`;

  return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : null;
}

function formatWhatsAppStatus(status: string): string {
  const labels: Record<string, string> = {
    accepted: 'Accepted by Twilio',
    queued: 'Queued by Twilio',
    scheduled: 'Scheduled by Twilio',
    sending: 'Sending through Twilio',
    sent: 'Sent by Twilio',
    delivered: 'Delivered',
    undelivered: 'Undelivered',
    failed: 'Failed',
    pending: 'Delivery still pending',
    'status-unavailable': 'Status unavailable',
  };

  return labels[status] || status;
}

type WhatsAppDelivery = {
  sid: string | null;
  status: string;
  errorCode?: string | number | null;
  errorMessage?: string | null;
  deliveryTracking?: boolean;
};

const WHATSAPP_TERMINAL_STATUSES = new Set(['delivered', 'failed', 'undelivered']);

export default function Sms() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const isSuperAdmin = user?.role === 'super_admin';

  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [activeChannel, setActiveChannel] = useState<'sms' | 'whatsapp'>('sms');
  const [whatsAppPhoneNumber, setWhatsAppPhoneNumber] = useState('');
  const [whatsAppMessage, setWhatsAppMessage] = useState('');
  const [whatsAppSending, setWhatsAppSending] = useState(false);
  const [whatsAppDelivery, setWhatsAppDelivery] = useState<WhatsAppDelivery | null>(null);
  const whatsAppPollingVersion = useRef(0);

  useEffect(() => {
    if (user && !isSuperAdmin) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, isSuperAdmin, navigate]);

  useEffect(() => () => {
    // Prevent an in-flight status poll from updating this screen after it is left.
    whatsAppPollingVersion.current += 1;
  }, []);

  const handleSend = async () => {
    if (!phoneNumber.trim() || !message.trim()) {
      alert(t('sms.fillRequired'));
      return;
    }

    const normalizedPhoneNumber = normalizeInternationalPhoneNumber(phoneNumber);
    if (!normalizedPhoneNumber) {
      alert(t('sms.invalidPhone'));
      return;
    }

    try {
      setSending(true);
      const response = await api.post('/sms/send', {
        phone_number: normalizedPhoneNumber,
        message: message.trim(),
      });

      if (!response.data?.accepted || !response.data?.sid) {
        throw new Error(response.data?.message || t('sms.providerNotAccepted'));
      }

      alert(t('sms.acceptedSuccess', { sid: response.data.sid }));
      setPhoneNumber('');
      setMessage('');
    } catch (error: unknown) {
      const err = error as Error & { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message || err.message || t('sms.sentError'));
    } finally {
      setSending(false);
    }
  };

  const handleWhatsAppSend = async () => {
    if (!whatsAppPhoneNumber.trim() || !whatsAppMessage.trim()) {
      alert(t('sms.fillRequired'));
      return;
    }

    const normalizedPhoneNumber = normalizeInternationalPhoneNumber(whatsAppPhoneNumber);
    if (!normalizedPhoneNumber) {
      alert(t('sms.invalidPhone'));
      return;
    }

    try {
      setWhatsAppSending(true);
      setWhatsAppDelivery(null);
      const response = await api.post('/communications/whatsapp/send', {
        to: normalizedPhoneNumber,
        message: whatsAppMessage.trim(),
      });

      if (!response.data?.accepted || !response.data?.sid) {
        throw new Error(response.data?.message || 'WhatsApp was not accepted by the provider.');
      }

      const initialDelivery: WhatsAppDelivery = {
        sid: response.data.sid,
        status: String(response.data.status || 'accepted').toLowerCase(),
        deliveryTracking: Boolean(response.data.delivery_tracking),
      };
      setWhatsAppDelivery(initialDelivery);
      setWhatsAppPhoneNumber('');
      setWhatsAppMessage('');
      void pollWhatsAppDelivery(initialDelivery.sid);
    } catch (error: unknown) {
      const err = error as Error & { response?: { data?: { message?: string } } };
      setWhatsAppDelivery({
        sid: null,
        status: 'failed',
        errorMessage: err.response?.data?.message || err.message || 'WhatsApp could not be sent.',
      });
    } finally {
      setWhatsAppSending(false);
    }
  };

  const pollWhatsAppDelivery = async (messageSid: string) => {
    const pollVersion = ++whatsAppPollingVersion.current;

    // Twilio delivery is asynchronous. Polling makes the actual state visible
    // immediately after a send without claiming that an accepted message was delivered.
    for (let attempt = 0; attempt < 20; attempt += 1) {
      try {
        const response = await api.get(`/communications/whatsapp/${encodeURIComponent(messageSid)}/status`);
        if (pollVersion !== whatsAppPollingVersion.current) return;

        const next: WhatsAppDelivery = {
          sid: response.data?.sid || messageSid,
          status: String(response.data?.status || 'unknown').toLowerCase(),
          errorCode: response.data?.error_code ?? null,
          errorMessage: response.data?.error_message ?? null,
          deliveryTracking: true,
        };
        setWhatsAppDelivery(next);

        if (WHATSAPP_TERMINAL_STATUSES.has(next.status)) return;
      } catch (error: unknown) {
        if (pollVersion !== whatsAppPollingVersion.current) return;
        const err = error as Error & { response?: { data?: { message?: string } } };
        setWhatsAppDelivery({
          sid: messageSid,
          status: 'status-unavailable',
          errorMessage: err.response?.data?.message || err.message || 'Twilio delivery status could not be checked.',
        });
        return;
      }

      await new Promise<void>((resolve) => window.setTimeout(resolve, 3000));
      if (pollVersion !== whatsAppPollingVersion.current) return;
    }

    if (pollVersion === whatsAppPollingVersion.current) {
      setWhatsAppDelivery((current) => current && current.sid === messageSid
        ? { ...current, status: current.status === 'delivered' ? current.status : 'pending' }
        : current);
    }
  };

  return (
    <div className="space-y-6">
      <Topbar
        title={t('sms.title')}
        subtitle={t('sms.subtitle')}
      />

      <div className="max-w-2xl rounded-2xl border border-line bg-white p-4 shadow-sm sm:p-6">
        <div role="tablist" aria-label="Message channel" className="mb-6 inline-flex w-full gap-1 rounded-xl bg-aqua-1/50 p-1 sm:w-auto">
          <button
            type="button"
            role="tab"
            aria-selected={activeChannel === 'sms'}
            onClick={() => setActiveChannel('sms')}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors sm:flex-none ${activeChannel === 'sms' ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink'}`}
          >
            SMS
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeChannel === 'whatsapp'}
            onClick={() => setActiveChannel('whatsapp')}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors sm:flex-none ${activeChannel === 'whatsapp' ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink'}`}
          >
            WhatsApp
          </button>
        </div>

        {activeChannel === 'sms' ? (
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

          <div className="flex justify-stretch pt-2 sm:justify-end">
            <Button
              onClick={handleSend}
              variant="primary"
              isLoading={sending}
              disabled={!phoneNumber.trim() || !message.trim()}
              className="w-full sm:w-auto"
            >
              {t('sms.send')}
            </Button>
          </div>
        </div>
        ) : (
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-ink">
              {t('sms.phoneNumber')} <span className="text-bad">*</span>
            </label>
            <input
              type="tel"
              value={whatsAppPhoneNumber}
              onChange={(e) => setWhatsAppPhoneNumber(e.target.value)}
              placeholder="+39 333 1234567"
              className="w-full rounded-xl border border-line px-4 py-2 outline-none focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-ink">
              WhatsApp message <span className="text-bad">*</span>
            </label>
            <textarea
              value={whatsAppMessage}
              onChange={(e) => setWhatsAppMessage(e.target.value)}
              placeholder="Write your WhatsApp message..."
              rows={6}
              maxLength={4096}
              className="w-full rounded-xl border border-line px-4 py-2 outline-none focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20"
            />
            <p className="mt-1 text-xs text-muted">{whatsAppMessage.length}/4096</p>
          </div>

          <div className="rounded-xl border border-line bg-aqua-1/30 p-4 text-sm text-muted">
            WhatsApp accepts free-form messages only inside the recipient’s active 24-hour WhatsApp conversation window. For a new or inactive conversation, Twilio requires an approved WhatsApp template; provider errors are shown here exactly as returned.
          </div>

          {whatsAppDelivery && (() => {
            const isDelivered = whatsAppDelivery.status === 'delivered';
            const isFailed = ['failed', 'undelivered'].includes(whatsAppDelivery.status);
            const tone = isDelivered
              ? 'border-ok/35 bg-ok/10 text-ok'
              : isFailed
                ? 'border-bad/35 bg-bad/10 text-bad'
                : 'border-warn/35 bg-warn/10 text-ink';
            const detail = isDelivered
              ? 'The recipient’s WhatsApp account has received this message.'
              : isFailed
                ? 'Twilio could not deliver this WhatsApp message. Review the provider error below.'
                : whatsAppDelivery.status === 'sent'
                  ? 'Twilio has sent the message and is awaiting final delivery confirmation.'
                  : 'The message is with Twilio, but it has not been confirmed as delivered yet.';

            return (
              <div className={`rounded-xl border p-4 text-sm ${tone}`} role="status" aria-live="polite">
                <p className="font-semibold">{formatWhatsAppStatus(whatsAppDelivery.status)}</p>
                <p className="mt-1 opacity-90">{detail}</p>
                {whatsAppDelivery.sid && (
                  <p className="mt-2 break-all text-xs opacity-80">Message SID: {whatsAppDelivery.sid}</p>
                )}
                {whatsAppDelivery.errorCode && (
                  <p className="mt-2 text-xs font-medium">Twilio error code: {whatsAppDelivery.errorCode}</p>
                )}
                {whatsAppDelivery.errorMessage && (
                  <p className="mt-1 break-words text-xs">{whatsAppDelivery.errorMessage}</p>
                )}
              </div>
            );
          })()}

          <div className="flex justify-stretch pt-2 sm:justify-end">
            <Button
              onClick={handleWhatsAppSend}
              variant="primary"
              isLoading={whatsAppSending}
              disabled={!whatsAppPhoneNumber.trim() || !whatsAppMessage.trim()}
              className="w-full sm:w-auto"
            >
              Send WhatsApp
            </Button>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
