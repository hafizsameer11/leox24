import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import Topbar from '../components/layout/Topbar';
import api from '../services/api';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import EmailRichEditor, { richTextHasContent } from '../components/ui/EmailRichEditor';
import { useAuthStore } from '../stores/authStore';

const SEARCH_DEBOUNCE_MS = 400;

interface EmailRecord {
  id: number;
  category: string;
  email_address?: string | null;
  headers_json: string[] | null;
  row_data_json: {
    email: string;
    [key: string]: any;
  };
  status: 'active' | 'sent' | 'failed';
  sent_at: string | null;
  error_message: string | null;
  created_at: string;
}

interface EmailSender {
  id: string;
  label: string;
  address: string;
  name: string;
}

interface LeadEmailRecord {
  id: number;
  name: string | null;
  email: string;
  category: string | null;
  status: string | null;
  bulk_email_status: 'sent' | 'failed' | null;
  bulk_email_sent_at: string | null;
  bulk_email_error: string | null;
  created_at: string;
}

type BulkTab = 'uploaded' | 'leads';

export default function EmailBulk() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const isSuperAdmin = user?.role === 'super_admin';
  const [activeTab, setActiveTab] = useState<BulkTab>('uploaded');
  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [leadEmails, setLeadEmails] = useState<LeadEmailRecord[]>([]);
  const [loading, setLoading] = useState(true);
  /** CRM project categories — used only on upload assign. */
  const [crmCategories, setCrmCategories] = useState<Array<{ id: number; name: string }>>([]);
  /** Categories actually stored on email rows — used for uploaded tab. */
  const [emailCategories, setEmailCategories] = useState<
    Array<{ name: string; total: number; active_count: number }>
  >([]);
  /** Lead categories among leads that have email. */
  const [leadCategories, setLeadCategories] = useState<
    Array<{ name: string; total: number; active_count: number; pending_count?: number }>
  >([]);
  const [filters, setFilters] = useState({
    category: 'all',
    status: 'all',
    search: '',
  });
  const [searchInput, setSearchInput] = useState('');
  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
    per_page: 15,
    total: 0,
  });
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);

  const filterCategories = activeTab === 'leads' ? leadCategories : emailCategories;
  const tableRows = activeTab === 'leads' ? leadEmails : emails;
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sendFileInputRef = useRef<HTMLInputElement>(null);
  const [uploadFormData, setUploadFormData] = useState({
    file: null as File | null,
    category: '',
  });
  const [sendAttachments, setSendAttachments] = useState<File[]>([]);
  const [senders, setSenders] = useState<EmailSender[]>([]);

  const [sendFormData, setSendFormData] = useState({
    selection_type: 'category' as 'selected' | 'category',
    selected_ids: [] as number[],
    category_filter: '',
    range_from: 1,
    range_to: 30,
    sender_id: '',
    subject: '',
    message: '',
  });

  useEffect(() => {
    if (user && !isSuperAdmin) {
      navigate('/dashboard', { replace: true });
      return;
    }
    if (user && isSuperAdmin) {
      if (activeTab === 'leads') {
        fetchLeadEmails();
      } else {
        fetchEmails();
      }
    }
  }, [
    activeTab,
    filters.category,
    filters.status,
    filters.search,
    pagination.current_page,
    user,
    isSuperAdmin,
    navigate,
  ]);

  // Debounce search box → applied filter
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = searchInput.trim();
      setFilters((prev) => {
        if (prev.search === next) return prev;
        return { ...prev, search: next };
      });
      setPagination((prev) =>
        prev.current_page === 1 ? prev : { ...prev, current_page: 1 }
      );
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    fetchCrmCategories();
    fetchEmailCategories();
    fetchLeadCategories();
    fetchSenders();
  }, []);

  const switchTab = (tab: BulkTab) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    setSelectedIds([]);
    setSearchInput('');
    setFilters({ category: 'all', status: 'all', search: '' });
    setPagination((prev) => ({ ...prev, current_page: 1 }));
    setSendFormData((prev) => ({
      ...prev,
      category_filter: '',
      selection_type: 'category',
    }));
  };

  const fetchSenders = async () => {
    try {
      const response = await api.get('/emails/senders');
      const list = response.data.senders || [];
      setSenders(list);
      if (list.length > 0) {
        setSendFormData((prev) => ({
          ...prev,
          sender_id: prev.sender_id || list[0].id,
        }));
      }
    } catch (error) {
      console.error('Failed to fetch email senders:', error);
      setSenders([]);
    }
  };

  const fetchCrmCategories = async () => {
    try {
      const response = await api.get('/categories');
      setCrmCategories(response.data || []);
    } catch (error) {
      console.error('Failed to fetch CRM categories:', error);
      setCrmCategories([]);
    }
  };

  const fetchEmailCategories = async () => {
    try {
      const response = await api.get('/emails/categories');
      setEmailCategories(response.data.categories || []);
    } catch (error) {
      console.error('Failed to fetch email categories:', error);
      setEmailCategories([]);
    }
  };

  const fetchLeadCategories = async () => {
    try {
      const response = await api.get('/emails/from-leads/categories');
      setLeadCategories(response.data.categories || []);
    } catch (error) {
      console.error('Failed to fetch lead email categories:', error);
      setLeadCategories([]);
    }
  };

  const applyListPagination = (responseData: any) => {
    setPagination({
      current_page: responseData.current_page || 1,
      last_page: responseData.last_page || 1,
      per_page: responseData.per_page || 15,
      total: responseData.total || 0,
    });
  };

  const buildListParams = () => {
    const params = new URLSearchParams({
      page: pagination.current_page.toString(),
      per_page: pagination.per_page.toString(),
    });
    if (filters.category !== 'all') {
      params.append('category', filters.category);
    }
    if (filters.status !== 'all') {
      params.append('status', filters.status);
    }
    if (filters.search) {
      params.append('search', filters.search);
    }
    return params;
  };

  const fetchEmails = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/emails?${buildListParams().toString()}`);
      setEmails(response.data.data || []);
      applyListPagination(response.data);
    } catch (error: any) {
      console.error('Failed to fetch emails:', error);
      alert(error.response?.data?.message || t('emails.fetchFailed'));
    } finally {
      setLoading(false);
    }
  };

  const fetchLeadEmails = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/emails/from-leads?${buildListParams().toString()}`);
      setLeadEmails(response.data.data || []);
      applyListPagination(response.data);
    } catch (error: any) {
      console.error('Failed to fetch lead emails:', error);
      alert(error.response?.data?.message || t('emails.fetchFailed'));
    } finally {
      setLoading(false);
    }
  };

  const refreshActiveList = () => {
    if (activeTab === 'leads') {
      fetchLeadEmails();
      fetchLeadCategories();
    } else {
      fetchEmails();
      fetchEmailCategories();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const extension = file.name.split('.').pop()?.toLowerCase();
      if (!['csv', 'xlsx', 'xls', 'txt'].includes(extension || '')) {
        alert(t('emails.invalidFileType'));
        return;
      }
      setUploadFormData({ ...uploadFormData, file });
    }
  };

  const handleUpload = async () => {
    if (!uploadFormData.file || !uploadFormData.category) {
      alert(t('emails.selectFileAndCategory'));
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', uploadFormData.file);
      formData.append('category', uploadFormData.category);

      const response = await api.post('/emails/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // Build result message
      let message = `${t('emails.uploadCompleted')}\n\n${t('emails.totalRows', { count: response.data.total_rows || response.data.total })}\n`;
      message += `✅ ${t('emails.uploadedSuccess', { count: response.data.successful })}\n`;
      if (response.data.skipped > 0) {
        message += `⏭️ ${t('emails.skippedExist', { count: response.data.skipped })}\n`;
      }
      if (response.data.failed > 0) {
        message += `❌ ${t('emails.uploadFailed', { count: response.data.failed })}\n`;
      }

      // Show skipped emails if any
      if (response.data.skipped_emails && response.data.skipped_emails.length > 0) {
        const skippedList = response.data.skipped_emails.slice(0, 10).join('\n');
        const moreSkipped = response.data.skipped_emails.length > 10 
          ? `\n${t('emails.andMore', { count: response.data.skipped_emails.length - 10 })}` 
          : '';
        message += `\n\n${t('emails.skippedEmailsTitle')}\n${skippedList}${moreSkipped}`;
      }

      // Show errors if any
      if (response.data.errors && response.data.errors.length > 0) {
        const errorList = response.data.errors.slice(0, 10).join('\n');
        const moreErrors = response.data.errors.length > 10 
          ? `\n${t('emails.andMoreErrors', { count: response.data.errors.length - 10 })}` 
          : '';
        message += `\n\n${t('emails.errorsTitle')}\n${errorList}${moreErrors}`;
      }

      alert(message);

      setShowUploadModal(false);
      setUploadFormData({ file: null, category: '' });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      fetchEmails();
      fetchEmailCategories();
    } catch (error: any) {
      console.error('Upload failed:', error);
      alert(error.response?.data?.message || t('emails.uploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  const handleSend = async () => {
    if (!sendFormData.subject || !richTextHasContent(sendFormData.message)) {
      alert(t('emails.enterSubjectMessage'));
      return;
    }

    if (sendFormData.selection_type === 'category' && !sendFormData.category_filter) {
      alert(t('emails.selectCategory'));
      return;
    }
    if (
      sendFormData.selection_type === 'category' &&
      (sendFormData.range_from < 1 ||
        sendFormData.range_to < sendFormData.range_from)
    ) {
      alert(t('emails.invalidRange'));
      return;
    }

    try {
      setSending(true);
      const hasAttachments = sendAttachments.length > 0;
      let response;

      if (hasAttachments) {
        const formData = new FormData();
        formData.append('subject', sendFormData.subject);
        formData.append('message', sendFormData.message);
        formData.append('selection_type', sendFormData.selection_type);
        if (sendFormData.sender_id) {
          formData.append('sender_id', sendFormData.sender_id);
        }

        if (sendFormData.selection_type === 'selected') {
          const ids = selectedIds.length > 0 ? selectedIds : sendFormData.selected_ids;
          ids.forEach((id) => formData.append('selected_ids[]', String(id)));
        } else {
          formData.append('category_filter', sendFormData.category_filter);
          formData.append('range_from', String(sendFormData.range_from));
          formData.append('range_to', String(sendFormData.range_to));
        }

        sendAttachments.forEach((file) => {
          formData.append('attachments[]', file);
        });

        const sendUrl =
          activeTab === 'leads' ? '/emails/send-from-leads' : '/emails/send';
        response = await api.post(sendUrl, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
      } else {
        const payload: any = {
          subject: sendFormData.subject,
          message: sendFormData.message,
          selection_type: sendFormData.selection_type,
        };

        if (sendFormData.sender_id) {
          payload.sender_id = sendFormData.sender_id;
        }

        if (sendFormData.selection_type === 'selected') {
          payload.selected_ids = selectedIds.length > 0 ? selectedIds : sendFormData.selected_ids;
        } else {
          payload.category_filter = sendFormData.category_filter;
          payload.range_from = sendFormData.range_from;
          payload.range_to = sendFormData.range_to;
        }

        const sendUrl =
          activeTab === 'leads' ? '/emails/send-from-leads' : '/emails/send';
        response = await api.post(sendUrl, payload);
      }

      alert(
        t('emails.queuedMessage', {
          total: response.data.total,
          queued: response.data.queued,
          failed: response.data.failed,
        })
      );

      setShowSendModal(false);
      setSendFormData({
        selection_type: 'category',
        selected_ids: [],
        category_filter: '',
        range_from: 1,
        range_to: 30,
        sender_id: senders[0]?.id || '',
        subject: '',
        message: '',
      });
      setSendAttachments([]);
      if (sendFileInputRef.current) {
        sendFileInputRef.current.value = '';
      }
      setSelectedIds([]);
      // Jobs update status async — refresh a few times so sent rows rise to top
      refreshActiveList();
      window.setTimeout(() => refreshActiveList(), 2500);
      window.setTimeout(() => refreshActiveList(), 6000);
    } catch (error: any) {
      console.error('Send failed:', error);
      alert(error.response?.data?.message || t('emails.sendFailed'));
    } finally {
      setSending(false);
    }
  };

  const handleSendAttachmentSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) {
      setSendAttachments([]);
      return;
    }

    const allowedExtensions = ['pdf', 'xls', 'xlsx', 'doc', 'docx', 'jpg', 'jpeg', 'png'];
    const maxSizeBytes = 100 * 1024 * 1024;
    const validFiles: File[] = [];

    files.forEach((file) => {
      const extension = file.name.split('.').pop()?.toLowerCase() || '';
      if (!allowedExtensions.includes(extension)) {
        return;
      }
      if (file.size > maxSizeBytes) {
        return;
      }
      validFiles.push(file);
    });

    if (validFiles.length !== files.length) {
      alert(t('emails.attachmentsSkipped'));
    }

    setSendAttachments(validFiles);
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === tableRows.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(tableRows.map((e) => e.id));
    }
  };

  const getEmailAddress = (email: EmailRecord): string => {
    return email.email_address || email.row_data_json?.email || 'N/A';
  };

  const leadMailStatus = (lead: LeadEmailRecord): string => {
    return lead.bulk_email_status || 'pending';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Topbar
        title={t('emails.title')}
        subtitle={t('emails.subtitle')}
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            {activeTab === 'uploaded' && (
              <Button onClick={() => setShowUploadModal(true)} variant="primary">
                {t('emails.uploadEmails')}
              </Button>
            )}
            <Button onClick={() => setShowSendModal(true)} variant="primary">
              {t('emails.sendEmail')}
            </Button>
          </div>
        }
      />

      <div className="p-4 sm:p-6">
        {/* Tabs */}
        <div className="mb-4 flex gap-1 border-b border-gray-200">
          <button
            type="button"
            onClick={() => switchTab('uploaded')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === 'uploaded'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t('emails.tabUploaded')}
          </button>
          <button
            type="button"
            onClick={() => switchTab('leads')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === 'leads'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t('emails.tabFromLeads')}
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('common.category')}
              </label>
              <select
                value={filters.category}
                onChange={(e) => {
                  setFilters({ ...filters, category: e.target.value });
                  setPagination({ ...pagination, current_page: 1 });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">{t('emails.allCategories')}</option>
                {filterCategories.map((cat) => (
                  <option key={cat.name} value={cat.name}>
                    {cat.name} ({cat.total})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('common.status')}
              </label>
              <select
                value={filters.status}
                onChange={(e) => {
                  setFilters({ ...filters, status: e.target.value });
                  setPagination({ ...pagination, current_page: 1 });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">{t('emails.allStatuses')}</option>
                {activeTab === 'leads' ? (
                  <option value="pending">{t('emails.pending')}</option>
                ) : (
                  <option value="active">{t('emails.active')}</option>
                )}
                <option value="sent">{t('emails.sent')}</option>
                <option value="failed">{t('emails.failed')}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('common.search')}
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="search"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const next = searchInput.trim();
                        setFilters((prev) => ({ ...prev, search: next }));
                        setPagination((prev) => ({ ...prev, current_page: 1 }));
                      }
                    }}
                    placeholder={t('emails.searchPlaceholder')}
                    className="w-full rounded-lg border border-gray-300 py-2 pl-3 pr-9 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    aria-label={t('emails.searchPlaceholder')}
                  />
                  {searchInput && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchInput('');
                        setFilters((prev) => ({ ...prev, search: '' }));
                        setPagination((prev) => ({ ...prev, current_page: 1 }));
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1 text-gray-400 hover:text-gray-700"
                      aria-label={t('common.clearFilters')}
                    >
                      ×
                    </button>
                  )}
                </div>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={() => {
                    const next = searchInput.trim();
                    setFilters((prev) => ({ ...prev, search: next }));
                    setPagination((prev) => ({ ...prev, current_page: 1 }));
                  }}
                >
                  {t('common.search')}
                </Button>
              </div>
            </div>

            <div className="flex items-end">
              <Button
                onClick={() => {
                  setSearchInput('');
                  setFilters({ category: 'all', status: 'all', search: '' });
                  setPagination({ ...pagination, current_page: 1 });
                }}
                variant="secondary"
                size="md"
              >
                {t('common.clearFilters')}
              </Button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">{t('common.loading')}</div>
          ) : tableRows.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {activeTab === 'leads'
                ? t('emails.noLeadEmailsFound')
                : t('emails.noEmailsFound')}
            </div>
          ) : (
            <>
              <label className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700 md:hidden">
                <input
                  type="checkbox"
                  checked={selectedIds.length === tableRows.length && tableRows.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded border-gray-300"
                />
                {t('emails.selectAll', { defaultValue: 'Select all on this page' })}
              </label>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left">
                        <span className="sr-only">{t('emails.selectAll', { defaultValue: 'Select' })}</span>
                        <input
                          type="checkbox"
                          checked={selectedIds.length === tableRows.length && tableRows.length > 0}
                          onChange={toggleSelectAll}
                          className="rounded border-gray-300"
                        />
                      </th>
                      {activeTab === 'leads' && (
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          {t('common.name')}
                        </th>
                      )}
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                        {t('common.email')}
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                        {t('common.category')}
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                        {t('common.status')}
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                        {t('emails.sentAt')}
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                        {t('emails.createdAt')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {activeTab === 'leads'
                      ? leadEmails.map((lead) => {
                          const status = leadMailStatus(lead);
                          return (
                            <tr
                              key={lead.id}
                              className="hover:bg-gray-50 transition-colors"
                            >
                              <td className="px-4 py-3">
                                <input
                                  type="checkbox"
                                  checked={selectedIds.includes(lead.id)}
                                  onChange={() => toggleSelect(lead.id)}
                                  className="rounded border-gray-300"
                                />
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900">
                                {lead.name || '—'}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900">
                                {lead.email}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {lead.category || '—'}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                    status === 'sent'
                                      ? 'bg-green-100 text-green-800'
                                      : status === 'failed'
                                      ? 'bg-red-100 text-red-800'
                                      : 'bg-blue-100 text-blue-800'
                                  }`}
                                  title={lead.bulk_email_error || undefined}
                                >
                                  {status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {lead.bulk_email_sent_at
                                  ? new Date(lead.bulk_email_sent_at).toLocaleString()
                                  : '-'}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {new Date(lead.created_at).toLocaleString()}
                              </td>
                            </tr>
                          );
                        })
                      : emails.map((email) => (
                          <tr
                            key={email.id}
                            className="hover:bg-gray-50 transition-colors"
                          >
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(email.id)}
                                onChange={() => toggleSelect(email.id)}
                                className="rounded border-gray-300"
                              />
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {getEmailAddress(email)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {email.category}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                  email.status === 'sent'
                                    ? 'bg-green-100 text-green-800'
                                    : email.status === 'failed'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}
                              >
                                {email.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {email.sent_at
                                ? new Date(email.sent_at).toLocaleString()
                                : '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {new Date(email.created_at).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  {t('emails.showingCount', {
                    count: tableRows.length,
                    total: pagination.total,
                  })}
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() =>
                      setPagination({ ...pagination, current_page: pagination.current_page - 1 })
                    }
                    disabled={pagination.current_page === 1}
                    variant="secondary"
                    size="sm"
                  >
                    {t('common.previous')}
                  </Button>
                  <span className="px-4 py-2 text-sm text-gray-700">
                    {pagination.current_page} / {pagination.last_page}
                  </span>
                  <Button
                    onClick={() =>
                      setPagination({ ...pagination, current_page: pagination.current_page + 1 })
                    }
                    disabled={pagination.current_page === pagination.last_page}
                    variant="secondary"
                    size="sm"
                  >
                    {t('common.next')}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Upload Modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => {
          setShowUploadModal(false);
          setUploadFormData({ file: null, category: '' });
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }}
        title={t('emails.uploadModalTitle')}
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('emails.selectFile')}
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,.txt"
              onChange={handleFileSelect}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {uploadFormData.file && (
              <p className="mt-2 text-sm text-gray-600">
                {t('emails.selectedFile', { name: uploadFormData.file.name })}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('common.category')} <span className="text-red-500">*</span>
            </label>
            <select
              value={uploadFormData.category}
              onChange={(e) =>
                setUploadFormData({ ...uploadFormData, category: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">{t('emails.selectCategory')}</option>
              {crmCategories.map((cat) => (
                <option key={cat.id} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              {t('emails.uploadCategoryHelp')}
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>{t('emails.fileFormatTitle')}</strong>
            </p>
            <ul className="text-sm text-blue-700 mt-2 list-disc list-inside space-y-1">
              <li>{t('emails.fileFormatHelp')}</li>
              <li>{t('emails.fileFormatHelpNoHeaders')}</li>
              <li>{t('emails.invalidRowsSkipped')}</li>
            </ul>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              onClick={() => {
                setShowUploadModal(false);
                setUploadFormData({ file: null, category: '' });
                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                }
              }}
              variant="secondary"
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleUpload}
              variant="primary"
              isLoading={uploading}
              disabled={!uploadFormData.file || !uploadFormData.category}
            >
              {t('common.upload')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Send Email Modal */}
      <Modal
        isOpen={showSendModal}
        onClose={() => {
          setShowSendModal(false);
          setSendAttachments([]);
          if (sendFileInputRef.current) {
            sendFileInputRef.current.value = '';
          }
        }}
        title={t('emails.sendModalTitle')}
        size="xl"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('emails.selectRecipients')}
            </label>
            <select
              value={sendFormData.selection_type}
              onChange={(e) =>
                setSendFormData({
                  ...sendFormData,
                  selection_type: e.target.value as 'selected' | 'category',
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="category">{t('emails.filterByCategory')}</option>
              <option value="selected">{t('emails.manuallySelected')}</option>
            </select>
          </div>

          {sendFormData.selection_type === 'category' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('common.category')}
                </label>
                <select
                  value={sendFormData.category_filter}
                  onChange={(e) =>
                    setSendFormData({
                      ...sendFormData,
                      category_filter: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">{t('emails.selectCategory')}</option>
                  {filterCategories.map((cat) => (
                    <option key={cat.name} value={cat.name}>
                      {activeTab === 'leads'
                        ? `${cat.name} (${cat.active_count} pending / ${cat.total})`
                        : `${cat.name} (${cat.active_count} active / ${cat.total})`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('emails.rangeFrom')}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={sendFormData.range_from}
                    onChange={(e) =>
                      setSendFormData({
                        ...sendFormData,
                        range_from: parseInt(e.target.value, 10) || 1,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('emails.rangeTo')}
                  </label>
                  <input
                    type="number"
                    min={sendFormData.range_from}
                    value={sendFormData.range_to}
                    onChange={(e) =>
                      setSendFormData({
                        ...sendFormData,
                        range_to: parseInt(e.target.value, 10) || sendFormData.range_from,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500">
                {t('emails.rangeHelp', {
                  from: sendFormData.range_from,
                  to: sendFormData.range_to,
                  count: Math.max(
                    0,
                    sendFormData.range_to - sendFormData.range_from + 1
                  ),
                })}
              </p>
            </>
          )}

          {sendFormData.selection_type === 'selected' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800">
                {selectedIds.length > 0
                  ? t('emails.selectedCount', { count: selectedIds.length })
                  : t('emails.selectFromTable')}
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('emails.sender')} <span className="text-red-500">*</span>
            </label>
            <select
              value={sendFormData.sender_id}
              onChange={(e) =>
                setSendFormData({ ...sendFormData, sender_id: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              {senders.length === 0 && (
                <option value="">{t('emails.defaultSender')}</option>
              )}
              {senders.map((sender) => (
                <option key={sender.id} value={sender.id}>
                  {sender.label} ({sender.address})
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              {t('emails.senderHelp')}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('emails.subject')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={sendFormData.subject}
              onChange={(e) =>
                setSendFormData({ ...sendFormData, subject: e.target.value })
              }
              placeholder={t('emails.subjectPlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('emails.message')} <span className="text-red-500">*</span>
            </label>
            <EmailRichEditor
              value={sendFormData.message}
              onChange={(html) =>
                setSendFormData({ ...sendFormData, message: html })
              }
              placeholder={t('emails.messagePlaceholder')}
            />
            <p className="mt-2 text-xs text-gray-500">
              Usa la barra strumenti per grassetto, corsivo, dimensione testo e link (URL).
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('emails.attachments')}
            </label>
            <input
              ref={sendFileInputRef}
              type="file"
              multiple
              accept=".pdf,.xls,.xlsx,.doc,.docx,.jpg,.jpeg,.png"
              onChange={handleSendAttachmentSelect}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="mt-2 text-xs text-gray-500">
              {t('emails.attachmentsHelp')}
            </p>
            {sendAttachments.length > 0 && (
              <div className="mt-2 text-sm text-gray-600">
                {t('emails.selectedFiles', { files: sendAttachments.map((file) => file.name).join(', ') })}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              onClick={() => {
                setShowSendModal(false);
                setSendAttachments([]);
                if (sendFileInputRef.current) {
                  sendFileInputRef.current.value = '';
                }
              }}
              variant="secondary"
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleSend}
              variant="primary"
              isLoading={sending}
              disabled={!sendFormData.subject || !richTextHasContent(sendFormData.message)}
            >
              {t('emails.sendEmails')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
