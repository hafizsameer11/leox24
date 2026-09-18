import { useEffect, useState, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import Topbar from '../components/layout/Topbar';
import { useAuthStore } from '../stores/authStore';
import api from '../services/api';
import Modal from '../components/ui/Modal';
import type { ApiLead, LeadTableRow } from '../utils/leadTableRows';
import {
  expandApiLeadsToTableRows,
  filterTableRowsBySearch,
  filterTableRowsByLeadFields,
  filterTableRowsByImportFilters,
  computeTopRawAttributeKeys,
  type LeadFieldFilters,
  type ImportFilter,
} from '../utils/leadTableRows';

type Lead = ApiLead;

type LeadUploadFormat = 'csv' | 'excel';

type LeadImportStatus = {
  id: number;
  file_name: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  total_rows: number | null;
  processed_rows: number;
  imported_count: number;
  error_count: number;
  error_message: string | null;
};

const LEAD_UPLOAD_ACCEPT = [
  '.csv',
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel',
  '.txt',
  'text/plain',
  '.xls',
  'application/excel',
  'application/xls',
  '.xlsx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
].join(',');

function getLeadUploadFormat(file: File): LeadUploadFormat | null {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'csv' || extension === 'txt') {
    return 'csv';
  }

  if (extension === 'xls' || extension === 'xlsx') {
    return 'excel';
  }

  return null;
}

/** Renders only this many table body rows at a time (legacy imports expand to many contacts). */
const LEADS_TABLE_ROWS_PER_PAGE = 25;

function displayCell(value?: string | null): string {
  const s = value != null ? String(value).trim() : '';
  return s || '—';
}

function rawAttributeCell(row: LeadTableRow, headerKey: string): string {
  const raw = row.raw_attributes;
  if (!raw) return '—';
  if (raw[headerKey] !== undefined && String(raw[headerKey]).trim() !== '') {
    return displayCell(raw[headerKey]);
  }
  const match = Object.keys(raw).find((k) => k.trim().toLowerCase() === headerKey.trim().toLowerCase());
  return match ? displayCell(raw[match]) : '—';
}

interface FollowUp {
  id: number;
  customer_id: number;
  opportunity_id?: number;
  title: string;
  notes?: string;
  type: 'call' | 'email' | 'meeting' | 'message' | 'other';
  status: 'scheduled' | 'completed' | 'cancelled' | 'overdue';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  scheduled_at: string;
  completed_at?: string;
  outcome?: string;
  created_by?: { id: number; name: string };
  assignee?: { id: number; name: string };
}

