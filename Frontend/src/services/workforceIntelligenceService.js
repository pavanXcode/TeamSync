import api from './api';
import employeeService from './employeeService';
import projectService from './projectService';

/**
 * Workforce Intelligence Service
 * Handles advanced workforce algorithms:
 * 1. Smart Team Builder (squad recommendations)
 * 2. Skill Gap Analysis (capability coverage and training suggestions)
 * 3. Workload Balancer (utilization metrics & reassignment suggestions)
 * 4. Deadline Risk Predictor (predictive milestone risk analysis)
 * 
 * Communicates with FastAPI endpoints when online, and provides structured,
 * clearly labeled development preview fallbacks when the backend is offline.
 */

export const workforceIntelligenceService = {
  // ==========================================
  // 1. SMART TEAM BUILDER
  // ==========================================
  async recommendTeam(projectId, teamSize = 4) {
    try {
      const response = await api.post('/api/team-builder/recommend', {
        project_id: Number(projectId),
        desired_team_size: Number(teamSize),
      });

      const serverData = response.data;
      const [empRes, projRes] = await Promise.all([
        employeeService.getEmployees(),
        projectService.getProjectById(projectId),
      ]);
      const empMap = {};
      (empRes.data || []).forEach((e) => {
        empMap[e.id] = e;
      });

      const project = projRes.data;
      const requiredSkills = project?.required_skills || [];

      const recommendedSquad = (serverData.team_members || []).map((m) => {
        const emp = empMap[m.employee_id] || {};
        const empSkills = emp.skills || [];
        const matching = requiredSkills.filter((s) =>
          empSkills.some((es) => es.toLowerCase() === s.toLowerCase())
        );
        const missing = requiredSkills.filter(
          (s) => !empSkills.some((es) => es.toLowerCase() === s.toLowerCase())
        );

        return {
          employee_id: m.employee_id,
          name: m.name,
          role: emp.role || 'Specialist',
          department: emp.department || 'Engineering',
          match_score: Math.round(m.match_score),
          matching_skills: matching.length ? matching : (empSkills.slice(0, 3)),
          missing_skills: missing,
          availability_status: emp.availability_status || 'available',
          current_workload_pct: m.workload_after_pct ?? emp.current_workload_pct ?? 50,
          experience_years: emp.experience_years ?? 3,
          explanation: m.reasons?.[0] || 'Optimized fit for project criteria',
        };
      });

      return {
        data: {
          project_id: projectId,
          project_name: project?.name || `Project ${projectId}`,
          desired_team_size: teamSize,
          recommended_team: recommendedSquad,
          average_match_score: Math.round(serverData.team_suitability_score || 80),
          overall_skill_coverage_pct: Math.round(serverData.overall_skill_coverage_pct || 100),
        },
        isSample: false,
      };
    } catch (error) {
      console.warn('POST /api/team-builder/recommend offline or failed. Generating development sample recommendations.', error.message);
      
      const [empRes, projRes] = await Promise.all([
        employeeService.getEmployees(),
        projectService.getProjectById(projectId),
      ]);

      const project = projRes.data;
      const employees = empRes.data || [];
      const requiredSkills = project?.required_skills || [];

      const candidates = employees.map((emp) => {
        const empSkills = emp.skills || [];
        const matching = requiredSkills.filter((s) =>
          empSkills.some((es) => es.toLowerCase() === s.toLowerCase())
        );
        const missing = requiredSkills.filter(
          (s) => !empSkills.some((es) => es.toLowerCase() === s.toLowerCase())
        );

        const skillScore = requiredSkills.length > 0 ? (matching.length / requiredSkills.length) * 60 : 40;
        const workloadScore = Math.max(0, (100 - (Number(emp.current_workload_pct) || 50)) * 0.25);
        const expScore = Math.min(15, (Number(emp.experience_years) || 0) * 2);
        const rawScore = Math.min(98, Math.round(skillScore + workloadScore + expScore));

        let rationale = '';
        if (matching.length === requiredSkills.length) {
          rationale = `Exceptional fit: verified coverage on all ${matching.length} required skills.`;
        } else if (matching.length > 0) {
          rationale = `Strong candidate: matches ${matching.slice(0, 2).join(', ')}. Capacity: ${emp.current_workload_pct}%.`;
        } else {
          rationale = `Cross-functional support candidate. Current bandwidth: ${100 - emp.current_workload_pct}%.`;
        }

        return {
          employee_id: emp.id,
          name: emp.name,
          role: emp.role,
          department: emp.department,
          match_score: rawScore,
          matching_skills: matching,
          missing_skills: missing,
          availability_status: emp.availability_status,
          current_workload_pct: emp.current_workload_pct,
          experience_years: emp.experience_years,
          explanation: rationale,
        };
      });

      candidates.sort((a, b) => b.match_score - a.match_score);
      const recommendedSquad = candidates.slice(0, Number(teamSize) || 4);

      return {
        data: {
          project_id: projectId,
          project_name: project?.name,
          desired_team_size: teamSize,
          recommended_team: recommendedSquad,
          average_match_score: Math.round(
            recommendedSquad.reduce((acc, c) => acc + c.match_score, 0) / (recommendedSquad.length || 1)
          ),
          overall_skill_coverage_pct: Math.min(100, Math.round(
            (Array.from(new Set(recommendedSquad.flatMap((c) => c.matching_skills))).length / (requiredSkills.length || 1)) * 100
          )),
        },
        isSample: true,
        error: error.message,
      };
    }
  },

  // ==========================================
  // 2. SKILL GAP ANALYSIS
  // ==========================================
  async getSkillGapAnalysis(projectId = null) {
    try {
      const projRes = await projectService.getProjects();
      const allProjects = projRes.data || [];
      const targetId = projectId && projectId !== 'all' ? projectId : allProjects[0]?.id || 1;

      const response = await api.get(`/api/skill-gaps/${targetId}`);
      const serverData = response.data;
      const gaps = serverData.gaps || [];

      const coveredSkills = gaps.filter((g) => g.status === 'Covered');
      const deficientSkills = gaps.filter((g) => g.status !== 'Covered');

      const trainingSuggestions = gaps
        .filter((g) => g.training_suggestion)
        .map((g) => ({
          skill: g.skill,
          priority: g.status === 'Missing' ? 'High' : 'Medium',
          recommendation_type: g.team_count === 0 ? 'External Hiring / Contractor' : 'Internal Upskilling',
          rationale: g.training_suggestion,
          candidates_for_upskilling: [],
        }));

      const chartData = gaps.map((g) => ({
        skill: g.skill,
        required: g.required_proficiency || 3,
        available: g.highest_proficiency || 0,
      }));

      return {
        data: {
          project_id: targetId,
          total_required_skills: gaps.length,
          covered_skills_count: coveredSkills.length,
          deficit_skills_count: deficientSkills.length,
          overall_coverage_pct: Math.round(serverData.overall_coverage_pct || 0),
          covered_skills: coveredSkills,
          deficient_skills: deficientSkills,
          training_suggestions: trainingSuggestions,
          chart_data: chartData,
        },
        isSample: false,
      };
    } catch (error) {
      console.warn('GET /api/skill-gaps offline or failed. Synthesizing development preview.', error.message);

      const [empRes, projRes] = await Promise.all([
        employeeService.getEmployees(),
        projectService.getProjects(),
      ]);

      const employees = empRes.data || [];
      const allProjects = projRes.data || [];
      const targetProjects = projectId && projectId !== 'all'
        ? allProjects.filter((p) => String(p.id) === String(projectId))
        : allProjects;

      const demandSkillMap = {};
      targetProjects.forEach((p) => {
        (p.required_skills || []).forEach((s) => {
          demandSkillMap[s] = (demandSkillMap[s] || 0) + 1;
        });
      });

      const supplySkillMap = {};
      employees.forEach((e) => {
        (e.skills || []).forEach((s) => {
          supplySkillMap[s] = (supplySkillMap[s] || 0) + 1;
        });
      });

      const uniqueRequiredSkills = Object.keys(demandSkillMap);
      const coveredSkills = [];
      const deficientSkills = [];

      uniqueRequiredSkills.forEach((skill) => {
        const requiredCount = demandSkillMap[skill];
        const availableCount = supplySkillMap[skill] || 0;
        const deficit = Math.max(0, requiredCount - availableCount);

        const skillDetail = {
          skill,
          required_count: requiredCount,
          available_count: availableCount,
          deficit,
          coverage_pct: Math.min(100, Math.round((availableCount / requiredCount) * 100)),
          is_critical: availableCount === 0 || deficit >= 2,
        };

        if (deficit === 0) {
          coveredSkills.push(skillDetail);
        } else {
          deficientSkills.push(skillDetail);
        }
      });

      const trainingSuggestions = deficientSkills.map((d) => {
        const matchingEmployees = employees
          .filter((e) => (e.skills || []).length > 0 && !(e.skills || []).includes(d.skill))
          .slice(0, 2);

        return {
          skill: d.skill,
          priority: d.is_critical ? 'High' : 'Medium',
          recommendation_type: d.available_count === 0 ? 'External Hiring / Contractor' : 'Internal Upskilling',
          rationale: d.available_count === 0
            ? `Zero personnel verified in ${d.skill}. Needed by ${d.required_count} active initiative(s).`
            : `${d.deficit} additional qualified specialist(s) required to eliminate project risk.`,
          candidates_for_upskilling: matchingEmployees.map((e) => e.name),
        };
      });

      const totalRequired = uniqueRequiredSkills.length;
      const coverageRate = totalRequired > 0
        ? Math.round((coveredSkills.length / totalRequired) * 100)
        : 100;

      return {
        data: {
          project_id: projectId,
          total_required_skills: totalRequired,
          covered_skills_count: coveredSkills.length,
          deficit_skills_count: deficientSkills.length,
          overall_coverage_pct: coverageRate,
          covered_skills: coveredSkills,
          deficient_skills: deficientSkills,
          training_suggestions: trainingSuggestions,
          chart_data: uniqueRequiredSkills.map((skill) => ({
            skill,
            required: demandSkillMap[skill] || 0,
            available: supplySkillMap[skill] || 0,
          })),
        },
        isSample: true,
        error: error.message,
      };
    }
  },

  // ==========================================
  // 3. WORKLOAD BALANCER
  // ==========================================
  async getWorkloadData() {
    try {
      const response = await api.get('/api/workload/analysis');
      const serverData = response.data;
      const employees = serverData.employees || [];

      const overloaded = employees.filter((e) => e.status === 'Overloaded' || e.utilization_pct > 80);
      const balanced = employees.filter((e) => e.status === 'Balanced' || (e.utilization_pct >= 60 && e.utilization_pct <= 80));
      const underutilized = employees.filter((e) => e.status === 'Underutilized' || e.utilization_pct < 60);

      const recommendations = [];
      if (overloaded.length > 0 && underutilized.length > 0) {
        overloaded.forEach((overEmp, idx) => {
          const underEmp = underutilized[idx % underutilized.length];
          recommendations.push({
            id: `REB-${idx + 1}`,
            source_employee_id: overEmp.employee_id,
            source_employee_name: overEmp.name,
            source_current_workload: overEmp.utilization_pct,
            source_projected_workload: Math.max(50, overEmp.utilization_pct - 15),
            target_employee_id: underEmp.employee_id,
            target_employee_name: underEmp.name,
            target_current_workload: underEmp.utilization_pct,
            target_projected_workload: Math.min(85, underEmp.utilization_pct + 15),
            initiative_name: 'AI Analytics Platform',
            project_id: 1,
            task_workload: 15,
            rationale: `Reallocate 15% workload from ${overEmp.name} (${overEmp.utilization_pct}%) to ${underEmp.name} (${underEmp.utilization_pct}%) to balance team capacity.`,
          });
        });
      }

      return {
        data: {
          total_workforce: employees.length,
          overloaded_count: overloaded.length,
          balanced_count: balanced.length,
          underutilized_count: underutilized.length,
          average_workload_pct: Math.round(
            employees.reduce((acc, e) => acc + Number(e.utilization_pct || 0), 0) / (employees.length || 1)
          ),
          employees: employees.map((e) => ({
            id: e.employee_id,
            name: e.name,
            department: e.department,
            current_workload_pct: e.utilization_pct,
            status_tier:
              e.status === 'Overloaded' || e.utilization_pct > 80
                ? 'overloaded'
                : e.status === 'Balanced' || e.utilization_pct >= 60
                ? 'balanced'
                : 'underutilized',
          })),
          balancing_suggestions: recommendations,
        },
        isSample: false,
      };
    } catch (error) {
      console.warn('GET /api/workload/analysis offline or failed. Deriving from talent pool.', error.message);

      const [empRes, projRes] = await Promise.all([
        employeeService.getEmployees(),
        projectService.getProjects(),
      ]);

      const employees = empRes.data || [];
      const projects = projRes.data || [];

      const overloaded = employees.filter((e) => Number(e.current_workload_pct) >= 90);
      const balanced = employees.filter((e) => Number(e.current_workload_pct) >= 70 && Number(e.current_workload_pct) < 90);
      const underutilized = employees.filter((e) => Number(e.current_workload_pct) < 70);

      const recommendations = [];
      if (overloaded.length > 0 && underutilized.length > 0) {
        overloaded.forEach((overEmp, idx) => {
          const underEmp = underutilized[idx % underutilized.length];
          const commonProject = (overEmp.current_projects || [])[0] || (projects[0]?.name || 'Core Sprint Ticket');

          recommendations.push({
            id: `REB-${idx + 1}`,
            source_employee_id: overEmp.id,
            source_employee_name: overEmp.name,
            source_current_workload: overEmp.current_workload_pct,
            source_projected_workload: Math.max(75, overEmp.current_workload_pct - 20),
            target_employee_id: underEmp.id,
            target_employee_name: underEmp.name,
            target_current_workload: underEmp.current_workload_pct,
            target_projected_workload: Math.min(85, underEmp.current_workload_pct + 20),
            initiative_name: commonProject,
            project_id: 1,
            task_workload: 15,
            rationale: `Reassign modules of "${commonProject}" from ${overEmp.name} (${overEmp.current_workload_pct}% load) to ${underEmp.name} (${underEmp.current_workload_pct}% load) to eliminate burnout risk.`,
          });
        });
      }

      return {
        data: {
          total_workforce: employees.length,
          overloaded_count: overloaded.length,
          balanced_count: balanced.length,
          underutilized_count: underutilized.length,
          average_workload_pct: Math.round(
            employees.reduce((acc, e) => acc + Number(e.current_workload_pct || 0), 0) / (employees.length || 1)
          ),
          employees: employees.map((e) => ({
            ...e,
            status_tier:
              Number(e.current_workload_pct) >= 90
                ? 'overloaded'
                : Number(e.current_workload_pct) >= 70
                ? 'balanced'
                : 'underutilized',
          })),
          balancing_suggestions: recommendations,
        },
        isSample: true,
        error: error.message,
      };
    }
  },

  async applyRebalance(rebalancePayload) {
    try {
      const response = await api.post('/api/workload/reallocation/confirm', {
        from_employee_id: Number(rebalancePayload.source_employee_id),
        to_employee_id: Number(rebalancePayload.target_employee_id),
        project_id: Number(rebalancePayload.project_id || 1),
        task_workload: Number(rebalancePayload.task_workload || 15),
      });
      return { data: response.data, isSample: false };
    } catch (error) {
      console.warn('POST /api/workload/reallocation/confirm offline. Emulating local workload adjustment.', error.message);
      if (rebalancePayload.source_employee_id && rebalancePayload.target_employee_id) {
        await Promise.all([
          employeeService.updateEmployee(rebalancePayload.source_employee_id, {
            current_workload_pct: rebalancePayload.source_projected_workload || 80,
          }),
          employeeService.updateEmployee(rebalancePayload.target_employee_id, {
            current_workload_pct: rebalancePayload.target_projected_workload || 75,
            current_projects: [rebalancePayload.initiative_name],
          }),
        ]);
      }
      return { success: true, isSample: true, offlineEmulated: true, error: error.message };
    }
  },

  // ==========================================
  // 4. DEADLINE RISK PREDICTOR
  // ==========================================
  async getDeadlineRiskAnalysis() {
    try {
      const response = await api.get('/api/risks');
      const risks = response.data || [];

      const highRiskCount = risks.filter(
        (r) => r.risk_level?.includes('Critical') || r.risk_level?.includes('High')
      ).length;
      const moderateRiskCount = risks.filter((r) => r.risk_level?.includes('Medium')).length;
      const lowRiskCount = risks.filter((r) => r.risk_level?.includes('Low')).length;

      const analyzedProjects = risks.map((r) => ({
        id: r.project_id,
        name: r.project_name,
        description: r.warnings?.[0] || 'Initiative milestone assessment',
        deadline: 'Tracked',
        days_left: 30,
        status: 'Active',
        priority: 'High',
        desired_team_size: 4,
        assigned_count: 3,
        risk_level: r.risk_level?.toLowerCase().includes('critical')
          ? 'critical'
          : r.risk_level?.toLowerCase().includes('high')
          ? 'high'
          : r.risk_level?.toLowerCase().includes('medium')
          ? 'moderate'
          : 'low',
        risk_score: Math.round(r.risk_score),
        contributing_factors: (r.factors || []).map((f) => `${f.name}: ${f.detail || f.score}`),
        mitigation_suggestions: r.recommendations || [],
        required_skills: r.critical_missing_skills || [],
      }));

      return {
        data: {
          total_projects_monitored: risks.length,
          high_critical_risk_count: highRiskCount,
          moderate_risk_count: moderateRiskCount,
          nominal_risk_count: lowRiskCount,
          projects: analyzedProjects,
        },
        isSample: false,
      };
    } catch (error) {
      console.warn('GET /api/risks offline. Synthesizing risk metrics from project milestones.', error.message);

      const [projRes, empRes] = await Promise.all([
        projectService.getProjects(),
        employeeService.getEmployees(),
      ]);

      const projects = projRes.data || [];
      const employees = empRes.data || [];
      const today = new Date();

      const riskRankOrder = { critical: 4, high: 3, moderate: 2, low: 1 };

      const analyzedProjects = projects.map((proj) => {
        const deadline = proj.deadline ? new Date(proj.deadline) : null;
        const daysLeft = deadline ? Math.ceil((deadline - today) / (1000 * 60 * 60 * 24)) : 999;
        const teamSize = (proj.assigned_team || []).length;
        const neededSize = proj.desired_team_size || 3;

        const contributingFactors = [];
        const mitigations = [];

        if (daysLeft < 0) {
          contributingFactors.push(`Milestone deadline lapsed ${Math.abs(daysLeft)} days ago.`);
          mitigations.push('Establish immediate crisis sprint; reset client delivery timeline.');
        } else if (daysLeft <= 15) {
          contributingFactors.push(`Critical deadline proximity: only ${daysLeft} days remaining.`);
          mitigations.push('Freeze scope changes and reallocate auxiliary support engineers.');
        }

        if (teamSize < neededSize) {
          contributingFactors.push(`Understaffed squad: ${teamSize}/${neededSize} engineers assigned.`);
          mitigations.push('Deploy Smart Team Builder to assign additional qualified contributors.');
        }

        const assignedEmployees = employees.filter((e) => (proj.assigned_team || []).includes(e.name));
        const overloadedMembers = assignedEmployees.filter((e) => Number(e.current_workload_pct) >= 90);

        if (overloadedMembers.length > 0) {
          contributingFactors.push(
            `Key staff overloaded: ${overloadedMembers.map((m) => `${m.name} (${m.current_workload_pct}%)`).join(', ')}.`
          );
          mitigations.push('Use Workload Balancer to redistribute non-critical tasks.');
        }

        if (contributingFactors.length === 0) {
          contributingFactors.push('Milestone trajectory is nominal; team allocations match competency criteria.');
          mitigations.push('Maintain current sprint velocity and bi-weekly standups.');
        }

        let computedRiskLevel = proj.risk_level || 'low';
        let riskScore = 20;

        if (daysLeft < 0 || (daysLeft <= 15 && teamSize < neededSize)) {
          computedRiskLevel = 'critical';
          riskScore = 92;
        } else if (daysLeft <= 25 || teamSize < neededSize || overloadedMembers.length > 0) {
          computedRiskLevel = 'high';
          riskScore = 78;
        } else if (daysLeft <= 45) {
          computedRiskLevel = 'moderate';
          riskScore = 48;
        }

        return {
          id: proj.id,
          name: proj.name,
          description: proj.description,
          deadline: proj.deadline,
          days_left: daysLeft,
          status: proj.status,
          priority: proj.priority,
          desired_team_size: neededSize,
          assigned_count: teamSize,
          risk_level: computedRiskLevel,
          risk_score: riskScore,
          contributing_factors: contributingFactors,
          mitigation_suggestions: mitigations,
          required_skills: proj.required_skills || [],
        };
      });

      analyzedProjects.sort((a, b) => (riskRankOrder[b.risk_level] || 0) - (riskRankOrder[a.risk_level] || 0));

      const highRiskCount = analyzedProjects.filter((p) => p.risk_level === 'critical' || p.risk_level === 'high').length;
      const moderateRiskCount = analyzedProjects.filter((p) => p.risk_level === 'moderate').length;
      const lowRiskCount = analyzedProjects.filter((p) => p.risk_level === 'low').length;

      return {
        data: {
          total_projects_monitored: analyzedProjects.length,
          high_critical_risk_count: highRiskCount,
          moderate_risk_count: moderateRiskCount,
          nominal_risk_count: lowRiskCount,
          projects: analyzedProjects,
        },
        isSample: true,
        error: error.message,
      };
    }
  },
};

export default workforceIntelligenceService;
