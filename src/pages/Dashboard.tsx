import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Topbar from '../components/layout/Topbar';
import api from '../services/api';
import { fetchMyPetPlusLeads } from '../services/myPetPlusApi';
import { fetchTgRegistrations } from '../services/tgCalabriaApi';
import type { Project } from '../types/project.types';

interface KPIs {
  lead_new: number;
  opportunities_open: number;
  sales_count: number;
  sales_value: number;
  weighted_pipeline: number;
  tasks_pending: number;
  tasks_overdue: number;
  lead_new_delta?: number;
  opportunities_delta?: number;
  sales_count_delta?: number;
  sales_value_delta?: number;
}

interface LeadSource { name: string; value: number; }
interface TopOperator { name: string; leads: number; sales: number; conversion: string; }
interface PipelineItem { id?: number; customer: string; stage: string; value: string; next_step: string; source: string; }
interface HotLead { id?: number; name: string; source: string; phone?: string; heat: string; }
type Period = 'today' | 'week' | 'month' | 'year';
interface ProjectInsight { status: 'loading' | 'ready' | 'unavailable'; registrations: number | null; subscriptionRevenue?: number | null; subscriptionPayments?: number | null; }

const loadingInsight = (): ProjectInsight => ({ status: 'loading', registrations: null });

function projectsFrom(payload: unknown): Project[] {
  if (Array.isArray(payload)) return payload as Project[];
  if (payload && typeof payload === 'object' && Array.isArray((payload as { data?: unknown }).data)) return (payload as { data: Project[] }).data;
  return [];
}

function formatMoney(value: number | null | undefined): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(Number(value || 0));
}

function Delta({ value, percentage = false }: { value?: number; percentage?: boolean }) {
  if (value === undefined) return <span className="text-xs text-muted">—</span>;
  return <span className={`text-xs font-bold ${value >= 0 ? 'text-ok' : 'text-bad'}`}>{value >= 0 ? '+' : ''}{value}{percentage ? '%' : ''}</span>;
}

function MetricCard({ icon, label, value, delta, percentage = false, detail }: { icon: string; label: string; value: string | number; delta?: number; percentage?: boolean; detail: string }) {
  return <article className="rounded-2xl border border-line bg-white p-5 shadow-sm transition-shadow hover:shadow-md"><div className="flex items-start justify-between gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-aqua-1/55 text-xl">{icon}</span><Delta value={delta} percentage={percentage} /></div><p className="mt-4 text-xs font-bold uppercase tracking-wide text-muted">{label}</p><p className="mt-1 text-3xl font-extrabold tracking-tight text-ink">{value}</p><p className="mt-2 text-xs text-muted">{detail}</p></article>;
}

