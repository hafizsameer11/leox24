import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import Topbar from '../components/layout/Topbar';
import api from '../services/api';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import { useAuthStore } from '../stores/authStore';

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

export default function EmailBulk() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const isSuperAdmin = user?.role === 'super_admin';
  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Array<{ id: number; name: string }>>([]);
  const [filters, setFilters] = useState({
    category: 'all',
    status: 'all',
    search: '',
  });
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
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sendFileInputRef = useRef<HTMLInputElement>(null);
  const [uploadFormData, setUploadFormData] = useState({
    file: null as File | null,
    category: '',
  });
  const [sendAttachments, setSendAttachments] = useState<File[]>([]);
  const [senders, setSenders] = useState<EmailSender[]>([]);

  const [sendFormData, setSendFormData] = useState({
    selection_type: 'first_n' as 'first_n' | 'selected' | 'category',
    first_n: 20,
    selected_ids: [] as number[],
    category_filter: '',
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
    fetchEmails();
    }
  }, [filters.category, filters.status, filters.search, pagination.current_page, user, isSuperAdmin, navigate]);

  useEffect(() => {
    fetchCategories();
    fetchSenders();
  }, []);

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

  const fetchCategories = async () => {
    try {
      const response = await api.get('/categories');
      setCategories(response.data || []);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      setCategories([]);
    }
  };

  const fetchEmails = async () => {
    try {
      setLoading(true);
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

      const response = await api.get(`/emails?${params.toString()}`);
      setEmails(response.data.data || []);
      setPagination({
        current_page: response.data.current_page || 1,
        last_page: response.data.last_page || 1,
        per_page: response.data.per_page || 15,
        total: response.data.total || 0,
      });
    } catch (error: any) {
      console.error('Failed to fetch emails:', error);
      alert(error.response?.data?.message || t('emails.fetchFailed'));
    } finally {
      setLoading(false);
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
    } catch (error: any) {
      console.error('Upload failed:', error);
      alert(error.response?.data?.message || t('emails.uploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  const handleSend = async () => {
    if (!sendFormData.subject || !sendFormData.message) {
      alert(t('emails.enterSubjectMessage'));
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

        if (sendFormData.selection_type === 'first_n') {
          formData.append('first_n', String(sendFormData.first_n));
        } else if (sendFormData.selection_type === 'selected') {
          const ids = selectedIds.length > 0 ? selectedIds : sendFormData.selected_ids;
          ids.forEach((id) => formData.append('selected_ids[]', String(id)));
        } else if (sendFormData.selection_type === 'category') {
          formData.append('category_filter', sendFormData.category_filter || filters.category);
        }

        sendAttachments.forEach((file) => {
          formData.append('attachments[]', file);
        });

        response = await api.post('/emails/send', formData, {
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

        if (sendFormData.selection_type === 'first_n') {
          payload.first_n = sendFormData.first_n;
        } else if (sendFormData.selection_type === 'selected') {
          payload.selected_ids = selectedIds.length > 0 ? selectedIds : sendFormData.selected_ids;
        } else if (sendFormData.selection_type === 'category') {
          payload.category_filter = sendFormData.category_filter || filters.category;
        }

        response = await api.post('/emails/send', payload);
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
        selection_type: 'first_n',
        first_n: 20,
        selected_ids: [],
        category_filter: '',
        sender_id: senders[0]?.id || '',
        subject: '',
        message: '',
      });
      setSendAttachments([]);
      if (sendFileInputRef.current) {
        sendFileInputRef.current.value = '';
      }
      setSelectedIds([]);
      fetchEmails();
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
    if (selectedIds.length === emails.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(emails.map((e) => e.id));
    }
  };

  const getEmailAddress = (email: EmailRecord): string => {
    return email.email_address || email.row_data_json?.email || 'N/A';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Topbar
        title={t('emails.title')}
        subtitle={t('emails.subtitle')}
        actions={
          <div className="flex gap-2">
            <Button onClick={() => setShowUploadModal(true)} variant="primary">
              {t('emails.uploadEmails')}
            </Button>
            <Button onClick={() => setShowSendModal(true)} variant="primary">
              {t('emails.sendEmail')}
            </Button>
          </div>
        }
      />

      <div className="p-6">
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
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.name}
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
                <option value="active">{t('emails.active')}</option>
                <option value="sent">{t('emails.sent')}</option>
                <option value="failed">{t('emails.failed')}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('common.search')}
              </label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => {
                  setFilters({ ...filters, search: e.target.value });
                  setPagination({ ...pagination, current_page: 1 });
                }}
                placeholder={t('emails.searchPlaceholder')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex items-end">
              <Button
                onClick={() => {
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
          ) : emails.length === 0 ? (
            <div className="p-8 text-center text-gray-500">{t('emails.noEmailsFound')}</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={selectedIds.length === emails.length && emails.length > 0}
                          onChange={toggleSelectAll}
                          className="rounded border-gray-300"
                        />
                      </th>
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
                    {emails.map((email) => (
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
                  {t('emails.showingCount', { count: emails.length, total: pagination.total })}
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
              {categories.map((cat) => (
                <option key={cat.id} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </select>
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
                  selection_type: e.target.value as any,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="first_n">{t('emails.firstNRecords')}</option>
              <option value="selected">{t('emails.manuallySelected')}</option>
              <option value="category">{t('emails.filterByCategory')}</option>
            </select>
          </div>

          {sendFormData.selection_type === 'first_n' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('emails.numberOfRecords')}
              </label>
              <input
                type="number"
                min="1"
                value={sendFormData.first_n}
                onChange={(e) =>
                  setSendFormData({
                    ...sendFormData,
                    first_n: parseInt(e.target.value) || 1,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}

          {sendFormData.selection_type === 'category' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('common.category')}
              </label>
              <select
                value={sendFormData.category_filter || filters.category}
                onChange={(e) =>
                  setSendFormData({
                    ...sendFormData,
                    category_filter: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">{t('emails.selectCategory')}</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
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
            <textarea
              value={sendFormData.message}
              onChange={(e) =>
                setSendFormData({ ...sendFormData, message: e.target.value })
              }
              placeholder={t('emails.messagePlaceholder')}
              rows={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
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
              disabled={!sendFormData.subject || !sendFormData.message}
            >
              {t('emails.sendEmails')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
