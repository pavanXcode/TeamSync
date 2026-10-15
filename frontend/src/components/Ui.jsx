export function Card({ title, children, action }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-2">
          {title && <h2 className="text-sm font-semibold text-navy">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function Kpi({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-navy">{value ?? '—'}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export function Badge({ children, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-800',
    red: 'bg-red-50 text-red-700',
    blue: 'bg-blue-50 text-blue-700',
  };
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone] || tones.slate}`}
    >
      {children}
    </span>
  );
}

export function Loading({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center py-16 text-sm text-slate-500">{label}</div>
  );
}

export function ErrorBox({ message }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      {message}
    </div>
  );
}

export function Empty({ message }) {
  return <p className="py-8 text-center text-sm text-slate-500">{message}</p>;
}

export function matchTone(label) {
  if (label?.includes('Excellent')) return 'green';
  if (label?.includes('Good')) return 'blue';
  return 'amber';
}

export function riskTone(level) {
  if (level?.includes('Critical')) return 'red';
  if (level?.includes('High')) return 'amber';
  if (level?.includes('Medium')) return 'blue';
  return 'green';
}
