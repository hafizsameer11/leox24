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
  filterTableRowsByImportFilters,
  type ImportFilter,
} from '../utils/leadTableRows';

type Lead = ApiLead;

/** Renders only this many table body rows at a time (legacy imports expand to many contacts). */
const LEADS_TABLE_ROWS_PER_PAGE = 25;

function displayCell(value?: string | null): string {
  const s = value != null ? String(value).trim() : '';
  return s || '—';
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
    const timer = setTimeout(() => setDebouncedImportFilters(importFilters), 400);
    return () => clearTimeout(timer);
  }, [importFilters]);

  useEffect(() => {
    setListPage(1);
  }, [filters.status, filters.source, filters.category, debouncedSearch, debouncedImportFilters]);

  useEffect(() => {
    setContactTablePage(1);
  }, [listPage, filters.status, filters.source, filters.category, debouncedSearch, debouncedImportFilters]);

  useEffect(() => {
    void fetchLeads();
  }, [listPage, filters.status, filters.source, filters.category, debouncedSearch, debouncedImportFilters]);

  useEffect(() => {
    fetchCategories();
  }, []);

  const tableRows = useMemo(() => {
    const expanded = expandApiLeadsToTableRows(leads);
    const searched = filterTableRowsBySearch(expanded, debouncedSearch);
    return filterTableRowsByImportFilters(searched, debouncedImportFilters);
  }, [leads, debouncedSearch, debouncedImportFilters]);

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
      alert(error.response?.data?.message || 'Failed to export leads. Please try again.');
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
    try {
      if (!uploadFormData.file) {
        alert(t('leads.selectFile') + ' ' + t('common.required', 'required'));
        return;
      }
      if (!uploadFormData.category) {
        alert(t('leads.selectCategory'));
        return;
      }

      const formData = new FormData();
      formData.append('file', uploadFormData.file);
      formData.append('format', uploadFormData.format);
      formData.append('category', uploadFormData.category);

      const response = await api.post('/leads', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      console.log('Lead file uploaded successfully:', response.data);

      setShowCreateModal(false);
      resetUploadForm();
      await fetchLeads(1);
      setListPage(1);

      const imported = response.data?.imported_count;
      if (typeof imported === 'number') {
        alert(t('leads.uploadSuccessCount', { count: imported }));
      } else {
        alert(t('leads.uploadSuccess'));
      }
    } catch (error: any) {
      console.error('Failed to upload lead file:', error);
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          'Failed to upload lead file. Please try again.';
      alert(`Error: ${errorMessage}`);
    }
  };

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
      alert('Failed to delete lead. Please try again.');
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
        alert('Please fill in title and scheduled date');
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
      alert('Follow-up scheduled successfully!');
    } catch (error: any) {
      console.error('Failed to create follow-up:', error);
      alert(error.response?.data?.message || 'Failed to create follow-up');
    }
  };

  const handleCompleteFollowUp = async (followUpId: number, leadId: number) => {
    try {
      const outcome = prompt('Enter outcome/notes:');
      if (outcome === null) return; // User cancelled

      await api.post(`/follow-ups/${followUpId}/complete`, { outcome });
      await fetchFollowUps(leadId);
      alert('Follow-up marked as completed!');
    } catch (error: any) {
      console.error('Failed to complete follow-up:', error);
      alert(error.response?.data?.message || 'Failed to complete follow-up');
    }
  };

  const handleDeleteFollowUp = async (followUpId: number, leadId: number) => {
    if (!confirm('Are you sure you want to delete this follow-up?')) return;

    try {
      await api.delete(`/follow-ups/${followUpId}`);
      await fetchFollowUps(leadId);
    } catch (error: any) {
      console.error('Failed to delete follow-up:', error);
      alert(error.response?.data?.message || 'Failed to delete follow-up');
    }
  };

  const handleStartCall = async (followUp: FollowUp | null, row: LeadTableRow | null) => {
    try {
      if (!row?.phone?.trim()) {
        alert(t('leads.noPhoneForCall'));
        return;
      }

      // Do not send customer_id: leads are not customers (validation would fail).
      const callPayload: Record<string, unknown> = {
        contact_name: row.name,
        contact_phone: row.phone,
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

      alert(`Call started! Call ID: ${response.data.id}\n\nYou can complete the call from the Calls page.`);

      if (followUp && selectedLeadId) {
        await fetchFollowUps(selectedLeadId);
      }
    } catch (error: any) {
      console.error('Failed to start call:', error);
      alert(error.response?.data?.message || 'Failed to start call. Please try again.');
    }
  };

  const openWhatsAppModal = (row: LeadTableRow) => {
    if (!row.phone?.trim()) {
      alert(t('leads.noPhoneForCall'));
      return;
    }
    setActionContactRow(row);
    setWhatsAppMessage('');
    setShowWhatsAppModal(true);
  };

  const handleSendWhatsApp = async () => {
    if (!actionContactRow?.phone || !whatsAppMessage.trim()) {
      alert('Please enter a message');
      return;
    }

    try {
      setWhatsAppSending(true);
      await api.post('/communications/whatsapp/send', {
        to: actionContactRow.phone,
        message: whatsAppMessage,
      });

      alert('WhatsApp message sent successfully!');
      setShowWhatsAppModal(false);
      setWhatsAppMessage('');
      setActionContactRow(null);
    } catch (error: any) {
      console.error('Failed to send WhatsApp message:', error);
      alert(error.response?.data?.message || 'Failed to send WhatsApp message. Please check Twilio configuration.');
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
              onClick={() => setShowCreateModal(true)}
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
                  <td className="py-3 px-4">
                    <span className="text-sm text-ink">{displayCell(row.category)}</span>
                  </td>
                  <td className="py-3 px-4 text-sm text-muted max-w-[180px] truncate" title={row.file_name}>
                    {displayCell(row.file_name)}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`text-xs px-2 py-1 rounded-full border font-medium ${getStatusBadge(row.status)}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm text-muted">{new Date(row.created_at).toLocaleDateString()}</span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-2">
                      {row.phone?.trim() && (
                        <>
                          <button
                            onClick={() => handleStartCall(null, row)}
                            className="p-1.5 hover:bg-blue-100 rounded-lg transition-colors text-blue-600"
                            title="Start Call Now"
                          >
                            📞
                          </button>
                          <button
                            onClick={() => openWhatsAppModal(row)}
                            className="p-1.5 hover:bg-green-100 rounded-lg transition-colors text-green-600"
                            title="Send WhatsApp"
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
                        title="View Details"
                      >
                        👁️
                      </button>
                      <button
                        onClick={() => openFollowUpModal(row)}
                        className="p-1.5 hover:bg-aqua-1 rounded-lg transition-colors"
                        title="Follow-ups"
                      >
                        📅
                      </button>
                      <button
                        onClick={() => handleDeleteLead(row)}
                        className="p-1.5 hover:bg-aqua-1 rounded-lg transition-colors text-red-500"
                        title="Delete"
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
                  accept=".csv,.txt,.xlsx,.xls"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                        setUploadFormData({ ...uploadFormData, file: e.target.files[0] });
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
                  setShowCreateModal(false);
                  resetUploadForm();
                }}
                className="flex-1 px-4 py-2 border border-line rounded-xl hover:bg-aqua-1/30 transition-colors text-ink font-medium"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleFileUpload}
                disabled={!uploadFormData.file || !uploadFormData.category}
                className="flex-1 px-4 py-2 bg-aqua-5 text-white rounded-xl hover:bg-aqua-4 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('leads.upload')}
              </button>
            </div>
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
          title="Send WhatsApp Message"
          onClose={() => {
            setShowWhatsAppModal(false);
            setWhatsAppMessage('');
            setActionContactRow(null);
          }}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Message</label>
              <textarea
                value={whatsAppMessage}
                onChange={(e) => setWhatsAppMessage(e.target.value)}
                rows={4}
                className="w-full px-4 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none"
                placeholder="Type your message here..."
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
                Cancel
              </button>
              <button
                onClick={handleSendWhatsApp}
                disabled={whatsAppSending || !whatsAppMessage.trim()}
                className="flex-1 px-4 py-2 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {whatsAppSending ? 'Sending...' : 'Send Message'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Follow-ups Modal */}
      {showFollowUpModal && selectedLeadId && (
        <Modal
          isOpen={true}
          title="Follow-ups"
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
                            {followUp.priority}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            followUp.status === 'completed' ? 'bg-green-100 text-green-800' :
                            followUp.status === 'overdue' ? 'bg-red-100 text-red-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {followUp.status}
                          </span>
                        </div>
                        {followUp.notes && (
                          <p className="text-sm text-muted mb-2">{followUp.notes}</p>
                        )}
                        <div className="text-xs text-muted">
                          Scheduled: {new Date(followUp.scheduled_at).toLocaleString()}
                          {followUp.completed_at && (
                            <> • Completed: {new Date(followUp.completed_at).toLocaleString()}</>
                          )}
                        </div>
                        {followUp.outcome && (
                          <div className="mt-2 text-sm text-ink bg-gray-50 p-2 rounded">
                            <strong>Outcome:</strong> {followUp.outcome}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 ml-4">
                        {followUp.type === 'call' && followUp.status === 'scheduled' && (
                          <button
                            onClick={() => handleStartCall(followUp, actionContactRow)}
                            className="px-3 py-1 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-1"
                            title="Start Call"
                          >
                            📞 Start Call
                          </button>
                        )}
                        {followUp.status !== 'completed' && (
                          <button
                            onClick={() => handleCompleteFollowUp(followUp.id, selectedLeadId)}
                            className="px-3 py-1 text-xs bg-green-500 text-white rounded-lg hover:bg-green-600"
                          >
                            ✓ Complete
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
                <div className="text-center text-muted py-8">No follow-ups scheduled</div>
              )}
            </div>

            {/* Create Follow-up Form */}
            <div className="border-t border-line pt-4">
              <h3 className="font-semibold text-ink mb-4">Schedule New Follow-up</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-ink mb-1">Title *</label>
                  <input
                    type="text"
                    value={followUpFormData.title}
                    onChange={(e) => setFollowUpFormData({ ...followUpFormData, title: e.target.value })}
                    className="w-full px-4 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none"
                    placeholder="e.g., Call to discuss pricing"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-ink mb-1">Type *</label>
                    <select
                      value={followUpFormData.type}
                      onChange={(e) => setFollowUpFormData({ ...followUpFormData, type: e.target.value as FollowUp['type'] })}
                      className="w-full px-4 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none"
                    >
                      <option value="call">📞 Call</option>
                      <option value="email">📧 Email</option>
                      <option value="meeting">🤝 Meeting</option>
                      <option value="message">💬 Message</option>
                      <option value="other">📝 Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-ink mb-1">Priority</label>
                    <select
                      value={followUpFormData.priority}
                      onChange={(e) => setFollowUpFormData({ ...followUpFormData, priority: e.target.value as FollowUp['priority'] })}
                      className="w-full px-4 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink mb-1">Scheduled Date & Time *</label>
                  <input
                    type="datetime-local"
                    value={followUpFormData.scheduled_at}
                    onChange={(e) => setFollowUpFormData({ ...followUpFormData, scheduled_at: e.target.value })}
                    className="w-full px-4 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink mb-1">Notes</label>
                  <textarea
                    value={followUpFormData.notes}
                    onChange={(e) => setFollowUpFormData({ ...followUpFormData, notes: e.target.value })}
                    className="w-full px-4 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none"
                    rows={3}
                    placeholder="Additional notes about this follow-up..."
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
                    Close
                  </button>
                  <button
                    onClick={handleCreateFollowUp}
                    className="flex-1 px-4 py-2 bg-aqua-5 text-white rounded-xl hover:bg-aqua-4 transition-colors font-semibold"
                  >
                    Schedule Follow-up
                  </button>
                </div>
              </div>
            </div>
        </Modal>
      )}
    </div>
  );
}
