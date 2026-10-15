import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Card, ErrorBox, Loading } from '../components/Ui';

export default function Settings() {
  const [config, setConfig] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.config()
      .then(setConfig)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <ErrorBox message={error} />;
  if (!config) return <Loading />;

  const pct = (obj) =>
    Object.entries(obj).map(([k, v]) => (
      <li key={k} className="flex justify-between border-b border-slate-50 py-2 text-sm">
        <span className="text-slate-600">{k.replace(/_/g, ' ')}</span>
        <span className="font-medium">{typeof v === 'number' && v <= 1 ? `${(v * 100).toFixed(0)}%` : v}</span>
      </li>
    ));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <p className="text-sm text-slate-600">{config.methodology}</p>
      <Card title="Matching weights">
        <ul>{pct(config.matching_weights)}</ul>
      </Card>
      <Card title="Deadline risk weights">
        <ul>{pct(config.risk_weights)}</ul>
      </Card>
      <Card title="Workload thresholds (%)">
        <ul>{pct(config.workload_thresholds)}</ul>
      </Card>
      <Card title="Prototype notice">
        <p className="text-sm text-slate-600">
          CrewIQ is a hackathon MVP. There is no login or role-based access control. All scoring
          uses explainable Python rules — not a trained machine learning model.
        </p>
      </Card>
    </div>
  );
}
