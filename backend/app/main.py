"""CrewIQ — Workforce Intelligence API."""

from datetime import date

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import (
    DATABASE_URL,
    MATCHING_WEIGHTS,
    RISK_WEIGHTS,
    WORKLOAD_THRESHOLDS,
)
from app.database import Base, engine, get_db
from app.helpers import employee_to_out, log_activity, project_to_out
from app.models import Assignment, Employee, Project
from app.schemas import (
    ConfigOut,
    DashboardResponse,
    EmployeeCreate,
    EmployeeOut,
    EmployeeUpdate,
    MatchingAnalyzeRequest,
    MatchingAnalyzeResponse,
    EmployeeMatchResult,
    MatchComponentScores,
    ProjectCreate,
    ProjectOut,
    ProjectUpdate,
    ReallocationConfirmRequest,
    ReallocationRecommendRequest,
    ReallocationRecommendResponse,
    ReallocationCandidate,
    RiskAssessment,
    SkillGapResponse,
    SkillGapItem,
    TeamMemberResult,
    TeamRecommendRequest,
    TeamRecommendResponse,
    WorkloadAnalysisResponse,
    WorkloadEmployeeRow,
    ActivityOut,
)
from app.seed import seed_if_needed
from app.services.dashboard import build_dashboard
from app.services.matching import (
    EmployeeLike,
    ProjectLike,
    compute_match,
    find_unknown_skills,
)
from app.services.reallocation import recommend_reallocation
from app.services.risk import assess_project_risk
from app.services.skill_gaps import analyze_skill_gaps
from app.services.team_builder import _team_coverage, greedy_select
from app.services.workload_utils import (
    available_capacity,
    effective_utilization,
    sync_employee_workload_field,
    utilization_status,
)

app = FastAPI(title="CrewIQ — Workforce Intelligence Platform", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
    db = next(get_db())
    try:
        seed_if_needed(db)
    finally:
        db.close()


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "service": "CrewIQ", "database": DATABASE_URL.split("///")[-1]}


@app.get("/api/config", response_model=ConfigOut)
def get_config() -> ConfigOut:
    return ConfigOut(
        matching_weights=MATCHING_WEIGHTS,
        risk_weights=RISK_WEIGHTS,
        workload_thresholds=WORKLOAD_THRESHOLDS,
        methodology=(
            "Scores combine normalized components with configurable weights. "
            "Workload utilization is derived from active assignment percentages. "
            "Risk is a transparent heuristic, not a trained ML model."
        ),
    )


@app.get("/api/dashboard", response_model=DashboardResponse)
def dashboard(db: Session = Depends(get_db)) -> DashboardResponse:
    data = build_dashboard(db)
    return DashboardResponse(**data)


@app.get("/api/activities", response_model=list[ActivityOut])
def list_activities(db: Session = Depends(get_db)) -> list[ActivityOut]:
    from app.models import Activity

    rows = db.query(Activity).order_by(Activity.timestamp.desc()).limit(50).all()
    return [ActivityOut.model_validate(r) for r in rows]


def _all_skill_names(db: Session) -> set[str]:
    names: set[str] = set()
    for e in db.query(Employee).all():
        names.update(e.skills.keys())
    return names


def _employee_like(db: Session, e: Employee) -> EmployeeLike:
    return EmployeeLike(
        id=e.id,
        name=e.name,
        job_title=e.job_title,
        department=e.department,
        skills=e.skills,
        experience_years=e.experience_years,
        availability_percentage=e.availability_percentage,
        workload_percentage=effective_utilization(db, e),
        active=e.active,
    )


@app.get("/api/employees", response_model=list[EmployeeOut])
def list_employees(db: Session = Depends(get_db)) -> list[EmployeeOut]:
    rows = db.query(Employee).order_by(Employee.name).all()
    return [employee_to_out(db, r) for r in rows]


