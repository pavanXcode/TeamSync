from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator, EmailStr


def clamp_pct(v: float) -> float:
    return max(0.0, min(100.0, float(v)))


class EmployeeBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    job_title: str
    department: str
    skills: dict[str, int] = Field(default_factory=dict)
    experience_years: float = Field(ge=0)
    availability_percentage: float = Field(default=100)
    workload_percentage: float = Field(default=0)
    github_username: str | None = None
    active: bool = True

    @field_validator("skills")
    @classmethod
    def validate_skills(cls, v: dict[str, int]) -> dict[str, int]:
        out = {}
        for k, val in (v or {}).items():
            if not str(k).strip():
                continue
            prof = int(val)
            if prof < 1 or prof > 5:
                raise ValueError(f"Skill proficiency for '{k}' must be 1–5")
            out[str(k).strip()] = prof
        return out

    @field_validator("availability_percentage", "workload_percentage")
    @classmethod
    def validate_pct(cls, v: float) -> float:
        if v < 0 or v > 100:
            raise ValueError("Percentage must be between 0 and 100")
        return v


class EmployeeCreate(EmployeeBase):
    pass


class EmployeeUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    job_title: str | None = None
    department: str | None = None
    skills: dict[str, int] | None = None
    experience_years: float | None = Field(default=None, ge=0)
    availability_percentage: float | None = None
    workload_percentage: float | None = None
    github_username: str | None = None
    active: bool | None = None

    @field_validator("availability_percentage", "workload_percentage")
    @classmethod
    def validate_pct(cls, v: float | None) -> float | None:
        if v is not None and (v < 0 or v > 100):
            raise ValueError("Percentage must be between 0 and 100")
        return v


class EmployeeOut(EmployeeBase):
    id: int
    active_projects: list[dict[str, Any]] = []

    model_config = {"from_attributes": True}


class ProjectBase(BaseModel):
    name: str = Field(min_length=1)
    description: str = ""
    required_skills: list[str] = Field(default_factory=list)
    minimum_experience: float = Field(default=0, ge=0)
    desired_team_size: int = Field(default=3, ge=1, le=50)
    start_date: date | None = None
    deadline: date | None = None
    estimated_workload: float = Field(default=100, ge=0)
    priority: str = "Medium"
    status: str = "Planning"

    @field_validator("required_skills")
    @classmethod
    def non_empty_skills(cls, v: list[str]) -> list[str]:
        cleaned = [s.strip() for s in v if s and s.strip()]
        if not cleaned:
            raise ValueError("At least one required skill is required")
        return cleaned


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    required_skills: list[str] | None = None
    minimum_experience: float | None = Field(default=None, ge=0)
    desired_team_size: int | None = Field(default=None, ge=1, le=50)
    start_date: date | None = None
    deadline: date | None = None
    estimated_workload: float | None = Field(default=None, ge=0)
    priority: str | None = None
    status: str | None = None


class ProjectOut(ProjectBase):
    id: int
    assigned_team: list[dict[str, Any]] = []

    model_config = {"from_attributes": True}


class MatchingAnalyzeRequest(BaseModel):
    project_id: int | None = None
    name: str | None = None
    description: str | None = None
    required_skills: list[str] | None = None
    minimum_experience: float = 0
    desired_team_size: int = 3
    start_date: date | None = None
    deadline: date | None = None
    estimated_workload: float = 100
    priority: str = "Medium"


class MatchComponentScores(BaseModel):
    skill_match: float
    experience_match: float
    availability: float
    workload_suitability: float


class EmployeeMatchResult(BaseModel):
    employee_id: int
    name: str
    job_title: str
    department: str
    match_score: float
    match_label: str
    skill_coverage_pct: float
    matching_skills: list[str]
    missing_skills: list[str]
    experience_years: float
    availability_percentage: float
    workload_percentage: float
    component_scores: MatchComponentScores
    reasons: list[str]


class MatchingAnalyzeResponse(BaseModel):
    project_name: str
    required_skills: list[str]
    unknown_skills: list[str]
    results: list[EmployeeMatchResult]
    weights: dict[str, float]


class TeamRecommendRequest(BaseModel):
    project_id: int | None = None
    required_skills: list[str] | None = None
    minimum_experience: float = 0
    desired_team_size: int = Field(default=4, ge=1, le=20)
    deadline: date | None = None
    exclude_employee_ids: list[int] = Field(default_factory=list)
    replace_employee_id: int | None = None


class TeamMemberResult(BaseModel):
    employee_id: int
    name: str
    match_score: float
    reasons: list[str]
    workload_after_pct: float


