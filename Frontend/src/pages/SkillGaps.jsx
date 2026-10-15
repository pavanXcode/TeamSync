import React, { useState, useEffect, useCallback } from 'react';
import {
  GitCompare,
  TrendingUp,
  AlertCircle,
  GraduationCap,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Briefcase,
  Layers,
  ArrowRight,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import AlertBanner from '../components/AlertBanner';
import projectService from '../services/projectService';
import workforceIntelligenceService from '../services/workforceIntelligenceService';

export default function SkillGaps() {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('all');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [isSampleData, setIsSampleData] = useState(false);
  const [apiError, setApiError] = useState(null);

  // Load project options and initial analysis
  const loadData = useCallback(async (projId = selectedProjectId) => {
    try {
      setLoading(true);
      setApiError(null);

      // Fetch projects for selector
      const projRes = await projectService.getProjects();
      setProjects(projRes.data || []);

      // Fetch skill gap analysis
      const targetId = projId === 'all' ? null : projId;
      const gapRes = await workforceIntelligenceService.getSkillGapAnalysis(targetId);
      setData(gapRes.data);
      setIsSampleData(gapRes.isSample);
      if (gapRes.error) {
        setApiError('FastAPI backend at http://127.0.0.1:8002 is offline. Displaying development sample audit.');
      }
    } catch (err) {
      setApiError(err.message || 'Failed to retrieve skill gap telemetry.');
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    loadData('all');
  }, [loadData]);

  const handleScopeChange = (e) => {
    const newId = e.target.value;
    setSelectedProjectId(newId);
    loadData(newId);
  };

  const hasData = data && (data.total_required_skills || 0) > 0;
  const chartData = data?.chart_data || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Skill Gap Analysis"
        description="Diagnose organizational skill deficits, benchmark capabilities against upcoming initiative requirements, and inform targeted hiring."
        badge="Capability Audit"
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => loadData(selectedProjectId)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Re-run Audit</span>
            </button>
          </div>
        }
      />

      {/* Backend Offline / Sample Data Notification */}
      {isSampleData && (
        <AlertBanner
          type="offline"
          title="FastAPI Backend Offline:"
          message="Skill Gap Analysis is running with Development Sample Data. Analysis reflects cross-tabulated requirements across project initiatives."
          actionText="Ping Backend"
          onAction={() => loadData(selectedProjectId)}
        />
      )}

      {/* Scope Selector Bar */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-blue-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Audit Scope Target:
            </span>
          </div>

          <div className="flex items-center gap-2 max-w-md w-full sm:w-auto">
            <select
              value={selectedProjectId}
              onChange={handleScopeChange}
              className="w-full sm:w-80 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs sm:text-sm font-semibold text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-hidden"
            >
              <option value="all">Enterprise Portfolio (All Initiatives)</option>
              {projects.map((proj) => (
                <option key={proj.id} value={proj.id}>
                  {proj.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPI Metric Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Capability Coverage"
          value={hasData ? `${data.overall_coverage_pct}%` : null}
          empty={!hasData && !loading}
          emptyText="Audit not initialized"
          icon={TrendingUp}
          subtitle="Satisfied skill ratio"
          badge={hasData && data.overall_coverage_pct >= 80 ? 'Healthy' : 'Deficit Risk'}
        />

        <StatCard
          title="Required Competencies"
          value={hasData ? data.total_required_skills : null}
          empty={!hasData && !loading}
          emptyText="0 tracked"
          icon={Briefcase}
          subtitle="Unique skills in scope"
        />

        <StatCard
          title="Deficit Skill Gaps"
          value={hasData ? data.deficit_skills_count : null}
          empty={!hasData && !loading}
          emptyText="0 deficits"
          icon={AlertCircle}
          subtitle="Unsatisfied needs"
          changeType={data?.deficit_skills_count > 0 ? 'negative' : 'neutral'}
          change={data?.deficit_skills_count > 0 ? 'Action Required' : 'All Covered'}
        />

        <StatCard
          title="Upskilling Programs"
          value={hasData ? (data.training_suggestions || []).length : null}
          empty={!hasData && !loading}
          emptyText="0 recommendations"
          icon={GraduationCap}
          subtitle="Targeted training pathways"
        />
      </div>

      {/* Chart: Required Demand vs Qualified Talent Supply */}
      {chartData.length > 0 && (
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Competency Requirements vs Verified Talent Supply
              </h2>
              <p className="text-xs text-slate-500">
                Visualizing shortages across technical proficiencies for selected initiatives
              </p>
            </div>
            {isSampleData && (
              <span className="text-[10px] font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100">
                Sample Data Preview
              </span>
            )}
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 20, left: 0, bottom: 25 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="skill"
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  angle={-15}
                  textAnchor="end"
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: '#64748b', fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#e2e8f0',
                    borderRadius: '0.75rem',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar
                  dataKey="required"
                  name="Required in Projects"
                  fill="#ef4444"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="available"
                  name="Available in Workforce"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Detailed Skill Gaps & Training Recommendations */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: Identified Skill Deficits */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Critical Capability Deficits
              </h3>
              <p className="text-xs text-slate-500">
                Skills with deficient workforce availability
              </p>
            </div>
            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700 border border-rose-200">
              {(data?.deficient_skills || []).length} Deficits
            </span>
          </div>

          {(data?.deficient_skills || []).length > 0 ? (
            <div className="space-y-3">
              {data.deficient_skills.map((item) => (
                <div
                  key={item.skill}
                  className="rounded-lg border border-slate-200/80 bg-slate-50/50 p-3.5 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-xs sm:text-sm">
                      {item.skill}
                    </span>
                    {item.is_critical ? (
                      <span className="inline-flex items-center gap-1 rounded bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                        <AlertCircle className="h-3 w-3" /> Critical Shortage
                      </span>
                    ) : (
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                        Moderate Deficit
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>Available: <strong>{item.available_count}</strong> / {item.required_count} needed</span>
                      <span className="font-semibold text-rose-600">Shortage: -{item.deficit}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full bg-rose-500"
                        style={{ width: `${item.coverage_pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-48 flex-col items-center justify-center text-center p-6 border border-dashed border-slate-200 rounded-lg">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2" />
              <p className="text-xs font-bold text-slate-800">No Critical Gaps Detected</p>
              <p className="text-[11px] text-slate-400 mt-1">
                All technical proficiencies required by the selected scope are fully satisfied.
              </p>
            </div>
          )}
        </div>

        {/* Right: Training & Hiring Recommendations */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Actionable Talent Recommendations
              </h3>
              <p className="text-xs text-slate-500">
                Targeted upskilling and recruitment strategies
              </p>
            </div>
            <GraduationCap className="h-4 w-4 text-indigo-600" />
          </div>

          {(data?.training_suggestions || []).length > 0 ? (
            <div className="space-y-3">
              {data.training_suggestions.map((rec) => (
                <div
                  key={rec.skill}
                  className="rounded-lg border border-slate-200/80 bg-slate-50/50 p-3.5 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-xs">
                      Focus: {rec.skill}
                    </span>
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-200">
                      {rec.recommendation_type}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    {rec.rationale}
                  </p>

                  {rec.candidates_for_upskilling.length > 0 && (
                    <div className="border-t border-slate-200/60 pt-2 text-[11px] text-slate-500 flex items-center justify-between">
                      <span>Upskilling Candidates:</span>
                      <span className="font-semibold text-slate-800">
                        {rec.candidates_for_upskilling.join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-48 flex-col items-center justify-center text-center p-6 border border-dashed border-slate-200 rounded-lg">
              <UserCheck className="h-8 w-8 text-indigo-400 mb-2" />
              <p className="text-xs font-bold text-slate-800">No Action Required</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Organizational capabilities match current initiative roadmaps.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
