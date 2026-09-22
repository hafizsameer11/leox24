import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { useAuthStore } from '../stores/authStore';

export default function TGCalabriaTry() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const user = useAuthStore((state) => state.user);
  const isSuperAdmin = user?.role === 'super_admin';

  const [plainPassword, setPlainPassword] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      setError(t('tgCalabriaTry.userNotAvailable'));
      return;
    }

    if (isSuperAdmin) {
      navigate('/projects', { replace: true });
      return;
    }

    const fetchPlainPassword = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await api.get(`/users/${user.id}/plain-password`);
        setPlainPassword(response.data?.plain_password || null);
      } catch (err: any) {
        setPlainPassword(null);
        setError(err.response?.data?.message || t('tgCalabriaTry.credentialsFailed'));
      } finally {
        setLoading(false);
      }
    };

    fetchPlainPassword();
  }, [user, isSuperAdmin, navigate, t]);

  const backToProject = projectId ? `/projects/${projectId}/tg-calabria` : '/projects';

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <div className="flex items-center gap-3 border-b border-line bg-white px-4 py-3 sm:gap-4 sm:px-6 sm:py-4">
          <button
            onClick={() => navigate(backToProject)}
            className="px-3 py-2 text-sm border border-line rounded-xl hover:bg-aqua-1/30 transition-colors text-ink font-medium"
          >
            {t('tgCalabriaTry.back')}
          </button>
          <h1 className="truncate text-xl font-bold text-ink">{t('tgCalabriaTry.title')}</h1>
      </div>

      <div className="px-4 py-4 sm:px-6">
        <div className="bg-white rounded-xl border border-line p-4">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold text-ink">{t('tgCalabriaTry.yourCredentials')}</h2>
              <p className="text-sm text-muted">{t('tgCalabriaTry.credentialsHelp')}</p>
            </div>
            <div className="flex flex-col gap-1 text-sm">
              <div>
                <span className="text-muted">{t('tgCalabriaTry.email')}</span>{' '}
                <span className="font-semibold text-ink">{user?.email || '-'}</span>
              </div>
              <div>
                <span className="text-muted">{t('tgCalabriaTry.password')}</span>{' '}
                <span className="font-semibold text-ink">
                  {loading ? t('common.loading') : plainPassword || t('tgCalabriaTry.notAvailable')}
                </span>
              </div>
              {!loading && error && <div className="text-sm text-bad">{error}</div>}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 pb-4 sm:px-6 sm:pb-6">
        <div className="flex h-full flex-col items-center justify-center rounded-xl border border-line bg-white p-4 text-center sm:p-6">
          <div className="text-3xl mb-3">🌐</div>
          <h3 className="text-lg font-semibold text-ink mb-2">{t('tgCalabriaTry.openAdminLogin')}</h3>
          <p className="text-sm text-muted mb-4 max-w-xl">
            {t('tgCalabriaTry.iframeBlocked')}
          </p>
          <button
            onClick={() => window.open('https://tgcalabriareport.com/admin-login', '_blank', 'noopener,noreferrer')}
            className="px-4 py-2 text-sm border border-aqua-5/35 bg-gradient-to-r from-aqua-3/45 to-aqua-5/14 rounded-xl hover:shadow-lg hover:shadow-aqua-5/10 transition-all text-ink font-semibold"
          >
            {t('tgCalabriaTry.openAdminLoginBtn')}
          </button>
        </div>
      </div>
    </div>
  );
}
