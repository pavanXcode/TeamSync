import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  FolderKanban,
  UserCheck,
  AlertTriangle,
  GitCompare,
  Clock,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Plus,
  UserPlus,
  Scale,
  Database,
  Layers,
  Activity,
  CheckCircle2,
  Info,
  ExternalLink,
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
  ReferenceLine,
} from 'recharts';

import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import AlertBanner from '../components/AlertBanner';
import dashboardService from '../services/dashboardService';

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [isSampleData, setIsSampleData] = useState(false);
  const [backendOffline, setBackendOffline] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const loadDashboard = useCallback(async (forceSample = false) => {
    try {
      setLoading(true);
      const res = await dashboardService.getDashboardData(forceSample);
      setData(res);
      setIsSampleData(res.isSample);
      setBackendOffline(res.isSample);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
      setIsRetrying(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleRetryConnection = () => {
    setIsRetrying(true);
    loadDashboard(false);
  };

  const handleToggleDataMode = () => {
    loadDashboard(!isSampleData);
  };

  const kpis = data?.kpis || {};
  const hasEmployees = (kpis.totalEmployees || 0) > 0;
  const hasProjects = (kpis.activeProjects || 0) > 0;
  const hasChartsData = (data?.departmentWorkloadData || []).length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workforce Intelligence Overview"
        description="High-level visibility into enterprise talent distribution, project health, AI team allocations, and real-time delivery risks."
        badge="Telemetry Hub"
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRetryConnection}
              disabled={isRetrying}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
              title="Ping http://127.0.0.1:8002"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh Data</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/team-builder')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition-colors cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Smart Team Builder</span>
            </button>
          </div>
        }
      />

      {/* Backend Status / Sample Data Banner */}
      {backendOffline && (
        <AlertBanner
          type="offline"
          title="FastAPI Backend Offline:"
          message={
            <span>
              Could not reach <code className="font-mono text-slate-900 bg-slate-200/60 px-1 py-0.5 rounded">http://127.0.0.1:8002</code>. Displaying clearly labeled{' '}
              <strong className="text-blue-700 underline decoration-blue-300">Development Sample Data</strong> for UI inspection.
            </span>
          }
          actionText={isRetrying ? 'Checking...' : 'Retry Backend'}
          onAction={handleRetryConnection}
          isRetrying={isRetrying}
        />
      )}

      {/* Development Sample Data Pill Indicator */}
      {isSampleData && (
        <div className="flex items-center justify-between rounded-lg bg-blue-50/70 border border-blue-200/70 px-4 py-2 text-xs text-blue-900">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
            <span className="font-semibold uppercase tracking-wider text-[11px] text-blue-800">
              [Development Sample Data Mode Active]
            </span>
            <span className="hidden md:inline text-blue-600/80">
              &mdash; Visualizations reflect sample talent & initiative vectors. Start FastAPI backend at port 8002 to stream live telemetry.
            </span>
          </div>
          <button
            type="button"
            onClick={handleToggleDataMode}
            className="text-[11px] font-semibold text-blue-700 hover:underline cursor-pointer"
          >
            Switch to Raw Empty State
          </button>
        </div>
      )}

      {/* 6 Core KPI Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          title="Total Employees"
          value={hasEmployees ? kpis.totalEmployees : null}
          empty={!hasEmployees && !loading}
          emptyText="No employees loaded"
          icon={Users}
          subtitle="Talent pool headcount"
          actionText="Directory"
          onAction={() => navigate('/employees')}
        />

        <StatCard
          title="Active Projects"
          value={hasProjects ? kpis.activeProjects : null}
          empty={!hasProjects && !loading}
          emptyText="No initiatives active"
          icon={FolderKanban}
          subtitle="In-flight initiatives"
          actionText="Projects"
          onAction={() => navigate('/projects')}
        />

        <StatCard
          title="Available Talent"
          value={hasEmployees ? kpis.availableEmployees : null}
          empty={!hasEmployees && !loading}
          emptyText="Awaiting roster"
          icon={UserCheck}
          subtitle="Capacity < 75%"
          badge={hasEmployees ? 'Ready' : null}
        />

        <StatCard
          title="High Workload"
          value={hasEmployees ? kpis.highWorkloadEmployees : null}
          empty={!hasEmployees && !loading}
          emptyText="0 alerts"
          icon={AlertTriangle}
          subtitle="Bandwidth >= 90%"
          changeType={kpis.highWorkloadEmployees > 0 ? 'negative' : 'neutral'}
          change={kpis.highWorkloadEmployees > 0 ? 'Alert' : null}
        />

        <StatCard
          title="Critical Skill Gaps"
          value={hasProjects ? kpis.criticalSkillGaps : null}
          empty={!hasProjects && !loading}
          emptyText="Audit pending"
          icon={GitCompare}
          subtitle="Uncovered needs"
          actionText="Audit"
          onAction={() => navigate('/skill-gaps')}
        />

        <StatCard
          title="Deadline Risk"
          value={hasProjects ? kpis.projectsAtRisk : null}
          empty={!hasProjects && !loading}
          emptyText="0 risks reported"
          icon={Clock}
          subtitle="Milestones in jeopardy"
          actionText="Inspect"
          onAction={() => navigate('/risks')}
        />
      </div>

      {/* Main Visualizations Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Chart 1: Department Workload & Utilization */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Department Workload & Utilization
              </h2>
              <p className="text-xs text-slate-500">
                Average resource utilization vs optimal benchmark (80%)
              </p>
            </div>
            {isSampleData && (
              <span className="text-[10px] font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100 self-start sm:self-auto">
                Sample Preview
              </span>
            )}
          </div>

          <div className="mt-4 pt-2">
            {hasChartsData ? (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.departmentWorkloadData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 25 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="department"
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                    />
                    <YAxis
                      domain={[0, 120]}
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      unit="%"
                    />
                    <Tooltip
                      formatter={(val) => [`${val}%`, 'Avg Utilization']}
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        borderColor: '#e2e8f0',
                        borderRadius: '0.75rem',
                        fontSize: '12px',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      }}
                    />
                    <ReferenceLine
                      y={80}
                      stroke="#f59e0b"
                      strokeDasharray="4 4"
                      label={{
                        value: 'Optimal 80%',
                        position: 'insideTopRight',
                        fill: '#d97706',
                        fontSize: 10,
                      }}
                    />
                    <Bar
                      dataKey="avgWorkload"
                      name="Average Utilization %"
                      fill="#2563eb"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-64 flex-col items-center justify-center text-center p-6 border border-dashed border-slate-200 rounded-lg">
                <Activity className="h-8 w-8 text-slate-300 mb-2" />
                <p className="text-xs font-semibold text-slate-700">No Utilization Data</p>
                <p className="text-[11px] text-slate-400 max-w-xs mt-1">
                  Connect employee profiles with workload allocations to generate department utilization charts.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Chart 2: Skill Demand vs Talent Supply */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Skills Demand vs Talent Supply
              </h2>
              <p className="text-xs text-slate-500">
                Project competency requirements compared to verified employee roster
              </p>
            </div>
            {isSampleData && (
              <span className="text-[10px] font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100 self-start sm:self-auto">
                Sample Preview
              </span>
            )}
          </div>

          <div className="mt-4 pt-2">
            {(data?.skillsChartData || []).length > 0 ? (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.skillsChartData}
                    layout="vertical"
                    margin={{ top: 10, right: 20, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} allowDecimals={false} />
                    <YAxis
                      dataKey="skill"
                      type="category"
                      width={100}
                      tick={{ fill: '#475569', fontSize: 11, fontWeight: 500 }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        borderColor: '#e2e8f0',
                        borderRadius: '0.75rem',
                        fontSize: '12px',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                    />
                    <Bar
                      dataKey="projectDemand"
                      name="Projects Needing Skill"
                      fill="#6366f1"
                      radius={[0, 4, 4, 0]}
                    />
                    <Bar
                      dataKey="talentSupply"
                      name="Qualified Employees"
                      fill="#10b981"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-64 flex-col items-center justify-center text-center p-6 border border-dashed border-slate-200 rounded-lg">
                <GitCompare className="h-8 w-8 text-slate-300 mb-2" />
                <p className="text-xs font-semibold text-slate-700">No Competency Data</p>
                <p className="text-[11px] text-slate-400 max-w-xs mt-1">
                  Tag skills on employee profiles and project initiatives to populate the balance matrix.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Section: Project Risk Breakdown & Recent Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Project Priority & Health Stacked Breakdown */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Initiative Risk by Priority Tier
              </h2>
              <p className="text-xs text-slate-500">
                Distribution of on-track vs deadline-risk projects
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/risks')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1 cursor-pointer"
            >
              Risk Predictor &rarr;
            </button>
          </div>

          <div className="mt-4">
            {(data?.priorityRiskData || []).length > 0 ? (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.priorityRiskData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 11 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        borderColor: '#e2e8f0',
                        borderRadius: '0.75rem',
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="low" name="On Track" stackId="a" fill="#10b981" />
                    <Bar dataKey="moderate" name="Moderate Risk" stackId="a" fill="#f59e0b" />
                    <Bar dataKey="high" name="High Risk" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-56 flex-col items-center justify-center text-center p-6 border border-dashed border-slate-200 rounded-lg">
                <Clock className="h-8 w-8 text-slate-300 mb-2" />
                <p className="text-xs font-semibold text-slate-700">No Projects Tracked</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Create initiatives in the Projects module to map schedule milestones.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions & Recent Activity Feed */}
        <div className="space-y-6">
          {/* Quick Actions Card */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Quick Actions
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => navigate('/projects')}
                className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/50 p-3 hover:bg-blue-50/60 hover:border-blue-200 transition-colors text-center cursor-pointer group"
              >
                <Plus className="h-4 w-4 text-blue-600 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-semibold text-slate-800">New Initiative</span>
              </button>

              <button
                type="button"
                onClick={() => navigate('/employees')}
                className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/50 p-3 hover:bg-blue-50/60 hover:border-blue-200 transition-colors text-center cursor-pointer group"
              >
                <UserPlus className="h-4 w-4 text-indigo-600 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-semibold text-slate-800">Add Member</span>
              </button>

              <button
                type="button"
                onClick={() => navigate('/team-builder')}
                className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/50 p-3 hover:bg-blue-50/60 hover:border-blue-200 transition-colors text-center cursor-pointer group"
              >
                <Sparkles className="h-4 w-4 text-amber-500 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-semibold text-slate-800">Team Builder</span>
              </button>

              <button
                type="button"
                onClick={() => navigate('/workload')}
                className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/50 p-3 hover:bg-blue-50/60 hover:border-blue-200 transition-colors text-center cursor-pointer group"
              >
                <Scale className="h-4 w-4 text-emerald-600 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-semibold text-slate-800">Balance Load</span>
              </button>
            </div>
          </div>

          {/* Recent Activity Feed */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Recent System Activity
            </h3>
            <div className="space-y-3">
              {(data?.recentActivities || []).map((act) => (
                <div key={act.id} className="flex items-start gap-2.5 text-xs">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                    <Activity className="h-3 w-3" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-800 truncate">{act.action}</p>
                    <p className="text-[11px] text-slate-500 truncate">{act.target}</p>
                    <span className="text-[10px] text-slate-400">{act.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
