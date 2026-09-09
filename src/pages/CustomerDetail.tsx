import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import Topbar from '../components/layout/Topbar';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import CustomerFormFields, { customerFormPayload, customerToForm, type CustomerCategory, type CustomerFormData } from '../components/customers/CustomerFormFields';

interface User { id: number; name: string; email: string; }
interface Opportunity { id: number; name: string; description: string | null; stage: string; value: number | null; currency: string; probability: number | null; expected_close_date: string | null; assignee: User | null; }
interface Task { id: number; title: string; description: string | null; priority: string; status: string; due_date: string | null; assignee: User | null; }
interface Note { id: number; title: string | null; content: string; type: string; is_pinned: boolean; is_important: boolean; user: User | null; created_at: string; }
interface CustomerDocument { id: number; name: string; original_name: string; category: string | null; size: number; mime_type: string | null; created_at: string; }
interface ActivityLog { id: number; action: string; description: string; severity: string; user: User | null; created_at: string; }
interface Customer extends Omit<Partial<CustomerFormData>, 'email' | 'phone' | 'first_name' | 'last_name' | 'second_last_name' | 'notes' | 'category_id'> { id: number; email: string; phone: string; first_name: string | null; last_name: string | null; second_last_name?: string | null; category_id?: number | null; category?: CustomerCategory | null; notes_text?: string | null; created_at: string; updated_at: string; created_by?: User | null; opportunities: Opportunity[]; tasks: Task[]; notes: Note[]; documents: CustomerDocument[]; }
interface CustomerStats { opportunities_count: number; open_opportunities_count: number; tasks_count: number; pending_tasks_count: number; notes_count: number; documents_count: number; activity_logs_count: number; }
type Tab = 'overview' | 'opportunities' | 'tasks' | 'notes' | 'documents' | 'activity';

const emptyOpportunity = { name: '', description: '', stage: 'prospecting', assigned_to: '', value: '', currency: 'EUR', probability: '', expected_close_date: '', source: '', campaign: '' };
const emptyTask = { title: '', description: '', priority: 'medium', status: 'pending', assigned_to: '', due_date: '' };
const emptyNote = { title: '', content: '', type: 'note', is_private: false, is_pinned: false, is_important: false };
const emptyDocument = { file: null as File | null, name: '', category: '', description: '', is_public: false };
const emptyActivity = { action: 'note', description: '', severity: 'info' };

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1 block text-sm font-medium text-ink">{label}</span>{children}</label>;
}