@app.get("/api/employees/{employee_id}", response_model=EmployeeOut)
def get_employee(employee_id: int, db: Session = Depends(get_db)) -> EmployeeOut:
    emp = db.get(Employee, employee_id)
    if not emp:
        raise HTTPException(404, "Employee not found")
    return employee_to_out(db, emp)


@app.post("/api/employees", response_model=EmployeeOut, status_code=201)
def create_employee(body: EmployeeCreate, db: Session = Depends(get_db)) -> EmployeeOut:
    emp = Employee(
        name=body.name,
        email=body.email,
        job_title=body.job_title,
        department=body.department,
        experience_years=body.experience_years,
        availability_percentage=body.availability_percentage,
        workload_percentage=body.workload_percentage,
        active=body.active,
    )
    emp.skills = body.skills
    db.add(emp)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(400, "Email already exists")
    db.refresh(emp)
    log_activity(db, "employee_created", f"Employee {emp.name} added to directory.")
    return employee_to_out(db, emp)


@app.put("/api/employees/{employee_id}", response_model=EmployeeOut)
def update_employee(
    employee_id: int, body: EmployeeUpdate, db: Session = Depends(get_db)
) -> EmployeeOut:
    emp = db.get(Employee, employee_id)
    if not emp:
        raise HTTPException(404, "Employee not found")
    data = body.model_dump(exclude_unset=True)
    skills = data.pop("skills", None)
    for k, v in data.items():
        setattr(emp, k, v)
    if skills is not None:
        emp.skills = skills
    db.commit()
    db.refresh(emp)
    log_activity(db, "employee_updated", f"Employee {emp.name} profile updated.")
    return employee_to_out(db, emp)


@app.delete("/api/employees/{employee_id}", status_code=204)
def delete_employee(employee_id: int, db: Session = Depends(get_db)) -> None:
    emp = db.get(Employee, employee_id)
    if not emp:
        raise HTTPException(404, "Employee not found")
    db.delete(emp)
    db.commit()


@app.get("/api/projects", response_model=list[ProjectOut])
def list_projects(db: Session = Depends(get_db)) -> list[ProjectOut]:
    rows = db.query(Project).order_by(Project.name).all()
    return [project_to_out(db, r) for r in rows]


@app.get("/api/projects/{project_id}", response_model=ProjectOut)
def get_project(project_id: int, db: Session = Depends(get_db)) -> ProjectOut:
    proj = db.get(Project, project_id)
    if not proj:
        raise HTTPException(404, "Project not found")
    return project_to_out(db, proj)


@app.post("/api/projects", response_model=ProjectOut, status_code=201)
def create_project(body: ProjectCreate, db: Session = Depends(get_db)) -> ProjectOut:
    if body.deadline and body.start_date and body.deadline < body.start_date:
        raise HTTPException(400, "Deadline must be on or after start date")
    proj = Project(
        name=body.name,
        description=body.description,
        minimum_experience=body.minimum_experience,
        desired_team_size=body.desired_team_size,
        start_date=body.start_date,
        deadline=body.deadline,
        estimated_workload=body.estimated_workload,
        priority=body.priority,
        status=body.status,
    )
    proj.required_skills = body.required_skills
    db.add(proj)
    db.commit()
    db.refresh(proj)
    log_activity(db, "project_created", f"Project '{proj.name}' created.")
    return project_to_out(db, proj)


@app.put("/api/projects/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: int, body: ProjectUpdate, db: Session = Depends(get_db)
) -> ProjectOut:
    proj = db.get(Project, project_id)
    if not proj:
        raise HTTPException(404, "Project not found")
    data = body.model_dump(exclude_unset=True)
    skills = data.pop("required_skills", None)
    for k, v in data.items():
        setattr(proj, k, v)
    if skills is not None:
        if not skills:
            raise HTTPException(400, "At least one required skill is required")
        proj.required_skills = skills
    if proj.deadline and proj.start_date and proj.deadline < proj.start_date:
        raise HTTPException(400, "Deadline must be on or after start date")
    db.commit()
    db.refresh(proj)
    return project_to_out(db, proj)


