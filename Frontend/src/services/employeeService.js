import api from './api';
import { SAMPLE_EMPLOYEES } from './sampleData';

/**
 * Service handling all Employee Directory operations.
 * Communicates with FastAPI backend endpoints:
 *   GET    /api/employees
 *   GET    /api/employees/{id}
 *   POST   /api/employees
 *   PUT    /api/employees/{id}
 *   DELETE /api/employees/{id}
 * 
 * Includes fallback state persistence for seamless local testing when backend is offline.
 */

// Local in-memory state for development fallback
let localEmployees = [...SAMPLE_EMPLOYEES];

// Helper to normalize employee between backend schema and frontend UI expectations
function normalizeEmployee(emp) {
  if (!emp) return emp;
  const skillsArray = Array.isArray(emp.skills)
    ? emp.skills
    : emp.skills && typeof emp.skills === 'object'
    ? Object.keys(emp.skills)
    : [];

  const workload = Number(emp.workload_percentage ?? emp.current_workload_pct ?? 0);
  let availStatus = emp.availability_status;
  if (!availStatus) {
    if (workload >= 90) availStatus = 'fully_allocated';
    else if (workload >= 70) availStatus = 'partially_allocated';
    else availStatus = 'available';
  }

  const activeProjects = Array.isArray(emp.active_projects)
    ? emp.active_projects.map((p) => p.project_name || p.name || `Project ${p.project_id}`)
    : emp.current_projects || [];

  return {
    ...emp,
    role: emp.role || emp.job_title || 'Specialist',
    job_title: emp.job_title || emp.role || 'Specialist',
    current_workload_pct: workload,
    workload_percentage: workload,
    skills: skillsArray,
    skills_dict: typeof emp.skills === 'object' && !Array.isArray(emp.skills) ? emp.skills : {},
    availability_status: availStatus,
    availability_percentage: Number(emp.availability_percentage ?? 100),
    current_projects: activeProjects,
  };
}

function formatEmployeePayload(data) {
  let skillsDict = {};
  if (data.skills && typeof data.skills === 'object' && !Array.isArray(data.skills)) {
    skillsDict = data.skills;
  } else if (Array.isArray(data.skills)) {
    data.skills.forEach((s) => {
      const name = String(s).trim();
      if (name) skillsDict[name] = 4;
    });
  } else if (typeof data.skills === 'string') {
    data.skills.split(',').forEach((s) => {
      const name = s.trim();
      if (name) skillsDict[name] = 4;
    });
  }

  const workload = Number(data.workload_percentage ?? data.current_workload_pct ?? 0);
  const availPct = Number(
    data.availability_percentage ??
      (data.availability_status === 'available' ? 90 : data.availability_status === 'partially_allocated' ? 60 : 30)
  );

  return {
    name: data.name,
    email: data.email,
    job_title: data.job_title || data.role || 'Engineer',
    department: data.department || 'Engineering',
    skills: skillsDict,
    experience_years: Number(data.experience_years) || 0,
    availability_percentage: Math.max(0, Math.min(100, availPct)),
    workload_percentage: Math.max(0, Math.min(100, workload)),
    active: data.active !== false,
  };
}

export const employeeService = {
  /**
   * Fetch all employees
   * @param {boolean} forceFallback - whether to use local sample data
   */
  async getEmployees(forceFallback = false) {
    if (forceFallback) {
      return { data: localEmployees.map(normalizeEmployee), isSample: true };
    }

    try {
      const response = await api.get('/api/employees');
      const normalized = (response.data || []).map(normalizeEmployee);
      return { data: normalized, isSample: false };
    } catch (error) {
      console.warn('GET /api/employees failed or offline. Falling back to development sample data.', error.message);
      return { data: localEmployees.map(normalizeEmployee), isSample: true, error };
    }
  },

  /**
   * Fetch a single employee by ID
   * @param {string|number} id
   * @param {boolean} forceFallback
   */
  async getEmployeeById(id, forceFallback = false) {
    if (forceFallback) {
      const item = localEmployees.find((e) => String(e.id) === String(id));
      if (!item) throw new Error(`Employee with ID ${id} not found.`);
      return { data: normalizeEmployee(item), isSample: true };
    }

    try {
      const response = await api.get(`/api/employees/${id}`);
      return { data: normalizeEmployee(response.data), isSample: false };
    } catch (error) {
      console.warn(`GET /api/employees/${id} failed. Checking local sample data.`, error.message);
      const item = localEmployees.find((e) => String(e.id) === String(id));
      if (item) return { data: normalizeEmployee(item), isSample: true, error };
      throw error;
    }
  },

  /**
   * Create a new employee
   * @param {Object} employeeData
   */
  async createEmployee(employeeData) {
    const payload = formatEmployeePayload(employeeData);
    try {
      const response = await api.post('/api/employees', payload);
      return { data: normalizeEmployee(response.data), isSample: false };
    } catch (error) {
      console.warn('POST /api/employees failed or backend offline. Emulating local creation.', error.message);
      const newEmployee = normalizeEmployee({
        ...employeeData,
        id: employeeData.id || `EMP-${Date.now().toString().slice(-4)}`,
      });
      localEmployees = [newEmployee, ...localEmployees];
      return { data: newEmployee, isSample: true, offlineEmulated: true, error };
    }
  },

  /**
   * Update an existing employee
   * @param {string|number} id
   * @param {Object} employeeData
   */
  async updateEmployee(id, employeeData) {
    const payload = formatEmployeePayload(employeeData);
    try {
      const response = await api.put(`/api/employees/${id}`, payload);
      return { data: normalizeEmployee(response.data), isSample: false };
    } catch (error) {
      console.warn(`PUT /api/employees/${id} failed or backend offline. Emulating local update.`, error.message);
      const index = localEmployees.findIndex((e) => String(e.id) === String(id));
      if (index === -1) throw error;
      
      const updated = normalizeEmployee({
        ...localEmployees[index],
        ...employeeData,
      });
      localEmployees[index] = updated;
      return { data: updated, isSample: true, offlineEmulated: true, error };
    }
  },

  /**
   * Delete an employee
   * @param {string|number} id
   */
  async deleteEmployee(id) {
    try {
      const response = await api.delete(`/api/employees/${id}`);
      return { data: response.data, isSample: false };
    } catch (error) {
      console.warn(`DELETE /api/employees/${id} failed or backend offline. Emulating local deletion.`, error.message);
      localEmployees = localEmployees.filter((e) => String(e.id) !== String(id));
      return { success: true, isSample: true, offlineEmulated: true, error };
    }
  },

  /**
   * Reset local sample data to initial state
   */
  resetLocalState() {
    localEmployees = [...SAMPLE_EMPLOYEES];
  },
};

export default employeeService;
