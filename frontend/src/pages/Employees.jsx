import { useEffect, useMemo, useState } from 'react';
import { api, allSkillsFromEmployees } from '../api/client';
import { Badge, Card, ErrorBox, Loading } from '../components/Ui';

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('');
  const [skillFilter, setSkillFilter] = useState('');
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.employees
      .list()
      .then(setEmployees)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const departments = useMemo(
    () => [...new Set(employees.map((e) => e.department))].sort(),
    [employees],
  );
  const skills = useMemo(() => allSkillsFromEmployees(employees), [employees]);

  const filtered = employees.filter((e) => {
    if (q && !e.name.toLowerCase().includes(q.toLowerCase())) return false;
    if (dept && e.department !== dept) return false;
    if (skillFilter && !(e.skills || {})[skillFilter]) return false;
    return true;
  });

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} />;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-4">
        <div className="flex flex-wrap gap-2">
          <input
            type="search"
            placeholder="Search by name"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <select
            value={dept}
            onChange={(e) => setDept(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <select
            value={skillFilter}
            onChange={(e) => setSkillFilter(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">All skills</option>
            {skills.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase text-slate-500">
                  <th className="py-2">Name</th>
                  <th>Department</th>
                  <th>Avail.</th>
                  <th>Workload</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr
                    key={e.id}
                    className="cursor-pointer border-b border-slate-50 hover:bg-slate-50"
                    onClick={() => setSelected(e)}
                  >
                    <td className="py-3">
                      <p className="font-medium">{e.name}</p>
                      <p className="text-xs text-slate-500">{e.job_title}</p>
                    </td>
                    <td>{e.department}</td>
                    <td>{e.availability_percentage}%</td>
                    <td>{e.workload_percentage}%</td>
                    <td>
                      <Badge tone={e.active ? 'green' : 'slate'}>
                        {e.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      <Card title="Employee detail">
        {!selected ? (
          <p className="text-sm text-slate-500">Select an employee to view skills and projects.</p>
        ) : (
          <div className="space-y-3 text-sm">
            <div>
              <p className="font-semibold text-navy">{selected.name}</p>
              <p className="text-slate-600">{selected.job_title}</p>
              <p className="text-slate-500">{selected.email}</p>
            </div>
            <p>
              Experience: <strong>{selected.experience_years}y</strong>
            </p>
            <div>
              <p className="font-medium">Skills</p>
              <ul className="mt-1 space-y-1">
                {Object.entries(selected.skills || {}).map(([k, v]) => (
                  <li key={k} className="flex justify-between text-slate-600">
                    <span>{k}</span>
                    <span>Level {v}/5</span>
                  </li>
                ))}
              </ul>
            </div>
            {selected.active_projects?.length > 0 && (
              <div>
                <p className="font-medium">Active projects</p>
                <ul className="mt-1 list-disc pl-4 text-slate-600">
                  {selected.active_projects.map((p) => (
                    <li key={p.project_id}>
                      {p.project_name} ({p.assigned_workload}%)
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
