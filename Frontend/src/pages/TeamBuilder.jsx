import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Users,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  FolderKanban,
  Sliders,
  ShieldCheck,
  BrainCircuit,
  Activity,
  Layers,
  ChevronRight,
  Info,
} from 'lucide-react';

import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import Modal from '../components/Modal';
import AlertBanner from '../components/AlertBanner';
import projectService from '../services/projectService';
import workforceIntelligenceService from '../services/workforceIntelligenceService';

export default function TeamBuilder() {
  const navigate = useNavigate();
  const location = useLocation();

  // Projects list for selector
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [teamSize, setTeamSize] = useState(4);

  // Recommendation State
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [recommendationResult, setRecommendationResult] = useState(null);
  const [isSampleData, setIsSampleData] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [isApproving, setIsApproving] = useState(false);
  const [isConfirmAssignModalOpen, setIsConfirmAssignModalOpen] = useState(false);

  // Load available projects
  const loadProjects = useCallback(async () => {
    try {
      setLoadingProjects(true);
      const res = await projectService.getProjects();
      const projList = res.data || [];
      setProjects(projList);

      // Check if URL has query parameter for project ID (e.g., from Projects page)
      const params = new URLSearchParams(location.search);
      const queryProjId = params.get('projectId');

      if (queryProjId && projList.some((p) => String(p.id) === String(queryProjId))) {
        setSelectedProjectId(queryProjId);
        const matched = projList.find((p) => String(p.id) === String(queryProjId));
        if (matched?.desired_team_size) {
          setTeamSize(matched.desired_team_size);
        }
      } else if (projList.length > 0 && !selectedProjectId) {
        setSelectedProjectId(projList[0].id);
        if (projList[0].desired_team_size) {
          setTeamSize(projList[0].desired_team_size);
        }
      }
    } catch (err) {
      console.error('Failed to load projects for Team Builder:', err);
    } finally {
      setLoadingProjects(false);
    }
  }, [location.search, selectedProjectId]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Handle Project Selection change
  const handleProjectChange = (e) => {
    const id = e.target.value;
    setSelectedProjectId(id);
    const matched = projects.find((p) => String(p.id) === String(id));
    if (matched?.desired_team_size) {
      setTeamSize(matched.desired_team_size);
    }
    setRecommendationResult(null);
    setApiError(null);
  };

  const selectedProject = projects.find((p) => String(p.id) === String(selectedProjectId));

  // Request AI Recommendation
  const handleGenerateRecommendations = async () => {
    if (!selectedProjectId) {
      setApiError('Please select a project initiative before generating squad recommendations.');
      return;
    }

    try {
      setGenerating(true);
      setApiError(null);
      setSuccessMessage(null);
      const res = await workforceIntelligenceService.recommendTeam(selectedProjectId, teamSize);
      setRecommendationResult(res.data);
      setIsSampleData(res.isSample);
      if (res.error) {
        setApiError('FastAPI backend at http://127.0.0.1:8002 is offline. Displaying development sample recommendation.');
      }
    } catch (err) {
      setApiError(err.message || 'Failed to generate recommendations.');
    } finally {
      setGenerating(false);
    }
  };

  // Approve & Assign Squad to Project
  const handleApproveSquad = async () => {
    if (!selectedProject || !recommendationResult?.recommended_team) return;

    try {
      setIsApproving(true);
      const assignedNames = recommendationResult.recommended_team.map((c) => c.name);
      const res = await projectService.updateProject(selectedProject.id, {
        assigned_team: assignedNames,
      });

      setIsConfirmAssignModalOpen(false);
      if (res.offlineEmulated) {
        setSuccessMessage(
          `[Local Preview Only] Squad assigned to "${selectedProject.name}" in local session. Backend is offline.`
        );
      } else {
        setSuccessMessage(
          `Squad successfully assigned to "${selectedProject.name}"! (${assignedNames.length} engineers allocated)`
        );
      }
      await loadProjects();
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setApiError(err.message || 'Failed to update project squad assignment.');
    } finally {
      setIsApproving(false);
    }
  };

  // Helper score badges
  const getScoreBadge = (score) => {
    if (score >= 90) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
          <Sparkles className="h-3 w-3" />
          {score}% Match
        </span>
      );
    }
    if (score >= 75) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 border border-blue-200">
          {score}% Match
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 border border-amber-200">
        {score}% Match
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Smart Team Builder"
        description="AI-assisted squad formation engine matching employee competencies, availability, and collaboration chemistry to project requirements."
        badge="Squad Optimizer"
        actions={
          <button
            type="button"
            onClick={handleGenerateRecommendations}
            disabled={generating || !selectedProjectId}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-indigo-700 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Sparkles className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
            {generating ? 'Running AI Engine...' : 'Generate Recommendations'}
          </button>
        }
      />

      {/* Success Notification */}
      {successMessage && (
        <AlertBanner
          type="success"
          message={successMessage}
          onClose={() => setSuccessMessage(null)}
        />
      )}

      {/* Backend Offline / Sample Notification */}
      {isSampleData && (
        <AlertBanner
          type="offline"
          title="FastAPI Backend Offline:"
          message="Smart Team Builder is operating in Development Sample Preview mode. Recommendations reflect verified employee skill intersections and workload balancing."
          actionText="Ping Backend"
          onAction={handleGenerateRecommendations}
        />
      )}

      {/* Error Banner */}
      {apiError && !isSampleData && (
        <AlertBanner
          type="error"
          message={apiError}
          onClose={() => setApiError(null)}
        />
      )}

      {/* Project Selector & Scope Card */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Selector controls */}
          <div className="space-y-4 lg:col-span-1 border-b lg:border-b-0 lg:border-r border-slate-100 pb-5 lg:pb-0 lg:pr-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Target Project Initiative
              </label>
              <select
                value={selectedProjectId}
                onChange={handleProjectChange}
                disabled={loadingProjects}
                className="w-full rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 text-xs sm:text-sm font-semibold text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-hidden"
              >
                {projects.length === 0 ? (
                  <option value="">No initiatives found</option>
                ) : (
                  projects.map((proj) => (
                    <option key={proj.id} value={proj.id}>
                      {proj.name} ({proj.priority.toUpperCase()})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center text-xs mb-1">
                <label className="font-bold uppercase tracking-wider text-slate-700 text-[11px]">
                  Target Squad Size
                </label>
                <span className="font-mono text-indigo-600 font-bold">{teamSize} Engineers</span>
              </div>
              <input
                type="range"
                min="1"
                max="8"
                value={teamSize}
                onChange={(e) => setTeamSize(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                <span>1 member</span>
                <span>8 members</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGenerateRecommendations}
              disabled={generating || !selectedProjectId}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 px-4 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Sparkles className="h-4 w-4" />
              {generating ? 'Analyzing Candidate Synergy...' : 'Optimize Squad Lineup'}
            </button>
          </div>

          {/* Project Details Overview Card */}
          <div className="lg:col-span-2 space-y-4">
            {selectedProject ? (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">
                      {selectedProject.name}
                    </h3>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 uppercase">
                      {selectedProject.status.replace('_', ' ')}
                    </span>
                  </div>
                  <span className="text-xs font-medium text-slate-500">
                    Deadline: <strong className="text-slate-800">{selectedProject.deadline}</strong>
                  </span>
                </div>

                <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {selectedProject.description}
                </p>

                {/* Required Skills Badges */}
                <div className="mt-4">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                    Required Competencies for Algorithm Match:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {(selectedProject.required_skills || []).map((skill) => (
                      <span
                        key={skill}
                        className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 border border-indigo-100"
                      >
                        <BrainCircuit className="h-3 w-3 text-indigo-500" />
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Current Squad assignment status */}
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                  <span>
                    Current Assignment: <strong className="text-slate-800">{(selectedProject.assigned_team || []).length}</strong> / {selectedProject.desired_team_size} members
                  </span>
                  {(selectedProject.assigned_team || []).length > 0 && (
                    <span className="text-slate-400 text-[11px]">
                      {selectedProject.assigned_team.join(', ')}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400 text-xs">
                Select an initiative to inspect its competency requirements.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RECOMMENDATIONS VIEW AREA */}
      {generating ? (
        <div className="flex h-72 flex-col items-center justify-center rounded-xl border border-indigo-100 bg-white p-8 text-center shadow-xs">
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 shadow-inner">
            <BrainCircuit className="h-7 w-7 animate-pulse" />
          </div>
          <h3 className="mt-4 text-sm font-bold text-slate-900">
            Running Squad Optimization Algorithm...
          </h3>
          <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
            Evaluating skill vectors, sprint capacity thresholds, and team collaboration balance via FastAPI.
          </p>
        </div>
      ) : recommendationResult ? (
        <div className="space-y-6">
          {/* Results Summary Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-indigo-200/80 bg-gradient-to-r from-indigo-50/70 via-blue-50/50 to-white p-5 shadow-xs">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-bold">
                  ✓
                </span>
                <h3 className="text-sm font-bold text-slate-900">
                  Optimized Squad Recommendation Ready
                </h3>
              </div>
              <p className="mt-1 text-xs text-slate-600">
                Generated {recommendationResult.recommended_team.length} matched candidates for{' '}
                <strong>{recommendationResult.project_name}</strong>.
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Avg Squad Score</span>
                <span className="text-lg font-black text-indigo-700">
                  {recommendationResult.average_match_score}%
                </span>
              </div>
              <div className="text-right border-l border-slate-200 pl-4">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Skill Coverage</span>
                <span className="text-lg font-black text-emerald-600">
                  {recommendationResult.overall_skill_coverage_pct}%
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsConfirmAssignModalOpen(true)}
                disabled={isApproving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition-colors disabled:opacity-50 cursor-pointer ml-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                Approve & Assign Squad
              </button>
            </div>
          </div>

          {/* Recommended Candidates Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recommendationResult.recommended_team.map((member, idx) => (
              <div
                key={member.employee_id || idx}
                className="relative rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs hover:shadow-md transition-all space-y-4"
              >
                {/* Header: Candidate Info & Match Score */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 font-bold text-xs">
                      #{idx + 1}
                    </span>
                    <div className="min-w-0">
                      <h4 className="font-bold text-slate-900 text-sm truncate">
                        {member.name}
                      </h4>
                      <p className="text-xs text-slate-500 truncate">
                        {member.role} &bull; {member.department}
                      </p>
                    </div>
                  </div>
                  {getScoreBadge(member.match_score)}
                </div>

                {/* Match Rationale / Explanation */}
                {member.explanation && (
                  <div className="rounded-lg bg-slate-50 p-2.5 text-xs text-slate-600 border border-slate-100/80 italic">
                    &ldquo;{member.explanation}&rdquo;
                  </div>
                )}

                {/* Matching vs Missing Skills */}
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide flex items-center gap-1 mb-1">
                      <CheckCircle2 className="h-3 w-3" /> Matching Competencies:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {member.matching_skills.length > 0 ? (
                        member.matching_skills.map((s) => (
                          <span
                            key={s}
                            className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 border border-emerald-200"
                          >
                            {s}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-400 text-[11px] italic">
                          No direct exact skill matches
                        </span>
                      )}
                    </div>
                  </div>

                  {member.missing_skills.length > 0 && (
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1 mb-1">
                        <XCircle className="h-3 w-3" /> Gaps in Project Spec:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {member.missing_skills.map((s) => (
                          <span
                            key={s}
                            className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Workload & Availability Footer */}
                <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-xs text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">Current Workload:</span>
                    <span className="font-bold text-slate-800">{member.current_workload_pct}%</span>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700 capitalize">
                    {member.availability_status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Empty State: Ready to Optimize */
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100">
            <Sparkles className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-base font-bold text-slate-900">
            Ready to Synthesize Optimal Squad
          </h3>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
            Select your target initiative and desired squad size above, then click <strong>Generate Recommendations</strong>. The AI engine will compute skill coverage rankings and workload balances.
          </p>
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={handleGenerateRecommendations}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700"
            >
              <Sparkles className="h-4 w-4" />
              Generate First Recommendation
            </button>
          </div>
        </div>
      )}

      {/* SQUAD ASSIGNMENT CONFIRMATION MODAL */}
      <Modal
        isOpen={isConfirmAssignModalOpen}
        onClose={() => setIsConfirmAssignModalOpen(false)}
        title="Confirm Squad Allocation"
        subtitle="Verify proposed squad roster before committing assignment"
      >
        {selectedProject && recommendationResult && (
          <div className="space-y-4">
            <div className="rounded-xl bg-indigo-50/70 p-4 border border-indigo-200/80 text-xs text-indigo-900 leading-relaxed">
              <span className="font-bold block mb-1">Target Initiative:</span>
              <p className="font-semibold text-slate-900 text-sm">{selectedProject.name}</p>
              <p className="text-slate-600 mt-1">
                You are assigning {recommendationResult.recommended_team.length} matched team members to this project initiative.
              </p>
            </div>

            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">
                Squad Lineup to be Committed:
              </span>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {recommendationResult.recommended_team.map((m, i) => (
                  <div
                    key={m.employee_id || i}
                    className="flex items-center justify-between rounded-lg border border-slate-200/80 bg-slate-50/60 p-2 text-xs"
                  >
                    <div>
                      <span className="font-semibold text-slate-800">{m.name}</span>
                      <span className="text-slate-400 text-[11px] block">{m.role}</span>
                    </div>
                    <span className="font-bold text-indigo-600">{m.match_score}% Match</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsConfirmAssignModalOpen(false)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApproveSquad}
                disabled={isApproving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                {isApproving ? 'Committing Allocation...' : 'Confirm & Commit Allocation'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
