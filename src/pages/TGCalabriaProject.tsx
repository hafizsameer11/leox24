import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuthStore } from '../stores/authStore';

interface TGCalabriaStats {
  user: {
    id: string;
    name: string;
    email: string;
  };
  overview: {
    total: number;
    published: number;
    draft: number;
    pending: number;
    rejected: number;
    featured: number;
    breaking: number;
  };
  views: {
    total: number;
    average: number;
  };
  recentActivity: {
    newsLast7Days: number;
    newsLast30Days: number;
  };
  topNews: Array<{
    id: string;
    title: string;
    slug: string;
    views: number;
    publishedAt: string;
    category?: {
      id: string;
      nameEn: string;
      nameIt: string;
    };
  }>;
  categoryBreakdown: Array<{
    categoryId: string;
    category: {
      id: string;
      nameEn: string;
      nameIt: string;
      slug: string;
    };
    newsCount: number;
    totalViews: number;
  }>;
}

interface News {
  id: string;
  title: string;
  slug: string;
  summary?: string;
  content?: string;
  categoryId?: string;
  category?: {
    id: string;
    nameEn: string;
    nameIt: string;
  };
  views?: number;
  publishedAt: string;
  status: 'DRAFT' | 'PUBLISHED';
  isFeatured?: boolean;
  isBreaking?: boolean;
}

interface Category {
  id: string;
  nameEn: string;
  nameIt: string;
  slug: string;
}

interface ArticleFormData {
  title: string;
  slug: string;
  summary: string;
  content: string;
  categoryId: string;
  isFeatured: boolean;
  status: 'DRAFT' | 'PUBLISHED';
  isBreaking: boolean;
  tags: string;
  mainImage: string | File;
}