export default function CustomerDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [showOpportunityForm, setShowOpportunityForm] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [showDocumentForm, setShowDocumentForm] = useState(false);
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [customerForm, setCustomerForm] = useState<CustomerFormData>(customerToForm(null));
  const [opportunityForm, setOpportunityForm] = useState(emptyOpportunity);
  const [taskForm, setTaskForm] = useState(emptyTask);
  const [noteForm, setNoteForm] = useState(emptyNote);
  const [documentForm, setDocumentForm] = useState(emptyDocument);
  const [activityForm, setActivityForm] = useState(emptyActivity);
  const inputClass = 'w-full rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-aqua-5 focus:ring-2 focus:ring-aqua-5/20';

  useEffect(() => { if (id) void fetchCustomerDetail(); }, [id]);
  useEffect(() => {
    if (showOpportunityForm || showTaskForm) void fetchUsers();
  }, [showOpportunityForm, showTaskForm]);

  const fetchCustomerDetail = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/customers/${id}`);
      const loadedCustomer = data.customer || data;
      setCustomer(loadedCustomer);
      setCustomerForm(customerToForm({ ...loadedCustomer, notes: loadedCustomer.notes_text ?? '' } as Record<string, unknown>));
      setStats(data.stats || null);
      setActivityLogs(data.activity_logs || []);
    } catch (error) {
      console.error('Failed to fetch customer:', error);
      alert(t('customerDetail.loadError'));
      navigate('/customers');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data } = await api.get('/users', { params: { per_page: 100, status: 'active' } });
      const items = data.data || data || [];
      setUsers(Array.isArray(items) ? items : []);
    } catch {
      setUsers([]);
    }
  };

  const runAction = async (action: () => Promise<void>, fallbackKey: string) => {
    try {
      setSaving(true);
      await action();
      await fetchCustomerDetail();
    } catch (error: any) {
      console.error('Customer detail action failed:', error);
      alert(error.response?.data?.message || t(fallbackKey));
    } finally {
      setSaving(false);
    }
  };

  const updateCustomer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!customer) return;
    await runAction(async () => {
      await api.put(`/customers/${customer.id}`, customerFormPayload(customerForm));
      setShowCustomerForm(false);
    }, 'customerDetail.updateFailed');
  };

  const createOpportunity = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!customer) return;
    await runAction(async () => {
      await api.post('/opportunities', {
        ...opportunityForm,
        customer_id: customer.id,
        assigned_to: opportunityForm.assigned_to ? Number(opportunityForm.assigned_to) : null,
        value: opportunityForm.value ? Number(opportunityForm.value) : null,
        probability: opportunityForm.probability ? Number(opportunityForm.probability) : null,
      });
      setShowOpportunityForm(false);
      setOpportunityForm(emptyOpportunity);
    }, 'customerDetail.createOpportunityFailed');
  };

  const createTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!customer) return;
    await runAction(async () => {
      await api.post('/tasks', {
        ...taskForm,
        taskable_type: 'Customer',
        taskable_id: customer.id,
        assigned_to: taskForm.assigned_to ? Number(taskForm.assigned_to) : null,
        due_date: taskForm.due_date || null,
      });
      setShowTaskForm(false);
      setTaskForm(emptyTask);
    }, 'customerDetail.createTaskFailed');
  };

  const createNote = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!customer) return;
    await runAction(async () => {
      await api.post('/notes', { ...noteForm, noteable_type: 'Customer', noteable_id: customer.id });
      setShowNoteForm(false);
      setNoteForm(emptyNote);
    }, 'customerDetail.createNoteFailed');
  };

  const uploadDocument = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!customer || !documentForm.file) return;
    await runAction(async () => {
      const payload = new FormData();
      payload.append('file', documentForm.file);
      payload.append('documentable_type', 'Customer');
      payload.append('documentable_id', String(customer.id));
      if (documentForm.name) payload.append('name', documentForm.name);
      if (documentForm.category) payload.append('category', documentForm.category);
      if (documentForm.description) payload.append('description', documentForm.description);
      payload.append('is_public', String(documentForm.is_public));
      await api.post('/documents/upload', payload);
      setShowDocumentForm(false);
      setDocumentForm(emptyDocument);
    }, 'customerDetail.uploadDocumentFailed');
  };

  const createActivity = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!customer) return;
    await runAction(async () => {
      await api.post(`/customers/${customer.id}/activities`, activityForm);
      setShowActivityForm(false);
      setActivityForm(emptyActivity);
    }, 'customerDetail.createActivityFailed');
  };

  const downloadDocument = async (document: CustomerDocument) => {
    try {
      const response = await api.get(`/documents/${document.id}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([response.data]));
      const link = window.document.createElement('a');
      link.href = url;
      link.download = document.original_name || document.name;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      alert(error.response?.data?.message || t('customerDetail.downloadFailed'));
    }
  };

  const name = (current: Customer) => [current.first_name, current.last_name, current.second_last_name].filter(Boolean).join(' ') || current.email;
  const formatDate = (value?: string | null) => value ? new Date(value).toLocaleDateString() : '—';
  const formatDateTime = (value?: string | null) => value ? new Date(value).toLocaleString() : '—';
  const formatMoney = (value: number | null, currency = 'EUR') => value === null ? '—' : new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value);
  const formatFileSize = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

  if (loading) return <div className="flex h-64 items-center justify-center"><LoadingSpinner /></div>;
  if (!customer) return <div className="p-8 text-center text-muted">{t('customerDetail.notFound')}</div>;

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'overview', label: t('customerDetail.overview') }, { id: 'opportunities', label: t('customerDetail.opportunities') },
    { id: 'tasks', label: t('customerDetail.tasks') }, { id: 'notes', label: t('customerDetail.notes') },
    { id: 'documents', label: t('customerDetail.documents') }, { id: 'activity', label: t('customerDetail.activity') },
  ];

  return (
    <div className="space-y-6">
      <Topbar title={name(customer)} subtitle={t('customerDetail.title')} actions={<><Button variant="ghost" onClick={() => navigate('/customers')}>← {t('customerDetail.back')}</Button><Button onClick={() => setShowCustomerForm(true)}>{t('customerDetail.editCustomer')}</Button></>} />

      {stats && <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label={t('customerDetail.opportunities')} value={stats.opportunities_count} detail={t('customerDetail.openCount', { count: stats.open_opportunities_count })} />
        <Stat label={t('customerDetail.tasks')} value={stats.tasks_count} detail={t('customerDetail.pendingCount', { count: stats.pending_tasks_count })} />
        <Stat label={t('customerDetail.notes')} value={stats.notes_count} />
        <Stat label={t('customerDetail.documents')} value={stats.documents_count} />
        <Stat label={t('customerDetail.activity')} value={stats.activity_logs_count} />
      </div>}

      <div className="rounded-2xl border border-line bg-white">
        <nav className="flex flex-wrap gap-1 border-b border-line p-2">
          {tabs.map((tab) => <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${activeTab === tab.id ? 'bg-aqua-5 text-white' : 'text-muted hover:bg-aqua-1/40 hover:text-ink'}`}>{tab.label}</button>)}
        </nav>
        <div className="p-5">
          {activeTab === 'overview' && <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <DetailSection title={t('customerDetail.contactInformation')}><Detail label={t('customerForm.email')} value={customer.email} /><Detail label={t('customerForm.phone')} value={customer.phone} /><Detail label={t('customerForm.mobile')} value={customer.mobile} /><Detail label={t('customerForm.address')} value={[customer.address, customer.city, customer.state_province, customer.country].filter(Boolean).join(', ') || '—'} /><Detail label={t('customerForm.pecEmail')} value={customer.pec_email} /></DetailSection>
            <DetailSection title={t('customerDetail.additionalInformation')}><Detail label={t('customerForm.category')} value={customer.category?.name} /><Detail label={t('customerForm.code')} value={customer.customer_code} /><Detail label={t('customerForm.group')} value={customer.customer_group} /><Detail label={t('customerForm.taxCode')} value={customer.tax_code} /><Detail label={t('customerForm.vatNumber')} value={customer.vat} /><Detail label={t('customerForm.dateAdded')} value={formatDate(customer.date_added)} /><Detail label={t('customerDetail.created')} value={formatDateTime(customer.created_at)} /><Detail label={t('customerDetail.operator')} value={customer.created_by?.name} /></DetailSection>
            <DetailSection title={t('customerDetail.preferences')}><Detail label={t('customerForm.processingConsent')} value={customer.privacy_consent_processing ? t('customerDetail.yes') : t('customerDetail.no')} /><Detail label={t('customerForm.marketingConsent')} value={customer.marketing_consent ? t('customerDetail.yes') : t('customerDetail.no')} /><Detail label={t('customerForm.profilingConsent')} value={customer.profiling_consent ? t('customerDetail.yes') : t('customerDetail.no')} /><Detail label={t('customerForm.language')} value={customer.language} /></DetailSection>
            <DetailSection title={t('customerDetail.notes')}><Detail label={t('customerForm.notes')} value={customer.notes_text} /><Detail label={t('customerForm.privateNotes')} value={customer.private_notes} /></DetailSection>
          </div>}

          {activeTab === 'opportunities' && <Collection title={t('customerDetail.opportunities')} actionLabel={t('customerDetail.newOpportunity')} onAction={() => setShowOpportunityForm(true)} empty={t('customerDetail.noOpportunities')} items={customer.opportunities} render={(item) => <div className="flex flex-col justify-between gap-3 sm:flex-row"><div><p className="font-semibold text-ink">{item.name}</p>{item.description && <p className="mt-1 text-sm text-muted">{item.description}</p>}<p className="mt-2 text-sm text-muted">{formatMoney(item.value, item.currency)} · {item.probability ?? 0}% · {formatDate(item.expected_close_date)}</p></div><Badge value={item.stage.replaceAll('_', ' ')} /></div>} />}
          {activeTab === 'tasks' && <Collection title={t('customerDetail.tasks')} actionLabel={t('customerDetail.newTask')} onAction={() => setShowTaskForm(true)} empty={t('customerDetail.noTasks')} items={customer.tasks} render={(item) => <div className="flex flex-col justify-between gap-3 sm:flex-row"><div><p className="font-semibold text-ink">{item.title}</p>{item.description && <p className="mt-1 text-sm text-muted">{item.description}</p>}<p className="mt-2 text-sm text-muted">{formatDate(item.due_date)}{item.assignee ? ` · ${item.assignee.name}` : ''}</p></div><div className="flex gap-2"><Badge value={item.priority} /><Badge value={item.status.replaceAll('_', ' ')} /></div></div>} />}
          {activeTab === 'notes' && <Collection title={t('customerDetail.notes')} actionLabel={t('customerDetail.newNote')} onAction={() => setShowNoteForm(true)} empty={t('customerDetail.noNotes')} items={customer.notes} render={(item) => <div><p className="font-semibold text-ink">{item.title || t('customerDetail.untitledNote')}</p><p className="mt-1 whitespace-pre-wrap text-sm text-ink">{item.content}</p><p className="mt-2 text-xs text-muted">{formatDateTime(item.created_at)}{item.user ? ` · ${item.user.name}` : ''}</p></div>} />}
          {activeTab === 'documents' && <Collection title={t('customerDetail.documents')} actionLabel={t('customerDetail.uploadDocument')} onAction={() => setShowDocumentForm(true)} empty={t('customerDetail.noDocuments')} items={customer.documents} render={(item) => <div className="flex items-center justify-between gap-3"><div><p className="font-semibold text-ink">{item.name}</p><p className="mt-1 text-sm text-muted">{item.original_name} · {formatFileSize(item.size)}{item.category ? ` · ${item.category}` : ''}</p></div><button type="button" onClick={() => void downloadDocument(item)} className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-aqua-5 hover:bg-aqua-1/30">{t('customerDetail.download')}</button></div>} />}
          {activeTab === 'activity' && <Collection title={t('customerDetail.activityLog')} actionLabel={t('customerDetail.newActivity')} onAction={() => setShowActivityForm(true)} empty={t('customerDetail.noActivity')} items={activityLogs} render={(item) => <div><div className="flex items-center justify-between gap-3"><p className="font-semibold capitalize text-ink">{item.action.replaceAll('_', ' ')}</p><p className="text-xs text-muted">{formatDateTime(item.created_at)}</p></div><p className="mt-1 text-sm text-muted">{item.description}</p>{item.user && <p className="mt-2 text-xs text-muted">{item.user.name}</p>}</div>} />}
        </div>
      </div>

      <Modal isOpen={showCustomerForm} onClose={() => setShowCustomerForm(false)} title={t('customers.editCustomer')} size="xl"><form onSubmit={updateCustomer} className="space-y-5"><CustomerFormFields value={customerForm} onChange={setCustomerForm} /><ModalActions saving={saving} onCancel={() => setShowCustomerForm(false)} /></form></Modal>
      <Modal isOpen={showOpportunityForm} onClose={() => setShowOpportunityForm(false)} title={t('customerDetail.createOpportunity')} size="lg"><form onSubmit={createOpportunity} className="space-y-4"><Field label={t('customerDetail.opportunityName')}><input required className={inputClass} value={opportunityForm.name} onChange={(event) => setOpportunityForm({ ...opportunityForm, name: event.target.value })} /></Field><Field label={t('common.description')}><textarea className={inputClass} rows={3} value={opportunityForm.description} onChange={(event) => setOpportunityForm({ ...opportunityForm, description: event.target.value })} /></Field><div className="grid gap-3 sm:grid-cols-2"><Field label={t('customerDetail.stage')}><select className={inputClass} value={opportunityForm.stage} onChange={(event) => setOpportunityForm({ ...opportunityForm, stage: event.target.value })}>{['prospecting','qualification','proposal','negotiation','closed_won','closed_lost','on_hold'].map((stage) => <option key={stage} value={stage}>{stage.replaceAll('_', ' ')}</option>)}</select></Field><Field label={t('customerDetail.assignedTo')}><select className={inputClass} value={opportunityForm.assigned_to} onChange={(event) => setOpportunityForm({ ...opportunityForm, assigned_to: event.target.value })}><option value="">{t('customerDetail.unassigned')}</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></Field><Field label={t('customerDetail.value')}><input type="number" min="0" className={inputClass} value={opportunityForm.value} onChange={(event) => setOpportunityForm({ ...opportunityForm, value: event.target.value })} /></Field><Field label={t('customerDetail.probability')}><input type="number" min="0" max="100" className={inputClass} value={opportunityForm.probability} onChange={(event) => setOpportunityForm({ ...opportunityForm, probability: event.target.value })} /></Field><Field label={t('customerDetail.expectedClose')}><input type="date" className={inputClass} value={opportunityForm.expected_close_date} onChange={(event) => setOpportunityForm({ ...opportunityForm, expected_close_date: event.target.value })} /></Field><Field label={t('customerDetail.source')}><input className={inputClass} value={opportunityForm.source} onChange={(event) => setOpportunityForm({ ...opportunityForm, source: event.target.value })} /></Field></div><ModalActions saving={saving} onCancel={() => setShowOpportunityForm(false)} /></form></Modal>
      <Modal isOpen={showTaskForm} onClose={() => setShowTaskForm(false)} title={t('customerDetail.createTask')} size="lg"><form onSubmit={createTask} className="space-y-4"><Field label={t('customerDetail.taskTitle')}><input required className={inputClass} value={taskForm.title} onChange={(event) => setTaskForm({ ...taskForm, title: event.target.value })} /></Field><Field label={t('common.description')}><textarea className={inputClass} rows={3} value={taskForm.description} onChange={(event) => setTaskForm({ ...taskForm, description: event.target.value })} /></Field><div className="grid gap-3 sm:grid-cols-2"><Field label={t('customerDetail.priority')}><select className={inputClass} value={taskForm.priority} onChange={(event) => setTaskForm({ ...taskForm, priority: event.target.value })}>{['low','medium','high','urgent'].map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select></Field><Field label={t('customerDetail.status')}><select className={inputClass} value={taskForm.status} onChange={(event) => setTaskForm({ ...taskForm, status: event.target.value })}>{['pending','in_progress','completed','cancelled'].map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select></Field><Field label={t('customerDetail.dueDate')}><input type="date" className={inputClass} value={taskForm.due_date} onChange={(event) => setTaskForm({ ...taskForm, due_date: event.target.value })} /></Field><Field label={t('customerDetail.assignedTo')}><select className={inputClass} value={taskForm.assigned_to} onChange={(event) => setTaskForm({ ...taskForm, assigned_to: event.target.value })}><option value="">{t('customerDetail.unassigned')}</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></Field></div><ModalActions saving={saving} onCancel={() => setShowTaskForm(false)} /></form></Modal>
      <Modal isOpen={showNoteForm} onClose={() => setShowNoteForm(false)} title={t('customerDetail.createNote')} size="lg"><form onSubmit={createNote} className="space-y-4"><Field label={t('customerDetail.noteTitle')}><input className={inputClass} value={noteForm.title} onChange={(event) => setNoteForm({ ...noteForm, title: event.target.value })} /></Field><Field label={t('customerDetail.noteContent')}><textarea required className={inputClass} rows={5} value={noteForm.content} onChange={(event) => setNoteForm({ ...noteForm, content: event.target.value })} /></Field><div className="grid gap-3 sm:grid-cols-3"><Field label={t('customerDetail.noteType')}><select className={inputClass} value={noteForm.type} onChange={(event) => setNoteForm({ ...noteForm, type: event.target.value })}>{['note','comment','call_log','meeting','email','other'].map((type) => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}</select></Field><Check label={t('customerDetail.private')} checked={noteForm.is_private} onChange={(checked) => setNoteForm({ ...noteForm, is_private: checked })} /><Check label={t('customerDetail.important')} checked={noteForm.is_important} onChange={(checked) => setNoteForm({ ...noteForm, is_important: checked })} /></div><ModalActions saving={saving} onCancel={() => setShowNoteForm(false)} /></form></Modal>
      <Modal isOpen={showDocumentForm} onClose={() => setShowDocumentForm(false)} title={t('customerDetail.uploadDocument')} size="lg"><form onSubmit={uploadDocument} className="space-y-4"><Field label={t('customerDetail.file')}><input required type="file" className={inputClass} onChange={(event) => setDocumentForm({ ...documentForm, file: event.target.files?.[0] || null })} /></Field><Field label={t('customerDetail.documentName')}><input className={inputClass} value={documentForm.name} onChange={(event) => setDocumentForm({ ...documentForm, name: event.target.value })} /></Field><Field label={t('customerDetail.category')}><input className={inputClass} value={documentForm.category} onChange={(event) => setDocumentForm({ ...documentForm, category: event.target.value })} /></Field><Field label={t('common.description')}><textarea className={inputClass} rows={3} value={documentForm.description} onChange={(event) => setDocumentForm({ ...documentForm, description: event.target.value })} /></Field><Check label={t('customerDetail.publicDocument')} checked={documentForm.is_public} onChange={(checked) => setDocumentForm({ ...documentForm, is_public: checked })} /><ModalActions saving={saving} onCancel={() => setShowDocumentForm(false)} /></form></Modal>
      <Modal isOpen={showActivityForm} onClose={() => setShowActivityForm(false)} title={t('customerDetail.createActivity')} size="lg"><form onSubmit={createActivity} className="space-y-4"><Field label={t('customerDetail.activityType')}><select className={inputClass} value={activityForm.action} onChange={(event) => setActivityForm({ ...activityForm, action: event.target.value })}>{['note','call','email','meeting','other'].map((action) => <option key={action} value={action}>{action}</option>)}</select></Field><Field label={t('customerDetail.activityDescription')}><textarea required className={inputClass} rows={4} value={activityForm.description} onChange={(event) => setActivityForm({ ...activityForm, description: event.target.value })} /></Field><Field label={t('customerDetail.severity')}><select className={inputClass} value={activityForm.severity} onChange={(event) => setActivityForm({ ...activityForm, severity: event.target.value })}>{['info','warning','error','critical'].map((severity) => <option key={severity} value={severity}>{severity}</option>)}</select></Field><ModalActions saving={saving} onCancel={() => setShowActivityForm(false)} /></form></Modal>
    </div>
  );
}

function Stat({ label, value, detail }: { label: string; value: number; detail?: string }) { return <div className="rounded-xl border border-line bg-white p-4"><p className="text-xs font-bold uppercase text-muted">{label}</p><p className="mt-1 text-2xl font-bold text-ink">{value}</p>{detail && <p className="mt-1 text-xs text-muted">{detail}</p>}</div>; }
function DetailSection({ title, children }: { title: string; children: ReactNode }) { return <section className="rounded-xl border border-line p-4"><h3 className="mb-3 font-semibold text-ink">{title}</h3><div className="space-y-3">{children}</div></section>; }
function Detail({ label, value }: { label: string; value?: string | null }) { return <div><p className="text-xs font-bold uppercase tracking-wide text-muted">{label}</p><p className="mt-0.5 whitespace-pre-wrap text-sm text-ink">{value || '—'}</p></div>; }
function Badge({ value }: { value: string }) { return <span className="inline-flex rounded-full border border-aqua-5/25 bg-aqua-1/30 px-2 py-1 text-xs font-medium capitalize text-aqua-5">{value}</span>; }
function Collection<T extends { id: number }>({ title, actionLabel, onAction, empty, items, render }: { title: string; actionLabel: string; onAction: () => void; empty: string; items: T[]; render: (item: T) => ReactNode }) { return <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-semibold text-ink">{title}</h3><Button onClick={onAction}>{actionLabel}</Button></div>{items.length ? <div className="space-y-3">{items.map((item) => <div key={item.id} className="rounded-xl border border-line p-4 transition-colors hover:bg-aqua-1/10">{render(item)}</div>)}</div> : <div className="rounded-xl border border-dashed border-line p-10 text-center text-muted">{empty}</div>}</section>; }
function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) { return <label className="flex items-center gap-2 pt-6 text-sm text-ink"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 rounded border-line text-aqua-5 focus:ring-aqua-5" />{label}</label>; }
function ModalActions({ saving, onCancel }: { saving: boolean; onCancel: () => void }) { const { t } = useTranslation(); return <div className="flex gap-3 border-t border-line pt-4"><button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink hover:bg-aqua-1/30">{t('common.cancel')}</button><button type="submit" disabled={saving} className="flex-1 rounded-xl bg-aqua-5 px-4 py-2.5 text-sm font-semibold text-white hover:bg-aqua-4 disabled:opacity-50">{saving ? t('customers.saving') : t('common.create')}</button></div>; }
