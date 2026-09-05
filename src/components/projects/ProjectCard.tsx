import { useTranslation } from 'react-i18next';
import type { Project } from '../../types/project.types';

interface ProjectCardProps {
  project: Project;
  onAccess: (projectId: number) => void;
  onShowCredentials?: (projectId: number) => void;
  isSuperAdmin?: boolean;
}

export default function ProjectCard({ project, onAccess, onShowCredentials, isSuperAdmin }: ProjectCardProps) {
  const { t } = useTranslation();

  const getIntegrationBadge = () => {
    const colors = {
      api: 'bg-aqua-1 text-aqua-5 border-aqua-5/30',
      iframe: 'bg-warn/20 text-warn border-warn/30',
      hybrid: 'bg-ok/20 text-ok border-ok/30',
    };
    return colors[project.integration_type] || 'bg-muted/20 text-muted border-muted/30';
  };

  const getButtonText = () => {
    if (project.integration_type === 'iframe') {
      return t('projectCard.openAdmin');
    } else if (project.integration_type === 'hybrid') {
      return t('projectCard.openCrm');
    } else {
      return t('projectCard.accessApi');
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-line hover:shadow-lg hover:border-aqua-4/35 transition-all duration-200">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-bold text-ink mb-1">{project.name}</h3>
          <p className="text-xs text-muted font-mono">{project.slug}</p>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getIntegrationBadge()}`}>
          {project.integration_type?.toUpperCase()}
        </span>
      </div>

      {project.description && (
        <p className="text-sm text-muted mb-4 line-clamp-2 leading-relaxed">{project.description}</p>
      )}

      <div className="flex items-center gap-2 mb-4">
        {project.sso_enabled && (
          <span className="text-xs px-2 py-1 rounded-lg bg-aqua-1/50 text-aqua-5 border border-aqua-5/20 font-medium">
            {t('projectCard.ssoEnabled')}
          </span>
        )}
        {project.is_active ? (
          <span className="text-xs px-2 py-1 rounded-lg bg-ok/15 text-ok border border-ok/30 font-medium">
            {t('projectCard.active')}
          </span>
        ) : (
          <span className="text-xs px-2 py-1 rounded-lg bg-muted/15 text-muted border border-muted/30 font-medium">
            {t('projectCard.inactive')}
          </span>
        )}
      </div>

      <div className="flex gap-2">
        {!isSuperAdmin ?
        <button
          onClick={() => onAccess(project.id)}
          className="flex-1 px-4 py-2.5 bg-gradient-to-r from-aqua-5 to-aqua-4 text-white rounded-xl hover:shadow-lg hover:shadow-aqua-5/25 transition-all font-semibold text-sm"
        >
          {getButtonText()}
        </button> : null}
        {isSuperAdmin && onShowCredentials && (
          <button
            onClick={() => onShowCredentials(project.id)}
            className="px-4 py-2.5 bg-purple-100 text-purple-600 rounded-xl hover:bg-purple-200 transition-colors font-semibold text-sm border border-purple-300"
            title={t('projectCard.credentialsTooltip')}
          >
            🔑 {t('projectCard.credentials')}
          </button>
        )}
      </div>
    </div>
  );
}
