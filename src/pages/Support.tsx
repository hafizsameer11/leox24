import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import Topbar from '../components/layout/Topbar';
import { useAuthStore } from '../stores/authStore';

interface Customer {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email: string;
  company_name?: string | null;
}

interface User {
  id: number;
  name: string;
  email: string;
}

interface SupportTicket {
  id: number;
  ticket_number: string;
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  type: 'technical' | 'billing' | 'feature_request' | 'bug' | 'other';
  company_id: number | null;
  customer_id: number | null;
  customer: Customer | null;
  assigned_to: number | null;
  assignee: User | null;
  creator: User | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  source: string | null;
  channel: string | null;
  category: string | null;
  resolution: string | null;
  first_response_at: string | null;
  resolution_due_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface PaginatedResponse {
  data: SupportTicket[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

interface Company {
  id: number;
  name: string;
  status: string;
}

export default function Support() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const isSuperAdmin = user?.role === 'super_admin';
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [filters, setFilters] = useState({
    status: 'all',
    priority: 'all',
    type: 'all',
    search: '',
  });
  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
    per_page: 15,
    total: 0,
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTicket, setEditingTicket] = useState<SupportTicket | null>(null);
  const [formData, setFormData] = useState({
    subject: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    type: 'other' as 'technical' | 'billing' | 'feature_request' | 'bug' | 'other',
    status: 'open' as 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed',
    company_id: '',
    customer_id: '',
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    source: '',
    channel: '',
    category: '',
    resolution: '',
  });

  useEffect(() => {
    fetchTickets();
  }, [filters, pagination.current_page]);

  useEffect(() => {
    if (isSuperAdmin && showCreateModal) {
      fetchCompanies();
    }
  }, [isSuperAdmin, showCreateModal]);

  const fetchCompanies = async () => {
    try {
      const response = await api.get('/companies', { params: { per_page: 1000 } });
      setCompanies(response.data.data || response.data || []);
    } catch (error) {
      console.error('Failed to fetch companies:', error);
    }
  };

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const params: any = {
        page: pagination.current_page,
        per_page: pagination.per_page,
      };

      if (filters.status !== 'all') {
        params.status = filters.status;
      }
      if (filters.priority !== 'all') {
        params.priority = filters.priority;
      }
      if (filters.type !== 'all') {
        params.type = filters.type;
      }
      if (filters.search) {
        params.search = filters.search;
      }

      const response = await api.get<PaginatedResponse>('/support-tickets', { params });
      setTickets(response.data.data || []);
      setPagination({
        current_page: response.data.current_page,
        last_page: response.data.last_page,
        per_page: response.data.per_page,
        total: response.data.total,
      });
    } catch (error) {
      console.error('Failed to fetch support tickets:', error);
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTicket = async () => {
    try {
      // For super_admin, company_id is required
      if (isSuperAdmin && !formData.company_id) {
        alert(t('support.selectCompany', 'Please select a company to create the ticket.'));
        return;
      }

      const payload: any = {
        subject: formData.subject,
        description: formData.description,
        priority: formData.priority,
        type: formData.type,
        status: formData.status,
      };

      // Add company_id for super_admin
      if (isSuperAdmin && formData.company_id) {
        payload.company_id = parseInt(formData.company_id);
      }

      if (formData.customer_id) {
        payload.customer_id = parseInt(formData.customer_id);
      } else {
        if (formData.customer_name) payload.customer_name = formData.customer_name;
        if (formData.customer_email) payload.customer_email = formData.customer_email;
        if (formData.customer_phone) payload.customer_phone = formData.customer_phone;
      }

      if (formData.source) payload.source = formData.source;
      if (formData.channel) payload.channel = formData.channel;
      if (formData.category) payload.category = formData.category;

      await api.post('/support-tickets', payload);
      setShowCreateModal(false);
      resetForm();
      fetchTickets();
    } catch (error: any) {
      console.error('Failed to create ticket:', error);
      alert(error.response?.data?.message || t('support.createFailed', 'Failed to create ticket. Please try again.'));
    }
  };

  const handleUpdateTicket = async () => {
    if (!editingTicket) return;

    try {
      const payload: any = {};

      if (formData.subject !== editingTicket.subject) payload.subject = formData.subject;
      if (formData.description !== editingTicket.description) payload.description = formData.description;
      if (formData.priority !== editingTicket.priority) payload.priority = formData.priority;
      if (formData.type !== editingTicket.type) payload.type = formData.type;
      if (formData.status !== editingTicket.status) payload.status = formData.status;
      if (formData.resolution !== (editingTicket.resolution || '')) payload.resolution = formData.resolution;

      if (formData.customer_id) {
        payload.customer_id = parseInt(formData.customer_id);
      } else {
        if (formData.customer_name !== (editingTicket.customer_name || '')) payload.customer_name = formData.customer_name;
        if (formData.customer_email !== (editingTicket.customer_email || '')) payload.customer_email = formData.customer_email;
        if (formData.customer_phone !== (editingTicket.customer_phone || '')) payload.customer_phone = formData.customer_phone;
      }

      if (formData.source !== (editingTicket.source || '')) payload.source = formData.source;
      if (formData.channel !== (editingTicket.channel || '')) payload.channel = formData.channel;
      if (formData.category !== (editingTicket.category || '')) payload.category = formData.category;

      await api.put(`/support-tickets/${editingTicket.id}`, payload);
      setEditingTicket(null);
      resetForm();
      fetchTickets();
    } catch (error) {
      console.error('Failed to update ticket:', error);
      alert(t('support.updateFailed', 'Failed to update ticket. Please try again.'));
    }
  };

  const handleDeleteTicket = async (ticketId: number) => {
    if (!confirm(t('support.deleteConfirm', 'Are you sure you want to delete this ticket?'))) {
      return;
    }

    try {
      await api.delete(`/support-tickets/${ticketId}`);
      fetchTickets();
    } catch (error) {
      console.error('Failed to delete ticket:', error);
      alert(t('support.deleteFailed', 'Failed to delete ticket. Please try again.'));
    }
  };

  const handleCloseTicket = async (ticket: SupportTicket) => {
    const resolution = prompt(t('support.resolutionPrompt'));
    if (resolution === null) return;

    try {
      await api.post(`/support-tickets/${ticket.id}/close`, { resolution });
      fetchTickets();
    } catch (error) {
      console.error('Failed to close ticket:', error);
      alert(t('support.closeFailed', 'Failed to close ticket. Please try again.'));
    }
  };

  const resetForm = () => {
    setFormData({
      subject: '',
      description: '',
      priority: 'medium',
      type: 'other',
      status: 'open',
      company_id: '',
      customer_id: '',
      customer_name: '',
      customer_email: '',
      customer_phone: '',
      source: '',
      channel: '',
      category: '',
      resolution: '',
    });
  };

  const openEditModal = (ticket: SupportTicket) => {
    setEditingTicket(ticket);
    setFormData({
      subject: ticket.subject,
      description: ticket.description,
      priority: ticket.priority,
      type: ticket.type,
      status: ticket.status,
      company_id: ticket.company_id ? String(ticket.company_id) : '',
      customer_id: ticket.customer_id ? String(ticket.customer_id) : '',
      customer_name: ticket.customer_name || '',
      customer_email: ticket.customer_email || '',
      customer_phone: ticket.customer_phone || '',
      source: ticket.source || '',
      channel: ticket.channel || '',
      category: ticket.category || '',
      resolution: ticket.resolution || '',
    });
  };

  const clearFilters = () => {
    setFilters({
      status: 'all',
      priority: 'all',
      type: 'all',
      search: '',
    });
    setPagination((prev) => ({ ...prev, current_page: 1 }));
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      open: 'bg-blue-100 text-blue-700 border-blue-300',
      in_progress: 'bg-yellow-100 text-yellow-700 border-yellow-300',
      waiting_customer: 'bg-orange-100 text-orange-700 border-orange-300',
      resolved: 'bg-green-100 text-green-700 border-green-300',
      closed: 'bg-gray-100 text-gray-700 border-gray-300',
    };
    return styles[status] || 'bg-gray-100 text-gray-700 border-gray-300';
  };