function SectionTitle({ icon, title, subtitle, action }: { icon: string; title: string; subtitle?: string; action?: ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div className="flex items-start gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-aqua-1/55 text-lg">{icon}</span><div><h2 className="font-bold text-ink">{title}</h2>{subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}</div></div>{action}</div>;
}

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>('week');
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [leadSources, setLeadSources] = useState<LeadSource[]>([]);
  const [topOperators, setTopOperators] = useState<TopOperator[]>([]);
  const [pipeline, setPipeline] = useState<PipelineItem[]>([]);
  const [hotLeads, setHotLeads] = useState<HotLead[]>([]);
  const [tgInsight, setTgInsight] = useState<ProjectInsight>(loadingInsight);
  const [myPetInsight, setMyPetInsight] = useState<ProjectInsight>(loadingInsight);
  const [loading, setLoading] = useState(true);

  const loadProjectInsights = useCallback(async () => {
    setTgInsight(loadingInsight());
    setMyPetInsight(loadingInsight());
    const projects = await api.get<Project[]>('/projects').then((response) => projectsFrom(response.data)).catch(() => [] as Project[]);
    const myPetProject = projects.find((project) => project.slug === 'mypetplus');
    const [tgResult, myPetResult] = await Promise.allSettled([
      fetchTgRegistrations({ page: 1, limit: 1 }),
      myPetProject ? fetchMyPetPlusLeads(myPetProject.id, { page: 1, limit: 1 }) : Promise.reject(new Error('MyPet Plus unavailable')),
    ]);

    setTgInsight(tgResult.status === 'fulfilled' && tgResult.value.success
      ? { status: 'ready', registrations: tgResult.value.data.meta.total }
      : { status: 'unavailable', registrations: null });

    if (myPetResult.status === 'fulfilled') {
      const revenue = myPetResult.value.stats?.subscriptionRevenue;
      setMyPetInsight({ status: 'ready', registrations: myPetResult.value.pagination.total, subscriptionRevenue: revenue?.totalRevenue ?? null, subscriptionPayments: revenue?.totalPayments ?? null });
    } else {
      setMyPetInsight({ status: 'unavailable', registrations: null });
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [kpisResult, pipelineResult, leadsResult, sourcesResult, operatorsResult] = await Promise.allSettled([
        api.get<KPIs>('/dashboard/kpis', { params: { period } }),
        api.get<{ data?: PipelineItem[] }>('/dashboard/pipeline'),
        api.get<HotLead[]>('/dashboard/leads'),
        api.get<LeadSource[]>('/dashboard/lead-sources'),
        api.get<TopOperator[]>('/dashboard/top-operators'),
      ]);
      setKpis(kpisResult.status === 'fulfilled' ? kpisResult.value.data : null);
      setPipeline(pipelineResult.status === 'fulfilled' && Array.isArray(pipelineResult.value.data?.data) ? pipelineResult.value.data.data : []);
      setHotLeads(leadsResult.status === 'fulfilled' && Array.isArray(leadsResult.value.data) ? leadsResult.value.data : []);
      setLeadSources(sourcesResult.status === 'fulfilled' && Array.isArray(sourcesResult.value.data) ? sourcesResult.value.data : []);
      setTopOperators(operatorsResult.status === 'fulfilled' && Array.isArray(operatorsResult.value.data) ? operatorsResult.value.data : []);
      void loadProjectInsights();
    } finally {
      setLoading(false);
    }
  }, [loadProjectInsights, period]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  if (loading && !kpis) return <div className="flex h-64 items-center justify-center"><div className="h-12 w-12 animate-spin rounded-full border-b-2 border-aqua-5" /></div>;

  const projectCard = (name: string, icon: string, insight: ProjectInsight, accent: 'aqua' | 'violet', destination: string, secondary?: ReactNode) => {
    const accentClass = accent === 'aqua' ? 'border-aqua-5/25 bg-aqua-1/20' : 'border-violet-300/60 bg-violet-50/70';
    return <article className={`rounded-2xl border p-5 ${accentClass}`}><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-xl shadow-sm">{icon}</span><div><h3 className="font-bold text-ink">{name}</h3><p className="text-xs text-muted">{t('dashboard.liveProjectData')}</p></div></div><button type="button" onClick={() => navigate(destination)} className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-ink shadow-sm transition hover:bg-aqua-1/40">{t('dashboard.viewLeads')}</button></div>{insight.status === 'loading' && <div className="mt-7 h-10 w-28 animate-pulse rounded-lg bg-white/80" />}{insight.status === 'ready' && <div className="mt-6"><p className="text-xs font-bold uppercase tracking-wide text-muted">{t('dashboard.totalRegistrations')}</p><p className="mt-1 text-3xl font-extrabold text-ink">{insight.registrations?.toLocaleString() ?? '—'}</p>{secondary && <div className="mt-4 border-t border-line/70 pt-3">{secondary}</div>}</div>}{insight.status === 'unavailable' && <p className="mt-6 text-sm text-muted">{t('dashboard.projectDataUnavailable')}</p>}</article>;
  };

  return <div className="space-y-6">
    <Topbar title={t('dashboard.title')} subtitle={t('dashboard.workspaceSubtitle')} actions={<div className="flex flex-wrap items-center gap-2"><select value={period} onChange={(event) => setPeriod(event.target.value as Period)} className="rounded-xl border border-line bg-white px-3 py-2 text-sm font-medium text-ink outline-none focus:border-aqua-5"><option value="today">{t('dashboard.periodToday')}</option><option value="week">{t('dashboard.periodWeek')}</option><option value="month">{t('dashboard.periodMonth')}</option><option value="year">{t('dashboard.periodYear')}</option></select><button type="button" onClick={() => void fetchData()} className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-aqua-1/30">{t('dashboard.refresh')}</button><button type="button" onClick={() => navigate('/leads')} className="rounded-xl border border-aqua-5/35 bg-gradient-to-r from-aqua-3/45 to-aqua-5/14 px-4 py-2 text-sm font-semibold text-ink transition-all hover:shadow-lg hover:shadow-aqua-5/10">+ {t('dashboard.newLead')}</button></div>} />

    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard icon="◎" label={t('dashboard.newLeads')} value={kpis?.lead_new ?? 0} delta={kpis?.lead_new_delta} percentage detail={t('dashboard.selectedPeriod')} /><MetricCard icon="↗" label={t('dashboard.openOpportunities')} value={kpis?.opportunities_open ?? 0} delta={kpis?.opportunities_delta} detail={t('dashboard.currentPipeline')} /><MetricCard icon="✓" label={t('dashboard.salesPeriod')} value={kpis?.sales_count ?? 0} delta={kpis?.sales_count_delta} detail={t('dashboard.selectedPeriod')} /><MetricCard icon="€" label={t('dashboard.valuePeriod')} value={formatMoney(kpis?.sales_value)} delta={kpis?.sales_value_delta} percentage detail={t('dashboard.selectedPeriod')} /></section>

    <section className="rounded-2xl border border-line bg-white p-5 shadow-sm"><SectionTitle icon="◈" title={t('dashboard.projectPulse')} subtitle={t('dashboard.projectPulseSubtitle')} /><div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{projectCard(t('dashboard.tgLeadsProject'), '📰', tgInsight, 'aqua', '/tg-leads')}{projectCard(t('dashboard.myPetPlusProject'), '🐾', myPetInsight, 'violet', '/mypetplus-leads', myPetInsight.status === 'ready' ? <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-muted">{t('dashboard.subscriptionRevenue')}</p><p className="mt-1 text-lg font-extrabold text-ink">{formatMoney(myPetInsight.subscriptionRevenue)}</p></div><p className="text-right text-xs text-muted">{myPetInsight.subscriptionPayments ?? 0}<br />{t('dashboard.subscriptionPayments')}</p></div> : undefined)}</div></section>

    <section className="grid grid-cols-1 gap-4 xl:grid-cols-3"><article className="rounded-2xl border border-line bg-white p-5 shadow-sm xl:col-span-2"><SectionTitle icon="▥" title={t('dashboard.leadsByPortal')} subtitle={t('dashboard.lastThirtyDays')} />{leadSources.length > 0 ? <ResponsiveContainer width="100%" height={230}><BarChart data={leadSources} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}><CartesianGrid vertical={false} stroke="#e6eef2" /><XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} /><YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} /><Tooltip cursor={{ fill: '#eefbff' }} /><Bar dataKey="value" fill="#0aa6d3" radius={[7, 7, 0, 0]} /></BarChart></ResponsiveContainer> : <EmptyState label={t('dashboard.noData')} />}</article><article className="rounded-2xl border border-line bg-white p-5 shadow-sm"><SectionTitle icon="✓" title={t('dashboard.crmWorkload')} subtitle={t('dashboard.currentCrmData')} /><div className="space-y-3"><WorkloadRow label={t('dashboard.weightedPipeline')} value={formatMoney(kpis?.weighted_pipeline)} /><WorkloadRow label={t('dashboard.pendingTasks')} value={String(kpis?.tasks_pending ?? 0)} /><WorkloadRow label={t('dashboard.overdueTasks')} value={String(kpis?.tasks_overdue ?? 0)} warning={(kpis?.tasks_overdue ?? 0) > 0} /></div></article></section>

    <section className="grid grid-cols-1 gap-4 xl:grid-cols-3"><article className="rounded-2xl border border-line bg-white p-5 shadow-sm xl:col-span-2"><SectionTitle icon="▤" title={t('dashboard.opportunityPipeline')} subtitle={t('dashboard.currentPipeline')} />{pipeline.length > 0 ? <div className="overflow-x-auto"><table className="w-full min-w-[620px]"><thead><tr className="border-b border-line"><th className="py-2 text-left text-xs font-bold uppercase tracking-wide text-muted">{t('dashboard.customer')}</th><th className="py-2 text-left text-xs font-bold uppercase tracking-wide text-muted">{t('dashboard.stage')}</th><th className="py-2 text-right text-xs font-bold uppercase tracking-wide text-muted">{t('common.value')}</th><th className="py-2 pl-5 text-left text-xs font-bold uppercase tracking-wide text-muted">{t('dashboard.nextStep')}</th></tr></thead><tbody>{pipeline.map((item, index) => <tr key={item.id || index} className="border-b border-line/50 last:border-0"><td className="py-3 text-sm font-semibold text-ink">{item.customer}</td><td className="py-3 text-sm text-muted">{item.stage}</td><td className="py-3 text-right text-sm font-semibold text-ink">{item.value}</td><td className="py-3 pl-5 text-sm text-muted">{item.next_step}</td></tr>)}</tbody></table></div> : <EmptyState label={t('dashboard.noPipeline')} />}</article><article className="rounded-2xl border border-line bg-white p-5 shadow-sm"><SectionTitle icon="☎" title={t('dashboard.hotLeadsToCall')} subtitle={t('dashboard.recentCrmLeads')} />{hotLeads.length > 0 ? <div className="space-y-2">{hotLeads.slice(0, 5).map((lead, index) => <div key={lead.id || index} className="rounded-xl border border-line p-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-semibold text-ink">{lead.name}</p><p className="truncate text-xs text-muted">{lead.source}</p></div><span className="shrink-0 text-xs">{lead.heat}</span></div>{lead.phone && <a href={`tel:${lead.phone}`} className="mt-2 inline-flex rounded-lg bg-aqua-5 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-aqua-4">{t('dashboard.call')}</a>}</div>)}</div> : <EmptyState label={t('dashboard.noHotLeads')} />}</article></section>

    <section className="rounded-2xl border border-line bg-white p-5 shadow-sm"><SectionTitle icon="★" title={t('dashboard.topOperators')} subtitle={t('dashboard.lastThirtyDays')} />{topOperators.length > 0 ? <div className="overflow-x-auto"><table className="w-full min-w-[520px]"><thead><tr className="border-b border-line"><th className="py-2 text-left text-xs font-bold uppercase tracking-wide text-muted">{t('dashboard.operator')}</th><th className="py-2 text-right text-xs font-bold uppercase tracking-wide text-muted">{t('sidebar.leads')}</th><th className="py-2 text-right text-xs font-bold uppercase tracking-wide text-muted">{t('sidebar.sales')}</th><th className="py-2 text-right text-xs font-bold uppercase tracking-wide text-muted">{t('dashboard.conversion')}</th></tr></thead><tbody>{topOperators.map((operator, index) => <tr key={`${operator.name}-${index}`} className="border-b border-line/50 last:border-0"><td className="py-3 text-sm font-semibold text-ink">{operator.name}</td><td className="py-3 text-right text-sm text-ink">{operator.leads}</td><td className="py-3 text-right text-sm text-ink">{operator.sales}</td><td className="py-3 text-right text-sm font-bold text-aqua-5">{operator.conversion}</td></tr>)}</tbody></table></div> : <EmptyState label={t('dashboard.noData')} />}</section>
  </div>;
}

function EmptyState({ label }: { label: string }) { return <div className="flex h-44 items-center justify-center rounded-xl border border-dashed border-line bg-gray-50/70 text-sm text-muted">{label}</div>; }
function WorkloadRow({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) { return <div className="flex items-center justify-between rounded-xl border border-line bg-gray-50/70 px-4 py-3"><span className="text-sm text-muted">{label}</span><span className={`text-lg font-extrabold ${warning ? 'text-bad' : 'text-ink'}`}>{value}</span></div>; }
