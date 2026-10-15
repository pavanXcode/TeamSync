import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Eye,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Briefcase,
  GraduationCap,
  MapPin,
  Mail,
  Calendar,
  Layers,
  Sparkles,
  LayoutGrid,
  Table as TableIcon,
  RefreshCw,
  X,
  Activity,
} from 'lucide-react';

import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import Drawer from '../components/Drawer';
import ConfirmDialog from '../components/ConfirmDialog';
import AlertBanner from '../components/AlertBanner';
import employeeService from '../services/employeeService';

export default function Employees() {
  const location = useLocation();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSampleData, setIsSampleData] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Filters & View state
  const [searchQuery, setSearchQuery] = useState('');

  // Sync search parameter from URL query string if present
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const searchParam = params.get('search');
    if (searchParam) {
      setSearchQuery(searchParam);
    }
  }, [location.search]);
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [availabilityFilter, setAvailabilityFilter] = useState('all');
  const [skillFilter, setSkillFilter] = useState('all');
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'cards'

  // Modal / Drawer states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeToDelete, setEmployeeToDelete] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State & Validation
  const initialFormState = {
    name: '',
    email: '',
    role: '',
    department: 'Engineering',
    skills: '',
    experience_years: 3,
    availability_status: 'available',
    current_workload_pct: 50,
    location: '',
    bio: '',
  };
  const [formData, setFormData] = useState(initialFormState);
  const [formErrors, setFormErrors] = useState({});

  // Load employee data from API
  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true);
      setApiError(null);
      const res = await employeeService.getEmployees();
      setEmployees(res.data || []);
      setIsSampleData(res.isSample);
      if (res.error) {
        setApiError('FastAPI backend at http://127.0.0.1:8002 is offline. Running in development sample mode.');
      }
    } catch (err) {
      setApiError(err.message || 'Failed to communicate with Employee API endpoint.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  // Extract all unique skills for filter dropdown
  const allUniqueSkills = useMemo(() => {
    const set = new Set();
    employees.forEach((emp) => {
      (emp.skills || []).forEach((s) => set.add(s));
    });
    return Array.from(set).sort();
  }, [employees]);

  // Filtered employees list
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        emp.name?.toLowerCase().includes(q) ||
        emp.email?.toLowerCase().includes(q) ||
        emp.role?.toLowerCase().includes(q) ||
        (emp.skills || []).some((s) => s.toLowerCase().includes(q));

      const matchesDept =
        departmentFilter === 'all' || emp.department === departmentFilter;

      const matchesAvail =
        availabilityFilter === 'all' || emp.availability_status === availabilityFilter;

      const matchesSkill =
        skillFilter === 'all' || (emp.skills || []).includes(skillFilter);

      return matchesSearch && matchesDept && matchesAvail && matchesSkill;
    });
  }, [employees, searchQuery, departmentFilter, availabilityFilter, skillFilter]);

  // Form Open / Close Handlers
  const handleOpenCreateModal = () => {
    setSelectedEmployee(null);
    setFormData(initialFormState);
    setFormErrors({});
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (emp) => {
    setSelectedEmployee(emp);
    setFormData({
      name: emp.name || '',
      email: emp.email || '',
      role: emp.role || '',
      department: emp.department || 'Engineering',
      skills: Array.isArray(emp.skills) ? emp.skills.join(', ') : emp.skills || '',
      experience_years: emp.experience_years ?? 3,
      availability_status: emp.availability_status || 'available',
      current_workload_pct: emp.current_workload_pct ?? 50,
      location: emp.location || '',
      bio: emp.bio || '',
    });
    setFormErrors({});
    setIsFormModalOpen(true);
    setIsDrawerOpen(false);
  };

  const handleOpenDetails = (emp) => {
    setSelectedEmployee(emp);
    setIsDrawerOpen(true);
  };

  const handleOpenDelete = (emp) => {
    setEmployeeToDelete(emp);
    setIsDeleteModalOpen(true);
    setIsDrawerOpen(false);
  };

  // Form Validation
  const validateForm = () => {
    const errors = {};
    if (!formData.name?.trim() || formData.name.trim().length < 2) {
      errors.name = 'Full name must be at least 2 characters.';
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email?.trim() || !emailRegex.test(formData.email.trim())) {
      errors.email = 'Please provide a valid professional email address.';
    }
    if (!formData.role?.trim()) {
      errors.role = 'Role / Job title is required.';
    }
    if (!formData.skills?.trim()) {
      errors.skills = 'Specify at least one primary skill (e.g. React, Python).';
    }
    if (formData.experience_years < 0 || formData.experience_years > 50) {
      errors.experience_years = 'Experience must be between 0 and 50 years.';
    }
    if (formData.current_workload_pct < 0 || formData.current_workload_pct > 150) {
      errors.current_workload_pct = 'Workload percentage must be between 0% and 150%.';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit Create or Edit
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setIsSubmitting(true);
      const payload = {
        ...formData,
        skills: formData.skills.split(',').map((s) => s.trim()).filter(Boolean),
        experience_years: Number(formData.experience_years),
        current_workload_pct: Number(formData.current_workload_pct),
      };

      if (selectedEmployee) {
        // PUT /api/employees/{id}
        const res = await employeeService.updateEmployee(selectedEmployee.id, payload);
        if (res.offlineEmulated) {
          setSuccessMessage(`[Local Preview Only] Employee "${payload.name}" updated. Backend at http://127.0.0.1:8002 is offline.`);
        } else {
          setSuccessMessage(`Employee "${payload.name}" updated successfully.`);
        }
      } else {
        // POST /api/employees
        const res = await employeeService.createEmployee(payload);
        if (res.offlineEmulated) {
          setSuccessMessage(`[Local Preview Only] Employee "${payload.name}" created. Backend at http://127.0.0.1:8002 is offline.`);
        } else {
          setSuccessMessage(`Employee "${payload.name}" added to talent directory.`);
        }
      }

      setIsFormModalOpen(false);
      await fetchEmployees();
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setApiError(err.message || 'Operation failed while saving employee.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!employeeToDelete) return;
    try {
      setIsSubmitting(true);
      const res = await employeeService.deleteEmployee(employeeToDelete.id);
      setIsDeleteModalOpen(false);
      if (res.offlineEmulated) {
        setSuccessMessage(`[Local Preview Only] Employee "${employeeToDelete.name}" removed from local session. Backend is offline.`);
      } else {
        setSuccessMessage(`Employee "${employeeToDelete.name}" was removed.`);
      }
      await fetchEmployees();
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setApiError(err.message || 'Failed to delete employee record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper styling for Workload
  const getWorkloadStyle = (pct) => {
    const val = Number(pct) || 0;
    if (val >= 90) return { bar: 'bg-rose-500', text: 'text-rose-700', badge: 'bg-rose-50 border-rose-200' };
    if (val >= 75) return { bar: 'bg-amber-500', text: 'text-amber-700', badge: 'bg-amber-50 border-amber-200' };
    return { bar: 'bg-emerald-500', text: 'text-emerald-700', badge: 'bg-emerald-50 border-emerald-200' };
  };

  // Helper styling for Availability
  const getAvailabilityBadge = (status) => {
    switch (status) {
      case 'available':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200/80">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Available
          </span>
        );
      case 'partially_allocated':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 border border-amber-200/80">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Partially Allocated
          </span>
        );
      case 'fully_allocated':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 border border-indigo-200/80">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
            Fully Allocated
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 border border-slate-200">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            Unavailable
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employee Directory"
        description="Search, inspect, and manage verified workforce competencies, squad deployments, and bandwidth utilization."
        badge={`${employees.length} Profiles`}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchEmployees}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
              title="Refresh from GET /api/employees"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors cursor-pointer"
            >
              <UserPlus className="h-4 w-4" />
              <span>Add Employee</span>
            </button>
          </div>
        }
      />

      {/* API Success Notification */}
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
          message="Employee directory is currently displaying Development Sample Data. When FastAPI is running at http://127.0.0.1:8002, live records will automatically stream."
          actionText="Ping Backend"
          onAction={fetchEmployees}
        />
      )}

      {/* Search & Filter Tooling Bar */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, role, email, or skill..."
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
            {/* Department Filter */}
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700 focus:border-blue-500 focus:outline-hidden"
            >
              <option value="all">All Departments</option>
              <option value="AI Research">AI Research</option>
              <option value="Engineering">Engineering</option>
              <option value="Product & Design">Product & Design</option>
              <option value="Data Science">Data Science</option>
              <option value="DevOps">DevOps</option>
            </select>

            {/* Availability Filter */}
            <select
              value={availabilityFilter}
              onChange={(e) => setAvailabilityFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700 focus:border-blue-500 focus:outline-hidden"
            >
              <option value="all">All Availability</option>
              <option value="available">Available (&lt; 75%)</option>
              <option value="partially_allocated">Partially Allocated</option>
              <option value="fully_allocated">Fully Allocated</option>
              <option value="unavailable">Unavailable</option>
            </select>

            {/* Skill Filter */}
            <select
              value={skillFilter}
              onChange={(e) => setSkillFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700 focus:border-blue-500 focus:outline-hidden max-w-[140px]"
            >
              <option value="all">All Skills</option>
              {allUniqueSkills.map((skill) => (
                <option key={skill} value={skill}>
                  {skill}
                </option>
              ))}
            </select>

            {/* View Mode Toggle */}
            <div className="hidden sm:flex items-center rounded-lg border border-slate-200 p-0.5 bg-slate-50">
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
            </div>
          </div>
        </div>
      </div>

      {/* Directory Content Area */}
      {loading ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-slate-200 bg-white text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mb-2" />
          <p className="text-sm font-semibold text-slate-700">Loading Employee Roster...</p>
          <p className="text-xs text-slate-400 mt-1">Connecting to GET /api/employees</p>
        </div>
      ) : filteredEmployees.length === 0 ? (
        /* Empty State */
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100">
            <Users className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-base font-bold text-slate-900">
            No Team Members Found
          </h3>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
            {searchQuery || departmentFilter !== 'all' || availabilityFilter !== 'all' || skillFilter !== 'all'
              ? 'No employees match the current search filters. Try clearing your search parameters.'
              : 'The talent repository is empty. Add your first team member using the button below.'}
          </p>

          <div className="mt-6 flex justify-center gap-3">
            {searchQuery || departmentFilter !== 'all' || availabilityFilter !== 'all' || skillFilter !== 'all' ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setDepartmentFilter('all');
                  setAvailabilityFilter('all');
                  setSkillFilter('all');
                }}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
              >
                Reset All Filters
              </button>
            ) : (
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700"
              >
                <UserPlus className="h-4 w-4" />
                Add First Employee
              </button>
            )}
          </div>
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE VIEW */
        <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="border-b border-slate-200/80 bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-3.5">
                    Team Member
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Department & Role
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Verified Competencies
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Workload
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Availability
                  </th>
                  <th scope="col" className="px-5 py-3.5 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredEmployees.map((emp) => {
                  const wl = getWorkloadStyle(emp.current_workload_pct);
                  return (
                    <tr
                      key={emp.id}
                      className="hover:bg-slate-50/70 transition-colors group"
                    >
                      {/* Name & Avatar */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-xs font-bold text-white shadow-2xs">
                            {emp.name
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => handleOpenDetails(emp)}
                              className="font-semibold text-slate-900 hover:text-blue-600 hover:underline text-left truncate block cursor-pointer"
                            >
                              {emp.name}
                            </button>
                            <span className="text-[11px] text-slate-400 truncate block">
                              {emp.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Department & Role */}
                      <td className="px-4 py-3.5">
                        <span className="font-medium text-slate-800 block text-xs truncate">
                          {emp.role}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {emp.department} &bull; {emp.experience_years}y exp
                        </span>
                      </td>

                      {/* Skills */}
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {(emp.skills || []).slice(0, 3).map((skill) => (
                            <span
                              key={skill}
                              className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700"
                            >
                              {skill}
                            </span>
                          ))}
                          {(emp.skills || []).length > 3 && (
                            <span className="rounded bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-400 border border-slate-200">
                              +{(emp.skills || []).length - 3}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Workload Progress Bar */}
                      <td className="px-4 py-3.5">
                        <div className="w-28 space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className={`font-bold ${wl.text}`}>
                              {emp.current_workload_pct}%
                            </span>
                            <span className="text-slate-400 text-[10px]">Cap</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-full ${wl.bar} transition-all duration-300`}
                              style={{ width: `${Math.min(emp.current_workload_pct, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Availability Status */}
                      <td className="px-4 py-3.5">
                        {getAvailabilityBadge(emp.availability_status)}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenDetails(emp)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                            title="Inspect details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(emp)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                            title="Edit employee"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDelete(emp)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                            title="Delete employee"
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
      ) : (
        /* CARDS VIEW */
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredEmployees.map((emp) => {
            const wl = getWorkloadStyle(emp.current_workload_pct);
            return (
              <div
                key={emp.id}
                className="group relative flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs hover:shadow-sm transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-sm font-bold text-white shadow-2xs">
                        {emp.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                          {emp.name}
                        </h3>
                        <p className="text-xs text-slate-500 truncate">{emp.role}</p>
                      </div>
                    </div>
                    {getAvailabilityBadge(emp.availability_status)}
                  </div>

                  <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Department:</span>
                      <span className="font-semibold text-slate-800">{emp.department}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Experience:</span>
                      <span className="font-semibold text-slate-800">{emp.experience_years} Years</span>
                    </div>
                  </div>

                  {/* Skills badges */}
                  <div className="mt-3">
                    <span className="text-[11px] font-semibold text-slate-400 block mb-1">
                      Key Skills:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {(emp.skills || []).map((skill) => (
                        <span
                          key={skill}
                          className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Card Footer Workload & Actions */}
                <div className="mt-5 border-t border-slate-100 pt-3">
                  <div className="space-y-1 mb-3">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Workload:</span>
                      <span className={`font-bold ${wl.text}`}>
                        {emp.current_workload_pct}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full ${wl.bar}`}
                        style={{ width: `${Math.min(emp.current_workload_pct, 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => handleOpenDetails(emp)}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                    >
                      View Details &rarr;
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(emp)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        title="Edit"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenDelete(emp)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SLIDE-OVER DRAWER: EMPLOYEE DETAILS VIEW */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={selectedEmployee?.name || 'Employee Details'}
        subtitle={selectedEmployee?.role}
        badge={selectedEmployee && getAvailabilityBadge(selectedEmployee.availability_status)}
        footer={
          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => handleOpenDelete(selectedEmployee)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Profile
            </button>
            <button
              type="button"
              onClick={() => handleOpenEditModal(selectedEmployee)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors"
            >
              <Edit2 className="h-3.5 w-3.5" />
              Edit Employee
            </button>
          </div>
        }
      >
        {selectedEmployee && (
          <div className="space-y-6 text-sm">
            {/* Header Identity card */}
            <div className="rounded-xl bg-slate-50 p-4 border border-slate-200/60">
              <div className="flex items-center gap-3.5">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-lg font-bold text-white shadow-sm">
                  {selectedEmployee.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-slate-900 truncate">
                    {selectedEmployee.name}
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                    <Mail className="h-3.5 w-3.5 text-slate-400" />
                    <span>{selectedEmployee.email}</span>
                  </div>
                  {selectedEmployee.location && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      <span>{selectedEmployee.location}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Core Metrics */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-slate-200/80 bg-white p-3">
                <span className="text-[11px] text-slate-400 block font-medium">Department</span>
                <span className="font-semibold text-slate-800 mt-0.5 block">
                  {selectedEmployee.department}
                </span>
              </div>
              <div className="rounded-lg border border-slate-200/80 bg-white p-3">
                <span className="text-[11px] text-slate-400 block font-medium">Seniority</span>
                <span className="font-semibold text-slate-800 mt-0.5 block">
                  {selectedEmployee.experience_years} Years Industry Exp
                </span>
              </div>
            </div>

            {/* Workload Meter */}
            <div className="rounded-xl border border-slate-200/80 bg-white p-4 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-700">Sprint Workload Capacity</span>
                <span className={`font-bold ${getWorkloadStyle(selectedEmployee.current_workload_pct).text}`}>
                  {selectedEmployee.current_workload_pct}% Allocated
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full ${getWorkloadStyle(selectedEmployee.current_workload_pct).bar}`}
                  style={{ width: `${Math.min(selectedEmployee.current_workload_pct, 100)}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Optimal target capacity is 80%. Allocations exceeding 90% generate burnout risk alerts.
              </p>
            </div>

            {/* Verified Technical Skills */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Verified Technical Proficiencies
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {(selectedEmployee.skills || []).map((skill) => (
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

            {/* Assigned Project Initiatives */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Active Project Deployments
              </h4>
              {(selectedEmployee.current_projects || []).length > 0 ? (
                <div className="space-y-2">
                  {selectedEmployee.current_projects.map((proj) => (
                    <div
                      key={proj}
                      className="flex items-center justify-between rounded-lg border border-slate-200/80 bg-slate-50/50 p-2.5 text-xs"
                    >
                      <span className="font-semibold text-slate-800">{proj}</span>
                      <span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                        Active Squad
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">
                  Not currently assigned to an active project. Available for Smart Team Builder matching.
                </p>
              )}
            </div>

            {/* Bio */}
            {selectedEmployee.bio && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Professional Profile & Bio
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                  {selectedEmployee.bio}
                </p>
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* CREATE / EDIT EMPLOYEE MODAL FORM */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={selectedEmployee ? 'Edit Team Member Profile' : 'Add New Team Member'}
        subtitle="Manage employee records, technical skill vectors, and availability limits"
      >
        <form onSubmit={handleSubmitForm} className="space-y-4">
          {/* Name & Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Dr. Sarah Lin"
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

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="sarah.lin@teamsync.ai"
                className={`w-full rounded-lg border bg-slate-50/50 px-3 py-2 text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-hidden ${
                  formErrors.email
                    ? 'border-rose-300 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                    : 'border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                }`}
              />
              {formErrors.email && (
                <p className="mt-1 text-[11px] text-rose-500">{formErrors.email}</p>
              )}
            </div>
          </div>

          {/* Role & Department */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Role / Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                placeholder="e.g. Principal AI Engineer"
                className={`w-full rounded-lg border bg-slate-50/50 px-3 py-2 text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-hidden ${
                  formErrors.role
                    ? 'border-rose-300 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                    : 'border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                }`}
              />
              {formErrors.role && (
                <p className="mt-1 text-[11px] text-rose-500">{formErrors.role}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Department
              </label>
              <select
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs sm:text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-hidden"
              >
                <option value="AI Research">AI Research</option>
                <option value="Engineering">Engineering</option>
                <option value="Product & Design">Product & Design</option>
                <option value="Data Science">Data Science</option>
                <option value="DevOps">DevOps</option>
              </select>
            </div>
          </div>

          {/* Skills (Comma separated) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Technical Skills (Comma separated) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={formData.skills}
              onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
              placeholder="e.g. Python, PyTorch, FastAPI, React, Docker"
              className={`w-full rounded-lg border bg-slate-50/50 px-3 py-2 text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-hidden ${
                formErrors.skills
                  ? 'border-rose-300 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                  : 'border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
              }`}
            />
            {formErrors.skills && (
              <p className="mt-1 text-[11px] text-rose-500">{formErrors.skills}</p>
            )}
            <p className="mt-1 text-[11px] text-slate-400">
              Separate competencies with commas. Used by the AI Matchmaker algorithm.
            </p>
          </div>

          {/* Experience, Availability & Workload */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Experience (Years)
              </label>
              <input
                type="number"
                min="0"
                max="50"
                value={formData.experience_years}
                onChange={(e) => setFormData({ ...formData, experience_years: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs sm:text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Availability Status
              </label>
              <select
                value={formData.availability_status}
                onChange={(e) => setFormData({ ...formData, availability_status: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs sm:text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-hidden"
              >
                <option value="available">Available</option>
                <option value="partially_allocated">Partially Allocated</option>
                <option value="fully_allocated">Fully Allocated</option>
                <option value="unavailable">Unavailable</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Current Workload (%)
              </label>
              <input
                type="number"
                min="0"
                max="150"
                value={formData.current_workload_pct}
                onChange={(e) => setFormData({ ...formData, current_workload_pct: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs sm:text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-hidden"
              />
            </div>
          </div>

          {/* Location & Bio */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Location
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g. San Francisco, CA (Hybrid)"
                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs sm:text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Professional Bio / Notes
              </label>
              <input
                type="text"
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                placeholder="Specialist focus or domain..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs sm:text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-hidden"
              />
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
                : selectedEmployee
                ? 'Save Profile Changes'
                : 'Create Employee'}
            </button>
          </div>
        </form>
      </Modal>

      {/* DELETE CONFIRMATION DIALOG */}
      <ConfirmDialog
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        itemName={employeeToDelete?.name}
        isDeleting={isSubmitting}
      />
    </div>
  );
}
