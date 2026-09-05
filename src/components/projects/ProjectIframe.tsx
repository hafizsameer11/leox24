import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';

interface ProjectIframeProps {
  projectId: number;
}

export default function ProjectIframe({ projectId }: ProjectIframeProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState<any>(null);

  useEffect(() => {
    const initiateSSO = async () => {
      try {
        // Check if returning from SSO redirect
        const urlParams = new URLSearchParams(window.location.search);
        const ssoToken = urlParams.get('sso_token');
        const projectIdParam = urlParams.get('project_id');

        if (ssoToken && projectIdParam == projectId.toString()) {
          // We're returning from SSO - show iframe
          const projectResponse = await api.get(`/projects/${projectId}`);
          setProject(projectResponse.data);
          setIframeUrl(projectResponse.data.admin_panel_url);
          setLoading(false);
        } else {
          // Start SSO flow with top-level redirect
          const response = await api.post(`/projects/${projectId}/sso/redirect`);
          
          // TOP-LEVEL redirect (not iframe)
          // This allows target system to set session cookies properly
          window.location.href = response.data.redirect_url;
        }
      } catch (err: any) {
        setError(err.response?.data?.error || t('projectIframe.ssoFailed'));
        setLoading(false);
      }
    };

    initiateSSO();
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-aqua-5 mx-auto mb-4"></div>
          <p className="text-muted">{t('projectIframe.connecting')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="bg-card p-6 rounded-xl border border-line max-w-md">
          <h3 className="text-lg font-semibold text-ink mb-2">{t('projectIframe.connectionError')}</h3>
          <p className="text-muted mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-aqua-5 text-white rounded-lg hover:bg-aqua-4 transition-colors"
          >
            {t('projectIframe.retry')}
          </button>
        </div>
      </div>
    );
  }

  if (!iframeUrl) {
    return null;
  }

  return (
    <div className="h-full w-full">
      <iframe
        src={iframeUrl}
        width={project?.iframe_width || '100%'}
        height={project?.iframe_height || '100vh'}
        sandbox={project?.iframe_sandbox || 'allow-same-origin allow-scripts'}
        frameBorder="0"
        className="w-full h-full"
        title={t('projectIframe.adminPanel')}
      />
    </div>
  );
}
