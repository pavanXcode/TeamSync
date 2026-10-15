import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { Badge, Card, ErrorBox, Loading } from '../components/Ui';

function gapTone(status) {
  if (status === 'Covered') return 'green';
  if (status === 'Partially covered') return 'amber';
  return 'red';
}

export default function SkillGaps() {
  const [params] = useSearchParams();
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState(params.get('project') || '');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.projects.list().then((p) => {
      setProjects(p);
      const id = params.get('project') || (p[0]?.id ? String(p[0].id) : '');
      setProjectId(id);
    });
  }, [params]);

  useEffect(() => {
    if (!projectId) return;
    setError('');
    api.skillGaps(+projectId)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [projectId]);

  return (
    <div className="space-y-6">
      <Card title="Select project">
        <select
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Card>
      {error && <ErrorBox message={error} />}
      {!data && !error && <Loading />}
      {data && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">{data.project_name}</h2>
              <p className="text-sm text-slate-600">
                Overall coverage: <strong>{data.overall_coverage_pct}%</strong>
              </p>
            </div>
          </div>
          <Card title="Skill coverage matrix">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase text-slate-500">
                    <th className="py-2">Skill</th>
                    <th>Team count</th>
                    <th>Highest</th>
                    <th>Average</th>
                    <th>Required</th>
                    <th>Status</th>
                    <th>Training</th>
                  </tr>
                </thead>
                <tbody>
                  {data.gaps.map((g) => (
                    <tr key={g.skill} className="border-b border-slate-50">
                      <td className="py-2 font-medium">{g.skill}</td>
                      <td>{g.team_count}</td>
                      <td>{g.highest_proficiency || '—'}</td>
                      <td>{g.average_proficiency}</td>
                      <td>{g.required_proficiency}</td>
                      <td>
                        <Badge tone={gapTone(g.status)}>{g.status}</Badge>
                      </td>
                      <td className="max-w-xs text-xs text-slate-600">
                        {g.training_suggestion || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
