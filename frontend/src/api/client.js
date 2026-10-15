const BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const j = await res.json();
      detail = j.detail || JSON.stringify(j);
    } catch {
      /* ignore */
    }
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  health: () => request('/api/health'),
  dashboard: () => request('/api/dashboard'),
  config: () => request('/api/config'),
  activities: () => request('/api/activities'),
  employees: {
    list: () => request('/api/employees'),
    get: (id) => request(`/api/employees/${id}`),
    create: (body) => request('/api/employees', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) =>
      request(`/api/employees/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    remove: (id) => request(`/api/employees/${id}`, { method: 'DELETE' }),
  },
  projects: {
    list: () => request('/api/projects'),
    get: (id) => request(`/api/projects/${id}`),
    create: (body) => request('/api/projects', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) =>
      request(`/api/projects/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    remove: (id) => request(`/api/projects/${id}`, { method: 'DELETE' }),
  },
  matching: {
    analyze: (body) =>
      request('/api/matching/analyze', { method: 'POST', body: JSON.stringify(body) }),
  },
  teamBuilder: {
    recommend: (body) =>
      request('/api/team-builder/recommend', { method: 'POST', body: JSON.stringify(body) }),
  },
  workload: {
    analysis: () => request('/api/workload/analysis'),
    recommendReallocation: (body) =>
      request('/api/workload/reallocation/recommend', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    confirmReallocation: (body) =>
      request('/api/workload/reallocation/confirm', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  },
  skillGaps: (projectId) => request(`/api/skill-gaps/${projectId}`),
  risks: {
    list: () => request('/api/risks'),
    get: (projectId) => request(`/api/risks/${projectId}`),
  },
};

export function allSkillsFromEmployees(employees) {
  const set = new Set();
  employees.forEach((e) => Object.keys(e.skills || {}).forEach((s) => set.add(s)));
  return [...set].sort((a, b) => a.localeCompare(b));
}