export default function TGCalabriaProject() {
  const { t } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const isSuperAdmin = user?.role === 'super_admin';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<TGCalabriaStats | null>(null);
  const [news, setNews] = useState<News[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showArticleModal, setShowArticleModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'topNews' | 'categories'>('overview');

  const [formData, setFormData] = useState<ArticleFormData>({
    title: '',
    slug: '',
    summary: '',
    content: '',
    categoryId: '',
    isFeatured: false,
    status: 'PUBLISHED',
    isBreaking: false,
    tags: '',
    mainImage: '',
  });

  useEffect(() => {
    if (projectId) {
      fetchProjectData();
    } else {
      setLoading(false);
    }
  }, [projectId]);

  const ensureLogin = async (projectIdNum: number) => {
    // Skip login for super_admin users - they can access directly
    if (isSuperAdmin) {
      return true;
    }

    try {
      // Try to login first (this will get/refresh the token)
      const loginResponse = await api.post(`/projects/${projectIdNum}/tg-calabria/login`);
      
      if (loginResponse.data?.success) {
        return true;
      } else {
        // If login response doesn't have success flag, still return true if no error
        if (loginResponse.status >= 200 && loginResponse.status < 300) {
          return true;
        }
        setError(t('tgCalabria.authFailed'));
        return false;
      }
    } catch (err: any) {
      console.error('Login error:', err);
      // Don't set error here, let the parent function handle it
      throw err;
    }
  };

  const fetchProjectData = async () => {
    if (!projectId) return;

    try {
      setLoading(true);
      setError(null);

      const projectIdNum = parseInt(projectId, 10);
      
      // First ensure user is logged in to TG Calabria
      const isLoggedIn = await ensureLogin(projectIdNum);
      if (!isLoggedIn) {
        setLoading(false);
        return;
      }

      // Fetch all data in parallel, with better error handling
      try {
        const [statsResponse, newsResponse, categoriesResponse] = await Promise.all([
          api.get(`/projects/${projectId}/tg-calabria/news/stats`),
          api.get(`/projects/${projectId}/tg-calabria/news`).catch(() => ({ data: { data: [] } })),
          api.get(`/projects/${projectId}/tg-calabria/categories`).catch(() => ({ data: { data: [] } })),
        ]);

        // Process stats data
        if (statsResponse.data?.data) {
          const statsData = statsResponse.data.data;
          
          // Transform the stats data to match the expected format
          const transformedStats: TGCalabriaStats = {
            user: statsData.user || {
              id: '',
              name: '',
              email: '',
            },
            overview: statsData.overview || {
              total: 0,
              published: 0,
              draft: 0,
              pending: 0,
              rejected: 0,
              featured: 0,
              breaking: 0,
            },
            views: statsData.views || {
              total: 0,
              average: 0,
            },
            recentActivity: statsData.recentActivity || {
              newsLast7Days: 0,
              newsLast30Days: 0,
            },
            topNews: statsData.topNews || [],
            categoryBreakdown: statsData.categoryBreakdown || [],
          };
          
          setStats(transformedStats);
        } else {
          setError(t('tgCalabria.statsFailed'));
        }

        // Process news data
        if (newsResponse.data?.data) {
          const newsData = Array.isArray(newsResponse.data.data) 
            ? newsResponse.data.data 
            : [newsResponse.data.data];
          setNews(newsData);
        }

        // Process categories data
        if (categoriesResponse.data?.data) {
          const categoriesData = Array.isArray(categoriesResponse.data.data)
            ? categoriesResponse.data.data
            : [categoriesResponse.data.data];
          setCategories(categoriesData);
        }
      } catch (dataErr: any) {
        console.error('Error fetching data:', dataErr);
        setError(dataErr.response?.data?.message || t('tgCalabria.loadError'));
      }
    } catch (err: any) {
      console.error('Failed to fetch TG Calabria data:', err);
      
      // Handle different error scenarios
      if (err.response?.status === 401) {
        setError(t('tgCalabria.sessionExpired'));
      } else if (err.response?.status === 403) {
        setError(t('tgCalabria.accessDenied'));
      } else if (err.response?.status === 400) {
        setError(err.response?.data?.message || t('tgCalabria.invalidProject'));
      } else {
        setError(err.response?.data?.message || t('tgCalabria.loadDataFailed'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) {
      setSubmitError(t('tgCalabria.projectIdNotFound'));
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError(null);

      // Use FormData for file upload support
      const formDataObj = new FormData();
      formDataObj.append('title', formData.title);
      formDataObj.append('slug', formData.slug || formData.title.toLowerCase().replace(/\s+/g, '-'));
      if (formData.summary) formDataObj.append('summary', formData.summary);
      formDataObj.append('content', formData.content);
      formDataObj.append('categoryId', formData.categoryId);
      formDataObj.append('isFeatured', String(formData.isFeatured));
      formDataObj.append('status', formData.status);
      formDataObj.append('isBreaking', String(formData.isBreaking));
      if (formData.tags) {
        formData.tags.split(',').map((t) => t.trim()).forEach((tag) => {
          formDataObj.append('tags[]', tag);
        });
      }

      // Only add mainImage file if provided
      if (formData.mainImage) {
        // Check if it's a base64 string or a file
        if (typeof formData.mainImage === 'string' && formData.mainImage.startsWith('data:')) {
          // Convert base64 to File object
          const arr = formData.mainImage.split(',');
          const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
          const bstr = atob(arr[1]);
          const n = bstr.length;
          const u8arr = new Uint8Array(n);
          for (let i = 0; i < n; i++) {
            u8arr[i] = bstr.charCodeAt(i);
          }
          const file = new File([u8arr], 'article-image', { type: mime });
          formDataObj.append('mainImage', file);
        } else if (typeof formData.mainImage !== 'string') {
          // If it's not a string, it must be a File
          formDataObj.append('mainImage', formData.mainImage as File);
        }
      }

      // Call backend endpoint with FormData
      // Do NOT set Content-Type header - axios will set it automatically with the boundary
      const response = await api.post(`/projects/${projectId}/tg-calabria/news`, formDataObj);

      if (response.status === 201 || response.status === 200) {
        setShowArticleModal(false);
        resetForm();
        // Refresh stats
        await fetchProjectData();
        alert(t('tgCalabria.articleCreated'));
      }
    } catch (err: any) {
      console.error('Failed to create article:', err);
      
      // Handle specific error messages
      if (err.response?.status === 401) {
        setSubmitError(t('tgCalabria.sessionExpired'));
      } else if (err.response?.status === 422) {
        setSubmitError(t('tgCalabria.fillRequiredFields'));
      } else if (err.response?.data?.message) {
        setSubmitError(err.response.data.message);
      } else {
        setSubmitError(t('tgCalabria.createArticleFailed'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      slug: '',
      summary: '',
      content: '',
      categoryId: '',
      isFeatured: false,
      status: 'PUBLISHED',
      isBreaking: false,
      tags: '',
      mainImage: '',
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, mainImage: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-gray-50">
        <div className="border-b border-line px-6 py-4 flex items-center">
          <button
            onClick={() => navigate('/projects')}
            className="px-3 py-2 text-sm border border-line rounded-xl hover:bg-aqua-1/30 transition-colors text-ink font-medium"
          >
            {t('tgCalabria.back')}
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-aqua-5 mx-auto mb-4"></div>
            <p className="text-muted">{t('tgCalabria.loading')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex flex-col h-screen bg-gray-50">
        <div className="border-b border-line px-6 py-4 flex items-center">
          <button
            onClick={() => navigate('/projects')}
            className="px-3 py-2 text-sm border border-line rounded-xl hover:bg-aqua-1/30 transition-colors text-ink font-medium"
          >
            {t('tgCalabria.back')}
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="bg-white rounded-xl p-8 border border-bad/30 max-w-md text-center">
            <h3 className="text-lg font-semibold text-ink mb-2">{t('tgCalabria.error')}</h3>
            <p className="text-muted text-sm mb-4">{error || t('tgCalabria.unableToLoad')}</p>
            <button
              onClick={fetchProjectData}
              className="px-4 py-2 bg-aqua-5 text-white rounded-lg hover:bg-aqua-4 transition-colors font-medium"
            >
              {t('common.tryAgain')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-line px-6 py-4 flex items-center justify-between bg-white">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/projects')}
            className="px-3 py-2 text-sm border border-line rounded-xl hover:bg-aqua-1/30 transition-colors text-ink font-medium"
          >
            {t('tgCalabria.back')}
          </button>
          <h1 className="text-xl font-bold text-ink">{t('tgCalabria.title')}</h1>
        </div>
        <div className="flex items-center gap-2">
          {!isSuperAdmin && (
            <button
              onClick={() => navigate(projectId ? `/projects/${projectId}/tg-calabria/try` : '/projects')}
              className="px-4 py-2 text-sm border border-aqua-5/35 bg-gradient-to-r from-aqua-3/45 to-aqua-5/14 rounded-xl hover:shadow-lg hover:shadow-aqua-5/10 transition-all text-ink font-semibold"
            >
              {t('tgCalabria.wantToTry')}
            </button>
          )}
          <button
            onClick={() => setShowArticleModal(true)}
            className="px-4 py-2 text-sm bg-aqua-5 text-white rounded-xl hover:bg-aqua-4 transition-all font-semibold"
          >
            {t('tgCalabria.createArticle')}
          </button>
        </div>
      </div>

      {/* User Summary Card */}
      <div className="px-6 py-6">
        <div className="bg-white rounded-xl border border-line p-6">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-ink mb-1">{stats.user?.name}</h2>
            <p className="text-sm text-muted">{stats.user?.email}</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-aqua-5">{stats.overview?.total || 0}</div>
              <div className="text-xs text-muted mt-1">{t('tgCalabria.totalNews')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.overview?.published || 0}</div>
              <div className="text-xs text-muted mt-1">{t('tgCalabria.published')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{stats.overview?.draft || 0}</div>
              <div className="text-xs text-muted mt-1">{t('tgCalabria.draft')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{stats.overview?.pending || 0}</div>
              <div className="text-xs text-muted mt-1">{t('tgCalabria.pending')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{stats.overview?.rejected || 0}</div>
              <div className="text-xs text-muted mt-1">{t('tgCalabria.rejected')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{stats.overview?.featured || 0}</div>
              <div className="text-xs text-muted mt-1">{t('tgCalabria.featured')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-700">{stats.overview?.breaking || 0}</div>
              <div className="text-xs text-muted mt-1">{t('tgCalabria.breaking')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="px-6 mb-4">
        <div className="bg-white rounded-xl border border-line p-1 inline-flex gap-1">
          {[
            { id: 'overview', label: t('tgCalabria.overview') },
            { id: 'topNews', label: t('tgCalabria.topNews') },
            { id: 'categories', label: `📁 ${t('tgCalabria.categories')}` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                activeTab === tab.id
                  ? 'bg-aqua-5 text-white shadow-md'
                  : 'text-muted hover:text-ink hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 px-6 pb-6 overflow-auto">
        <div className="space-y-4">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-line p-6">
                <h3 className="text-lg font-semibold text-ink mb-4">{t('tgCalabria.totalViews')}</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-muted">{t('tgCalabria.totalViewsLabel')}</span>
                    <span className="text-2xl font-bold text-aqua-5">{stats.views?.total?.toLocaleString() || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted">{t('tgCalabria.averagePerNews')}</span>
                    <span className="text-2xl font-bold text-aqua-5">{Math.round(stats.views?.average || 0)}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-line p-6">
                <h3 className="text-lg font-semibold text-ink mb-4">{t('tgCalabria.recentActivity')}</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-muted">{t('tgCalabria.last7Days')}</span>
                    <span className="text-2xl font-bold text-aqua-5">{stats.recentActivity?.newsLast7Days || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted">{t('tgCalabria.last30Days')}</span>
                    <span className="text-2xl font-bold text-aqua-5">{stats.recentActivity?.newsLast30Days || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Top News Tab */}
          {activeTab === 'topNews' && (
            <div className="space-y-3">
              {news && news.length > 0 ? (
                news.map((article) => (
                  <div key={article.id} className="bg-white rounded-xl border border-line p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h4 className="font-semibold text-ink mb-2">{article.title}</h4>
                        <p className="text-sm text-muted mb-3 line-clamp-2">{article.summary || article.content || t('tgCalabria.noDescription')}</p>
                        <div className="flex items-center gap-3 text-sm text-muted flex-wrap">
                          <span className="bg-gray-100 px-2 py-1 rounded">{article.category?.nameEn || t('tgCalabria.uncategorized')}</span>
                          <span>•</span>
                          <span>{new Date(article.publishedAt).toLocaleDateString()}</span>
                          <span>•</span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            article.status === 'PUBLISHED' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {article.status}
                          </span>
                          {article.isFeatured && <span className="text-purple-600">⭐ {t('tgCalabria.featured')}</span>}
                          {article.isBreaking && <span className="text-red-600">🔴 {t('tgCalabria.breaking')}</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-aqua-5">{article.views?.toLocaleString() || 0}</div>
                        <div className="text-xs text-muted">{t('tgCalabria.views')}</div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-muted">{t('tgCalabria.noNewsFound')}</div>
              )}
            </div>
          )}

          {/* Categories Tab */}
          {activeTab === 'categories' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-ink mb-4">{t('tgCalabria.categoryBreakdown')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {stats.categoryBreakdown && stats.categoryBreakdown.length > 0 ? (
                    stats.categoryBreakdown.map((cat) => (
                      <div key={cat.categoryId} className="bg-white rounded-xl border border-line p-5 hover:shadow-md transition-shadow">
                        <h4 className="font-semibold text-ink mb-3">{cat.category?.nameEn}</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted">{t('tgCalabria.newsCount')}</span>
                            <span className="font-bold text-aqua-5">{cat.newsCount}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted">{t('tgCalabria.totalViewsCount')}</span>
                            <span className="font-bold text-aqua-5">{cat.totalViews?.toLocaleString() || 0}</span>
                          </div>
                          <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-aqua-5 h-2 rounded-full"
                              style={{
                                width: `${
                                  (cat.newsCount / (stats.overview?.total || 1)) * 100
                                }%`,
                              }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-muted col-span-full">{t('tgCalabria.noCategoryBreakdown')}</div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-ink mb-4">{t('tgCalabria.allCategories')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {categories && categories.length > 0 ? (
                    categories.map((cat) => (
                      <div key={cat.id} className="bg-white rounded-xl border border-line p-5 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <h4 className="font-semibold text-ink mb-2">{cat.nameEn}</h4>
                            <p className="text-sm text-muted mb-2 italic">{cat.nameIt}</p>
                            <p className="text-xs text-muted">{t('tgCalabria.slug')}: <code className="bg-gray-100 px-2 py-1 rounded">{cat.slug}</code></p>
                          </div>
                          <div className="text-xs text-muted bg-gray-100 px-3 py-1 rounded">
                            ID: {cat.id.substring(0, 8)}...
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-muted col-span-full">{t('tgCalabria.noCategoriesFound')}</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Article Creation Modal */}
      {showArticleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-auto py-6">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-8 shadow-2xl my-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-ink">{t('tgCalabria.createArticle')}</h3>
              <button
                onClick={() => {
                  setShowArticleModal(false);
                  setSubmitError(null);
                }}
                className="text-2xl text-muted hover:text-ink transition-colors"
              >
                ✕
              </button>
            </div>

            {submitError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {submitError}
              </div>
            )}

            <form onSubmit={handleCreateArticle} className="space-y-5">
              {/* Title */}
              <div>
                <label className="block text-sm font-semibold text-ink mb-2">{t('tgCalabria.titleLabel')}</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  placeholder={t('tgCalabria.titlePlaceholder')}
                  className="w-full px-4 py-2 border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-aqua-5"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Slug */}
                <div>
                  <label className="block text-sm font-semibold text-ink mb-2">{t('tgCalabria.slugLabel')}</label>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    placeholder={t('tgCalabria.slugPlaceholder')}
                    className="w-full px-4 py-2 border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-aqua-5"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-semibold text-ink mb-2">{t('tgCalabria.categoryLabel')}</label>
                  <select
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-aqua-5"
                  >
                    <option value="">{t('tgCalabria.selectCategory')}</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.nameEn}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Summary */}
              <div>
                <label className="block text-sm font-semibold text-ink mb-2">{t('tgCalabria.summaryLabel')}</label>
                <textarea
                  value={formData.summary}
                  onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                  required
                  placeholder={t('tgCalabria.summaryPlaceholder')}
                  rows={2}
                  className="w-full px-4 py-2 border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-aqua-5 resize-none"
                />
              </div>

              {/* Content */}
              <div>
                <label className="block text-sm font-semibold text-ink mb-2">{t('tgCalabria.contentLabel')}</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  required
                  placeholder={t('tgCalabria.contentPlaceholder')}
                  rows={4}
                  className="w-full px-4 py-2 border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-aqua-5 resize-none"
                />
              </div>

              {/* Image Upload */}
              <div>
                <label className="block text-sm font-semibold text-ink mb-2">{t('tgCalabria.mainImage')}</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="w-full px-4 py-2 border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-aqua-5"
                />
                {formData.mainImage && (
                  <div className="mt-2">
                    <img 
                      src={typeof formData.mainImage === 'string' 
                        ? formData.mainImage 
                        : URL.createObjectURL(formData.mainImage)} 
                      alt="Preview" 
                      className="max-h-32 rounded-lg object-cover" 
                    />
                  </div>
                )}
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-semibold text-ink mb-2">{t('tgCalabria.tags')}</label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder={t('tgCalabria.tagsPlaceholder')}
                  className="w-full px-4 py-2 border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-aqua-5"
                />
              </div>

              {/* Checkboxes */}
              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isFeatured}
                    onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
                    className="w-4 h-4 accent-aqua-5 rounded"
                  />
                  <span className="text-sm font-medium text-ink">{t('tgCalabria.featuredLabel')}</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isBreaking}
                    onChange={(e) => setFormData({ ...formData, isBreaking: e.target.checked })}
                    className="w-4 h-4 accent-aqua-5 rounded"
                  />
                  <span className="text-sm font-medium text-ink">{t('tgCalabria.breakingNews')}</span>
                </label>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-semibold text-ink mb-2">{t('tgCalabria.status')}</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      value="PUBLISHED"
                      checked={formData.status === 'PUBLISHED'}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-4 h-4 accent-aqua-5"
                    />
                    <span className="text-sm font-medium text-ink">{t('tgCalabria.published')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      value="DRAFT"
                      checked={formData.status === 'DRAFT'}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-4 h-4 accent-aqua-5"
                    />
                    <span className="text-sm font-medium text-ink">{t('tgCalabria.draft')}</span>
                  </label>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex gap-3 pt-4 border-t border-line">
                <button
                  type="button"
                  onClick={() => {
                    setShowArticleModal(false);
                    setSubmitError(null);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2 border border-line text-ink rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-aqua-5 text-white rounded-lg hover:bg-aqua-4 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? t('tgCalabria.creating') : t('tgCalabria.createArticle')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
