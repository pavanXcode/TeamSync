import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Menu,
  Search,
  Bell,
  Plus,
  Calendar,
  Sparkles,
  Command,
  ChevronDown,
  User,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

const routeTitleMap = {
  '/': { title: 'Overview', category: 'Dashboard' },
  '/projects': { title: 'Projects', category: 'Portfolio' },
  '/employees': { title: 'Employee Directory', category: 'Talent Pool' },
  '/team-builder': { title: 'Smart Team Builder', category: 'AI Optimization' },
  '/workload': { title: 'Workload Balancer', category: 'Resource Allocation' },
  '/skill-gaps': { title: 'Skill Gap Analysis', category: 'Workforce Intelligence' },
  '/risks': { title: 'Deadline Risk', category: 'Predictive Monitoring' },
  '/settings': { title: 'Settings', category: 'Configuration' },
};

export default function Topbar({ onOpenSidebar }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  const currentRouteMeta = routeTitleMap[location.pathname] || {
    title: 'Workspace',
    category: 'TeamSync',
  };

  // Format current date nicely
  const formattedDate = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());

  const handleCreateProject = () => {
    navigate('/projects');
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 sm:px-6 backdrop-blur-xs">
      {/* Left: Mobile hamburger & Page Title */}
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          aria-label="Open sidebar menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-block text-xs font-medium text-slate-400">
              {currentRouteMeta.category}
            </span>
            <span className="hidden sm:inline-block text-slate-300">/</span>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate">
              {currentRouteMeta.title}
            </h1>
          </div>
        </div>
      </div>

      {/* Center: Global Search UI */}
      <div className="hidden md:flex flex-1 max-w-md mx-6">
        <div className="relative w-full">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search className="h-4 w-4" />
          </div>
          <input
            type="search"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchValue.trim()) {
                navigate(`/employees?search=${encodeURIComponent(searchValue.trim())}`);
              }
            }}
            placeholder="Search employees, skills, projects (Press Enter)..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50/70 py-1.5 pl-9 pr-14 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 transition-all"
            aria-label="Global search"
          />
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5">
            <kbd className="inline-flex items-center gap-0.5 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-400 shadow-2xs">
              <Command className="h-2.5 w-2.5" /> K
            </kbd>
          </div>
        </div>
      </div>

      {/* Right Controls: Date, Create Project CTA, Notifications, Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Current Date Badge */}
        <div className="hidden xl:flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200/60">
          <Calendar className="h-3.5 w-3.5 text-slate-400" />
          <span>{formattedDate}</span>
        </div>

        {/* Primary Action Button: Create Project (navigates to /projects) */}
        <button
          type="button"
          onClick={handleCreateProject}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-blue-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all cursor-pointer"
          title="Navigate to Projects to initialize a new initiative"
        >
          <Plus className="h-4 w-4 stroke-[2.5]" />
          <span className="hidden sm:inline">Create Project</span>
          <span className="sm:hidden">New</span>
        </button>

        {/* Notification Bell (UI Only) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-colors"
            aria-label="Notifications"
            title="Notifications (UI Preview)"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-blue-600 ring-2 ring-white" />
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-3 shadow-lg ring-1 ring-black/5 z-50">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-semibold text-slate-900">Notifications</span>
                <span className="text-[10px] text-blue-600 font-medium">UI Only</span>
              </div>
              <div className="py-2 space-y-2 text-xs">
                <div className="rounded-lg bg-slate-50 p-2 text-slate-600">
                  <p className="font-semibold text-slate-800">Part 1 Shell Active</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Frontend architecture, routing, and UI design loaded cleanly.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Area */}
        <div className="relative border-l border-slate-200 pl-2 sm:pl-3">
          <button
            type="button"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-2.5 rounded-lg p-1 hover:bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-left transition-colors"
            aria-label="User menu"
          >
            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 text-xs font-bold text-white shadow-2xs">
              AM
              <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-1 ring-white" />
            </div>

            <div className="hidden lg:flex flex-col">
              <span className="text-xs font-semibold text-slate-900 leading-none">
                Alex Morgan
              </span>
              <span className="text-[10px] text-slate-400 font-medium mt-0.5">
                Talent & Ops Lead
              </span>
            </div>

            <ChevronDown className="hidden lg:block h-3.5 w-3.5 text-slate-400" />
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg ring-1 ring-black/5 z-50 text-xs">
              <div className="px-3 py-2 border-b border-slate-100">
                <p className="font-semibold text-slate-900">Alex Morgan</p>
                <p className="text-slate-400 text-[11px]">alex.morgan@teamsync.ai</p>
                <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                  <ShieldCheck className="h-3 w-3" /> Person 2: Frontend Lead
                </div>
              </div>
              <div className="py-1">
                <button
                  type="button"
                  onClick={() => {
                    navigate('/settings');
                    setShowProfileMenu(false);
                  }}
                  className="w-full text-left px-3 py-1.5 rounded-md hover:bg-slate-50 text-slate-700"
                >
                  Workspace Settings
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

Topbar.propTypes = {
  onOpenSidebar: PropTypes.func.isRequired,
};
