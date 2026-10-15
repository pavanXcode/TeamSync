import React from 'react';
import PropTypes from 'prop-types';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Sparkles,
  Scale,
  GitCompare,
  AlertTriangle,
  Settings,
  X,
  BrainCircuit,
  Radio,
  ExternalLink,
  GitPullRequest,
} from 'lucide-react';

const navigationItems = [
  {
    name: 'Overview',
    to: '/',
    icon: LayoutDashboard,
    badge: null,
  },
  {
    name: 'Projects',
    to: '/projects',
    icon: FolderKanban,
    badge: null,
  },
  {
    name: 'Employee Directory',
    to: '/employees',
    icon: Users,
    badge: null,
  },
  {
    name: 'Smart Team Builder',
    to: '/team-builder',
    icon: Sparkles,
    badge: 'AI',
  },
  {
    name: 'Workload Balancer',
    to: '/workload',
    icon: Scale,
    badge: null,
  },
  {
    name: 'Skill Gap Analysis',
    to: '/skill-gaps',
    icon: GitCompare,
    badge: null,
  },
  {
    name: 'Deadline Risk',
    to: '/risks',
    icon: AlertTriangle,
    badge: null,
  },
  {
    name: 'GitHub Analytics',
    to: '/github-analytics',
    icon: GitPullRequest,
    badge: 'New',
  },
  {
    name: 'Settings',
    to: '/settings',
    icon: Settings,
    badge: null,
  },
];

export default function Sidebar({ isOpen, onClose }) {
  const handleNavClick = () => {
    // Automatically close sidebar on mobile viewport upon link selection
    if (onClose) {
      onClose();
    }
  };

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-300 lg:hidden ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sidebar container */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-white border-r border-slate-200/80 shadow-lg lg:shadow-none transition-transform duration-300 ease-in-out lg:static lg:w-64 lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Sidebar navigation"
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between border-b border-slate-100 px-5">
          <NavLink
            to="/"
            onClick={handleNavClick}
            className="flex items-center gap-3 group focus:outline-hidden"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 text-white shadow-xs group-hover:shadow-md transition-all">
              <BrainCircuit className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight text-slate-900 leading-none">
                TeamSync
              </span>
              <span className="text-[11px] font-medium text-slate-500 tracking-wide mt-1">
                Workforce Intelligence
              </span>
            </div>
          </NavLink>

          {/* Close button for mobile */}
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 lg:hidden focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Section title */}
        <div className="px-5 pt-5 pb-2">
          <p className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            Workforce Platform
          </p>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-1">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={handleNavClick}
                className={({ isActive }) =>
                  `group flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon
                        className={`h-4 w-4 shrink-0 transition-colors ${
                          isActive
                            ? 'text-blue-600'
                            : 'text-slate-400 group-hover:text-slate-600'
                        }`}
                      />
                      <span className="truncate">{item.name}</span>
                    </div>

                    {item.badge && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          isActive
                            ? 'bg-blue-600 text-white'
                            : 'bg-indigo-50 text-indigo-700 group-hover:bg-indigo-100'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* System & Backend Status footer */}
        <div className="border-t border-slate-100 p-4">
          <div className="rounded-xl bg-slate-50 p-3 border border-slate-200/60">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">FastAPI Engine</span>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Configured
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500 truncate">
              {import.meta.env.VITE_API_URL || 'http://localhost:8001'}
            </p>
          </div>

          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 px-1">
            <span>TeamSync v1.0.0</span>
            <span className="inline-flex items-center gap-1 text-slate-500">
              <Radio className="h-3 w-3 text-blue-500" /> Part 1 Shell
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}

Sidebar.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};
