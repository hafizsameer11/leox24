import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ProjectIframe from '../components/projects/ProjectIframe';

export default function ProjectIframePage() {
  const { t } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();

  if (!projectId) {
    return <div>{t('projectIframe.invalidProjectId')}</div>;
  }

  return <ProjectIframe projectId={parseInt(projectId)} />;
}
