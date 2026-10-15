import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../api/client';
import { Badge, Card, ErrorBox, Loading } from '../components/Ui';

function statusTone(s) {
  if (s === 'Overloaded') return 'red';
  if (s === 'High workload') return 'amber';
  if (s === 'Underutilized') return 'blue';
  return 'green';
}

export default function Workload() {
  const [data, setData] = useState(null);
  const [recommendation, setRecommendation] = useState(null);
  const [taskLoad, setTaskLoad] = useState(10);
  const [selectedEmp, setSelectedEmp] = useState('');
  const [projectId, setProjectId] = useState('');
  const [projects, setProjects] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = () =>
    api.workload.analysis().then(setData).catch((e) => setError(e.message));

  useEffect(() => {
    load();
    api.projects.list().then(setProjects);
  }, []);

  const suggest = async () => {
    if (!selectedEmp || !projectId) {
      setError('Select an overloaded employee and project');
      return;
    }
    setError('');
    try {
      const r = await api.workload.recommendReallocation({
        employee_id: +selectedEmp,
        project_id: +projectId,
        task_workload: taskLoad,
      });
      setRecommendation(r);
    } catch (e) {
      setError(e.message);
    }
  };

  const confirm = async () => {
    if (!recommendation?.proposed) return;
    try {
      await api.workload.confirmReallocation({
        from_employee_id: recommendation.current.employee_id,
        to_employee_id: recommendation.proposed.employee_id,
        project_id: recommendation.current.project_id,
        task_workload: taskLoad,
      });
      setMessage('Reallocation applied and saved.');
      setRecommendation(null);
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  if (error && !data) return <ErrorBox message={error} />;
  if (!data) return <Loading />;

  const chartData = data.employees.slice(0, 12).map((e) => ({
    name: e.name.split(' ')[0],
    util: e.utilization_pct,
  }));

  return (
    <div className="space-y-6">
      {error && <ErrorBox message={error} />}
      {message && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          {message}
        </p>
      )}

      <Card title="Utilization thresholds">
        <p className="text-sm text-slate-600">
          Underutilized &lt; {data.thresholds.underutilized_max}% · Balanced{' '}
          {data.thresholds.underutilized_max}–{data.thresholds.balanced_max}% · High{' '}
          {data.thresholds.balanced_max}–{data.thresholds.high_max}% · Overloaded &gt;{' '}
          {data.thresholds.high_max}%
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Utilization is computed from active assignment percentages. Availability is separate
          (scheduled time available for work).
        </p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Workload distribution">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 120]} />
              <Tooltip />
              <Bar dataKey="util" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Reallocation assistant">
          <div className="space-y-3 text-sm">
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
              value={selectedEmp}
              onChange={(e) => setSelectedEmp(e.target.value)}
            >
              <option value="">Employee (try overloaded first)…</option>
              {data.overloaded.concat(data.employees.map((e) => e.employee_id))
                .filter((v, i, a) => a.indexOf(v) === i)
                .map((id) => {
                  const e = data.employees.find((x) => x.employee_id === id);
                  return e ? (
                    <option key={id} value={id}>
                      {e.name} ({e.utilization_pct}%)
                    </option>
                  ) : null;
                })}
            </select>
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              <option value="">Project…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <label>
              Task workload (%)
              <input
                type="number"
                min={1}
                max={100}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                value={taskLoad}
                onChange={(e) => setTaskLoad(+e.target.value)}
              />
            </label>
            <button
              type="button"
              onClick={suggest}
              className="w-full rounded-lg bg-brand py-2 text-white"
            >
              Get recommendation
            </button>
          </div>
          {recommendation && (
            <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 text-sm md:grid-cols-2">
              <div className="rounded-lg bg-red-50 p-3">
                <p className="font-medium text-red-900">Current</p>
                <p>{recommendation.current.name}</p>
                <p className="text-red-700">{recommendation.current.utilization_pct}% util</p>
              </div>
              {recommendation.proposed ? (
                <div className="rounded-lg bg-emerald-50 p-3">
                  <p className="font-medium text-emerald-900">Proposed</p>
                  <p>{recommendation.proposed.name}</p>
                  <ul className="mt-1 list-disc pl-4 text-xs">
                    {recommendation.proposed.reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-slate-600">{recommendation.message}</p>
              )}
              {recommendation.proposed && (
                <div className="md:col-span-2 flex gap-2">
                  <button
                    type="button"
                    onClick={confirm}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-white"
                  >
                    Accept & apply
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecommendation(null)}
                    className="rounded-lg border border-slate-200 px-4 py-2"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      <Card title="Employee workload table">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase text-slate-500">
                <th className="py-2">Employee</th>
                <th>Utilization</th>
                <th>Capacity left</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.employees.map((e) => (
                <tr key={e.employee_id} className="border-b border-slate-50">
                  <td className="py-2">
                    {e.name}
                    <span className="block text-xs text-slate-500">{e.department}</span>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full ${e.utilization_pct > 100 ? 'bg-red-500' : 'bg-brand'}`}
                          style={{ width: `${Math.min(100, e.utilization_pct)}%` }}
                        />
                      </div>
                      {e.utilization_pct}%
                    </div>
                  </td>
                  <td>{e.recommended_additional_capacity}%</td>
                  <td>
                    <Badge tone={statusTone(e.status)}>{e.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
