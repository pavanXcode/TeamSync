import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  UsersRound,
  Scale,
  GraduationCap,
  AlertTriangle,
  Settings,
  Menu,
  Bell,
  Plus,
  ChevronLeft,
} from 'lucide-react';
import { useState } from 'react';

const nav = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/employees', label: 'Employee Directory', icon: Users },
  { to: '/team-builder', label: 'Smart Team Builder', icon: UsersRound },
  { to: '/workload', label: 'Workload Balancer', icon: Scale },
  { to: '/skill-gaps', label: 'Skill Gap Analysis', icon: GraduationCap },
  { to: '/deadline-risk', label: 'Deadline Risk', icon: AlertTriangle },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const titles = Object.fromEntries(nav.map((n) => [n.to, n.label]));

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const path = window.location.pathname;
  const title = titles[path] || 'CrewIQ';

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="flex min-h-screen">
      <aside
        className={`${
          collapsed ? 'w-16' : 'w-64'
        } shrink-0 border-r border-slate-200 bg-white transition-all`}
      >
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-indigo-600 text-sm font-bold text-white">
            CQ
          </div>
          {!collapsed && (
            <div>
              <p className="text-sm font-semibold text-navy">CrewIQ</p>
              <p className="text-xs text-slate-500">Workforce Intelligence</p>
            </div>
          )}
        </div>
        <nav className="space-y-1 p-2">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                  isActive
                    ? 'bg-brand-soft font-medium text-brand-dark'
                    : 'text-slate-600 hover:bg-slate-50'
                }`
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="m-2 flex w-[calc(100%-1rem)] items-center justify-center gap-2 rounded-lg border border-slate-200 py-2 text-xs text-slate-600 hover:bg-slate-50"
        >
          {collapsed ? <Menu className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          {!collapsed && 'Collapse'}
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex flex-wrap items-center gap-4 border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold text-navy">{title}</h1>
            <p className="text-xs text-slate-500">
              Intelligent Workforce. Smarter Teams. Better Outcomes.
            </p>
          </div>
          <span className="hidden text-sm text-slate-500 md:inline">{today}</span>
          <button
            type="button"
            className="relative rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
          </button>
          <div className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-sm">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-xs font-medium text-white">
              HM
            </span>
            <span className="hidden sm:inline text-slate-700">Hackathon Manager</span>
          </div>
          <button
            type="button"
            onClick={() => navigate('/projects?create=1')}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
          >
            <Plus className="h-4 w-4" />
            Create Project
          </button>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
        <footer className="border-t border-slate-100 px-6 py-3 text-center text-xs text-slate-400">
          CrewIQ hackathon prototype — no authentication; demo data in SQLite.
        </footer>
      </div>
    </div>
  );
}
