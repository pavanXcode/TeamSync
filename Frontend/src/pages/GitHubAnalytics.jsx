import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  GitPullRequest,
  GitBranch,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  Github,
  Calendar,
  Layers,
  ArrowUpDown,
  Check,
  Eye,
  AlertCircle,
  TrendingUp,
  UserCheck,
  X,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';

import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import AlertBanner from '../components/AlertBanner';
import Modal from '../components/Modal';
import { githubService } from '../services/githubService';

export default function GitHubAnalytics() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState(null);
  const [apiError, setApiError] = useState(null);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'overdue' | 'completed' | 'in_progress'
  const [sortBy, setSortBy] = useState('progress_desc'); // 'progress_desc' | 'progress_asc' | 'tasks_desc' | 'prs_desc'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Task Drilldown Modal
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [modalTypeFilter, setModalTypeFilter] = useState('all'); // 'all' | 'issue' | 'pull_request'

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setApiError(null);

    const params = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;

    try {
      const res = await githubService.getProgress(params);
      setData(res.data);
      if (res.error) {
        setApiError(res.error);
      }
    } catch (err) {
      setApiError(err.message || 'Failed to fetch GitHub progress analytics.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    if (!data?.employee_progress) return [];

    return data.employee_progress
      .filter((emp) => {
        // Search filter
        const matchSearch =
          !searchTerm ||
          emp.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (emp.github_username && emp.github_username.toLowerCase().includes(searchTerm.toLowerCase())) ||
          emp.job_title.toLowerCase().includes(searchTerm.toLowerCase());

        // Department filter
        const matchDept = selectedDept === 'all' || emp.department === selectedDept;

        // Status filter
        let matchStatus = true;
        if (statusFilter === 'overdue') {
          matchStatus = emp.overdue_tasks > 0;
        } else if (statusFilter === 'completed') {
          matchStatus = emp.assigned_tasks > 0 && emp.task_progress_pct === 100;
        } else if (statusFilter === 'in_progress') {
          matchStatus = emp.open_tasks > 0;
        }

        return matchSearch && matchDept && matchStatus;
      })
      .sort((a, b) => {
        if (sortBy === 'progress_desc') return b.task_progress_pct - a.task_progress_pct;
        if (sortBy === 'progress_asc') return a.task_progress_pct - b.task_progress_pct;
        if (sortBy === 'tasks_desc') return b.assigned_tasks - a.assigned_tasks;
        if (sortBy === 'prs_desc') return b.prs_merged - a.prs_merged;
        return 0;
      });
  }, [data, searchTerm, selectedDept, statusFilter, sortBy]);

  // Chart data: Department Task Progress & PR Volume
  const departmentChartData = useMemo(() => {
    if (!data?.employee_progress) return [];
    const depts = {};

    data.employee_progress.forEach((emp) => {
      if (!depts[emp.department]) {
        depts[emp.department] = {
          department: emp.department,
          assignedTasks: 0,
          completedTasks: 0,
          prsMerged: 0,
        };
      }
      depts[emp.department].assignedTasks += emp.assigned_tasks;
      depts[emp.department].completedTasks += emp.completed_tasks;
      depts[emp.department].prsMerged += emp.prs_merged;
    });

    return Object.values(depts).map((d) => ({
      ...d,
      progressPct: d.assignedTasks > 0 ? Math.round((d.completedTasks / d.assignedTasks) * 100) : 0,
    }));
  }, [data]);

  // Modal tasks for selected employee
  const modalTasks = useMemo(() => {
    if (!selectedEmployee || !data?.tasks) return [];
    return data.tasks.filter((t) => {
      const matchEmp = t.assigned_employee_id === selectedEmployee.employee_id;
      const matchType = modalTypeFilter === 'all' || t.type === modalTypeFilter;
      return matchEmp && matchType;
    });
  }, [selectedEmployee, data, modalTypeFilter]);

  const handleOpenTaskModal = (emp) => {
    setSelectedEmployee(emp);
    setModalTypeFilter('all');
    setIsTaskModalOpen(true);
  };

  const isSample = data?.connection_status?.is_sample;
  const isConnected = data?.connection_status?.is_connected;
  const repoOwner = data?.connection_status?.owner || 'Unconfigured';
  const repoName = data?.connection_status?.repo || 'Unconfigured';
  const lastSync = data?.connection_status?.last_sync
    ? new Date(data.connection_status.last_sync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Never';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="GitHub Task Analytics"
        description="Engineering velocity and accepted task delivery tracking powered by real GitHub issue & pull request telemetry."
        badge="Live Telemetry"
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Connection Status Pill */}
            <div
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-2xs ${
                isConnected
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-blue-200 bg-blue-50 text-blue-800'
              }`}
            >
              <Github className="h-4 w-4" />
              <span>{repoOwner}/{repoName}</span>
              <span
                className={`h-2 w-2 rounded-full ${
                  isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-blue-500'
                }`}
              />
              <span className="text-[11px] font-medium opacity-80">
                {isConnected ? 'Connected' : 'Sample Mode'}
              </span>
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => fetchData(true)}
              disabled={refreshing || loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Syncing...' : 'Sync GitHub'}</span>
            </button>
          </div>
        }
      />

      {/* Mode / Warning Banner */}
      {isSample && (
        <AlertBanner
          type="info"
          title="Development Sample Telemetry Active:"
          message={
            <span>
              GitHub backend environment variables (<code>GITHUB_OWNER</code>, <code>GITHUB_REPO</code>, <code>GITHUB_TOKEN</code>) are not yet configured. Displaying deterministic development sample telemetry for UI inspection.
            </span>
          }
        />
      )}

      {apiError && !isSample && (
        <AlertBanner
          type="warning"
          title="GitHub Sync Alert:"
          message={apiError}
          actionText="Retry Sync"
          onAction={() => fetchData(true)}
          isRetrying={refreshing}
        />
      )}

      {/* Top Team KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          title="Task Delivery Rate"
          value={`${data?.team_summary?.overall_task_progress_pct ?? 0}%`}
          icon={CheckCircle2}
          subtitle={`${data?.team_summary?.total_completed_tasks ?? 0} of ${data?.team_summary?.total_eligible_tasks ?? 0} tasks completed`}
          badge="Core Rule"
        />
        <StatCard
          title="Eligible Tasks"
          value={data?.team_summary?.total_eligible_tasks ?? 0}
          icon={Layers}
          subtitle={`${data?.team_summary?.total_completed_tasks ?? 0} closed / accepted`}
        />
        <StatCard
          title="PR Throughput"
          value={data?.team_summary?.total_prs_merged ?? 0}
          icon={GitPullRequest}
          subtitle={`${data?.team_summary?.total_prs_opened ?? 0} PRs opened by team`}
          change={`${data?.team_summary?.total_prs_opened ? Math.round(((data?.team_summary?.total_prs_merged || 0) / data.team_summary.total_prs_opened) * 100) : 0}% merge rate`}
          changeType="positive"
        />
        <StatCard
          title="Code Reviews"
          value={data?.team_summary?.total_reviews_completed ?? 0}
          icon={UserCheck}
          subtitle="Peer reviews completed"
        />
        <StatCard
          title="Overdue Tasks"
          value={data?.team_summary?.overdue_tasks_count ?? 0}
          icon={AlertTriangle}
          subtitle="Milestones past due date"
          changeType={data?.team_summary?.overdue_tasks_count > 0 ? 'negative' : 'neutral'}
          badge={data?.team_summary?.overdue_tasks_count > 0 ? 'Action Req' : 'Clear'}
        />
      </div>

      {/* Visual Analytics Chart */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Department Task Completion & PR Delivery
            </h2>
            <p className="text-xs text-slate-500">
              Assigned eligible tasks vs. completed deliveries and merged pull requests across squads
            </p>
          </div>
          <span className="text-[11px] text-slate-400">
            Last synced: <strong className="text-slate-600">{lastSync}</strong>
          </span>
        </div>

        <div className="h-64 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={departmentChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="department" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  borderColor: '#e2e8f0',
                  borderRadius: '0.75rem',
                  fontSize: '12px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
              <Bar dataKey="completedTasks" name="Completed Tasks" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="assignedTasks" name="Total Assigned Tasks" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="prsMerged" name="Merged Pull Requests" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search employee or GitHub handle..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Department Filter */}
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-medium text-slate-700 focus:border-blue-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="all">All Departments</option>
            {(data?.departments || []).map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>

          {/* Task Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-medium text-slate-700 focus:border-blue-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="all">All Task Statuses</option>
            <option value="overdue">Overdue Tasks Alert</option>
            <option value="completed">100% Completed Tasks</option>
            <option value="in_progress">Tasks In Progress</option>
          </select>

          {/* Sorting */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-medium text-slate-700 focus:border-blue-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="progress_desc">Sort: Progress % (High to Low)</option>
            <option value="progress_asc">Sort: Progress % (Low to High)</option>
            <option value="tasks_desc">Sort: Assigned Tasks (Most to Least)</option>
            <option value="prs_desc">Sort: PRs Merged (Most to Least)</option>
          </select>

          {/* Date range filters */}
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-1/2 rounded-lg border border-slate-200 bg-slate-50/50 px-2 py-1.5 text-[11px] text-slate-700 focus:border-blue-500 focus:bg-white focus:outline-hidden"
              title="Start Date"
            />
            <span className="text-slate-400 text-xs">&ndash;</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-1/2 rounded-lg border border-slate-200 bg-slate-50/50 px-2 py-1.5 text-[11px] text-slate-700 focus:border-blue-500 focus:bg-white focus:outline-hidden"
              title="End Date"
            />
          </div>
        </div>
      </div>

      {/* Employee Progress Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
            <thead className="bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-3.5 pl-4 pr-3 sm:pl-6">Employee & Role</th>
                <th className="px-3 py-3.5">Department</th>
                <th className="px-3 py-3.5">GitHub Identity</th>
                <th className="px-3 py-3.5">Task Progress (Completed / Assigned)</th>
                <th className="px-3 py-3.5">PR Throughput</th>
                <th className="px-3 py-3.5">Code Reviews</th>
                <th className="py-3.5 pl-3 pr-4 text-right sm:pr-6">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    <RefreshCw className="mx-auto h-6 w-6 animate-spin text-blue-500 mb-2" />
                    <span>Loading GitHub analytics...</span>
                  </td>
                </tr>
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    <AlertCircle className="mx-auto h-6 w-6 text-slate-300 mb-2" />
                    <span>No employee records match the selected filters.</span>
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => (
                  <tr key={emp.employee_id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Employee & Role */}
                    <td className="py-4 pl-4 pr-3 sm:pl-6">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 font-bold text-white shadow-2xs text-xs">
                          {emp.employee_name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{emp.employee_name}</p>
                          <p className="text-[11px] text-slate-400">{emp.job_title}</p>
                        </div>
                      </div>
                    </td>

                    {/* Department */}
                    <td className="px-3 py-4">
                      <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                        {emp.department}
                      </span>
                    </td>

                    {/* GitHub Username */}
                    <td className="px-3 py-4">
                      {emp.github_username ? (
                        <a
                          href={`https://github.com/${emp.github_username}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-mono text-xs text-blue-600 hover:underline"
                        >
                          <Github className="h-3 w-3" />
                          <span>@{emp.github_username}</span>
                        </a>
                      ) : (
                        <span className="text-slate-400 italic">Unmapped</span>
                      )}
                    </td>

                    {/* Task Progress */}
                    <td className="px-3 py-4 min-w-[200px]">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="text-slate-900">{emp.task_progress_pct}%</span>
                          <span className="text-slate-500 font-normal">
                            {emp.completed_tasks} / {emp.assigned_tasks} tasks
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              emp.task_progress_pct >= 80
                                ? 'bg-emerald-500'
                                : emp.task_progress_pct >= 40
                                ? 'bg-blue-500'
                                : 'bg-amber-500'
                            }`}
                            style={{ width: `${emp.task_progress_pct}%` }}
                          />
                        </div>
                        {emp.overdue_tasks > 0 && (
                          <div className="flex items-center gap-1 text-[11px] font-semibold text-rose-600">
                            <AlertTriangle className="h-3 w-3" />
                            <span>{emp.overdue_tasks} overdue task{emp.overdue_tasks > 1 ? 's' : ''}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* PR Activity */}
                    <td className="px-3 py-4">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                          <GitPullRequest className="h-3.5 w-3.5 text-indigo-500" />
                          <span>{emp.prs_merged} merged</span>
                          <span className="text-slate-400 font-normal">/ {emp.prs_opened} opened</span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {emp.pr_merge_rate_pct}% merge throughput
                        </p>
                      </div>
                    </td>

                    {/* Code Review Activity */}
                    <td className="px-3 py-4">
                      <div className="space-y-0.5">
                        <p className="font-semibold text-slate-900 text-xs">
                          {emp.reviews_completed} reviews
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {emp.reviews_requested} requested
                        </p>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-4 pl-3 pr-4 text-right sm:pr-6">
                      <button
                        type="button"
                        onClick={() => handleOpenTaskModal(emp)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
                      >
                        <Eye className="h-3.5 w-3.5 text-blue-500" />
                        <span>Tasks ({emp.assigned_tasks})</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Task & PR Drilldown Modal */}
      {selectedEmployee && (
        <Modal
          isOpen={isTaskModalOpen}
          onClose={() => setIsTaskModalOpen(false)}
          title={`Tasks & Deliverables — ${selectedEmployee.employee_name}`}
          subtitle={`Itemized GitHub issues and pull requests assigned to @${selectedEmployee.github_username || 'unmapped'}`}
          maxWidth="max-w-4xl"
        >
          <div className="space-y-4">
            {/* Filter pills inside modal */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setModalTypeFilter('all')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer ${
                    modalTypeFilter === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All ({modalTasks.length})
                </button>
                <button
                  type="button"
                  onClick={() => setModalTypeFilter('issue')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer ${
                    modalTypeFilter === 'issue'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Issues
                </button>
                <button
                  type="button"
                  onClick={() => setModalTypeFilter('pull_request')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer ${
                    modalTypeFilter === 'pull_request'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Pull Requests
                </button>
              </div>

              <span className="text-xs text-slate-400">
                {selectedEmployee.completed_tasks} of {selectedEmployee.assigned_tasks} completed accepted
              </span>
            </div>

            {/* Task list table */}
            <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-slate-200">
              <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="py-2.5 pl-3 pr-2">Item</th>
                    <th className="px-2 py-2.5">Type</th>
                    <th className="px-2 py-2.5">State</th>
                    <th className="px-2 py-2.5">Due Date</th>
                    <th className="py-2.5 pl-2 pr-3 text-right">Source Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600">
                  {modalTasks.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="py-8 text-center text-slate-400">
                        No tasks match the filter.
                      </td>
                    </tr>
                  ) : (
                    modalTasks.map((task) => (
                      <tr key={task.id} className="hover:bg-slate-50/70">
                        <td className="py-3 pl-3 pr-2 max-w-md">
                          <p className="font-semibold text-slate-900 line-clamp-1">{task.title}</p>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                            <span>#{task.number}</span>
                            <span>&bull;</span>
                            <span>Created {new Date(task.created_at).toLocaleDateString()}</span>
                            {task.linked_pr_url && (
                              <>
                                <span>&bull;</span>
                                <a
                                  href={task.linked_pr_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-indigo-600 hover:underline flex items-center gap-0.5"
                                >
                                  <GitPullRequest className="h-3 w-3" />
                                  <span>Linked PR</span>
                                </a>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${
                              task.type === 'pull_request'
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {task.type === 'pull_request' ? (
                              <GitPullRequest className="h-3 w-3" />
                            ) : (
                              <Layers className="h-3 w-3" />
                            )}
                            <span className="capitalize">{task.type.replace('_', ' ')}</span>
                          </span>
                        </td>
                        <td className="px-2 py-3">
                          {task.is_overdue ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200">
                              <AlertTriangle className="h-3 w-3" />
                              Overdue
                            </span>
                          ) : task.state === 'closed' || task.state === 'merged' ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                              <Check className="h-3 w-3" />
                              {task.state === 'merged' ? 'Merged' : 'Closed'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200">
                              <Clock className="h-3 w-3" />
                              Open
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-3 font-mono text-[11px]">
                          {task.due_date ? (
                            <span className={task.is_overdue ? 'text-rose-600 font-bold' : 'text-slate-600'}>
                              {task.due_date}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">&mdash;</span>
                          )}
                        </td>
                        <td className="py-3 pl-2 pr-3 text-right">
                          <a
                            href={task.html_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            <span>GitHub</span>
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
