import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { Badge, Card, ErrorBox, Loading, matchTone } from '../components/Ui';

export default function TeamBuilder() {
  const [params] = useSearchParams();
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState(params.get('project') || '');
  const [teamSize, setTeamSize] = useState(4);
  const [result, setResult] = useState(null);
  const [exclude, setExclude] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.projects.list().then(setProjects).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (params.get('project')) setProjectId(params.get('project'));
  }, [params]);

  const generate = async () => {
    if (!projectId) {
      setError('Select a project');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const body = {
        project_id: +projectId,
        desired_team_size: teamSize,
        exclude_employee_ids: exclude,
      };
      const r = await api.teamBuilder.recommend(body);
      setResult(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const removeMember = (id) => {
    setExclude((ex) => [...ex, id]);
    setResult(null);
  };

  const project = projects.find((p) => String(p.id) === String(projectId));

  return (
    <div className="space-y-6">
      {error && <ErrorBox message={error} />}
      <Card title="Configure team build">
        <div className="flex flex-wrap items-end gap-4">
          <label className="text-sm">
            Project
            <select
              className="mt-1 block min-w-[240px] rounded-lg border border-slate-200 px-3 py-2"
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                setResult(null);
              }}
            >
              <option value="">Select project…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Team size
            <input
              type="number"
              min={1}
              max={12}
              className="mt-1 block w-24 rounded-lg border border-slate-200 px-3 py-2"
              value={teamSize}
              onChange={(e) => setTeamSize(+e.target.value)}
            />
          </label>
          <button
            type="button"
            onClick={generate}
            disabled={loading}
            className="rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? 'Generating…' : 'Generate team'}
          </button>
        </div>
        {project && (
          <p className="mt-3 text-sm text-slate-600">
            Required: {project.required_skills.join(', ')} · Min exp:{' '}
            {project.minimum_experience}y
          </p>
        )}
      </Card>

      {result && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card title="Team suitability">
              <p className="text-3xl font-semibold text-navy">{result.team_suitability_score}</p>
            </Card>
            <Card title="Skill coverage">
              <p className="text-3xl font-semibold text-navy">{result.overall_skill_coverage_pct}%</p>
            </Card>
            <Card title="Avg experience">
              <p className="text-3xl font-semibold text-navy">{result.team_experience_avg}y</p>
            </Card>
          </div>
          {result.warnings?.map((w) => (
            <p key={w} className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
              {w}
            </p>
          ))}
          <Card title="Recommended team">
            <div className="grid gap-3 md:grid-cols-2">
              {result.team_members.map((m) => (
                <div
                  key={m.employee_id}
                  className="rounded-lg border border-slate-100 p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{m.name}</p>
                      <Badge tone={matchTone(m.match_score >= 80 ? 'Excellent match' : 'Good match')}>
                        {m.match_score}% match
                      </Badge>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeMember(m.employee_id)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                  <ul className="mt-2 list-disc pl-4 text-xs text-slate-600">
                    {m.reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-slate-500">
                    Est. workload after assign: {m.workload_after_pct}%
                  </p>
                </div>
              ))}
            </div>
            {exclude.length > 0 && (
              <button
                type="button"
                onClick={generate}
                className="mt-4 text-sm text-brand hover:underline"
              >
                Recalculate with {exclude.length} excluded
              </button>
            )}
          </Card>
          {result.uncovered_skills?.length > 0 && (
            <Card title="Remaining skill gaps">
              <p className="text-sm text-red-700">{result.uncovered_skills.join(', ')}</p>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
