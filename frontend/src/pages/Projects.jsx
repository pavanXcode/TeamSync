import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, allSkillsFromEmployees } from '../api/client';
import { Badge, Card, ErrorBox, Loading } from '../components/Ui';

const emptyProject = {
  name: '',
  description: '',
  required_skills: ['Python'],
  minimum_experience: 2,
  desired_team_size: 4,
  start_date: '',
  deadline: '',
  estimated_workload: 100,
  priority: 'Medium',
  status: 'Planning',
};

function priorityTone(p) {
  if (p === 'High' || p === 'Critical') return 'amber';
  if (p === 'Low') return 'slate';
  return 'blue';
}

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [q, setQ] = useState('');
  const [form, setForm] = useState(emptyProject);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [params] = useSearchParams();

  const skillOptions = useMemo(() => allSkillsFromEmployees(employees), [employees]);

  const load = () =>
    Promise.all([api.projects.list(), api.employees.list()])
      .then(([p, e]) => {
        setProjects(p);
        setEmployees(e);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
    if (params.get('create') === '1') setShowForm(true);
  }, [params]);

  const filtered = projects.filter(
    (p) =>
      !q ||
      p.name.toLowerCase().includes(q.toLowerCase()) ||
      p.status.toLowerCase().includes(q.toLowerCase()),
  );

  const toggleSkill = (skill) => {
    setForm((f) => {
      const has = f.required_skills.includes(skill);
      const required_skills = has
        ? f.required_skills.filter((s) => s !== skill)
        : [...f.required_skills, skill];
      return { ...f, required_skills: required_skills.length ? required_skills : f.required_skills };
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const body = {
        ...form,
        start_date: form.start_date || null,
        deadline: form.deadline || null,
        required_skills: form.required_skills,
      };
      await api.projects.create(body);
      setForm(emptyProject);
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      {error && <ErrorBox message={error} />}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Search projects…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className="rounded-lg bg-brand px-4 py-2 text-sm text-white hover:bg-brand-dark"
        >
          {showForm ? 'Close form' : 'New project'}
        </button>
      </div>

      {showForm && (
        <Card title="Create project">
          <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
            <label className="text-sm">
              Name
              <input
                required
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label className="text-sm">
              Priority
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
              >
                {['Low', 'Medium', 'High', 'Critical'].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <label className="md:col-span-2 text-sm">
              Description
              <textarea
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </label>
            <div className="md:col-span-2">
              <p className="text-sm font-medium">Required skills</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {skillOptions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSkill(s)}
                    className={`rounded-full px-3 py-1 text-xs ${
                      form.required_skills.includes(s)
                        ? 'bg-brand text-white'
                        : 'border border-slate-200 bg-white'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <input
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Add custom skill and press Enter"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const v = e.target.value.trim();
                    if (v && !form.required_skills.includes(v)) {
                      setForm({ ...form, required_skills: [...form.required_skills, v] });
                    }
                    e.target.value = '';
                  }
                }}
              />
            </div>
            <label className="text-sm">
              Min experience (years)
              <input
                type="number"
                min={0}
                step={0.5}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                value={form.minimum_experience}
                onChange={(e) => setForm({ ...form, minimum_experience: +e.target.value })}
              />
            </label>
            <label className="text-sm">
              Team size
              <input
                type="number"
                min={1}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                value={form.desired_team_size}
                onChange={(e) => setForm({ ...form, desired_team_size: +e.target.value })}
              />
            </label>
            <label className="text-sm">
              Start date
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              />
            </label>
            <label className="text-sm">
              Deadline
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                value={form.deadline}
                onChange={(e) => setForm({ ...form, deadline: e.target.value })}
              />
            </label>
            <button
              type="submit"
              className="md:col-span-2 rounded-lg bg-brand py-2 text-sm font-medium text-white"
            >
              Save project
            </button>
          </form>
        </Card>
      )}

      <div className="grid gap-4">
        {filtered.map((p) => (
          <Link
            key={p.id}
            to={`/projects/${p.id}`}
            className="block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-navy">{p.name}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-slate-600">{p.description}</p>
              </div>
              <div className="flex gap-2">
                <Badge tone={priorityTone(p.priority)}>{p.priority}</Badge>
                <Badge>{p.status}</Badge>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {p.required_skills.map((s) => (
                <span key={s} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  {s}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