  const getPriorityBadge = (priority: string) => {
    const styles: Record<string, string> = {
      low: 'bg-green-100 text-green-700 border-green-300',
      medium: 'bg-yellow-100 text-yellow-700 border-yellow-300',
      high: 'bg-orange-100 text-orange-700 border-orange-300',
      urgent: 'bg-red-100 text-red-700 border-red-300',
    };
    return styles[priority] || 'bg-gray-100 text-gray-700 border-gray-300';
  };

  const formatStatus = (status: string) => {
    const statusKeys: Record<string, string> = {
      open: 'support.open',
      in_progress: 'support.inProgress',
      waiting_customer: 'support.waitingCustomer',
      resolved: 'support.resolved',
      closed: 'support.closed',
    };
    return t(statusKeys[status] || status);
  };

  const formatPriority = (priority: string) => {
    const priorityKeys: Record<string, string> = {
      low: 'leads.low',
      medium: 'leads.medium',
      high: 'leads.high',
      urgent: 'leads.urgent',
    };
    return t(priorityKeys[priority] || priority);
  };

  const formatType = (type: string) => {
    const typeKeys: Record<string, string> = {
      technical: 'support.technical',
      billing: 'support.billing',
      feature_request: 'support.featureRequest',
      bug: 'support.bug',
      other: 'leads.other',
    };
    return t(typeKeys[type] || type);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('it-IT', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getCustomerName = (ticket: SupportTicket) => {
    if (ticket.customer) {
      if (ticket.customer.company_name) return ticket.customer.company_name;
      const name = `${ticket.customer.first_name || ''} ${ticket.customer.last_name || ''}`.trim();
      return name || ticket.customer.email || '-';
    }
    return ticket.customer_name || '-';
  };

  const handlePageChange = (page: number) => {
    setPagination((prev) => ({ ...prev, current_page: page }));
  };

  if (loading && tickets.length === 0) {
    return (
      <div className="space-y-6">
        <Topbar
          title={t('support.ticketsTitle')}
          subtitle={t('support.ticketsSubtitle')}
          actions={
            <>
              <button className="px-4 py-2 text-sm border border-line rounded-xl hover:bg-aqua-1/30 transition-colors text-ink font-medium">
                {t('common.refresh')}
              </button>
              <button className="px-4 py-2 text-sm border border-aqua-5/35 bg-gradient-to-r from-aqua-3/45 to-aqua-5/14 rounded-xl hover:shadow-lg hover:shadow-aqua-5/10 transition-all text-ink font-semibold">
                🛠️ {t('support.newTicket')}
              </button>
            </>
          }
        />
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-aqua-5"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Topbar
        title={t('support.ticketsTitle')}
        subtitle={t('support.ticketsSubtitle')}
        actions={
          <>
            <button
              onClick={fetchTickets}
              className="px-4 py-2 text-sm border border-line rounded-xl hover:bg-aqua-1/30 transition-colors text-ink font-medium"
            >
              🔄 {t('common.refresh')}
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 text-sm border border-aqua-5/35 bg-gradient-to-r from-aqua-3/45 to-aqua-5/14 rounded-xl hover:shadow-lg hover:shadow-aqua-5/10 transition-all text-ink font-semibold"
            >
              🛠️ {t('support.newTicket')}
            </button>
          </>
        }
      />

      {/* Filters */}
      <div className="bg-white border border-line rounded-2xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <input
            type="text"
            placeholder={t('support.searchPlaceholder')}
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="px-3 py-2 text-sm border border-line rounded-xl focus:outline-none focus:ring-2 focus:ring-aqua-5/20"
          />
          <select
            value={filters.status}
            onChange={(e) => {
              setFilters({ ...filters, status: e.target.value });
              setPagination((prev) => ({ ...prev, current_page: 1 }));
            }}
            className="px-3 py-2 text-sm border border-line rounded-xl focus:outline-none focus:ring-2 focus:ring-aqua-5/20"
          >
            <option value="all">{t('common.allStatus')}</option>
            <option value="open">{t('support.open')}</option>
            <option value="in_progress">{t('support.inProgress')}</option>
            <option value="waiting_customer">{t('support.waitingCustomer')}</option>
            <option value="resolved">{t('support.resolved')}</option>
            <option value="closed">{t('support.closed')}</option>
          </select>
          <select
            value={filters.priority}
            onChange={(e) => {
              setFilters({ ...filters, priority: e.target.value });
              setPagination((prev) => ({ ...prev, current_page: 1 }));
            }}
            className="px-3 py-2 text-sm border border-line rounded-xl focus:outline-none focus:ring-2 focus:ring-aqua-5/20"
          >
            <option value="all">{t('support.allPriorities', 'All Priorities')}</option>
            <option value="low">{t('leads.low')}</option>
            <option value="medium">{t('leads.medium')}</option>
            <option value="high">{t('leads.high')}</option>
            <option value="urgent">{t('leads.urgent')}</option>
          </select>
          <select
            value={filters.type}
            onChange={(e) => {
              setFilters({ ...filters, type: e.target.value });
              setPagination((prev) => ({ ...prev, current_page: 1 }));
            }}
            className="px-3 py-2 text-sm border border-line rounded-xl focus:outline-none focus:ring-2 focus:ring-aqua-5/20"
          >
            <option value="all">{t('common.allTypes')}</option>
            <option value="technical">{t('support.technical')}</option>
            <option value="billing">{t('support.billing')}</option>
            <option value="feature_request">{t('support.featureRequest')}</option>
            <option value="bug">{t('support.bug')}</option>
            <option value="other">{t('leads.other')}</option>
          </select>
          <button
            onClick={clearFilters}
            className="px-4 py-2 text-sm border border-line rounded-xl hover:bg-aqua-1/30 transition-colors text-ink font-medium"
          >
            {t('common.clearFilters')}
          </button>
        </div>
      </div>

      {/* Tickets Table */}
      <div className="bg-white border border-line rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-aqua-5"></div>
          </div>
        ) : tickets.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-muted text-lg mb-2">{t('support.noTickets')}</p>
            <p className="text-muted text-sm">{t('support.createFirst')}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-aqua-1/30 border-b border-line">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-muted uppercase">{t('support.ticketNumber')}</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-muted uppercase">{t('support.subject')}</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-muted uppercase">{t('sales.customer')}</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-muted uppercase">{t('common.status')}</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-muted uppercase">{t('common.priority')}</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-muted uppercase">{t('common.type')}</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-muted uppercase">{t('support.assignedTo')}</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-muted uppercase">{t('support.createdAt')}</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-muted uppercase">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => (
                    <tr
                      key={ticket.id}
                      className="border-b border-line/50 hover:bg-aqua-1/20 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="text-sm font-semibold text-ink">{ticket.ticket_number}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-ink">{ticket.subject}</div>
                        <div className="text-xs text-muted mt-1 line-clamp-1">{ticket.description}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-ink">{getCustomerName(ticket)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusBadge(
                            ticket.status
                          )}`}
                        >
                          {formatStatus(ticket.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getPriorityBadge(
                            ticket.priority
                          )}`}
                        >
                          {formatPriority(ticket.priority)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted">
                        {formatType(ticket.type)}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted">
                        {ticket.assignee?.name || t('support.unassigned', 'Unassigned')}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted">{formatDate(ticket.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(ticket)}
                            className="p-1.5 hover:bg-aqua-1 rounded-lg transition-colors"
                            title={t('common.edit')}
                          >
                            ✏️
                          </button>
                          {ticket.status !== 'closed' && (
                            <button
                              onClick={() => handleCloseTicket(ticket)}
                              className="p-1.5 hover:bg-aqua-1 rounded-lg transition-colors text-green-600"
                              title={t('common.close')}
                            >
                              ✓
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteTicket(ticket.id)}
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

            {/* Pagination */}
            {pagination.last_page > 1 && (
              <div className="px-4 py-3 border-t border-line flex items-center justify-between">
                <div className="text-sm text-muted">
                  {t('common.showingRange', {
                    from: ((pagination.current_page - 1) * pagination.per_page) + 1,
                    to: Math.min(pagination.current_page * pagination.per_page, pagination.total),
                    total: pagination.total,
                    entity: t('support.tickets', 'tickets').toLowerCase(),
                  })}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePageChange(pagination.current_page - 1)}
                    disabled={pagination.current_page === 1}
                    className="px-3 py-1 text-sm border border-line rounded-lg hover:bg-aqua-1/30 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t('common.previous')}
                  </button>
                  <button
                    onClick={() => handlePageChange(pagination.current_page + 1)}
                    disabled={pagination.current_page === pagination.last_page}
                    className="px-3 py-1 text-sm border border-line rounded-lg hover:bg-aqua-1/30 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t('common.next')}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || editingTicket) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-ink mb-4">
              {editingTicket ? t('support.editTicket') : t('support.createTicket')}
            </h2>

            <div className="space-y-4">
              {/* Company Selector for Super Admin - Only when creating */}
              {isSuperAdmin && !editingTicket && (
                <div>
                  <label className="block text-sm font-medium text-ink mb-1">{t('users.company')} *</label>
                  <select
                    value={formData.company_id}
                    onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
                    className="w-full px-4 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none"
                    required
                  >
                    <option value="">{t('common.selectCompany')}</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-ink mb-1">{t('support.subject')} *</label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full px-4 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink mb-1">{t('common.description')} *</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-ink mb-1">{t('common.priority')} *</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                    className="w-full px-4 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none"
                  >
                    <option value="low">{t('leads.low')}</option>
                    <option value="medium">{t('leads.medium')}</option>
                    <option value="high">{t('leads.high')}</option>
                    <option value="urgent">{t('leads.urgent')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink mb-1">{t('common.type')} *</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                    className="w-full px-4 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none"
                  >
                    <option value="technical">{t('support.technical')}</option>
                    <option value="billing">{t('support.billing')}</option>
                    <option value="feature_request">{t('support.featureRequest')}</option>
                    <option value="bug">{t('support.bug')}</option>
                    <option value="other">{t('leads.other')}</option>
                  </select>
                </div>
              </div>

              {editingTicket && (
                <div>
                  <label className="block text-sm font-medium text-ink mb-1">{t('common.status')}</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-4 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none"
                  >
                    <option value="open">{t('support.open')}</option>
                    <option value="in_progress">{t('support.inProgress')}</option>
                    <option value="waiting_customer">{t('support.waitingCustomer')}</option>
                    <option value="resolved">{t('support.resolved')}</option>
                    <option value="closed">{t('support.closed')}</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-ink mb-1">{t('support.customerId', 'Customer ID')} ({t('common.optional')})</label>
                <input
                  type="number"
                  value={formData.customer_id}
                  onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                  placeholder={t('support.customerIdPlaceholder', 'Leave empty to enter customer details manually')}
                  className="w-full px-4 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none"
                />
              </div>

              {!formData.customer_id && (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-ink mb-1">{t('support.customerName', 'Customer Name')}</label>
                    <input
                      type="text"
                      value={formData.customer_name}
                      onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                      className="w-full px-4 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ink mb-1">{t('support.customerEmail', 'Customer Email')}</label>
                    <input
                      type="email"
                      value={formData.customer_email}
                      onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
                      className="w-full px-4 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ink mb-1">{t('support.customerPhone', 'Customer Phone')}</label>
                    <input
                      type="tel"
                      value={formData.customer_phone}
                      onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                      className="w-full px-4 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-ink mb-1">{t('leads.source')}</label>
                  <input
                    type="text"
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                    placeholder={t('support.sourcePlaceholder', 'e.g., email, phone, web')}
                    className="w-full px-4 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink mb-1">{t('support.channel', 'Channel')}</label>
                  <input
                    type="text"
                    value={formData.channel}
                    onChange={(e) => setFormData({ ...formData, channel: e.target.value })}
                    placeholder={t('support.channelPlaceholder', 'e.g., support_email, live_chat')}
                    className="w-full px-4 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink mb-1">{t('common.category')}</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none"
                  />
                </div>
              </div>

              {editingTicket && (
                <div>
                  <label className="block text-sm font-medium text-ink mb-1">{t('support.resolution')}</label>
                  <textarea
                    value={formData.resolution}
                    onChange={(e) => setFormData({ ...formData, resolution: e.target.value })}
                    rows={3}
                    placeholder={t('support.resolutionNotes', 'Resolution notes...')}
                    className="w-full px-4 py-2 border border-line rounded-xl focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20 outline-none"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingTicket(null);
                  resetForm();
                }}
                className="flex-1 px-4 py-2 border border-line rounded-xl hover:bg-aqua-1/30 transition-colors text-ink font-medium"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={editingTicket ? handleUpdateTicket : handleCreateTicket}
                className="flex-1 px-4 py-2 bg-aqua-5 text-white rounded-xl hover:bg-aqua-4 transition-colors font-semibold"
              >
                {editingTicket ? t('common.update') : t('common.create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
