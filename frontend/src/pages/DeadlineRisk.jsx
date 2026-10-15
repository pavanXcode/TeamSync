import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { Badge, Card, ErrorBox, Loading, riskTone } from '../components/Ui';

export default function DeadlineRisk() {
  const [risks, setRisks] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.risks
      .list()
      .then(setRisks)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} />;

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={load}
        className="rounded-lg border border-slate-200 px-4 py-2 text-sm hover:bg-white"
      >
        Recalculate all assessments
      </button>
      <div className="space-y-4">
        {risks.map((r) => (
          <Card key={r.project_id}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <Link
                  to={`/projects/${r.project_id}`}
                  className="text-lg font-semibold text-navy hover:text-brand"
                >
                  {r.project_name}
                </Link>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-2xl font-bold">{r.risk_score}</span>
                  <Badge tone={riskTone(r.risk_level)}>{r.risk_level}</Badge>
                </div>
              </div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Contributing factors</p>
                <ul className="mt-2 space-y-2 text-sm">
                  {r.factors.map((f) => (
                    <li key={f.name} className="flex justify-between gap-2 border-b border-slate-50 pb-1">
                      <span>{f.name}</span>
                      <span className="font-medium">{f.score}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Recommendations</p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-slate-700">
                  {r.recommendations.map((rec) => (
                    <li key={rec}>{rec}</li>
                  ))}
                </ul>
                {r.critical_missing_skills?.length > 0 && (
                  <p className="mt-3 text-sm text-red-700">
                    Missing skills: {r.critical_missing_skills.join(', ')}
                  </p>
                )}
                {r.overloaded_employees?.length > 0 && (
                  <p className="mt-1 text-sm text-amber-700">
                    Overloaded: {r.overloaded_employees.join(', ')}
                  </p>
                )}
              </div>
            </div>
            {r.warnings?.length > 0 && (
              <p className="mt-3 text-xs text-slate-500">{r.warnings.join(' ')}</p>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
