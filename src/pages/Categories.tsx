import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import Topbar from '../components/layout/Topbar';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import LoadingSpinner from '../components/ui/LoadingSpinner';

interface Category {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export default function Categories() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (searchTerm) {
        params.search = searchTerm;
      }
      const response = await api.get('/categories', { params });
      if (response.data?.data) {
        setCategories(response.data.data || []);
      } else {
        setCategories(response.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCategories();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      setFormError(t('categories.nameRequired'));
      return;
    }

    try {
      setFormError(null);
      await api.post('/categories', {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
      });
      setShowCreateModal(false);
      resetForm();
      fetchCategories();
    } catch (error: any) {
      setFormError(error.response?.data?.message || t('categories.createFailed'));
    }
  };

  const handleUpdate = async () => {
    if (!editingCategory) return;
    if (!formData.name.trim()) {
      setFormError(t('categories.nameRequired'));
      return;
    }

    try {
      setFormError(null);
      await api.put(`/categories/${editingCategory.id}`, {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
      });
      setShowEditModal(false);
      setEditingCategory(null);
      resetForm();
      fetchCategories();
    } catch (error: any) {
      setFormError(error.response?.data?.message || t('categories.updateFailed'));
    }
  };

  const handleDelete = async (category: Category) => {
    if (!confirm(t('categories.deleteConfirmNamed', { name: category.name }))) {
      return;
    }

    try {
      await api.delete(`/categories/${category.id}`);
      fetchCategories();
    } catch (error: any) {
      alert(error.response?.data?.message || t('categories.deleteFailed'));
    }
  };

  const openEditModal = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
    });
    setFormError(null);
    setShowEditModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
    });
    setFormError(null);
  };

  if (loading && categories.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Topbar
        title={t('categories.title')}
        subtitle={t('categories.subtitle')}
        actions={
          <Button onClick={() => {
            resetForm();
            setShowCreateModal(true);
          }}>
            {t('categories.newCategory')}
          </Button>
        }
      />

      <div className="bg-white border border-line rounded-xl p-4">
        <Input
          type="text"
          placeholder={t('categories.searchPlaceholder')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-white border border-line rounded-xl overflow-hidden">
        {categories.length === 0 ? (
          <div className="text-center py-12 text-muted">
            {searchTerm ? t('categories.noCategoriesSearch') : t('categories.noCategoriesEmpty')}
          </div>
        ) : (
          <div className="divide-y divide-line">
            {categories.map((category) => (
              <div key={category.id} className="p-4 hover:bg-aqua-1/10 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-ink mb-1">{category.name}</h3>
                    {category.description && (
                      <p className="text-sm text-muted">{category.description}</p>
                    )}
                    <p className="text-xs text-muted mt-2">
                      {t('categories.created')}: {new Date(category.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditModal(category)}
                    >
                      {t('common.edit')}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDelete(category)}
                    >
                      {t('common.delete')}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          resetForm();
        }}
        title={t('categories.createNew')}
      >
        <div className="space-y-4">
          <Input
            label={t('categories.nameLabel')}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            placeholder={t('categories.namePlaceholder')}
          />
          <div>
            <label className="block text-sm font-medium text-ink mb-1">{t('categories.description')}</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none resize-none"
              placeholder={t('categories.descriptionPlaceholder')}
            />
          </div>
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{formError}</p>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <Button
              variant="ghost"
              onClick={() => {
                setShowCreateModal(false);
                resetForm();
              }}
              className="flex-1"
            >
              {t('common.cancel')}
            </Button>
            <Button onClick={handleCreate} className="flex-1">
              {t('categories.createCategory')}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingCategory(null);
          resetForm();
        }}
        title={t('categories.edit')}
      >
        <div className="space-y-4">
          <Input
            label={t('categories.nameLabel')}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <div>
            <label className="block text-sm font-medium text-ink mb-1">{t('categories.description')}</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none resize-none"
              placeholder={t('categories.descriptionPlaceholder')}
            />
          </div>
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{formError}</p>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <Button
              variant="ghost"
              onClick={() => {
                setShowEditModal(false);
                setEditingCategory(null);
                resetForm();
              }}
              className="flex-1"
            >
              {t('common.cancel')}
            </Button>
            <Button onClick={handleUpdate} className="flex-1">
              {t('categories.updateCategory')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
