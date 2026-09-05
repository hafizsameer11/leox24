import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import Topbar from '../components/layout/Topbar';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface KPIs {
  lead_new: number;
  opportunities_open: number;
  sales_count: number;
  sales_value: number;
  lead_new_delta?: number;
  opportunities_delta?: number;
  sales_count_delta?: number;
  sales_value_delta?: number;
}

interface LeadSource {
  name: string;
  value: number;
}

interface TopOperator {
  name: string;
  leads: number;
  sales: number;
  conversion: string;
}

interface PipelineItem {
  id?: number;
  customer: string;
  stage: string;
  value: string;
  next_step: string;
  source: string;
}

interface HotLead {
  id?: number;
  name: string;
  source: string;
  phone?: string;
  heat: string;
}

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [leadSources, setLeadSources] = useState<LeadSource[]>([]);
  const [topOperators, setTopOperators] = useState<TopOperator[]>([]);
  const [pipeline, setPipeline] = useState<PipelineItem[]>([]);
  const [hotLeads, setHotLeads] = useState<HotLead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [kpisRes, pipelineRes, leadsRes, leadSourcesRes, topOperatorsRes] = await Promise.all([
        api.get('/dashboard/kpis'),
        api.get('/dashboard/pipeline'),
        api.get('/dashboard/leads'),
        api.get('/dashboard/lead-sources'),
        api.get('/dashboard/top-operators'),
      ]);

      // Set KPIs
      setKpis(kpisRes.data);
      
      // Set lead sources
      if (leadSourcesRes.data && leadSourcesRes.data.length > 0) {
        setLeadSources(leadSourcesRes.data);
      } else {
        // Fallback if no data
        setLeadSources([]);
      }

      // Set top operators
      if (topOperatorsRes.data && topOperatorsRes.data.length > 0) {
        setTopOperators(topOperatorsRes.data);
      } else {
        // Fallback if no data
        setTopOperators([]);
      }

      // Set pipeline - map backend format to frontend format
      if (pipelineRes.data?.data && pipelineRes.data.data.length > 0) {
        setPipeline(pipelineRes.data.data);
      } else {
        setPipeline([]);
      }

      // Set hot leads
      if (leadsRes.data && leadsRes.data.length > 0) {
        setHotLeads(leadsRes.data);
      } else {
        setHotLeads([]);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      // Set empty data on error
      setKpis(null);
      setLeadSources([]);
      setTopOperators([]);
      setPipeline([]);
      setHotLeads([]);
    } finally {
      setLoading(false);
    }
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
        title={t('dashboard.salesTitle')}
        subtitle={t('dashboard.salesSubtitle')}
        actions={
          <>
            <button 
              onClick={fetchData}
              className="px-4 py-2 text-sm border border-line rounded-xl hover:bg-aqua-1/30 transition-colors text-ink font-medium"
            >
              {t('dashboard.refresh')}
            </button>
            <button 
              onClick={() => navigate('/leads')}
              className="px-4 py-2 text-sm border border-aqua-5/35 bg-gradient-to-r from-aqua-3/45 to-aqua-5/14 rounded-xl hover:shadow-lg hover:shadow-aqua-5/10 transition-all text-ink font-semibold"
            >
              ➕ {t('dashboard.newLead')}
            </button>
          </>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-line rounded-2xl p-5 shadow-sm">
          <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">{t('dashboard.newLeads')}</h3>
          <div className="flex items-end justify-between">
            <div className="text-3xl font-extrabold text-ink">{kpis?.lead_new ?? 0}</div>
            {kpis?.lead_new_delta !== undefined && (
              <div className={`text-sm font-semibold mb-1 ${kpis.lead_new_delta >= 0 ? 'text-ok' : 'text-bad'}`}>
                {kpis.lead_new_delta >= 0 ? '+' : ''}{kpis.lead_new_delta}%
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-line rounded-2xl p-5 shadow-sm">
          <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">{t('dashboard.openOpportunities')}</h3>
          <div className="flex items-end justify-between">
            <div className="text-3xl font-extrabold text-ink">{kpis?.opportunities_open ?? 0}</div>
            {kpis?.opportunities_delta !== undefined && (
              <div className={`text-sm font-semibold mb-1 ${kpis.opportunities_delta >= 0 ? 'text-ok' : 'text-bad'}`}>
                {kpis.opportunities_delta >= 0 ? '+' : ''}{kpis.opportunities_delta}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-line rounded-2xl p-5 shadow-sm">
          <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">{t('dashboard.salesPeriod')}</h3>
          <div className="flex items-end justify-between">
            <div className="text-3xl font-extrabold text-ink">{kpis?.sales_count ?? 0}</div>
            {kpis?.sales_count_delta !== undefined && (
              <div className={`text-sm font-semibold mb-1 ${kpis.sales_count_delta >= 0 ? 'text-ok' : 'text-bad'}`}>
                {kpis.sales_count_delta >= 0 ? '+' : ''}{kpis.sales_count_delta}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-line rounded-2xl p-5 shadow-sm">
          <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">{t('dashboard.valuePeriod')}</h3>
          <div className="flex items-end justify-between">
            <div className="text-3xl font-extrabold text-ink">
              € {kpis?.sales_value ? kpis.sales_value.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '0'}
            </div>
            {kpis?.sales_value_delta !== undefined && (
              <div className={`text-sm font-semibold mb-1 ${kpis.sales_value_delta >= 0 ? 'text-ok' : 'text-bad'}`}>
                {kpis.sales_value_delta >= 0 ? '+' : ''}{kpis.sales_value_delta}%
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Charts and Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Lead Sources Chart */}
        <div className="bg-white border border-line rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-bold text-ink mb-4">{t('dashboard.leadsByPortal')}</h3>
          {leadSources.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={leadSources}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e6eef2" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#0aa6d3" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-muted">
              {t('dashboard.noData')}
            </div>
          )}
        </div>

        {/* Top Operators */}
        <div className="bg-white border border-line rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-bold text-ink mb-4">{t('dashboard.topOperators')}</h3>
          {topOperators.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-line">
                    <th className="text-left text-xs font-bold text-muted uppercase py-2">{t('dashboard.operator')}</th>
                    <th className="text-right text-xs font-bold text-muted uppercase py-2">{t('sidebar.leads')}</th>
                    <th className="text-right text-xs font-bold text-muted uppercase py-2">{t('sidebar.sales')}</th>
                    <th className="text-right text-xs font-bold text-muted uppercase py-2">{t('dashboard.conversion')}</th>
                  </tr>
                </thead>
                <tbody>
                  {topOperators.map((op, idx) => (
                    <tr key={idx} className="border-b border-line/50 hover:bg-aqua-1/20">
                      <td className="py-3 text-sm text-ink font-medium">{op.name}</td>
                      <td className="py-3 text-sm text-ink text-right">{op.leads}</td>
                      <td className="py-3 text-sm text-ink text-right">{op.sales}</td>
                      <td className="py-3 text-sm text-ink text-right font-semibold">{op.conversion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-muted">
              {t('dashboard.noData')}
            </div>
          )}
        </div>
      </div>

      {/* Pipeline and Hot Leads */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Pipeline */}
        <div className="lg:col-span-2 bg-white border border-line rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-bold text-ink mb-4">{t('dashboard.opportunityPipeline')}</h3>
          {pipeline.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-line">
                    <th className="text-left text-xs font-bold text-muted uppercase py-2">{t('dashboard.customer')}</th>
                    <th className="text-left text-xs font-bold text-muted uppercase py-2">{t('dashboard.stage')}</th>
                    <th className="text-right text-xs font-bold text-muted uppercase py-2">{t('common.value')}</th>
                    <th className="text-left text-xs font-bold text-muted uppercase py-2">{t('dashboard.nextStep')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pipeline.map((item, idx) => (
                    <tr key={item.id || idx} className="border-b border-line/50 hover:bg-aqua-1/20 cursor-pointer">
                      <td className="py-3 text-sm text-ink font-medium">{item.customer}</td>
                      <td className="py-3 text-sm text-muted">{item.stage}</td>
                      <td className="py-3 text-sm text-ink text-right font-semibold">{item.value}</td>
                      <td className="py-3 text-sm text-muted">{item.next_step}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-muted">
              {t('dashboard.noPipeline')}
            </div>
          )}
        </div>

        {/* Hot Leads */}
        <div className="bg-white border border-line rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-bold text-ink mb-4">{t('dashboard.hotLeadsToCall')}</h3>
          {hotLeads.length > 0 ? (
            <div className="space-y-3">
              {hotLeads.map((lead, idx) => (
                <div key={lead.id || idx} className="p-3 border border-line rounded-xl hover:bg-aqua-1/20 transition-colors cursor-pointer">
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <p className="text-sm font-semibold text-ink">{lead.name}</p>
                      <p className="text-xs text-muted">{lead.source}</p>
                    </div>
                    <span className="text-xs">{lead.heat}</span>
                  </div>
                  {lead.phone && (
                    <a 
                      href={`tel:${lead.phone}`}
                      className="mt-2 inline-block text-xs px-3 py-1 bg-aqua-5 text-white rounded-lg hover:bg-aqua-4 transition-colors"
                    >
                      📞 {t('dashboard.call')}
                    </a>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-muted">
              {t('dashboard.noHotLeads')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