export default function Leads() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const isSuperAdmin = user?.role === 'super_admin';
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: 'all',
    source: 'all',
    category: 'all',
    search: '',
    age: '',
    gender: '',
    country: '',
    intention: '',
  });
  /** Stacked filters on imported CSV columns (e.g. Città → Roma, Professione → Medico). */
  const [importFilters, setImportFilters] = useState<ImportFilter[]>(() => [
    { field: '', value: '' },
    { field: '', value: '' },
    { field: '', value: '' },
  ]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingRow, setViewingRow] = useState<LeadTableRow | null>(null);
  
  // New state for file upload form
  const [uploadFormData, setUploadFormData] = useState({
    file: null as File | null,
    format: 'csv',
    category: '',
  });
  const [activeImport, setActiveImport] = useState<LeadImportStatus | null>(null);
  const [uploading, setUploading] = useState(false);
  const [importStatusError, setImportStatusError] = useState<string | null>(null);
  const [importQueuedAt, setImportQueuedAt] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsAppMessage, setWhatsAppMessage] = useState('');
  const [whatsAppSending, setWhatsAppSending] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  /** Contact row used for call/WhatsApp and follow-up "start call" (handles legacy file rows). */
  const [actionContactRow, setActionContactRow] = useState<LeadTableRow | null>(null);
  const [followUps, setFollowUps] = useState<Record<number, FollowUp[]>>({});
  const [_editingFollowUp, setEditingFollowUp] = useState<FollowUp | null>(null);
  const [followUpFormData, setFollowUpFormData] = useState({
    title: '',
    notes: '',
    type: 'call' as FollowUp['type'],
    priority: 'medium' as FollowUp['priority'],
    scheduled_at: '',
    outcome: '',
  });
  const [categories, setCategories] = useState<Array<{ id: number; name: string }>>([]);

  const [listPage, setListPage] = useState(1);
  /** Client-side page over expanded contact rows for the current API page. */
  const [contactTablePage, setContactTablePage] = useState(1);
  const [paginationMeta, setPaginationMeta] = useState({
    current_page: 1,
    last_page: 1,
    total: 0,
  });
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search);
  const [debouncedLeadFilters, setDebouncedLeadFilters] = useState<LeadFieldFilters>({
    age: filters.age,
    gender: filters.gender,
    country: filters.country,
    intention: filters.intention,
  });
  const [debouncedImportFilters, setDebouncedImportFilters] = useState<ImportFilter[]>(() => [
    { field: '', value: '' },
    { field: '', value: '' },
    { field: '', value: '' },
  ]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.search), 300);
    return () => clearTimeout(timer);
  }, [filters.search]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedLeadFilters({
      age: filters.age,
      gender: filters.gender,
      country: filters.country,
      intention: filters.intention,
    }), 300);
    return () => clearTimeout(timer);
  }, [filters.age, filters.gender, filters.country, filters.intention]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedImportFilters(importFilters), 400);
    return () => clearTimeout(timer);
  }, [importFilters]);

  useEffect(() => {
    setListPage(1);
  }, [filters.status, filters.source, filters.category, debouncedSearch, debouncedLeadFilters, debouncedImportFilters]);

  useEffect(() => {
    setContactTablePage(1);
  }, [listPage, filters.status, filters.source, filters.category, debouncedSearch, debouncedLeadFilters, debouncedImportFilters]);

  useEffect(() => {
    void fetchLeads();
  }, [listPage, filters.status, filters.source, filters.category, debouncedSearch, debouncedImportFilters]);

  useEffect(() => {
    fetchCategories();
  }, []);

  const tableRows = useMemo(() => {
    const expanded = expandApiLeadsToTableRows(leads);
    const searched = filterTableRowsBySearch(expanded, debouncedSearch);
    const fieldFiltered = filterTableRowsByLeadFields(searched, debouncedLeadFilters);
    return filterTableRowsByImportFilters(fieldFiltered, debouncedImportFilters);
  }, [leads, debouncedSearch, debouncedLeadFilters, debouncedImportFilters]);

  const dynamicImportKeys = useMemo(() => computeTopRawAttributeKeys(tableRows, 4), [tableRows]);

  const contactTableTotalPages = useMemo(
    () => Math.max(1, Math.ceil(tableRows.length / LEADS_TABLE_ROWS_PER_PAGE)),
    [tableRows.length]
  );

  const pagedTableRows = useMemo(() => {
    const start = (contactTablePage - 1) * LEADS_TABLE_ROWS_PER_PAGE;
    return tableRows.slice(start, start + LEADS_TABLE_ROWS_PER_PAGE);
  }, [tableRows, contactTablePage]);

  useEffect(() => {
    setContactTablePage((p) => Math.min(p, contactTableTotalPages));
  }, [contactTableTotalPages]);

  const contactRowFrom =
    tableRows.length === 0 ? 0 : (contactTablePage - 1) * LEADS_TABLE_ROWS_PER_PAGE + 1;
  const contactRowTo = Math.min(contactTablePage * LEADS_TABLE_ROWS_PER_PAGE, tableRows.length);

  const fetchCategories = async () => {
    try {
      const response = await api.get('/categories');
      setCategories(response.data || []);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      setCategories([]);
    }
  };

  const handleExport = async () => {
    try {
      // Build query params from current filters
      const params = new URLSearchParams();
      
      if (filters.status !== 'all') {
        params.append('status', filters.status);
      }
      if (filters.source !== 'all') {
        params.append('source', filters.source);
      }
      if (filters.category !== 'all') {
        params.append('category', filters.category);
      }
      if (debouncedSearch) {
        params.append('search', debouncedSearch);
      }
      (Object.entries(debouncedLeadFilters) as Array<[keyof LeadFieldFilters, string]>).forEach(([field, value]) => {
        if (value.trim()) params.append(field, value.trim());
      });
      const importPayload = debouncedImportFilters
        .map((f) => ({ field: f.field.trim(), value: f.value.trim() }))
        .filter((f) => f.value.length > 0);
      if (importPayload.length > 0) {
        params.append('import_filters', JSON.stringify(importPayload));
      }

      const queryString = params.toString();
      const url = `/leads/export${queryString ? '?' + queryString : ''}`;

      const response = await api.get(url, {
        responseType: 'blob',
      });

      // Create blob URL and trigger download
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url_blob = window.URL.createObjectURL(blob);
      link.href = url_blob;
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().split('T')[0];
      link.setAttribute('download', `leads_export_${timestamp}.csv`);
      
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url_blob);
    } catch (error: any) {
      console.error('Failed to export leads:', error);
      alert(error.response?.data?.message || t('leadsPage.exportFailed'));
    }
  };

  const fetchLeads = async (pageOverride?: number) => {
    try {
      setLoading(true);
      const page = pageOverride ?? listPage;
      const params: Record<string, string> = {};
      
      if (filters.status !== 'all') {
        params.status = filters.status;
      }
      
      if (filters.source !== 'all') {
        params.source = filters.source;
      }

      if (filters.category !== 'all') {
        params.category = filters.category;
      }
      
      if (debouncedSearch) {
        params.search = debouncedSearch;
      }

      (Object.entries(debouncedLeadFilters) as Array<[keyof LeadFieldFilters, string]>).forEach(([field, value]) => {
        if (value.trim()) params[field] = value.trim();
      });

      const importPayload = debouncedImportFilters
        .map((f) => ({ field: f.field.trim(), value: f.value.trim() }))
        .filter((f) => f.value.length > 0);
      if (importPayload.length > 0) {
        params.import_filters = JSON.stringify(importPayload);
      }

      const response = await api.get('/leads', {
        params: { ...params, page, per_page: 30 },
      });
      setLeads(response.data.data || []);
      setPaginationMeta({
        current_page: response.data.current_page ?? 1,
        last_page: response.data.last_page ?? 1,
        total: response.data.total ?? 0,
      });
    } catch (error) {
      console.error('Failed to fetch leads:', error);
      setLeads([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async () => {
    if (uploading) return;
    try {
      const file = uploadFormData.file;
      const detectedFormat = file ? getLeadUploadFormat(file) : null;

      if (!file || !detectedFormat) {
        alert(t('leads.selectFile') + ' ' + t('common.required', 'required'));
        return;
      }
      if (!uploadFormData.category) {
        alert(t('leads.selectCategory'));
        return;
      }

      const formData = new FormData();
      formData.append('file', file);
      // The backend also derives this from the extension. Sending the detected
      // value keeps older API clients compatible without allowing a stale UI
      // selection to make an Excel workbook get parsed as CSV.
      formData.append('format', detectedFormat);
      formData.append('category', uploadFormData.category);

      // Let Axios/browser set the multipart boundary automatically. Setting
      // Content-Type manually can make binary workbook uploads arrive without
      // a valid boundary on some browsers/proxies.
      setUploading(true);
      const response = await api.post('/leads', formData);

      console.log('Lead file uploaded successfully:', response.data);
      setActiveImport({
        id: response.data.import_id,
        file_name: response.data.file_name || file.name,
        status: response.data.status || 'queued',
        total_rows: null,
        processed_rows: 0,
        imported_count: 0,
        error_count: 0,
        error_message: null,
      });
      setImportStatusError(null);
      setImportQueuedAt(Date.now());
      resetUploadForm();
    } catch (error: any) {
      console.error('Failed to upload lead file:', error);
      const errorMessage = error.response?.data?.message ||
                          error.response?.data?.error ||
                          (error.request && !error.response
                            ? t('leads.uploadNetworkError', 'The upload could not reach the CRM server. Please check the API connection and try again.')
                            : error.message) ||
                          t('leads.uploadError');
      alert(t('leadsPage.errorWithMessage', { message: errorMessage }));
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    if (!activeImport || activeImport.status === 'completed' || activeImport.status === 'failed') {
      return;
    }

    let cancelled = false;
    const poll = async () => {
      try {
        const response = await api.get(`/leads/imports/${activeImport.id}`);
        if (!cancelled) {
          const next = response.data as LeadImportStatus;
          setActiveImport(next);
          setImportStatusError(null);
          if (next.status === 'completed') {
            setShowCreateModal(false);
            await fetchLeads(1);
            setListPage(1);
            alert(t('leads.uploadSuccessCount', { count: next.imported_count }));
          } else if (next.status === 'failed') {
            alert(next.error_message || t('leads.uploadError'));
          }
        }
      } catch (error) {
        console.error('Failed to check lead import status:', error);
        if (!cancelled) {
          const message = (error as any)?.response?.data?.message
            || ((error as any)?.request
              ? 'The CRM server did not return the import status. The queue worker may be unavailable.'
              : (error as any)?.message)
            || 'The import status could not be checked.';
          setImportStatusError(message);
        }
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeImport?.id, activeImport?.status]);

  const handleDeleteLead = async (row: LeadTableRow) => {
    const confirmMsg =
      row.legacyRowIndex !== null
        ? t('leads.deleteLegacyBatchConfirm')
        : t('leads.deleteConfirm');
    if (!confirm(confirmMsg)) {
      return;
    }

    try {
      await api.delete(`/leads/${row.dbLeadId}`);
      fetchLeads();
    } catch (error) {
      console.error('Failed to delete lead:', error);
      alert(t('leadsPage.deleteFailed'));
    }
  };

  const resetUploadForm = () => {
    setUploadFormData({
      file: null,
      format: 'csv',
      category: '',
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const clearFilters = () => {
    setFilters({
      status: 'all',
      source: 'all',
      category: 'all',
      search: '',
      age: '',
      gender: '',
      country: '',
      intention: '',
    });
    setImportFilters([
      { field: '', value: '' },
      { field: '', value: '' },
      { field: '', value: '' },
    ]);
  };

  const updateImportFilter = (index: number, patch: Partial<ImportFilter>) => {
    setImportFilters((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const addImportFilterRow = () => {
    setImportFilters((prev) => (prev.length >= 6 ? prev : [...prev, { field: '', value: '' }]));
  };

  const removeImportFilterRow = (index: number) => {
    setImportFilters((prev) =>
      prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)
    );
  };

  const fetchFollowUps = async (leadId: number) => {
    try {
      const response = await api.get(`/leads/${leadId}/follow-ups`);
      setFollowUps(prev => ({ ...prev, [leadId]: response.data }));
    } catch (error) {
      console.error('Failed to fetch follow-ups:', error);
    }
  };

  const handleCreateFollowUp = async () => {
    if (!selectedLeadId) return;

    try {
      if (!followUpFormData.title || !followUpFormData.scheduled_at) {
        alert(t('leadsPage.fillTitleDate'));
        return;
      }

      const payload = {
        title: followUpFormData.title,
        notes: followUpFormData.notes || null,
        type: followUpFormData.type,
        priority: followUpFormData.priority,
        scheduled_at: followUpFormData.scheduled_at,
      };

      await api.post(`/leads/${selectedLeadId}/follow-ups`, payload);
      setShowFollowUpModal(false);
      resetFollowUpForm();
      await fetchFollowUps(selectedLeadId);
      alert(t('leadsPage.followUpScheduled'));
    } catch (error: any) {
      console.error('Failed to create follow-up:', error);
      alert(error.response?.data?.message || t('leadsPage.createFollowUpFailed'));
    }
  };

  const handleCompleteFollowUp = async (followUpId: number, leadId: number) => {
    try {
      const outcome = prompt(t('leadsPage.enterOutcomePrompt'));
      if (outcome === null) return; // User cancelled

      await api.post(`/follow-ups/${followUpId}/complete`, { outcome });
      await fetchFollowUps(leadId);
      alert(t('leadsPage.followUpCompleted'));
    } catch (error: any) {
      console.error('Failed to complete follow-up:', error);
      alert(error.response?.data?.message || t('leadsPage.completeFollowUpFailed'));
    }
  };

  const handleDeleteFollowUp = async (followUpId: number, leadId: number) => {
    if (!confirm(t('leadsPage.confirmDeleteFollowUp'))) return;

    try {
      await api.delete(`/follow-ups/${followUpId}`);
      await fetchFollowUps(leadId);
    } catch (error: any) {
      console.error('Failed to delete follow-up:', error);
      alert(error.response?.data?.message || t('leadsPage.deleteFollowUpFailed'));
    }
  };

  const handleStartCall = async (followUp: FollowUp | null, row: LeadTableRow | null) => {
    try {
      const contactPhone = row?.phone?.trim() || row?.mobile?.trim();
      if (!contactPhone) {
        alert(t('leads.noPhoneForCall'));
        return;
      }

      // Do not send customer_id: leads are not customers (validation would fail).
      const callPayload: Record<string, unknown> = {
        contact_name: row.name,
        contact_phone: contactPhone,
        source: row.source || 'Leads',
        priority: followUp?.priority || 'medium',
        status: 'in_progress',
        scheduled_at: followUp?.scheduled_at || new Date().toISOString(),
      };

      if (followUp?.opportunity_id) {
        callPayload.opportunity_id = followUp.opportunity_id;
      }

      if (followUp) {
        callPayload.notes = `Call started from follow-up: ${followUp.title}${followUp.notes ? '\n' + followUp.notes : ''}`;
      } else {
        callPayload.notes = `Call started directly from Leads page`;
      }

      const response = await api.post('/calls', callPayload);

      alert(t('leadsPage.callStarted', { id: response.data.id }));

      if (followUp && selectedLeadId) {
        await fetchFollowUps(selectedLeadId);
      }
    } catch (error: any) {
      console.error('Failed to start call:', error);
      alert(error.response?.data?.message || t('leadsPage.startCallFailed'));
    }
  };

  const openWhatsAppModal = (row: LeadTableRow) => {
    if (!(row.phone?.trim() || row.mobile?.trim())) {
      alert(t('leads.noPhoneForCall'));
      return;
    }
    setActionContactRow(row);
    setWhatsAppMessage('');
    setShowWhatsAppModal(true);
  };

  const handleSendWhatsApp = async () => {
    const contactPhone = actionContactRow?.phone?.trim() || actionContactRow?.mobile?.trim();
    if (!contactPhone || !whatsAppMessage.trim()) {
      alert(t('leadsPage.enterMessage'));
      return;
    }

    try {
      setWhatsAppSending(true);
      await api.post('/communications/whatsapp/send', {
        to: contactPhone,
        message: whatsAppMessage,
      });

      alert(t('leadsPage.whatsAppSent'));
      setShowWhatsAppModal(false);
      setWhatsAppMessage('');
      setActionContactRow(null);
    } catch (error: any) {
      console.error('Failed to send WhatsApp message:', error);
      alert(error.response?.data?.message || t('leadsPage.whatsAppFailed'));
    } finally {
      setWhatsAppSending(false);
    }
  };

  const resetFollowUpForm = () => {
    setFollowUpFormData({
      title: '',
      notes: '',
      type: 'call',
      priority: 'medium',
      scheduled_at: '',
      outcome: '',
    });
    setEditingFollowUp(null);
    setSelectedLeadId(null);
    setActionContactRow(null);
  };

  const openFollowUpModal = (row: LeadTableRow) => {
    setSelectedLeadId(row.dbLeadId);
    setActionContactRow(row);
    setShowFollowUpModal(true);
    fetchFollowUps(row.dbLeadId);
  };

  const getFollowUpTypeIcon = (type: FollowUp['type']) => {
    const icons = {
      call: '📞',
      email: '📧',
      meeting: '🤝',
      message: '💬',
      other: '📝',
    };
    return icons[type] || '📝';
  };

  const getPriorityColor = (priority: FollowUp['priority']) => {
    const colors = {
      low: 'text-muted',
      medium: 'text-ink',
      high: 'text-warn',
      urgent: 'text-bad',
    };
    return colors[priority] || 'text-ink';
  };


  const getStatusBadge = (status: string) => {
    const styles = {
      hot: 'bg-bad/15 text-bad border-bad/30',
      warm: 'bg-warn/15 text-warn border-warn/30',
      cold: 'bg-muted/15 text-muted border-muted/30',
      converted: 'bg-ok/15 text-ok border-ok/30',
    };
    return styles[status as keyof typeof styles] || styles.cold;
  };

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
        title={t('leads.title')}
        subtitle={t('leads.listSubtitle')}
        actions={
          <>
            <button 
              onClick={handleExport}
              className="px-4 py-2 text-sm border border-line rounded-xl hover:bg-aqua-1/30 transition-colors text-ink font-medium"
            >
              {t('common.export', 'Export')}
            </button>
            {isSuperAdmin && (
            <button 
              onClick={() => navigate('/emails')}
              className="px-4 py-2 text-sm border border-purple-5/35 bg-gradient-to-r from-purple-3/45 to-purple-5/14 rounded-xl hover:shadow-lg hover:shadow-purple-5/10 transition-all text-ink font-semibold"
            >
              📧 Email Bulk
            </button>
            )}
            <button 
              onClick={() => {
                setActiveImport(null);
                setImportStatusError(null);
                setImportQueuedAt(null);
                resetUploadForm();
                setShowCreateModal(true);
              }}
              className="px-4 py-2 text-sm border border-aqua-5/35 bg-gradient-to-r from-aqua-3/45 to-aqua-5/14 rounded-xl hover:shadow-lg hover:shadow-aqua-5/10 transition-all text-ink font-semibold"
            >
              ➕ {t('leads.uploadFile')}
            </button>
          </>
        }
      />

      {/* Filters */}
      <div className="bg-white border border-line rounded-2xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            type="text"
            placeholder={t('common.search') + '...'}
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="px-4 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none text-sm"
          />
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="px-4 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none text-sm"
          >
            <option value="all">{t('common.all')} {t('common.status')}</option>
            <option value="hot">{t('leads.hot')}</option>
            <option value="warm">{t('leads.warm')}</option>
            <option value="cold">{t('leads.cold')}</option>
            <option value="converted">{t('leads.converted')}</option>
          </select>
          <select
            value={filters.category}
            onChange={(e) => setFilters({ ...filters, category: e.target.value })}
            className="px-4 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none text-sm"
          >
            <option value="all">{t('common.all')} {t('common.category')}</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.name}>{cat.name}</option>
            ))}
          </select>
          <button 
            onClick={clearFilters}
            className="px-4 py-2 text-sm border border-line rounded-xl hover:bg-aqua-1/30 transition-colors text-ink font-medium"
          >
            {t('common.clearFilters', 'Clear Filters')}
          </button>
        </div>

        <div className="mt-4 pt-4 border-t border-line">
          <p className="text-xs font-bold text-muted uppercase tracking-wide mb-3">{t('leads.contactFiltersTitle')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {(['age', 'gender', 'country', 'intention'] as const).map((field) => (
              <label key={field} className="block">
                <span className="block text-[11px] text-muted mb-1">{t(`leads.${field}`)}</span>
                <input
                  type="text"
                  value={filters[field]}
                  onChange={(e) => setFilters({ ...filters, [field]: e.target.value })}
                  placeholder={t(`leads.${field}FilterPlaceholder`)}
                  className="w-full px-3 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none text-sm"
                />
              </label>
            ))}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-line">
          <p className="text-xs font-bold text-muted uppercase tracking-wide mb-1">{t('leads.importFiltersTitle')}</p>
          <p className="text-xs text-muted mb-3">{t('leads.importFiltersHelp')}</p>
          <div className="space-y-2">
            {importFilters.map((row, idx) => (
              <div key={idx} className="flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-[160px]">
                  <label className="block text-[11px] text-muted mb-0.5">{t('leads.importFieldLabel')}</label>
                  <input
                    type="text"
                    value={row.field}
                    onChange={(e) => updateImportFilter(idx, { field: e.target.value })}
                    placeholder={t('leads.importFieldPlaceholder')}
                    className="w-full px-3 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none text-sm"
                  />
                </div>
                <div className="flex-1 min-w-[160px]">
                  <label className="block text-[11px] text-muted mb-0.5">{t('leads.importValueLabel')}</label>
                  <input
                    type="text"
                    value={row.value}
                    onChange={(e) => updateImportFilter(idx, { value: e.target.value })}
                    placeholder={t('leads.importValuePlaceholder')}
                    className="w-full px-3 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none text-sm"
                  />
                </div>
                {importFilters.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeImportFilterRow(idx)}
                    className="px-2 py-2 text-sm text-muted hover:text-bad border border-line rounded-xl"
                    title={t('common.delete')}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          {importFilters.length < 6 && (
            <button
              type="button"
              onClick={addImportFilterRow}
              className="mt-2 text-sm font-medium text-aqua-5 hover:underline"
            >
              + {t('leads.addImportFilterRow')}
            </button>
          )}
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-white border border-line rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-aqua-1/30 border-b border-line">
              <tr>
                <th className="text-left text-xs font-bold text-muted uppercase py-3 px-4">{t('common.name')}</th>
                <th className="text-left text-xs font-bold text-muted uppercase py-3 px-4">{t('common.email')}</th>
                <th className="text-left text-xs font-bold text-muted uppercase py-3 px-4">{t('common.phone')}</th>
                <th className="text-left text-xs font-bold text-muted uppercase py-3 px-4">{t('leads.mobile')}</th>
                <th className="text-left text-xs font-bold text-muted uppercase py-3 px-4">{t('leads.age')}</th>
                <th className="text-left text-xs font-bold text-muted uppercase py-3 px-4">{t('leads.gender')}</th>
                <th className="text-left text-xs font-bold text-muted uppercase py-3 px-4">{t('leads.country')}</th>
                <th className="text-left text-xs font-bold text-muted uppercase py-3 px-4">{t('leads.intention')}</th>
                {dynamicImportKeys.map((colKey) => (
                  <th
                    key={colKey}
                    title={colKey}
                    className="text-left text-xs font-bold text-muted uppercase py-3 px-4 max-w-[130px] truncate"
                  >
                    {colKey}
                  </th>
                ))}
                <th className="text-left text-xs font-bold text-muted uppercase py-3 px-4">{t('common.category')}</th>
                <th className="text-left text-xs font-bold text-muted uppercase py-3 px-4">{t('leads.importFile')}</th>
                <th className="text-left text-xs font-bold text-muted uppercase py-3 px-4">{t('common.status')}</th>
                <th className="text-left text-xs font-bold text-muted uppercase py-3 px-4">{t('leads.createdAt')}</th>
                <th className="text-right text-xs font-bold text-muted uppercase py-3 px-4">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {pagedTableRows.map((row) => {
                const fromLegacyFile = row.legacyRowIndex !== null;
                return (
                <tr key={row.rowKey} className="border-b border-line/50 hover:bg-aqua-1/10 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-ink">{displayCell(row.name)}</div>
                    {fromLegacyFile && (
                      <div className="text-xs text-muted mt-0.5">
                        {t('leads.rowFromImport', { n: (row.legacyRowIndex ?? 0) + 1 })}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-sm text-ink max-w-[200px] truncate" title={row.email || undefined}>
                    {displayCell(row.email)}
                  </td>
                  <td className="py-3 px-4 text-sm text-ink whitespace-nowrap">
                    {displayCell(row.phone)}
                  </td>
                  <td className="py-3 px-4 text-sm text-ink whitespace-nowrap">
                    {displayCell(row.mobile)}
                  </td>
                  <td className="py-3 px-4 text-sm text-ink whitespace-nowrap">
                    {displayCell(row.age)}
                  </td>
                  <td className="py-3 px-4 text-sm text-ink whitespace-nowrap">
                    {displayCell(row.gender)}
                  </td>
                  <td className="py-3 px-4 text-sm text-ink whitespace-nowrap">
                    {displayCell(row.country)}
                  </td>
                  <td className="py-3 px-4 text-sm text-ink max-w-[180px] truncate" title={row.intention || undefined}>
                    {displayCell(row.intention)}
                  </td>
                  {dynamicImportKeys.map((colKey) => {
                    const full = rawAttributeCell(row, colKey);
                    return (
                      <td
                        key={colKey}
                        className="py-3 px-4 text-sm text-ink max-w-[150px] truncate"
                        title={full !== '—' ? full : undefined}
                      >
                        {full}
                      </td>
                    );
                  })}
                  <td className="py-3 px-4">
                    <span className="text-sm text-ink">{displayCell(row.category)}</span>
                  </td>
                  <td className="py-3 px-4 text-sm text-muted max-w-[180px] truncate" title={row.file_name}>
                    {displayCell(row.file_name)}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`text-xs px-2 py-1 rounded-full border font-medium ${getStatusBadge(row.status)}`}>
                      {t(`leads.${row.status}`, row.status)}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm text-muted">{new Date(row.created_at).toLocaleDateString()}</span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-2">
                      {(row.phone?.trim() || row.mobile?.trim()) && (
                        <>
                          <button
                            onClick={() => handleStartCall(null, row)}
                            className="p-1.5 hover:bg-blue-100 rounded-lg transition-colors text-blue-600"
                            title={t('leadsPage.startCallNow')}
                          >
                            📞
                          </button>
                          <button
                            onClick={() => openWhatsAppModal(row)}
                            className="p-1.5 hover:bg-green-100 rounded-lg transition-colors text-green-600"
                            title={t('leads.sendWhatsApp')}
                          >
                            💬
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => {
                          setViewingRow(row);
                          setShowViewModal(true);
                        }}
                        className="p-1.5 hover:bg-aqua-1 rounded-lg transition-colors"
                        title={t('leadsPage.viewDetails')}
                      >
                        👁️
                      </button>
                      <button
                        onClick={() => openFollowUpModal(row)}
                        className="p-1.5 hover:bg-aqua-1 rounded-lg transition-colors"
                        title={t('leads.followUps')}
                      >
                        📅
                      </button>
                      <button
                        onClick={() => handleDeleteLead(row)}
                        className="p-1.5 hover:bg-aqua-1 rounded-lg transition-colors text-red-500"
                        title={t('common.delete')}
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {tableRows.length > LEADS_TABLE_ROWS_PER_PAGE && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-t border-line bg-aqua-1/20">
            <p className="text-sm text-muted">
              {t('leads.tableRowPaginationHint', {
                from: contactRowFrom,
                to: contactRowTo,
                total: tableRows.length,
                page: contactTablePage,
                last: contactTableTotalPages,
              })}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={contactTablePage <= 1}
                onClick={() => setContactTablePage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 text-sm border border-line rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t('common.previous')}
              </button>
              <span className="text-sm text-ink font-medium">
                {contactTablePage} / {contactTableTotalPages}
              </span>
              <button
                type="button"
                disabled={contactTablePage >= contactTableTotalPages}
                onClick={() => setContactTablePage((p) => Math.min(contactTableTotalPages, p + 1))}
                className="px-3 py-1.5 text-sm border border-line rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t('common.next')}
              </button>
            </div>
          </div>
        )}
        {paginationMeta.last_page > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-line bg-aqua-1/15">
            <p className="text-sm text-muted">
              <span className="font-medium text-ink">{t('leads.serverPaginationLabel')}</span>
              {' · '}
              {t('leads.paginationHint', {
                current: paginationMeta.current_page,
                last: paginationMeta.last_page,
                total: paginationMeta.total,
              })}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={listPage <= 1}
                onClick={() => setListPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 text-sm border border-line rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t('common.previous')}
              </button>
              <span className="text-sm text-ink font-medium">
                {paginationMeta.current_page} / {paginationMeta.last_page}
              </span>
              <button
                type="button"
                disabled={listPage >= paginationMeta.last_page}
                onClick={() => setListPage((p) => Math.min(paginationMeta.last_page, p + 1))}
                className="px-3 py-1.5 text-sm border border-line rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t('common.next')}
              </button>
            </div>
          </div>
        )}
        {tableRows.length === 0 && !loading && (
          <div className="p-8 text-center text-muted">
            {t('leads.noLeadsFound')}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {(showCreateModal) && (
        <Modal
          isOpen={true}
          title={t('leads.fileUpload')}
          onClose={() => {
            if (uploading || (activeImport && ['queued', 'processing'].includes(activeImport.status))) return;
            setShowCreateModal(false);
            resetUploadForm();
          }}
        >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink mb-1">{t('leads.fileFormat')} *</label>
                <select
                  value={uploadFormData.format}
                  onChange={(e) => setUploadFormData({ ...uploadFormData, format: e.target.value })}
                  className="w-full px-4 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none"
                >
                  <option value="csv">{t('leads.csv')}</option>
                  <option value="excel">{t('leads.excel')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink mb-1">{t('common.category')} *</label>
                <select
                  value={uploadFormData.category}
                  onChange={(e) => setUploadFormData({ ...uploadFormData, category: e.target.value })}
                  className="w-full px-4 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none"
                >
                  <option value="">{t('leads.selectCategory')}</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink mb-1">{t('leads.selectFile')} *</label>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept={LEAD_UPLOAD_ACCEPT}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    const detectedFormat = file ? getLeadUploadFormat(file) : null;

                    if (file && detectedFormat) {
                      setUploadFormData({ ...uploadFormData, file, format: detectedFormat });
                    } else if (file) {
                      alert(t('leads.invalidFileType', 'Please select a CSV, TXT, XLS, or XLSX file.'));
                      e.currentTarget.value = '';
                      setUploadFormData({ ...uploadFormData, file: null });
                    }
                  }}
                  className="w-full px-4 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none"
                />
                <p className="text-xs text-muted mt-1">
                    {t('leads.fileUploadHint', 'First row must be headers. Supported formats: CSV, Excel (.xlsx, .xls)')}
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  if (uploading || (activeImport && ['queued', 'processing'].includes(activeImport.status))) return;
                  setShowCreateModal(false);
                  resetUploadForm();
                }}
                className="flex-1 px-4 py-2 border border-line rounded-xl hover:bg-aqua-1/30 transition-colors text-ink font-medium"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleFileUpload}
                disabled={uploading || !uploadFormData.file || !uploadFormData.category}
                className="flex-1 px-4 py-2 bg-aqua-5 text-white rounded-xl hover:bg-aqua-4 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? t('leads.uploading') : t('leads.upload')}
              </button>
            </div>
            {activeImport && ['queued', 'processing'].includes(activeImport.status) && (
              <div className="mt-4 rounded-xl border border-aqua-5/30 bg-aqua-1/30 p-4 text-sm text-ink">
                <p className="font-semibold">{activeImport.status === 'queued' ? t('leadsPage.importQueued') : t('leadsPage.importProcessing')}</p>
                <p className="mt-1 break-all">{activeImport.file_name}</p>
                <p className="mt-2 text-muted">
                  {activeImport.total_rows
                    ? `${activeImport.processed_rows} / ${activeImport.total_rows} rows processed`
                    : t('leadsPage.preparingSpreadsheet')}
                </p>
                {activeImport.total_rows && (
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                    <div
                      className="h-full bg-aqua-5 transition-all"
                      style={{ width: `${Math.min(100, (activeImport.processed_rows / activeImport.total_rows) * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            )}
            {activeImport?.status === 'queued' && importQueuedAt && Date.now() - importQueuedAt > 30000 && (
              <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                {t('leadsPage.waitingForQueueWorker')}
              </div>
            )}
            {importStatusError && (
              <div className="mt-4 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">
                <p className="font-semibold">{t('leadsPage.importStatusUnavailable')}</p>
                <p className="mt-1 break-words">{importStatusError}</p>
              </div>
            )}
            {activeImport?.status === 'failed' && (
              <div className="mt-4 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">
                <p className="font-semibold">{t('leadsPage.importFailed')}</p>
                <p className="mt-1 break-words">{activeImport.error_message || t('leadsPage.spreadsheetImportFailed')}</p>
              </div>
            )}
        </Modal>
      )}

      {/* View Lead Details Modal */}
      {showViewModal && viewingRow && (
        <Modal
          isOpen={true}
          title={t('leads.viewContactTitle', { name: viewingRow.name })}
          onClose={() => {
            setShowViewModal(false);
            setViewingRow(null);
          }}
        >
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-muted mb-1">{t('common.name')}</label>
                <p className="text-sm text-ink">{displayCell(viewingRow.name)}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">{t('common.email')}</label>
                <p className="text-sm text-ink break-all">{displayCell(viewingRow.email)}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">{t('common.phone')}</label>
                <p className="text-sm text-ink">{displayCell(viewingRow.phone)}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">{t('leads.mobile')}</label>
                <p className="text-sm text-ink">{displayCell(viewingRow.mobile)}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">{t('leads.age')}</label>
                <p className="text-sm text-ink">{displayCell(viewingRow.age)}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">{t('leads.gender')}</label>
                <p className="text-sm text-ink">{displayCell(viewingRow.gender)}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">{t('leads.country')}</label>
                <p className="text-sm text-ink">{displayCell(viewingRow.country)}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">{t('leads.intention')}</label>
                <p className="text-sm text-ink">{displayCell(viewingRow.intention)}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">{t('common.category')}</label>
                <p className="text-sm text-ink">{displayCell(viewingRow.category)}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">{t('common.status')}</label>
                <span className={`text-xs px-2 py-1 rounded-full border font-medium ${getStatusBadge(viewingRow.status)}`}>
                  {viewingRow.status}
                </span>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">{t('leads.source')}</label>
                <p className="text-sm text-ink break-all">{displayCell(viewingRow.source)}</p>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-muted mb-1">{t('leads.importFile')}</label>
                <p className="text-sm text-ink">{displayCell(viewingRow.file_name)}</p>
              </div>
            </div>

            {viewingRow.raw_attributes && Object.keys(viewingRow.raw_attributes).length > 0 && (
              <div>
                <h3 className="font-semibold text-ink mb-2">{t('leads.allImportFields')}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {Object.entries(viewingRow.raw_attributes).map(([key, val]) => (
                    <div key={key} className="border border-line rounded-lg p-3 bg-aqua-1/20">
                      <div className="text-xs font-medium text-muted mb-1">{key}</div>
                      <div className="text-sm text-ink break-words">{val?.trim() ? val : '—'}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {viewingRow.legacyBatch?.file_headers && viewingRow.legacyBatch.file_headers.length > 0 && (
              <div>
                <h3 className="font-semibold text-ink mb-2">{t('leads.fileHeaders')}</h3>
                <div className="bg-aqua-1/30 p-3 rounded-lg">
                  <div className="flex flex-wrap gap-2">
                    {viewingRow.legacyBatch.file_headers.map((header, idx) => (
                      <span key={idx} className="text-xs px-2 py-1 bg-white border border-line rounded text-ink">
                        {header}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {viewingRow.legacyBatch?.file_records && viewingRow.legacyBatch.file_records.length > 0 && (
              <div>
                <h3 className="font-semibold text-ink mb-2">
                  {t('leads.embeddedRecordsTitle', { count: viewingRow.legacyBatch.file_records.length })}
                </h3>
                <div className="overflow-x-auto border border-line rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-aqua-1/30 border-b border-line">
                      <tr>
                        {viewingRow.legacyBatch.file_headers?.map((header, idx) => (
                          <th key={idx} className="text-left text-xs font-bold text-muted uppercase py-2 px-3">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {viewingRow.legacyBatch.file_records.slice(0, 100).map((record, rowIdx) => (
                        <tr
                          key={rowIdx}
                          className={`border-b border-line/50 hover:bg-aqua-1/10 ${
                            viewingRow.legacyRowIndex === rowIdx ? 'bg-aqua-3/25' : ''
                          }`}
                        >
                          {record.map((cell, cellIdx) => (
                            <td key={cellIdx} className="py-2 px-3 text-ink">
                              {cell || '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {viewingRow.legacyBatch.file_records.length > 100 && (
                    <div className="p-3 text-center text-xs text-muted bg-aqua-1/10">
                      {t('leads.embeddedRecordsTruncated', {
                        shown: 100,
                        total: viewingRow.legacyBatch.file_records.length,
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* WhatsApp Modal */}
      {showWhatsAppModal && actionContactRow && (
        <Modal
          isOpen={true}
          title={t('leadsPage.sendWhatsAppTitle')}
          onClose={() => {
            setShowWhatsAppModal(false);
            setWhatsAppMessage('');
            setActionContactRow(null);
          }}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-1">{t('leads.whatsAppMessage')}</label>
              <textarea
                value={whatsAppMessage}
                onChange={(e) => setWhatsAppMessage(e.target.value)}
                rows={4}
                className="w-full px-4 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none"
                placeholder={t('leadsPage.messagePlaceholder')}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowWhatsAppModal(false);
                  setWhatsAppMessage('');
                  setActionContactRow(null);
                }}
                className="flex-1 px-4 py-2 border border-line rounded-xl hover:bg-aqua-1/30 transition-colors text-ink font-medium"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSendWhatsApp}
                disabled={whatsAppSending || !whatsAppMessage.trim()}
                className="flex-1 px-4 py-2 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {whatsAppSending ? t('leads.sending') : t('leadsPage.sendMessage')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Follow-ups Modal */}
      {showFollowUpModal && selectedLeadId && (
        <Modal
          isOpen={true}
          title={t('leads.followUps')}
          onClose={() => {
            setShowFollowUpModal(false);
            resetFollowUpForm();
          }}
        >
            {/* Follow-ups List */}
            <div className="mb-6 space-y-3 max-h-64 overflow-y-auto">
              {followUps[selectedLeadId]?.length > 0 ? (
                followUps[selectedLeadId].map((followUp) => (
                  <div
                    key={followUp.id}
                    className={`p-4 border rounded-xl ${
                      followUp.status === 'completed' ? 'bg-green-50 border-green-200' :
                      followUp.status === 'overdue' ? 'bg-red-50 border-red-200' :
                      'bg-white border-line'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">{getFollowUpTypeIcon(followUp.type)}</span>
                          <span className="font-semibold text-ink">{followUp.title}</span>
                          <span className={`text-xs px-2 py-0.5 rounded ${getPriorityColor(followUp.priority)} bg-opacity-10`}>
                            {t(`leads.${followUp.priority}`)}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            followUp.status === 'completed' ? 'bg-green-100 text-green-800' :
                            followUp.status === 'overdue' ? 'bg-red-100 text-red-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {t(`leads.${followUp.status}`)}
                          </span>
                        </div>
                        {followUp.notes && (
                          <p className="text-sm text-muted mb-2">{followUp.notes}</p>
                        )}
                        <div className="text-xs text-muted">
                          {t('leadsPage.scheduledAt', { date: new Date(followUp.scheduled_at).toLocaleString() })}
                          {followUp.completed_at && (
                            <> • {t('leadsPage.completedAt', { date: new Date(followUp.completed_at).toLocaleString() })}</>
                          )}
                        </div>
                        {followUp.outcome && (
                          <div className="mt-2 text-sm text-ink bg-gray-50 p-2 rounded">
                            <strong>{t('leadsPage.outcomeLabel')}</strong> {followUp.outcome}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 ml-4">
                        {followUp.type === 'call' && followUp.status === 'scheduled' && (
                          <button
                            onClick={() => handleStartCall(followUp, actionContactRow)}
                            className="px-3 py-1 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-1"
                            title={t('leadsPage.startCall')}
                          >
                            📞 {t('leadsPage.startCall')}
                          </button>
                        )}
                        {followUp.status !== 'completed' && (
                          <button
                            onClick={() => handleCompleteFollowUp(followUp.id, selectedLeadId)}
                            className="px-3 py-1 text-xs bg-green-500 text-white rounded-lg hover:bg-green-600"
                          >
                            ✓ {t('leadsPage.completeFollowUp')}
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteFollowUp(followUp.id, selectedLeadId)}
                          className="px-3 py-1 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-muted py-8">{t('leadsPage.noFollowUpsScheduled')}</div>
              )}
            </div>

            {/* Create Follow-up Form */}
            <div className="border-t border-line pt-4">
              <h3 className="font-semibold text-ink mb-4">{t('leadsPage.scheduleNewFollowUp')}</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-ink mb-1">{t('leads.followUpTitle')} *</label>
                  <input
                    type="text"
                    value={followUpFormData.title}
                    onChange={(e) => setFollowUpFormData({ ...followUpFormData, title: e.target.value })}
                    className="w-full px-4 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none"
                    placeholder={t('leadsPage.followUpTitlePlaceholder')}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-ink mb-1">{t('leads.followUpType')} *</label>
                    <select
                      value={followUpFormData.type}
                      onChange={(e) => setFollowUpFormData({ ...followUpFormData, type: e.target.value as FollowUp['type'] })}
                      className="w-full px-4 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none"
                    >
                      <option value="call">📞 {t('leads.call')}</option>
                      <option value="email">📧 {t('leads.email')}</option>
                      <option value="meeting">🤝 {t('leads.meeting')}</option>
                      <option value="message">💬 {t('leads.message')}</option>
                      <option value="other">📝 {t('leads.other')}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-ink mb-1">{t('leads.followUpPriority')}</label>
                    <select
                      value={followUpFormData.priority}
                      onChange={(e) => setFollowUpFormData({ ...followUpFormData, priority: e.target.value as FollowUp['priority'] })}
                      className="w-full px-4 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none"
                    >
                      <option value="low">{t('leads.low')}</option>
                      <option value="medium">{t('leads.medium')}</option>
                      <option value="high">{t('leads.high')}</option>
                      <option value="urgent">{t('leads.urgent')}</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink mb-1">{t('leadsPage.scheduledDateTime')}</label>
                  <input
                    type="datetime-local"
                    value={followUpFormData.scheduled_at}
                    onChange={(e) => setFollowUpFormData({ ...followUpFormData, scheduled_at: e.target.value })}
                    className="w-full px-4 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink mb-1">{t('common.notes')}</label>
                  <textarea
                    value={followUpFormData.notes}
                    onChange={(e) => setFollowUpFormData({ ...followUpFormData, notes: e.target.value })}
                    className="w-full px-4 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none"
                    rows={3}
                    placeholder={t('leadsPage.followUpNotesPlaceholder')}
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowFollowUpModal(false);
                      resetFollowUpForm();
                    }}
                    className="flex-1 px-4 py-2 border border-line rounded-xl hover:bg-aqua-1/30 transition-colors text-ink font-medium"
                  >
                    {t('common.close')}
                  </button>
                  <button
                    onClick={handleCreateFollowUp}
                    className="flex-1 px-4 py-2 bg-aqua-5 text-white rounded-xl hover:bg-aqua-4 transition-colors font-semibold"
                  >
                    {t('leadsPage.scheduleFollowUp')}
                  </button>
                </div>
              </div>
            </div>
        </Modal>
      )}
    </div>
  );
}