class TeamRecommendResponse(BaseModel):
    team_members: list[TeamMemberResult]
    team_suitability_score: float
    overall_skill_coverage_pct: float
    uncovered_skills: list[str]
    team_experience_avg: float
    combined_workload_impact: float
    warnings: list[str]


class WorkloadEmployeeRow(BaseModel):
    employee_id: int
    name: str
    department: str
    assigned_workload: float
    stored_workload: float
    utilization_pct: float
    available_capacity_pct: float
    availability_percentage: float
    status: str
    recommended_additional_capacity: float


class WorkloadAnalysisResponse(BaseModel):
    employees: list[WorkloadEmployeeRow]
    thresholds: dict[str, float]
    underutilized: list[int]
    overloaded: list[int]
    distribution: list[dict[str, Any]]


class ReallocationRecommendRequest(BaseModel):
    employee_id: int
    project_id: int
    task_workload: float = Field(gt=0, le=100)


class ReallocationCandidate(BaseModel):
    employee_id: int
    name: str
    reasons: list[str]
    utilization_after_pct: float


class ReallocationRecommendResponse(BaseModel):
    current: dict[str, Any]
    proposed: ReallocationCandidate | None
    message: str


class ReallocationConfirmRequest(BaseModel):
    from_employee_id: int
    to_employee_id: int
    project_id: int
    task_workload: float = Field(gt=0, le=100)


class SkillGapItem(BaseModel):
    skill: str
    team_count: int
    highest_proficiency: int
    average_proficiency: float
    required_proficiency: int
    status: str
    training_suggestion: str | None = None


class SkillGapResponse(BaseModel):
    project_id: int
    project_name: str
    team_employee_ids: list[int]
    overall_coverage_pct: float
    gaps: list[SkillGapItem]


class RiskFactor(BaseModel):
    name: str
    score: float
    detail: str


class RiskAssessment(BaseModel):
    project_id: int
    project_name: str
    risk_score: float
    risk_level: str
    factors: list[RiskFactor]
    recommendations: list[str]
    critical_missing_skills: list[str]
    overloaded_employees: list[str]
    warnings: list[str]


class DashboardResponse(BaseModel):
    kpis: dict[str, Any]
    charts: dict[str, Any]
    recent_activity: list[dict[str, Any]]


class ActivityOut(BaseModel):
    id: int
    event_type: str
    description: str
    timestamp: datetime

    model_config = {"from_attributes": True}


class ConfigOut(BaseModel):
    matching_weights: dict[str, float]
    risk_weights: dict[str, float]
    workload_thresholds: dict[str, float]
    methodology: str


class GitHubConnectionStatus(BaseModel):
    is_connected: bool
    configured: bool
    owner: str | None = None
    repo: str | None = None
    rate_limit_remaining: int | None = None
    rate_limit_reset: str | None = None
    last_sync: str
    error_message: str | None = None
    is_sample: bool = False


class GitHubTeamSummary(BaseModel):
    total_eligible_tasks: int
    total_completed_tasks: int
    overall_task_progress_pct: float
    total_prs_opened: int
    total_prs_merged: int
    total_reviews_completed: int
    overdue_tasks_count: int
    active_contributors_count: int


class GitHubTaskItem(BaseModel):
    id: int | str
    number: int
    title: str
    type: str  # "issue" or "pull_request"
    state: str  # "open", "closed", "merged"
    assigned_employee_id: int | None = None
    assigned_employee_name: str | None = None
    github_assignees: list[str] = Field(default_factory=list)
    author: str
    created_at: str
    closed_at: str | None = None
    due_date: str | None = None
    is_overdue: bool = False
    html_url: str
    linked_pr_url: str | None = None
    linked_issue_number: int | None = None


class GitHubEmployeeProgress(BaseModel):
    employee_id: int
    employee_name: str
    job_title: str
    department: str
    github_username: str | None = None
    assigned_tasks: int
    completed_tasks: int
    open_tasks: int
    overdue_tasks: int
    task_progress_pct: float
    prs_opened: int
    prs_merged: int
    prs_open: int
    pr_merge_rate_pct: float
    reviews_requested: int
    reviews_completed: int
    recent_tasks: list[GitHubTaskItem] = Field(default_factory=list)


class GitHubProgressResponse(BaseModel):
    connection_status: GitHubConnectionStatus
    team_summary: GitHubTeamSummary
    employee_progress: list[GitHubEmployeeProgress]
    tasks: list[GitHubTaskItem]
    departments: list[str] = Field(default_factory=list)
