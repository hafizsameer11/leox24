import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import Topbar from '../components/layout/Topbar';
import { useAuthStore } from '../stores/authStore';

interface Project {
  id: number;
  name: string;
  slug: string;
}

interface ProjectManage {
  id: number;
  project_id: number;
  email: string;
  password?: string;
  project?: Project;
  created_at?: string;
  updated_at?: string;
}

export default function ProjectManagement() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const isSuperAdmin = user?.role === 'super_admin';

  const [manages, setManages] = useState<ProjectManage[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingManage, setEditingManage] = useState<ProjectManage | null>(null);
  const [formData, setFormData] = useState({
    project_id: '',
    email: '',
    password: '',
  });

  useEffect(() => {
    if (isSuperAdmin) {
      fetchManages();
      fetchProjects();
    }
  }, [isSuperAdmin]);

  const fetchProjects = async () => {
    try {
      const response = await api.get('/projects');
      const data = response.data.data || response.data || [];
      setProjects(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
      setProjects([]);
    }
  };

  const fetchManages = async () => {
    try {
      setLoading(true);
      const response = await api.get('/project-manages');
      const data = response.data.data || response.data || [];
      setManages(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch project manages:', error);
      setManages([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      if (editingManage) {
        await api.put(`/project-manages/${editingManage.id}`, formData);
      } else {
        await api.post('/project-manages', formData);
      }
      setShowModal(false);
      setEditingManage(null);
      resetForm();
      fetchManages();
    } catch (error: any) {
      console.error('Failed to save project manage:', error);
      alert(error.response?.data?.message || t('projectManagement.saveFailed'));
    }
  };

  const handleEdit = (manage: ProjectManage) => {
    setEditingManage(manage);
    setFormData({
      project_id: manage.project_id.toString(),
      email: manage.email,
      password: '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('projectManagement.deleteConfirm'))) {
      return;
    }

    try {
      await api.delete(`/project-manages/${id}`);
      fetchManages();
    } catch (error: any) {
      console.error('Failed to delete project manage:', error);
      alert(error.response?.data?.message || t('projectManagement.deleteFailed'));
    }
  };

  const resetForm = () => {
    setFormData({
      project_id: '',
      email: '',
      password: '',
    });
  };

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-muted text-lg">{t('common.accessDenied')}</p>
          <p className="text-muted text-sm mt-2">{t('projectManagement.superAdminOnly')}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-aqua-5"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Topbar
        title={t('projectManagement.title')}
        subtitle={t('projectManagement.subtitle')}
        actions={
          <>
            <button
              onClick={fetchManages}
              className="px-4 py-2 text-sm border border-line rounded-xl hover:bg-aqua-1/30 transition-colors text-ink font-medium"
            >
              🔄 {t('common.refresh')}
            </button>
            <button
              onClick={() => {
                resetForm();
                setEditingManage(null);
                setShowModal(true);
              }}
              className="px-4 py-2 text-sm border border-aqua-5/35 bg-gradient-to-r from-aqua-3/45 to-aqua-5/14 rounded-xl hover:shadow-lg hover:shadow-aqua-5/10 transition-all text-ink font-semibold"
            >
              ➕ {t('projectManagement.newEntry')}
            </button>
          </>
        }
      />

      <div className="bg-white border border-line rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-aqua-1/30 border-b border-line">
              <tr>
                <th className="text-left text-xs font-bold text-muted uppercase py-3 px-4">{t('projectManagement.project')}</th>
                <th className="text-left text-xs font-bold text-muted uppercase py-3 px-4">{t('projectManagement.email')}</th>
                <th className="text-left text-xs font-bold text-muted uppercase py-3 px-4">{t('projectManagement.password')}</th>
                <th className="text-left text-xs font-bold text-muted uppercase py-3 px-4">{t('projectManagement.created')}</th>
                <th className="text-right text-xs font-bold text-muted uppercase py-3 px-4">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {manages.map((manage) => (
                <tr key={manage.id} className="border-b border-line/50 hover:bg-aqua-1/10 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-ink">{manage.project?.name || 'N/A'}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-sm text-ink">{manage.email}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-sm text-muted">••••••••</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-sm text-muted">
                      {manage.created_at ? new Date(manage.created_at).toLocaleDateString() : '-'}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEdit(manage)}
                        className="p-1.5 hover:bg-aqua-1 rounded-lg transition-colors"
                        title={t('common.edit')}
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDelete(manage.id)}
                        className="p-1.5 hover:bg-aqua-1 rounded-lg transition-colors text-red-500"
                        title={t('common.delete')}
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {manages.length === 0 && !loading && (
          <div className="p-8 text-center text-muted">
            {t('projectManagement.noEntriesEmpty')}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-ink mb-4">
              {editingManage ? t('projectManagement.editTitle') : t('projectManagement.newTitle')}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink mb-1">{t('projectManagement.projectRequired')}</label>
                <select
                  value={formData.project_id}
                  onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                  className="w-full px-4 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none"
                  required
                  disabled={!!editingManage}
                >
                  <option value="">{t('projectManagement.selectProject')}</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
                {editingManage && (
                  <p className="text-xs text-muted mt-1">{t('projectManagement.projectCannotChange')}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-ink mb-1">{t('projectManagement.emailRequired')}</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink mb-1">
                  {t('projectManagement.password')} {editingManage ? t('common.passwordKeepCurrent') : '*'}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none"
                  required={!editingManage}
                  minLength={8}
                  placeholder={editingManage ? t('projectManagement.passwordNewPlaceholder') : t('projectManagement.passwordPlaceholder')}
                />
                {!editingManage && (
                  <p className="text-xs text-muted mt-1">{t('common.minPassword')}</p>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingManage(null);
                  resetForm();
                }}
                className="flex-1 px-4 py-2 border border-line rounded-xl hover:bg-aqua-1/30 transition-colors text-ink font-medium"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSubmit}
                className="flex-1 px-4 py-2 bg-aqua-5 text-white rounded-xl hover:bg-aqua-4 transition-colors font-semibold"
              >
                {editingManage ? t('common.update') : t('common.create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
