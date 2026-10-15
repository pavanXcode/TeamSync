import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { api } from '../api/client';
import { Card, Kpi, Loading, ErrorBox, Empty } from '../components/Ui';

const PIE_COLORS = ['#2563eb', '#6366f1', '#f59e0b', '#ef4444'];

export default function Overview() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.dashboard()
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <ErrorBox message={error} />;
  if (!data) return <Loading />;

  const { kpis, charts, recent_activity } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <Link
          to="/team-builder"
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm hover:border-brand"
        >
          Build a team
        </Link>
        <Link
          to="/workload"
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm hover:border-brand"
        >
          Balance workload
        </Link>
        <Link
          to="/deadline-risk"
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm hover:border-brand"
        >
          Review deadline risks
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Kpi label="Total employees" value={kpis.total_employees} hint="Active directory records" />
        <Kpi label="Active projects" value={kpis.active_projects} hint="Excludes completed/cancelled" />
        <Kpi
          label="Available employees"
          value={kpis.available_employees}
          hint="≥50% availability & util &lt;80%"
        />
        <Kpi
          label="High workload / overload"
          value={kpis.high_workload_employees}
          hint="Utilization &gt;80%"
        />
        <Kpi label="Critical skill gaps" value={kpis.critical_skill_gaps} hint="Missing skills on teams" />
        <Kpi label="Projects at risk" value={kpis.projects_at_risk} hint="Risk score ≥60" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Workforce utilization distribution">
          {charts.utilization_distribution?.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={charts.utilization_distribution}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label
                >
                  {charts.utilization_distribution.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <Empty message="No utilization data yet." />
          )}
        </Card>
        <Card title="Employee workload comparison">
          {charts.workload_comparison?.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={charts.workload_comparison}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="utilization" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <Empty message="No employees to chart." />
          )}
        </Card>
        <Card title="Most common skills">
          {charts.top_skills?.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={charts.top_skills} layout="vertical">
                <XAxis type="number" />
                <YAxis dataKey="skill" type="category" width={100} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <Empty message="No skills recorded." />
          )}
        </Card>
        <Card title="Project deadline risk distribution">
          {charts.risk_distribution?.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={charts.risk_distribution}>
                <XAxis dataKey="level" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={60} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <Empty message="No projects for risk chart." />
          )}
        </Card>
      </div>

      <Card title="Recent activity">
        {!recent_activity?.length ? (
          <Empty message="No activity logged yet." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {recent_activity.map((a) => (
              <li key={a.id} className="flex justify-between gap-4 py-3 text-sm">
                <div>
                  <span className="font-medium text-navy">{a.event_type.replace(/_/g, ' ')}</span>
                  <p className="text-slate-600">{a.description}</p>
                </div>
                <time className="shrink-0 text-xs text-slate-400">
                  {new Date(a.timestamp).toLocaleString()}
                </time>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