@app.delete("/api/projects/{project_id}", status_code=204)
def delete_project(project_id: int, db: Session = Depends(get_db)) -> None:
    proj = db.get(Project, project_id)
    if not proj:
        raise HTTPException(404, "Project not found")
    db.delete(proj)
    db.commit()


def _resolve_project_req(body, db: Session) -> tuple[ProjectLike, str, list[str]]:
    if body.project_id:
        proj = db.get(Project, body.project_id)
        if not proj:
            raise HTTPException(404, "Project not found")
        pl = ProjectLike(
            name=proj.name,
            required_skills=proj.required_skills,
            minimum_experience=proj.minimum_experience,
        )
        return pl, proj.name, proj.required_skills
    skills = body.required_skills or []
    if not skills:
        raise HTTPException(400, "required_skills or project_id required")
    name = body.name or "Ad-hoc analysis"
    pl = ProjectLike(
        name=name,
        required_skills=skills,
        minimum_experience=body.minimum_experience or 0,
    )
    return pl, name, skills


@app.post("/api/matching/analyze", response_model=MatchingAnalyzeResponse)
def matching_analyze(
    body: MatchingAnalyzeRequest, db: Session = Depends(get_db)
) -> MatchingAnalyzeResponse:
    pl, pname, req_skills = _resolve_project_req(body, db)
    all_skills = _all_skill_names(db)
    unknown = find_unknown_skills(all_skills, req_skills)

    employees = db.query(Employee).filter(Employee.active == True).all()  # noqa: E712
    results: list[EmployeeMatchResult] = []
    for e in employees:
        el = _employee_like(db, e)
        m = compute_match(el, pl)
        results.append(
            EmployeeMatchResult(
                employee_id=e.id,
                name=e.name,
                job_title=e.job_title,
                department=e.department,
                match_score=m["match_score"],
                match_label=m["match_label"],
                skill_coverage_pct=m["skill_coverage_pct"],
                matching_skills=m["matching_skills"],
                missing_skills=m["missing_skills"],
                experience_years=e.experience_years,
                availability_percentage=e.availability_percentage,
                workload_percentage=el.workload_percentage,
                component_scores=MatchComponentScores(**m["component_scores"]),
                reasons=m["reasons"],
            )
        )
    results.sort(key=lambda r: r.match_score, reverse=True)
    return MatchingAnalyzeResponse(
        project_name=pname,
        required_skills=req_skills,
        unknown_skills=unknown,
        results=results,
        weights=MATCHING_WEIGHTS,
    )


@app.post("/api/team-builder/recommend", response_model=TeamRecommendResponse)
def team_recommend(
    body: TeamRecommendRequest, db: Session = Depends(get_db)
) -> TeamRecommendResponse:
    if body.project_id:
        proj = db.get(Project, body.project_id)
        if not proj:
            raise HTTPException(404, "Project not found")
        pl = ProjectLike(
            name=proj.name,
            required_skills=proj.required_skills,
            minimum_experience=proj.minimum_experience,
        )
        team_size = body.desired_team_size or proj.desired_team_size
        required = proj.required_skills
    else:
        if not body.required_skills:
            raise HTTPException(400, "project_id or required_skills required")
        pl = ProjectLike(
            name="Team build",
            required_skills=body.required_skills,
            minimum_experience=body.minimum_experience,
        )
        team_size = body.desired_team_size
        required = body.required_skills

    exclude = set(body.exclude_employee_ids or [])
    if body.replace_employee_id:
        exclude.add(body.replace_employee_id)

    employees = db.query(Employee).all()
    likes = [_employee_like(db, e) for e in employees]
    selected, warnings, suitability = greedy_select(likes, pl, team_size, exclude)

    cov_pct, _ = _team_coverage(selected, required)
    uncovered = [r for r in required if _norm_skill_team(selected, r)]

    members: list[TeamMemberResult] = []
    impact = 0.0
    for e in selected:
        m = compute_match(e, pl)
        wl_after = min(100.0, e.workload_percentage + 10.0)
        impact += wl_after
        members.append(
            TeamMemberResult(
                employee_id=e.id,
                name=e.name,
                match_score=m["match_score"],
                reasons=m["reasons"][:4],
                workload_after_pct=round(wl_after, 1),
            )
        )

    log_activity(
        db,
        "team_recommendation",
        f"Team recommendation generated for {pl.name} ({len(members)} members).",
    )

    exp_avg = sum(e.experience_years for e in selected) / len(selected) if selected else 0.0
    return TeamRecommendResponse(
        team_members=members,
        team_suitability_score=suitability,
        overall_skill_coverage_pct=round(cov_pct, 1),
        uncovered_skills=uncovered,
        team_experience_avg=round(exp_avg, 1),
        combined_workload_impact=round(impact, 1),
        warnings=warnings,
    )


