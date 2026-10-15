import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Clock,
  ShieldCheck,
  Calendar,
  Activity,
  Layers,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertCircle,
  HelpCircle,
  Scale,
  Users,
} from 'lucide-react';

import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import AlertBanner from '../components/AlertBanner';
import workforceIntelligenceService from '../services/workforceIntelligenceService';

export default function DeadlineRisk() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [isSampleData, setIsSampleData] = useState(false);
  const [apiError, setApiError] = useState(null);

  // Filters
  const [riskFilter, setRiskFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Load Risk Telemetry
  const loadRiskData = useCallback(async () => {
    try {
      setLoading(true);
      setApiError(null);
      const res = await workforceIntelligenceService.getDeadlineRiskAnalysis();
      setData(res.data);
      setIsSampleData(res.isSample);
      if (res.error) {
        setApiError('FastAPI backend at http://127.0.0.1:8002 is offline. Displaying development sample predictive telemetry.');
      }
    } catch (err) {
      setApiError(err.message || 'Failed to retrieve deadline risk predictions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRiskData();
  }, [loadRiskData]);

  // Filtered projects
  const filteredProjects = useMemo(() => {
    if (!data?.projects) return [];
    return data.projects.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.name?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        (p.contributing_factors || []).some((f) => f.toLowerCase().includes(q));

      const matchesRisk =
        riskFilter === 'all' ||
        (riskFilter === 'critical_high' && (p.risk_level === 'critical' || p.risk_level === 'high')) ||
        p.risk_level === riskFilter;

      return matchesSearch && matchesRisk;
    });
  }, [data, searchQuery, riskFilter]);

  // Risk Level badge helper
  const getRiskBadge = (level, score) => {
    switch (level) {
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 border border-rose-200">
            <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
            Critical Risk ({score}%)
          </span>
        );
      case 'high':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 border border-amber-200">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            High Risk ({score}%)
          </span>
        );
      case 'moderate':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 border border-blue-200">
            Moderate Risk ({score}%)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            Low Risk / On Track ({score}%)
          </span>
        );
    }
  };

  const hasData = data && (data.total_projects_monitored || 0) > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Deadline Risk Predictor"
        description="Predictive milestone monitoring that flags potential schedule slippage, skill bottlenecks, and team dependency deadlocks before they escalate."
        badge="Early Warning System"
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadRiskData}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh Risk Model</span>
            </button>
          </div>
        }
      />

      {/* Backend Offline / Sample Notification */}
      {isSampleData && (
        <AlertBanner
          type="offline"
          title="FastAPI Backend Offline:"
          message="Deadline Risk Predictor is displaying Development Sample Telemetry based on milestone countdowns and staffing ratios. When the FastAPI model is active, predictive neural forecasts stream here."
          actionText="Ping Backend"
          onAction={loadRiskData}
        />
      )}

      {/* KPI StatCards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Monitored Initiatives"
          value={hasData ? data.total_projects_monitored : null}
          empty={!hasData && !loading}
          emptyText="0 initiatives"
          icon={Activity}
          subtitle="Portfolio active roadmap"
        />

        <StatCard
          title="Critical & High Risk"
          value={hasData ? data.high_critical_risk_count : null}
          empty={!hasData && !loading}
          emptyText="0 alerts"
          icon={AlertTriangle}
          subtitle="Slippage probability > 70%"
          changeType={data?.high_critical_risk_count > 0 ? 'negative' : 'neutral'}
          change={data?.high_critical_risk_count > 0 ? 'Action Needed' : 'Nominal'}
        />

        <StatCard
          title="Moderate Risk"
          value={hasData ? data.moderate_risk_count : null}
          empty={!hasData && !loading}
          emptyText="0 alerts"
          icon={Clock}
          subtitle="Watchlist initiatives"
        />

        <StatCard
          title="Nominal / On Track"
          value={hasData ? data.nominal_risk_count : null}
          empty={!hasData && !loading}
          emptyText="0 on track"
          icon={ShieldCheck}
          subtitle="Operating within schedule buffer"
        />
      </div>

      {/* Filter and Search Tooling */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search initiatives, bottlenecks, or contributing factors..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-hidden"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:border-blue-500 focus:outline-hidden"
            >
              <option value="all">All Risk Severity Tiers</option>
              <option value="critical_high">Critical & High Risk Only</option>
              <option value="moderate">Moderate Risk</option>
              <option value="low">Low Risk / On Track</option>
            </select>
          </div>
        </div>
      </div>

      {/* Risk Projects Feed */}
      <div className="space-y-4">
        {filteredProjects.map((proj) => (
          <div
            key={proj.id}
            className={`rounded-xl border p-5 shadow-xs transition-all space-y-4 bg-white ${
              proj.risk_level === 'critical'
                ? 'border-rose-200 shadow-rose-50/50'
                : proj.risk_level === 'high'
                ? 'border-amber-200 shadow-amber-50/50'
                : 'border-slate-200/80'
            }`}
          >
            {/* Header: Title, Deadline, Risk Badge */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">
                    {proj.name}
                  </h3>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 uppercase">
                    {proj.priority} Priority
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                  <span>Target Deadline: <strong className="text-slate-800">{proj.deadline}</strong></span>
                  <span>&bull;</span>
                  <span className={proj.days_left <= 15 ? 'text-rose-600 font-bold' : 'text-slate-600'}>
                    {proj.days_left < 0 ? `Overdue by ${Math.abs(proj.days_left)} days` : `${proj.days_left} days remaining`}
                  </span>
                  <span>&bull;</span>
                  <span>Staffing: <strong>{proj.assigned_count}</strong> / {proj.desired_team_size} members</span>
                </div>
              </div>

              <div>{getRiskBadge(proj.risk_level, proj.risk_score)}</div>
            </div>

            {/* Contributing Factors & Mitigation Suggestions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left: Contributing Factors */}
              <div className="rounded-lg bg-slate-50/70 p-3.5 border border-slate-100 space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" /> Contributing Risk Factors
                </span>
                <ul className="space-y-1.5 text-xs text-slate-700">
                  {proj.contributing_factors.map((factor, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-rose-500 font-bold mt-0.5">&bull;</span>
                      <span>{factor}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Right: Actionable Mitigation Suggestions */}
              <div className="rounded-lg bg-emerald-50/40 p-3.5 border border-emerald-100 space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Recommended Mitigation Actions
                </span>
                <ul className="space-y-1.5 text-xs text-slate-700">
                  {proj.mitigation_suggestions.map((mit, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
                      <span>{mit}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Action Triggers Footer */}
            <div className="flex flex-wrap items-center justify-between border-t border-slate-100 pt-3 gap-2">
              <div className="flex flex-wrap gap-1 text-[11px] text-slate-500 items-center">
                <span className="font-medium text-slate-400">Required Skills:</span>
                {(proj.required_skills || []).map((s) => (
                  <span key={s} className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] text-slate-700">
                    {s}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/workload')}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
                >
                  <Scale className="h-3.5 w-3.5 text-slate-500" />
                  Workload Balancer
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/team-builder?projectId=${proj.id}`)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition-colors cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Resolve in Team Builder
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
