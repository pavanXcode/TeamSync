import api from './api';
import { SAMPLE_PROJECTS } from './sampleData';

/**
 * Service handling all Project management operations.
 * Communicates with FastAPI backend endpoints:
 *   GET    /api/projects
 *   GET    /api/projects/{id}
 *   POST   /api/projects
 *   PUT    /api/projects/{id}
 *   DELETE /api/projects/{id}
 * 
 * Supports offline emulation with local sample persistence for development testing.
 */

let localProjects = [...SAMPLE_PROJECTS];

function normalizeProject(proj) {
  if (!proj) return proj;
  const assignedNames = Array.isArray(proj.assigned_team)
    ? proj.assigned_team.map((m) => (typeof m === 'object' && m ? m.name : m))
    : [];

  return {
    ...proj,
    min_experience_years: Number(proj.min_experience_years ?? proj.minimum_experience ?? 0),
    minimum_experience: Number(proj.minimum_experience ?? proj.min_experience_years ?? 0),
    estimated_workload_hours: Number(proj.estimated_workload_hours ?? proj.estimated_workload ?? 100),
    estimated_workload: Number(proj.estimated_workload ?? proj.estimated_workload_hours ?? 100),
    assigned_team: assignedNames,
    assigned_team_details: Array.isArray(proj.assigned_team) && typeof proj.assigned_team[0] === 'object' ? proj.assigned_team : [],
    priority: proj.priority ? proj.priority.toLowerCase() : 'medium',
    status: proj.status ? proj.status.toLowerCase().replace(' ', '_') : 'planning',
  };
}

function formatProjectPayload(data) {
  let skillsList = [];
  if (Array.isArray(data.required_skills)) {
    skillsList = data.required_skills.map((s) => String(s).trim()).filter(Boolean);
  } else if (typeof data.required_skills === 'string') {
    skillsList = data.required_skills.split(',').map((s) => s.trim()).filter(Boolean);
  }
  if (skillsList.length === 0) {
    skillsList = ['General'];
  }

  // Capitalize priority/status to match backend defaults if needed
  const prio = data.priority ? data.priority.charAt(0).toUpperCase() + data.priority.slice(1).toLowerCase() : 'Medium';
  const status = data.status === 'in_progress' ? 'Active' : data.status === 'completed' ? 'Completed' : 'Planning';

  return {
    name: data.name,
    description: data.description || '',
    required_skills: skillsList,
    minimum_experience: Number(data.minimum_experience ?? data.min_experience_years ?? 0),
    desired_team_size: Number(data.desired_team_size) || 3,
    start_date: data.start_date || null,
    deadline: data.deadline || null,
    estimated_workload: Number(data.estimated_workload ?? data.estimated_workload_hours ?? 100),
    priority: prio,
    status: status,
  };
}

export const projectService = {
  /**
   * Fetch all projects
   * @param {boolean} forceFallback
   */
  async getProjects(forceFallback = false) {
    if (forceFallback) {
      return { data: localProjects.map(normalizeProject), isSample: true };
    }

    try {
      const response = await api.get('/api/projects');
      const normalized = (response.data || []).map(normalizeProject);
      return { data: normalized, isSample: false };
    } catch (error) {
      console.warn('GET /api/projects failed or offline. Falling back to development sample data.', error.message);
      return { data: localProjects.map(normalizeProject), isSample: true, error };
    }
  },

  /**
   * Fetch a single project by ID
   * @param {string|number} id
   * @param {boolean} forceFallback
   */
  async getProjectById(id, forceFallback = false) {
    if (forceFallback) {
      const item = localProjects.find((p) => String(p.id) === String(id));
      if (!item) throw new Error(`Project with ID ${id} not found.`);
      return { data: normalizeProject(item), isSample: true };
    }

    try {
      const response = await api.get(`/api/projects/${id}`);
      return { data: normalizeProject(response.data), isSample: false };
    } catch (error) {
      console.warn(`GET /api/projects/${id} failed. Checking local sample data.`, error.message);
      const item = localProjects.find((p) => String(p.id) === String(id));
      if (item) return { data: normalizeProject(item), isSample: true, error };
      throw error;
    }
  },

  /**
   * Create a new project
   * @param {Object} projectData
   */
  async createProject(projectData) {
    const payload = formatProjectPayload(projectData);
    try {
      const response = await api.post('/api/projects', payload);
      return { data: normalizeProject(response.data), isSample: false };
    } catch (error) {
      console.warn('POST /api/projects failed or backend offline. Emulating local creation.', error.message);
      const newProject = normalizeProject({
        ...projectData,
        id: projectData.id || `PRJ-${Date.now().toString().slice(-4)}`,
      });
      localProjects = [newProject, ...localProjects];
      return { data: newProject, isSample: true, offlineEmulated: true, error };
    }
  },

  /**
   * Update an existing project
   * @param {string|number} id
   * @param {Object} projectData
   */
  async updateProject(id, projectData) {
    const payload = formatProjectPayload(projectData);
    try {
      const response = await api.put(`/api/projects/${id}`, payload);
      return { data: normalizeProject(response.data), isSample: false };
    } catch (error) {
      console.warn(`PUT /api/projects/${id} failed or backend offline. Emulating local update.`, error.message);
      const index = localProjects.findIndex((p) => String(p.id) === String(id));
      if (index === -1) throw error;

      const updated = normalizeProject({
        ...localProjects[index],
        ...projectData,
      });
      localProjects[index] = updated;
      return { data: updated, isSample: true, offlineEmulated: true, error };
    }
  },

  /**
   * Delete a project
   * @param {string|number} id
   */
  async deleteProject(id) {
    try {
      const response = await api.delete(`/api/projects/${id}`);
      return { data: response.data, isSample: false };
    } catch (error) {
      console.warn(`DELETE /api/projects/${id} failed or backend offline. Emulating local deletion.`, error.message);
      localProjects = localProjects.filter((p) => String(p.id) !== String(id));
      return { success: true, isSample: true, offlineEmulated: true, error };
    }
  },

  /**
   * Reset local state to sample data
   */
  resetLocalState() {
    localProjects = [...SAMPLE_PROJECTS];
  },
};

export default projectService;
