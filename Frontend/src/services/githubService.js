import api from './api';

/**
 * TeamSync - GitHub Analytics Service
 * Connects to GET /api/github/progress
 */
export const githubService = {
  /**
   * Fetch GitHub progress metrics, team summary, and itemized tasks
   * @param {Object} [params] - Optional query parameters
   * @param {string} [params.start_date] - Filter by start date (YYYY-MM-DD)
   * @param {string} [params.end_date] - Filter by end date (YYYY-MM-DD)
   * @param {number} [params.employee_id] - Filter by specific employee ID
   * @returns {Promise<{ data: Object, isSample: boolean, error?: string }>}
   */
  async getProgress(params = {}) {
    try {
      const response = await api.get('/api/github/progress', { params });
      return {
        data: response.data,
        isSample: Boolean(response.data?.connection_status?.is_sample),
      };
    } catch (error) {
      console.warn('GET /api/github/progress network failure. Falling back to local offline sample structure.', error.message);
      return {
        data: {
          connection_status: {
            is_connected: false,
            configured: false,
            owner: 'teamsync-org',
            repo: 'teamsync-workforce-core',
            rate_limit_remaining: null,
            rate_limit_reset: null,
            last_sync: new Date().toISOString(),
            error_message: error.message || 'Network error communicating with backend.',
            is_sample: true,
          },
          team_summary: {
            total_eligible_tasks: 0,
            total_completed_tasks: 0,
            overall_task_progress_pct: 0,
            total_prs_opened: 0,
            total_prs_merged: 0,
            total_reviews_completed: 0,
            overdue_tasks_count: 0,
            active_contributors_count: 0,
          },
          employee_progress: [],
          tasks: [],
          departments: [],
        },
        isSample: true,
        error: error.message,
      };
    }
  },
};

export default githubService;