def _norm_skill_team(team: list[EmployeeLike], raw: str) -> bool:
    from app.services.matching import _norm_skill

    covered = set()
    for e in team:
        for k in e.skills:
            covered.add(_norm_skill(k))
    return _norm_skill(raw) not in covered


@app.get("/api/workload/analysis", response_model=WorkloadAnalysisResponse)
def workload_analysis(db: Session = Depends(get_db)) -> WorkloadAnalysisResponse:
    employees = db.query(Employee).filter(Employee.active == True).order_by(Employee.name).all()  # noqa: E712
    rows: list[WorkloadEmployeeRow] = []
    under: list[int] = []
    over: list[int] = []
    for e in employees:
        util = effective_utilization(db, e)
        assigned = sum(
            a.assigned_workload
            for a in e.assignments
            if a.status == "Active"
        )
        status = utilization_status(util)
        cap = available_capacity(db, e)
        rec = max(0.0, min(cap, 100.0 - util))
        if status == "Underutilized":
            under.append(e.id)
        if status == "Overloaded":
            over.append(e.id)
        rows.append(
            WorkloadEmployeeRow(
                employee_id=e.id,
                name=e.name,
                department=e.department,
                assigned_workload=round(assigned, 1),
                stored_workload=round(e.workload_percentage, 1),
                utilization_pct=round(util, 1),
                available_capacity_pct=round(cap, 1),
                availability_percentage=e.availability_percentage,
                status=status,
                recommended_additional_capacity=round(rec, 1),
            )
        )
    dist = {}
    for r in rows:
        dist[r.status] = dist.get(r.status, 0) + 1
    return WorkloadAnalysisResponse(
        employees=rows,
        thresholds=WORKLOAD_THRESHOLDS,
        underutilized=under,
        overloaded=over,
        distribution=[{"status": k, "count": v} for k, v in dist.items()],
    )


@app.post("/api/workload/reallocation/recommend", response_model=ReallocationRecommendResponse)
def reallocation_recommend(
    body: ReallocationRecommendRequest, db: Session = Depends(get_db)
) -> ReallocationRecommendResponse:
    emp = db.get(Employee, body.employee_id)
    proj = db.get(Project, body.project_id)
    if not emp:
        raise HTTPException(404, "Employee not found")
    if not proj:
        raise HTTPException(404, "Project not found")
    all_emps = db.query(Employee).filter(Employee.active == True).all()  # noqa: E712
    raw = recommend_reallocation(db, emp, proj, body.task_workload, all_emps)
    proposed = None
    if raw["proposed"]:
        proposed = ReallocationCandidate(**raw["proposed"])
    return ReallocationRecommendResponse(
        current=raw["current"], proposed=proposed, message=raw["message"]
    )


