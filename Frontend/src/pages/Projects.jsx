import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  FolderKanban,
  Plus,
  Search,
  Filter,
  Calendar,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Eye,
  Edit2,
  Trash2,
  RefreshCw,
  X,
  Layers,
  ShieldAlert,
  Activity,
  Briefcase,
  LayoutGrid,
  Table as TableIcon,
} from 'lucide-react';

import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import Drawer from '../components/Drawer';
import ConfirmDialog from '../components/ConfirmDialog';
import AlertBanner from '../components/AlertBanner';
import projectService from '../services/projectService';

export default function Projects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSampleData, setIsSampleData] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');

  // Sync search parameter from URL query string if present
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const searchParam = params.get('search');
    if (searchParam) {
      setSearchQuery(searchParam);
    }
  }, [location.search]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'

  // Modal / Drawer states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const initialFormState = {
    name: '',
    description: '',
    required_skills: '',
    min_experience_years: 3,
    desired_team_size: 4,
    start_date: new Date().toISOString().split('T')[0],
    deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    estimated_workload_hours: 320,
    priority: 'medium',
    status: 'planning',
    risk_level: 'low',
  };
  const [formData, setFormData] = useState(initialFormState);
  const [formErrors, setFormErrors] = useState({});

  // Fetch projects from API
  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      setApiError(null);
      const res = await projectService.getProjects();
      setProjects(res.data || []);
      setIsSampleData(res.isSample);
      if (res.error) {
        setApiError('FastAPI backend at http://127.0.0.1:8002 is offline. Running in development sample mode.');
      }
    } catch (err) {
      setApiError(err.message || 'Failed to communicate with Project API endpoint.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Filtered projects
  const filteredProjects = useMemo(() => {
    return projects.filter((proj) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        proj.name?.toLowerCase().includes(q) ||
        proj.description?.toLowerCase().includes(q) ||
        (proj.required_skills || []).some((s) => s.toLowerCase().includes(q));

      const matchesStatus =
        statusFilter === 'all' || proj.status === statusFilter;

      const matchesPriority =
        priorityFilter === 'all' || proj.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [projects, searchQuery, statusFilter, priorityFilter]);

  // Handlers
  const handleOpenCreateModal = () => {
    setSelectedProject(null);
    setFormData(initialFormState);
    setFormErrors({});
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (proj) => {
    setSelectedProject(proj);
    setFormData({
      name: proj.name || '',
      description: proj.description || '',
      required_skills: Array.isArray(proj.required_skills)
        ? proj.required_skills.join(', ')
        : proj.required_skills || '',
      min_experience_years: proj.min_experience_years ?? 3,
      desired_team_size: proj.desired_team_size ?? 4,
      start_date: proj.start_date || '',
      deadline: proj.deadline || '',
      estimated_workload_hours: proj.estimated_workload_hours ?? 320,
      priority: proj.priority || 'medium',
      status: proj.status || 'planning',
      risk_level: proj.risk_level || 'low',
    });
    setFormErrors({});
    setIsFormModalOpen(true);
    setIsDrawerOpen(false);
  };

  const handleOpenDetails = (proj) => {
    setSelectedProject(proj);
    setIsDrawerOpen(true);
  };

  const handleOpenDelete = (proj) => {
    setProjectToDelete(proj);
    setIsDeleteModalOpen(true);
    setIsDrawerOpen(false);
  };

  // Form Validation
  const validateForm = () => {
    const errors = {};
    if (!formData.name?.trim() || formData.name.trim().length < 3) {
      errors.name = 'Initiative name must be at least 3 characters.';
    }
    if (!formData.description?.trim() || formData.description.trim().length < 10) {
      errors.description = 'Provide a descriptive summary (at least 10 characters).';
    }
    if (!formData.required_skills?.trim()) {
      errors.required_skills = 'Specify at least one technical competency.';
    }
    if (formData.desired_team_size < 1) {
      errors.desired_team_size = 'Desired squad size must be at least 1.';
    }
    if (formData.min_experience_years < 0) {
      errors.min_experience_years = 'Experience cannot be negative.';
    }
    if (!formData.start_date) {
      errors.start_date = 'Target start date is required.';
    }
    if (!formData.deadline) {
      errors.deadline = 'Target milestone deadline is required.';
    }
    if (formData.start_date && formData.deadline && new Date(formData.deadline) < new Date(formData.start_date)) {
      errors.deadline = 'Deadline cannot precede the project start date.';
    }
    if (formData.estimated_workload_hours < 1) {
      errors.estimated_workload_hours = 'Estimated workload hours must be at least 1.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit Create / Edit
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setIsSubmitting(true);
      const payload = {
        ...formData,
        required_skills: formData.required_skills.split(',').map((s) => s.trim()).filter(Boolean),
        desired_team_size: Number(formData.desired_team_size),
        min_experience_years: Number(formData.min_experience_years),
        estimated_workload_hours: Number(formData.estimated_workload_hours),
      };

      if (selectedProject) {
        // PUT /api/projects/{id}
        const res = await projectService.updateProject(selectedProject.id, payload);
        if (res.offlineEmulated) {
          setSuccessMessage(`[Local Preview Only] Initiative "${payload.name}" updated. Backend at http://127.0.0.1:8002 is offline.`);
        } else {
          setSuccessMessage(`Initiative "${payload.name}" updated successfully.`);
        }
      } else {
        // POST /api/projects
        const res = await projectService.createProject(payload);
        if (res.offlineEmulated) {
          setSuccessMessage(`[Local Preview Only] Initiative "${payload.name}" created. Backend at http://127.0.0.1:8002 is offline.`);
        } else {
          setSuccessMessage(`Initiative "${payload.name}" created.`);
        }
      }

      setIsFormModalOpen(false);
      await fetchProjects();
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setApiError(err.message || 'Operation failed while saving project.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!projectToDelete) return;
    try {
      setIsSubmitting(true);
      const res = await projectService.deleteProject(projectToDelete.id);
      setIsDeleteModalOpen(false);
      if (res.offlineEmulated) {
        setSuccessMessage(`[Local Preview Only] Initiative "${projectToDelete.name}" removed from local session. Backend is offline.`);
      } else {
        setSuccessMessage(`Initiative "${projectToDelete.name}" was removed.`);
      }
      await fetchProjects();
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setApiError(err.message || 'Failed to delete project record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper formatting for deadlines
  const getDeadlineDetails = (deadlineStr) => {
    if (!deadlineStr) return { text: 'No deadline set', isUrgent: false };
    const today = new Date();
    const deadline = new Date(deadlineStr);
    const diffDays = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: `Overdue by ${Math.abs(diffDays)}d`, isUrgent: true, color: 'text-rose-600 bg-rose-50 border-rose-200' };
    }
    if (diffDays <= 15) {
      return { text: `${diffDays} days left`, isUrgent: true, color: 'text-rose-600 bg-rose-50 border-rose-200' };
    }
    if (diffDays <= 45) {
      return { text: `${diffDays} days left`, isUrgent: false, color: 'text-amber-700 bg-amber-50 border-amber-200' };
    }
    return { text: `${diffDays} days left`, isUrgent: false, color: 'text-slate-600 bg-slate-100 border-slate-200' };
  };

  // Priority Badge
  const getPriorityBadge = (prio) => {
    switch (prio) {
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700 border border-rose-200">
            <AlertTriangle className="h-3 w-3" />
            Critical
          </span>
        );
      case 'high':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 border border-amber-200">
            High
          </span>
        );
      case 'medium':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-200">
            Medium
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 border border-slate-200">
            Low
          </span>
        );
    }
  };

  // Status Badge
  const getStatusBadge = (status) => {
    switch (status) {
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200/80">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Active Delivery
          </span>
        );
      case 'planning':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200/80">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            Planning Phase
          </span>
        );
      case 'review':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200/80">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Quality Review
          </span>
        );
      case 'delayed':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 border border-rose-200/80">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            Schedule Delay
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 border border-slate-200">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            Completed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects & Initiatives"
        description="Monitor enterprise initiatives, required skill competencies, squad compositions, and delivery risk horizons."
        badge={`${projects.length} Active`}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchProjects}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
              title="Refresh from GET /api/projects"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>New Initiative</span>
            </button>
          </div>
        }
      />

      {/* Success Notification */}
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
          message="Projects module is operating with Development Sample Data. When FastAPI is reachable at http://127.0.0.1:8002, changes will sync directly with the database."
          actionText="Ping Backend"
          onAction={fetchProjects}
        />
      )}

      {/* Search & Filter Bar */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search initiatives by title, description, or skill..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-8 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filters & View Toggle */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700 focus:border-blue-500 focus:outline-hidden"
            >
              <option value="all">All Statuses</option>
              <option value="planning">Planning Phase</option>
              <option value="in_progress">Active Delivery</option>
              <option value="review">Quality Review</option>
              <option value="delayed">Delayed</option>
              <option value="completed">Completed</option>
            </select>

            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700 focus:border-blue-500 focus:outline-hidden"
            >
              <option value="all">All Priorities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            {/* View Mode Toggle */}
            <div className="hidden sm:flex items-center rounded-lg border border-slate-200 p-0.5 bg-slate-50">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded-md text-xs transition-colors ${
                  viewMode === 'cards'
                    ? 'bg-white shadow-2xs text-blue-600 font-semibold'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
                title="Cards view"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-md text-xs transition-colors ${
                  viewMode === 'table'
                    ? 'bg-white shadow-2xs text-blue-600 font-semibold'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
                title="Table view"
              >
                <TableIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Projects Content Area */}
      {loading ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-slate-200 bg-white text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mb-2" />
          <p className="text-sm font-semibold text-slate-700">Loading Project Portfolio...</p>
          <p className="text-xs text-slate-400 mt-1">Connecting to GET /api/projects</p>
        </div>
      ) : filteredProjects.length === 0 ? (
        /* Empty State */
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 border border-blue-100">
            <FolderKanban className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-base font-bold text-slate-900">
            No Initiatives Found
          </h3>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
            {searchQuery || statusFilter !== 'all' || priorityFilter !== 'all'
              ? 'No projects match your current filters. Adjust or clear the filter criteria.'
              : 'Your project repository is empty. Initialize a new initiative to begin squad planning.'}
          </p>

          <div className="mt-6 flex justify-center gap-3">
            {searchQuery || statusFilter !== 'all' || priorityFilter !== 'all' ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setPriorityFilter('all');
                }}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
              >
                Clear Filters
              </button>
            ) : (
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Create First Initiative
              </button>
            )}
          </div>
        </div>
      ) : viewMode === 'cards' ? (
        /* CARDS GRID VIEW */
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((proj) => {
            const deadlineInfo = getDeadlineDetails(proj.deadline);
            return (
              <div
                key={proj.id}
                className="group relative flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs hover:shadow-md transition-all duration-200"
              >
                <div>
                  {/* Card Top: Badges and Actions */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {getStatusBadge(proj.status)}
                      {getPriorityBadge(proj.priority)}
                    </div>
                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => handleOpenDetails(proj)}
                        className="rounded-lg p-1 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                        title="View details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(proj)}
                        className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                        title="Edit initiative"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenDelete(proj)}
                        className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                        title="Delete initiative"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Title and Description */}
                  <h3
                    onClick={() => handleOpenDetails(proj)}
                    className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors cursor-pointer text-base line-clamp-1"
                  >
                    {proj.name}
                  </h3>
                  <p className="mt-1.5 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                    {proj.description}
                  </p>

                  {/* Required Skills Badges */}
                  <div className="mt-3.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      Required Competencies:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {(proj.required_skills || []).slice(0, 4).map((skill) => (
                        <span
                          key={skill}
                          className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-100"
                        >
                          {skill}
                        </span>
                      ))}
                      {(proj.required_skills || []).length > 4 && (
                        <span className="rounded bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-400 border border-slate-200">
                          +{(proj.required_skills || []).length - 4}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Project Metrics Summary */}
                  <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-slate-400" />
                      <span>
                        Squad: <strong className="text-slate-800">{proj.desired_team_size}</strong> (Min {proj.min_experience_years}y exp)
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      <span>
                        Workload: <strong className="text-slate-800">{proj.estimated_workload_hours}h</strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Footer: Deadline & Quick Navigation to Team Builder and Risk */}
                <div className="mt-5 border-t border-slate-100 pt-3 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      <span>Due {proj.deadline}</span>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border ${deadlineInfo.color}`}>
                      {deadlineInfo.text}
                    </span>
                  </div>

                  {/* Direct Module Cross-Links */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => navigate('/team-builder')}
                      className="inline-flex items-center justify-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50/50 py-1.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors cursor-pointer"
                      title="Form squad with Smart Team Builder"
                    >
                      <Sparkles className="h-3 w-3" />
                      Team Builder
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/risks')}
                      className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-slate-50/70 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                      title="Check delivery risk prediction"
                    >
                      <ShieldAlert className="h-3 w-3" />
                      Deadline Risk
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="border-b border-slate-200/80 bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-3.5">
                    Initiative
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Status & Priority
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Required Skills
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Target Squad
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Deadline
                  </th>
                  <th scope="col" className="px-5 py-3.5 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredProjects.map((proj) => {
                  const deadlineInfo = getDeadlineDetails(proj.deadline);
                  return (
                    <tr key={proj.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3.5">
                        <button
                          type="button"
                          onClick={() => handleOpenDetails(proj)}
                          className="font-bold text-slate-900 hover:text-blue-600 hover:underline text-left block truncate max-w-xs"
                        >
                          {proj.name}
                        </button>
                        <span className="text-[11px] text-slate-400 truncate block max-w-xs">
                          {proj.description}
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="flex flex-col gap-1 items-start">
                          {getStatusBadge(proj.status)}
                          {getPriorityBadge(proj.priority)}
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {(proj.required_skills || []).slice(0, 3).map((skill) => (
                            <span
                              key={skill}
                              className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 border border-blue-100"
                            >
                              {skill}
                            </span>
                          ))}
                          {(proj.required_skills || []).length > 3 && (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                              +{(proj.required_skills || []).length - 3}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <span className="font-semibold text-slate-800">
                          {proj.desired_team_size} Members
                        </span>
                        <span className="text-[11px] text-slate-400 block">
                          Min {proj.min_experience_years}y &bull; {proj.estimated_workload_hours}h
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        <span className="font-medium text-slate-800 block text-xs">
                          {proj.deadline}
                        </span>
                        <span className={`inline-block text-[10px] font-semibold rounded px-1.5 py-0.2 border ${deadlineInfo.color} mt-0.5`}>
                          {deadlineInfo.text}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => navigate('/team-builder')}
                            className="rounded-lg p-1.5 text-indigo-600 hover:bg-indigo-50"
                            title="Open in Team Builder"
                          >
                            <Sparkles className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDetails(proj)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            title="Details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(proj)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            title="Edit"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDelete(proj)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SLIDE-OVER DRAWER: PROJECT DETAILS VIEW */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={selectedProject?.name || 'Initiative Details'}
        subtitle={`Initiative ID: ${selectedProject?.id || '--'}`}
        badge={selectedProject && getStatusBadge(selectedProject.status)}
        footer={
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <button
              type="button"
              onClick={() => handleOpenDelete(selectedProject)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Initiative
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  navigate('/team-builder');
                  setIsDrawerOpen(false);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 border border-indigo-200"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Assemble Squad
              </button>
              <button
                type="button"
                onClick={() => handleOpenEditModal(selectedProject)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors"
              >
                <Edit2 className="h-3.5 w-3.5" />
                Edit Details
              </button>
            </div>
          </div>
        }
      >
        {selectedProject && (
          <div className="space-y-6 text-sm">
            {/* Description Card */}
            <div className="rounded-xl bg-slate-50 p-4 border border-slate-200/60">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Executive Objective & Scope
              </h4>
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed mt-2">
                {selectedProject.description}
              </p>
            </div>

            {/* Key Specs Matrix */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-slate-200/80 bg-white p-3">
                <span className="text-[11px] text-slate-400 block font-medium">Priority Tier</span>
                <div className="mt-1">{getPriorityBadge(selectedProject.priority)}</div>
              </div>
              <div className="rounded-lg border border-slate-200/80 bg-white p-3">
                <span className="text-[11px] text-slate-400 block font-medium">Desired Squad Size</span>
                <span className="font-bold text-slate-900 mt-1 block">
                  {selectedProject.desired_team_size} Engineers
                </span>
              </div>
              <div className="rounded-lg border border-slate-200/80 bg-white p-3">
                <span className="text-[11px] text-slate-400 block font-medium">Min Seniority</span>
                <span className="font-bold text-slate-900 mt-1 block">
                  {selectedProject.min_experience_years} Years Experience
                </span>
              </div>
              <div className="rounded-lg border border-slate-200/80 bg-white p-3">
                <span className="text-[11px] text-slate-400 block font-medium">Estimated Workload</span>
                <span className="font-bold text-slate-900 mt-1 block">
                  {selectedProject.estimated_workload_hours} Hours
                </span>
              </div>
            </div>

            {/* Schedule Timeline */}
            <div className="rounded-xl border border-slate-200/80 bg-white p-4 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Milestone Schedule
              </h4>
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-slate-500">Start Date:</span>
                <span className="font-semibold text-slate-800">{selectedProject.start_date}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Milestone Deadline:</span>
                <span className="font-semibold text-slate-800">{selectedProject.deadline}</span>
              </div>
              <div className="flex items-center justify-between text-xs border-t border-slate-100 pt-2">
                <span className="text-slate-500">Horizon Status:</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border ${getDeadlineDetails(selectedProject.deadline).color}`}>
                  {getDeadlineDetails(selectedProject.deadline).text}
                </span>
              </div>
            </div>

            {/* Required Technical Competencies */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Required Technical Competencies
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {(selectedProject.required_skills || []).map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 border border-blue-100"
                  >
                    <Sparkles className="h-3 w-3 text-blue-500" />
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            {/* Assigned Squad Lineup */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Current Squad Members
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    navigate('/team-builder');
                    setIsDrawerOpen(false);
                  }}
                  className="text-xs font-semibold text-blue-600 hover:underline"
                >
                  Adjust Squad in Team Builder &rarr;
                </button>
              </div>

              {(selectedProject.assigned_team || []).length > 0 ? (
                <div className="space-y-1.5">
                  {selectedProject.assigned_team.map((member) => (
                    <div
                      key={member}
                      className="flex items-center justify-between rounded-lg border border-slate-200/80 bg-slate-50/50 p-2.5 text-xs font-medium text-slate-800"
                    >
                      <span>{member}</span>
                      <span className="rounded bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[10px] font-semibold border border-emerald-100">
                        Allocated
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
                  No squad members assigned yet. Use Smart Team Builder to run AI matching.
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* CREATE / EDIT PROJECT MODAL FORM */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={selectedProject ? 'Edit Initiative' : 'Create New Project Initiative'}
        subtitle="Specify initiative objectives, required skills, team capacity, and target deadlines"
      >
        <form onSubmit={handleSubmitForm} className="space-y-4">
          {/* Initiative Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Initiative Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Autonomous Workforce Dispatch"
              className={`w-full rounded-lg border bg-slate-50/50 px-3 py-2 text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-hidden ${
                formErrors.name
                  ? 'border-rose-300 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                  : 'border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
              }`}
            />
            {formErrors.name && (
              <p className="mt-1 text-[11px] text-rose-500">{formErrors.name}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description & Objectives <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe the initiative goals, key deliverables, and target outcome..."
              className={`w-full rounded-lg border bg-slate-50/50 px-3 py-2 text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-hidden ${
                formErrors.description
                  ? 'border-rose-300 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                  : 'border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
              }`}
            />
            {formErrors.description && (
              <p className="mt-1 text-[11px] text-rose-500">{formErrors.description}</p>
            )}
          </div>

          {/* Required Skills (Comma-separated) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Required Technical Skills (Comma-separated) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={formData.required_skills}
              onChange={(e) => setFormData({ ...formData, required_skills: e.target.value })}
              placeholder="e.g. Python, FastAPI, React, PyTorch, Vector DBs"
              className={`w-full rounded-lg border bg-slate-50/50 px-3 py-2 text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-hidden ${
                formErrors.required_skills
                  ? 'border-rose-300 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                  : 'border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
              }`}
            />
            {formErrors.required_skills && (
              <p className="mt-1 text-[11px] text-rose-500">{formErrors.required_skills}</p>
            )}
            <p className="mt-1 text-[11px] text-slate-400">
              The AI Matchmaker balances these competencies against employee profiles.
            </p>
          </div>

          {/* Desired Team Size & Min Experience */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Target Team Size
              </label>
              <input
                type="number"
                min="1"
                max="25"
                value={formData.desired_team_size}
                onChange={(e) => setFormData({ ...formData, desired_team_size: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs sm:text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Min Experience (Years)
              </label>
              <input
                type="number"
                min="0"
                max="20"
                value={formData.min_experience_years}
                onChange={(e) => setFormData({ ...formData, min_experience_years: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs sm:text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Est. Workload (Hours)
              </label>
              <input
                type="number"
                min="1"
                value={formData.estimated_workload_hours}
                onChange={(e) => setFormData({ ...formData, estimated_workload_hours: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs sm:text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-hidden"
              />
            </div>
          </div>

          {/* Dates: Start & Deadline */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Start Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs sm:text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Milestone Deadline <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={formData.deadline}
                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                className={`w-full rounded-lg border bg-slate-50/50 px-3 py-2 text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-hidden ${
                  formErrors.deadline
                    ? 'border-rose-300 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                    : 'border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                }`}
              />
              {formErrors.deadline && (
                <p className="mt-1 text-[11px] text-rose-500">{formErrors.deadline}</p>
              )}
            </div>
          </div>

          {/* Priority & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Priority Tier
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs sm:text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-hidden"
              >
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Initiative Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs sm:text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-hidden"
              >
                <option value="planning">Planning Phase</option>
                <option value="in_progress">Active Delivery</option>
                <option value="review">Quality Review</option>
                <option value="delayed">Delayed</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          {/* Form Actions */}
          <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsFormModalOpen(false)}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 className="h-4 w-4" />
              {isSubmitting
                ? 'Saving...'
                : selectedProject
                ? 'Save Initiative Changes'
                : 'Create Initiative'}
            </button>
          </div>
        </form>
      </Modal>

      {/* DELETE CONFIRMATION DIALOG */}
      <ConfirmDialog
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        itemName={projectToDelete?.name}
        isDeleting={isSubmitting}
      />
    </div>
  );
}
