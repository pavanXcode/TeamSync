import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { Badge, Card, ErrorBox, Loading, matchTone, riskTone } from '../components/Ui';

export default function ProjectDetail() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [matches, setMatches] = useState(null);
  const [risk, setRisk] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.projects.get(id),
      api.matching.analyze({ project_id: +id }),
      api.risks.get(+id),
    ])
      .then(([p, m, r]) => {
        setProject(p);
        setMatches(m);
        setRisk(r);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) return <ErrorBox message={error} />;
  if (!project) return <Loading />;

  return (
    <div className="space-y-6">
      <Link to="/projects" className="text-sm text-brand hover:underline">
        ← Back to projects
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-navy">{project.name}</h2>
          <p className="mt-1 text-slate-600">{project.description}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge tone="blue">{project.priority}</Badge>
            <Badge>{project.status}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            to={`/team-builder?project=${id}`}
            className="rounded-lg bg-brand px-4 py-2 text-sm text-white"
          >
            Build team
          </Link>
          <Link
            to={`/skill-gaps?project=${id}`}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
          >
            Skill gaps
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Timeline">
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Start</dt>
              <dd>{project.start_date || '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Deadline</dt>
              <dd>{project.deadline || '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Est. workload</dt>
              <dd>{project.estimated_workload}</dd>
            </div>
          </dl>
        </Card>
        <Card title="Assigned team">
          {project.assigned_team?.length ? (
            <ul className="space-y-2 text-sm">
              {project.assigned_team.map((m) => (
                <li key={m.employee_id} className="flex justify-between">
                  <span>{m.name}</span>
                  <span className="text-slate-500">{m.assigned_workload}%</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No assignments yet.</p>
          )}
        </Card>
        {risk && (
          <Card title="Deadline risk">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-semibold">{risk.risk_score}</span>
              <Badge tone={riskTone(risk.risk_level)}>{risk.risk_level}</Badge>
            </div>
            <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-slate-600">
              {risk.recommendations.slice(0, 3).map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      {matches && (
        <Card title="Top employee matches">
          {matches.unknown_skills?.length > 0 && (
            <p className="mb-3 text-sm text-amber-700">
              No employee has recorded skills: {matches.unknown_skills.join(', ')}
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase text-slate-500">
                  <th className="py-2">Employee</th>
                  <th>Match</th>
                  <th>Skills</th>
                  <th>Avail.</th>
                  <th>Workload</th>
                </tr>
              </thead>
              <tbody>
                {matches.results.slice(0, 8).map((r) => (
                  <tr key={r.employee_id} className="border-b border-slate-50">
                    <td className="py-3">
                      <p className="font-medium">{r.name}</p>
                      <p className="text-xs text-slate-500">{r.job_title}</p>
                    </td>
                    <td>
                      <Badge tone={matchTone(r.match_label)}>{r.match_score}%</Badge>
                      <p className="text-xs text-slate-500">{r.match_label}</p>
                    </td>
                    <td className="text-xs">
                      {r.matching_skills.join(', ') || '—'}
                      {r.missing_skills.length > 0 && (
                        <p className="text-amber-600">Missing: {r.missing_skills.join(', ')}</p>
                      )}
                    </td>
                    <td>{r.availability_percentage}%</td>
                    <td>{r.workload_percentage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
