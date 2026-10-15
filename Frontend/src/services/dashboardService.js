import api from './api';
import employeeService from './employeeService';
import projectService from './projectService';
import { SAMPLE_ACTIVITIES } from './sampleData';

/**
 * Service providing aggregated KPI metrics and chart feeds for the Dashboard.
 * Dynamically computes statistics from live/sample employee & project collections.
 */

export const dashboardService = {
  /**
   * Compute comprehensive dashboard analytics
   * @param {boolean} forceFallback
   */
  async getDashboardData(forceFallback = false) {
    // Attempt dedicated backend summary first, otherwise synthesize from resource collections
    let backendSummary = null;
    try {
      if (!forceFallback) {
        const res = await api.get('/api/dashboard');
        backendSummary = res.data;
      }
    } catch {
      // Endpoint not yet implemented or offline, compute from resources
    }

    const [empRes, projRes] = await Promise.all([
      employeeService.getEmployees(forceFallback),
      projectService.getProjects(forceFallback),
    ]);

    const employees = empRes.data || [];
    const projects = projRes.data || [];
    const isSample = empRes.isSample || projRes.isSample;

    // 1. KPIs
    const totalEmployees = employees.length;
    const activeProjects = projects.filter((p) => p.status !== 'completed').length;
    const availableEmployees = employees.filter(
      (e) => e.availability_status === 'available' || Number(e.current_workload_pct) < 75
    ).length;
    const highWorkloadEmployees = employees.filter(
      (e) => Number(e.current_workload_pct) >= 90
    ).length;

    // Compute skill demands vs supplies
    const skillDemandMap = {};
    projects.forEach((p) => {
      (p.required_skills || []).forEach((skill) => {
        skillDemandMap[skill] = (skillDemandMap[skill] || 0) + 1;
      });
    });

    const skillSupplyMap = {};
    employees.forEach((e) => {
      (e.skills || []).forEach((skill) => {
        skillSupplyMap[skill] = (skillSupplyMap[skill] || 0) + 1;
      });
    });

    // Detect critical skill gaps (skills needed in projects with 0 or 1 qualified employee)
    const criticalSkillGaps = Object.keys(skillDemandMap).filter(
      (skill) => (skillSupplyMap[skill] || 0) < skillDemandMap[skill]
    ).length;

    // Projects at deadline risk (flagged risk_level 'high' or deadline within 25 days)
    const today = new Date();
    const projectsAtRisk = projects.filter((p) => {
      if (p.risk_level === 'high' || p.status === 'delayed') return true;
      if (p.deadline) {
        const diffDays = Math.ceil((new Date(p.deadline) - today) / (1000 * 60 * 60 * 24));
        return diffDays > 0 && diffDays <= 25 && p.status !== 'completed';
      }
      return false;
    }).length;

    // 2. Department Workload Utilization chart data
    const deptMap = {};
    employees.forEach((e) => {
      const dept = e.department || 'General';
      if (!deptMap[dept]) {
        deptMap[dept] = { totalWorkload: 0, count: 0 };
      }
      deptMap[dept].totalWorkload += Number(e.current_workload_pct) || 0;
      deptMap[dept].count += 1;
    });

    const departmentWorkloadData = Object.entries(deptMap).map(([department, data]) => ({
      department,
      avgWorkload: Math.round(data.totalWorkload / (data.count || 1)),
      employeeCount: data.count,
      optimalBenchmark: 80,
    }));

    // 3. Top Skills Demand vs Supply chart data
    const allSkills = Array.from(
      new Set([...Object.keys(skillDemandMap), ...Object.keys(skillSupplyMap)])
    );

    const skillsChartData = allSkills
      .map((skill) => ({
        skill,
        projectDemand: skillDemandMap[skill] || 0,
        talentSupply: skillSupplyMap[skill] || 0,
      }))
      .sort((a, b) => b.projectDemand - a.projectDemand)
      .slice(0, 6);

    // 4. Project Priority & Risk Matrix
    const priorityRiskMap = {
      critical: { name: 'Critical', low: 0, moderate: 0, high: 0 },
      high: { name: 'High', low: 0, moderate: 0, high: 0 },
      medium: { name: 'Medium', low: 0, moderate: 0, high: 0 },
      low: { name: 'Low', low: 0, moderate: 0, high: 0 },
    };

    projects.forEach((p) => {
      const prio = (p.priority || 'medium').toLowerCase();
      const risk = (p.risk_level || 'low').toLowerCase();
      if (priorityRiskMap[prio]) {
        if (risk === 'high') priorityRiskMap[prio].high += 1;
        else if (risk === 'moderate') priorityRiskMap[prio].moderate += 1;
        else priorityRiskMap[prio].low += 1;
      }
    });

    const priorityRiskData = Object.values(priorityRiskMap).filter(
      (item) => item.low + item.moderate + item.high > 0
    );

    // If live backend summary provided, merge server-calculated KPIs
    const finalKpis = {
      totalEmployees: backendSummary?.kpis?.total_employees ?? totalEmployees,
      activeProjects: backendSummary?.kpis?.active_projects ?? activeProjects,
      availableEmployees: backendSummary?.kpis?.available_employees ?? availableEmployees,
      highWorkloadEmployees: backendSummary?.kpis?.high_workload_employees ?? highWorkloadEmployees,
      criticalSkillGaps: backendSummary?.kpis?.critical_skill_gaps ?? criticalSkillGaps,
      projectsAtRisk: backendSummary?.kpis?.projects_at_risk ?? projectsAtRisk,
    };

    const finalActivities = backendSummary?.recent_activity?.length
      ? backendSummary.recent_activity.map((act) => ({
          id: String(act.id || Math.random()),
          action: act.event_type?.replace(/_/g, ' ').toUpperCase() || 'ACTIVITY',
          target: act.description || '',
          time: act.timestamp ? new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently',
          type: act.event_type?.includes('employee') ? 'employee' : act.event_type?.includes('project') ? 'project' : 'alert',
        }))
      : SAMPLE_ACTIVITIES;

    return {
      isSample: isSample && !backendSummary,
      backendSummary,
      kpis: finalKpis,
      departmentWorkloadData,
      skillsChartData,
      priorityRiskData,
      recentActivities: finalActivities,
    };
  },
};

export default dashboardService;
