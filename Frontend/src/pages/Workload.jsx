import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Scale,
  Activity,
  AlertCircle,
  Calendar,
  Layers,
  CheckCircle2,
  Users,
  ArrowRight,
  RefreshCw,
  Search,
  Filter,
  ShieldCheck,
  Zap,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';

import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import Modal from '../components/Modal';
import AlertBanner from '../components/AlertBanner';
import workforceIntelligenceService from '../services/workforceIntelligenceService';

export default function Workload() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [isSampleData, setIsSampleData] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Filters
  const [statusTierFilter, setStatusTierFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Rebalance Confirmation Modal State
  const [isRebalanceModalOpen, setIsRebalanceModalOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(null);
  const [isApplying, setIsApplying] = useState(false);

  // Load workload data
  const loadWorkload = useCallback(async () => {
    try {
      setLoading(true);
      setApiError(null);
      const res = await workforceIntelligenceService.getWorkloadData();
      setData(res.data);
      setIsSampleData(res.isSample);
      if (res.error) {
        setApiError('FastAPI backend at http://127.0.0.1:8002 is offline. Displaying development sample telemetry.');
      }
    } catch (err) {
      setApiError(err.message || 'Failed to retrieve workload metrics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkload();
  }, [loadWorkload]);

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    if (!data?.employees) return [];
    return data.employees.filter((emp) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        emp.name?.toLowerCase().includes(q) ||
        emp.department?.toLowerCase().includes(q) ||
        (emp.current_projects || []).some((p) => p.toLowerCase().includes(q));

      const matchesTier =
        statusTierFilter === 'all' || emp.status_tier === statusTierFilter;

      const matchesDept =
        departmentFilter === 'all' || emp.department === departmentFilter;

      return matchesSearch && matchesTier && matchesDept;
    });
  }, [data, searchQuery, statusTierFilter, departmentFilter]);

  // Open Rebalance Confirmation
  const handleOpenRebalance = (suggestion) => {
    setActiveSuggestion(suggestion);
    setIsRebalanceModalOpen(true);
  };

  // Submit Rebalance
  const handleConfirmRebalance = async () => {
    if (!activeSuggestion) return;
    try {
      setIsApplying(true);
      await workforceIntelligenceService.applyRebalance(activeSuggestion);
      setIsRebalanceModalOpen(false);
      setSuccessMessage(
        `Successfully transferred module to ${activeSuggestion.target_employee_name}. Workloads re-balanced.`
      );
      await loadWorkload();
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setApiError(err.message || 'Failed to apply workload rebalancing.');
    } finally {
      setIsApplying(false);
    }
  };

  // Workload bar helper
  const getWorkloadStyle = (pct) => {
    const val = Number(pct) || 0;
    if (val >= 90) {
      return {
        bar: 'bg-rose-500',
        text: 'text-rose-700 font-bold',
        badge: 'bg-rose-50 text-rose-700 border-rose-200',
        label: 'Overloaded',
      };
    }
    if (val >= 70) {
      return {
        bar: 'bg-blue-600',
        text: 'text-blue-700 font-semibold',
        badge: 'bg-blue-50 text-blue-700 border-blue-200',
        label: 'Balanced',
      };
    }
    return {
      bar: 'bg-emerald-500',
      text: 'text-emerald-700 font-medium',
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      label: 'Available Capacity',
    };
  };

  const hasData = data && (data.total_workforce || 0) > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workload Balancer"
        description="Monitor talent capacity and distribution across active projects to prevent burnout and resolve under-utilization."
        badge="Bandwidth Control"
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadWorkload}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh Data</span>
            </button>
          </div>
        }
      />

      {/* Success Banner */}
      {successMessage && (
        <AlertBanner
          type="success"
          message={successMessage}
          onClose={() => setSuccessMessage(null)}
        />
      )}

      {/* Backend Offline / Sample Data Notification */}
      {isSampleData && (
        <AlertBanner
          type="offline"
          title="FastAPI Backend Offline:"
          message="Workload Balancer is utilizing Development Sample Telemetry. Simulated reassignments update local state immediately."
          actionText="Ping Backend"
          onAction={loadWorkload}
        />
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Average Utilization"
          value={hasData ? `${data.average_workload_pct}%` : null}
          empty={!hasData && !loading}
          emptyText="Awaiting sync"
          icon={Activity}
          subtitle="Target threshold: 75% - 85%"
        />

        <StatCard
          title="Overloaded Staff"
          value={hasData ? data.overloaded_count : null}
          empty={!hasData && !loading}
          emptyText="0 alerts"
          icon={AlertCircle}
          subtitle="Exceeding 90% threshold"
          changeType={data?.overloaded_count > 0 ? 'negative' : 'neutral'}
          change={data?.overloaded_count > 0 ? 'Burnout Alert' : 'Nominal'}
        />

        <StatCard
          title="Balanced Capacity"
          value={hasData ? data.balanced_count : null}
          empty={!hasData && !loading}
          emptyText="0 active"
          icon={Scale}
          subtitle="70% - 89% optimal tier"
        />

        <StatCard
          title="Underutilized Staff"
          value={hasData ? data.underutilized_count : null}
          empty={!hasData && !loading}
          emptyText="0 available"
          icon={Users}
          subtitle="Capacity < 70% available"
        />
      </div>

      {/* Backend Rebalancing Suggestions Panel */}
      {(data?.balancing_suggestions || []).length > 0 && (
        <div className="rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50/70 via-blue-50/40 to-white p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">
                AI Workload Balancing Suggestions
              </h3>
            </div>
            <span className="rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5">
              {data.balancing_suggestions.length} Actions Available
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {data.balancing_suggestions.map((sug) => (
              <div
                key={sug.id}
                className="rounded-lg border border-indigo-100 bg-white p-4 shadow-2xs space-y-3 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                    <span className="text-slate-800 font-bold">{sug.initiative_name}</span>
                    <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[10px] border border-amber-200">
                      Reassignment
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {sug.rationale}
                  </p>
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 pt-2.5">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-rose-600 font-bold">{sug.source_employee_name} ({sug.source_current_workload}%)</span>
                    <ArrowRight className="h-3 w-3 text-slate-400" />
                    <span className="text-emerald-600 font-bold">{sug.target_employee_name} ({sug.target_current_workload}%)</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenRebalance(sug)}
                    className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-700 transition-colors cursor-pointer"
                  >
                    Apply
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter and Search Tooling */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by team member, department, or project..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-hidden"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusTierFilter}
              onChange={(e) => setStatusTierFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:border-blue-500 focus:outline-hidden"
            >
              <option value="all">All Utilization Tiers</option>
              <option value="overloaded">Overloaded (≥ 90%)</option>
              <option value="balanced">Balanced (70% - 89%)</option>
              <option value="underutilized">Underutilized (&lt; 70%)</option>
            </select>

            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:border-blue-500 focus:outline-hidden"
            >
              <option value="all">All Departments</option>
              <option value="AI Research">AI Research</option>
              <option value="Engineering">Engineering</option>
              <option value="Product & Design">Product & Design</option>
              <option value="Data Science">Data Science</option>
              <option value="DevOps">DevOps</option>
            </select>
          </div>
        </div>
      </div>

      {/* Employee Workload Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="border-b border-slate-200/80 bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th scope="col" className="px-5 py-3.5">
                  Team Member
                </th>
                <th scope="col" className="px-4 py-3.5">
                  Current Deployments
                </th>
                <th scope="col" className="px-4 py-3.5">
                  Capacity Meter
                </th>
                <th scope="col" className="px-4 py-3.5">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredEmployees.map((emp) => {
                const wl = getWorkloadStyle(emp.current_workload_pct);
                return (
                  <tr key={emp.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-slate-900">{emp.name}</div>
                      <div className="text-[11px] text-slate-400">
                        {emp.role} &bull; {emp.department}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      {(emp.current_projects || []).length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {emp.current_projects.map((proj) => (
                            <span
                              key={proj}
                              className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700"
                            >
                              {proj}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs italic">
                          No active project assignments
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="w-36 space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className={wl.text}>{emp.current_workload_pct}%</span>
                          <span className="text-[10px] text-slate-400">
                            {100 - emp.current_workload_pct}% Reserve
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full ${wl.bar}`}
                            style={{ width: `${Math.min(emp.current_workload_pct, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${wl.badge}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${wl.bar}`} />
                        {wl.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* REBALANCE CONFIRMATION MODAL */}
      <Modal
        isOpen={isRebalanceModalOpen}
        onClose={() => setIsRebalanceModalOpen(false)}
        title="Confirm Workload Reassignment"
        subtitle="Verify proposed resource redistribution before submitting to FastAPI"
      >
        {activeSuggestion && (
          <div className="space-y-4">
            <div className="rounded-xl bg-blue-50/70 p-4 border border-blue-200/80 text-xs text-blue-900 leading-relaxed">
              <strong>Proposed Adjustment:</strong> {activeSuggestion.rationale}
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border border-slate-200 p-3 bg-slate-50">
                <span className="text-slate-400 block text-[11px] font-medium">Source Member</span>
                <span className="font-bold text-slate-900 text-sm block mt-0.5">
                  {activeSuggestion.source_employee_name}
                </span>
                <div className="mt-2 flex items-center justify-between text-slate-600">
                  <span>Workload:</span>
                  <span className="text-rose-600 font-bold">
                    {activeSuggestion.source_current_workload}% &rarr; {activeSuggestion.source_projected_workload}%
                  </span>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-3 bg-slate-50">
                <span className="text-slate-400 block text-[11px] font-medium">Target Member</span>
                <span className="font-bold text-slate-900 text-sm block mt-0.5">
                  {activeSuggestion.target_employee_name}
                </span>
                <div className="mt-2 flex items-center justify-between text-slate-600">
                  <span>Workload:</span>
                  <span className="text-emerald-600 font-bold">
                    {activeSuggestion.target_current_workload}% &rarr; {activeSuggestion.target_projected_workload}%
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsRebalanceModalOpen(false)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRebalance}
                disabled={isApplying}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                {isApplying ? 'Applying Rebalance...' : 'Confirm & Apply Rebalance'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