@app.post("/api/workload/reallocation/confirm")
def reallocation_confirm(
    body: ReallocationConfirmRequest, db: Session = Depends(get_db)
) -> dict:
    from_ = db.get(Employee, body.from_employee_id)
    to_ = db.get(Employee, body.to_employee_id)
    proj = db.get(Project, body.project_id)
    if not from_ or not to_ or not proj:
        raise HTTPException(404, "Employee or project not found")

    assignment = (
        db.query(Assignment)
        .filter(
            Assignment.employee_id == body.from_employee_id,
            Assignment.project_id == body.project_id,
            Assignment.status == "Active",
        )
        .first()
    )
    if not assignment:
        raise HTTPException(400, "No active assignment found for source employee")

    to_util = effective_utilization(db, to_)
    if to_util + body.task_workload > 100:
        raise HTTPException(
            400,
            "Target employee would exceed 100% utilization without override",
        )

    assignment.assigned_workload = max(0.0, assignment.assigned_workload - body.task_workload)
    if assignment.assigned_workload <= 0:
        db.delete(assignment)
    else:
        db.add(assignment)

    existing = (
        db.query(Assignment)
        .filter(
            Assignment.employee_id == body.to_employee_id,
            Assignment.project_id == body.project_id,
        )
        .first()
    )
    if existing:
        existing.assigned_workload += body.task_workload
        existing.status = "Active"
    else:
        db.add(
            Assignment(
                employee_id=body.to_employee_id,
                project_id=body.project_id,
                assigned_workload=body.task_workload,
                role="Contributor",
                status="Active",
            )
        )

    sync_employee_workload_field(db, from_)
    sync_employee_workload_field(db, to_)
    db.commit()
    log_activity(
        db,
        "workload_reassigned",
        f"Moved {body.task_workload}% workload from {from_.name} to {to_.name} on {proj.name}.",
    )
    return {"ok": True, "message": "Reallocation applied."}


@app.get("/api/skill-gaps/{project_id}", response_model=SkillGapResponse)
def skill_gaps(project_id: int, db: Session = Depends(get_db)) -> SkillGapResponse:
    proj = db.get(Project, project_id)
    if not proj:
        raise HTTPException(404, "Project not found")
    team = [a.employee for a in proj.assignments if a.status == "Active" and a.employee]
    team_ids = [e.id for e in team]
    team_skills = [e.skills for e in team]
    gaps_raw, overall = analyze_skill_gaps(proj.required_skills, team_skills)
    gaps = [SkillGapItem(**g) for g in gaps_raw]
    return SkillGapResponse(
        project_id=proj.id,
        project_name=proj.name,
        team_employee_ids=team_ids,
        overall_coverage_pct=overall,
        gaps=gaps,
    )


@app.get("/api/risks", response_model=list[RiskAssessment])
def list_risks(db: Session = Depends(get_db)) -> list[RiskAssessment]:
    projects = db.query(Project).filter(Project.status != "Cancelled").all()
    out: list[RiskAssessment] = []
    for p in projects:
        out.append(RiskAssessment(**_risk_for_project(db, p)))
    out.sort(key=lambda r: r.risk_score, reverse=True)
    return out


@app.get("/api/risks/{project_id}", response_model=RiskAssessment)
def project_risk(project_id: int, db: Session = Depends(get_db)) -> RiskAssessment:
    proj = db.get(Project, project_id)
    if not proj:
        raise HTTPException(404, "Project not found")
    data = _risk_for_project(db, proj)
    log_activity(db, "project_risk", f"Risk assessed for project '{proj.name}'.")
    return RiskAssessment(**data)


def _risk_for_project(db: Session, proj: Project) -> dict:
    team = [a.employee for a in proj.assignments if a.status == "Active" and a.employee]
    return assess_project_risk(
        proj.id,
        proj.name,
        proj.deadline,
        proj.priority,
        proj.estimated_workload,
        proj.required_skills,
        [e.name for e in team],
        [e.skills for e in team],
        [effective_utilization(db, e) for e in team],
        [e.availability_percentage for e in team],
        date.today(),
    )
