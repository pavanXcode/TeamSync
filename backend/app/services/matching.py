"""Explainable employee–project matching."""

from __future__ import annotations

from dataclasses import dataclass

from app.config import DEFAULT_SKILL_PROFICIENCY_REQUIRED, MATCHING_WEIGHTS


def _norm_skill(name: str) -> str:
    return name.strip().lower()


def match_label(score: float) -> str:
    if score >= 80:
        return "Excellent match"
    if score >= 60:
        return "Good match"
    return "Partial match"


@dataclass
class EmployeeLike:
    id: int
    name: str
    job_title: str
    department: str
    skills: dict[str, int]
    experience_years: float
    availability_percentage: float
    workload_percentage: float
    active: bool = True


@dataclass
class ProjectLike:
    name: str
    required_skills: list[str]
    minimum_experience: float


def skill_match_score(emp_skills: dict[str, int], required: list[str]) -> tuple[float, float, list[str], list[str]]:
    if not required:
        return 0.0, 0.0, [], []

    norm_emp = {_norm_skill(k): v for k, v in emp_skills.items()}
    matching: list[str] = []
    missing: list[str] = []
    coverage_points = 0.0
    prof_points = 0.0
    req_count = len(required)

    for raw in required:
        key = _norm_skill(raw)
        if key not in norm_emp:
            missing.append(raw)
            continue
        prof = norm_emp[key]
        matching.append(raw)
        coverage_points += 1.0
        req_prof = DEFAULT_SKILL_PROFICIENCY_REQUIRED
        prof_points += min(1.0, prof / max(req_prof, 1))

    if req_count == 0:
        return 0.0, 0.0, matching, missing

    coverage_pct = (coverage_points / req_count) * 100.0
    prof_pct = (prof_points / req_count) * 100.0
    combined = coverage_pct * 0.6 + prof_pct * 0.4
    return combined, coverage_pct, matching, missing


def experience_match_score(years: float, minimum: float) -> float:
    minimum = max(0.0, minimum)
    years = max(0.0, years)
    if minimum <= 0:
        return 100.0
    if years >= minimum:
        return 100.0
    if minimum == 0:
        return 100.0
    return min(100.0, (years / minimum) * 100.0)


def availability_score(pct: float) -> float:
    return max(0.0, min(100.0, pct))


def workload_suitability_score(workload_pct: float) -> float:
    w = max(0.0, min(100.0, workload_pct))
    remaining = 100.0 - w
    return max(0.0, min(100.0, remaining))


def compute_match(employee: EmployeeLike, project: ProjectLike) -> dict:
    weights = MATCHING_WEIGHTS
    reasons: list[str] = []

    if not employee.active:
        return {
            "match_score": 0.0,
            "match_label": "Partial match",
            "skill_coverage_pct": 0.0,
            "matching_skills": [],
            "missing_skills": list(project.required_skills),
            "component_scores": {
                "skill_match": 0.0,
                "experience_match": 0.0,
                "availability": 0.0,
                "workload_suitability": 0.0,
            },
            "reasons": ["Employee is inactive and excluded from matching."],
        }

    sk, cov, matching, missing = skill_match_score(employee.skills, project.required_skills)
    exp = experience_match_score(employee.experience_years, project.minimum_experience)
    avail = availability_score(employee.availability_percentage)
    wl = workload_suitability_score(employee.workload_percentage)

    total = (
        sk * weights["skill_match"]
        + exp * weights["experience_match"]
        + avail * weights["availability"]
        + wl * weights["workload_suitability"]
    )
    total = max(0.0, min(100.0, total))

    if matching:
        reasons.append(f"Covers {len(matching)}/{len(project.required_skills)} required skills.")
    if missing:
        reasons.append(f"Missing skills: {', '.join(missing)}.")
    if exp >= 100:
        reasons.append("Meets or exceeds minimum experience.")
    elif project.minimum_experience > 0:
        reasons.append(
            f"Experience {employee.experience_years}y vs required {project.minimum_experience}y."
        )
    if avail < 50:
        reasons.append("Low availability may limit contribution.")
    if employee.workload_percentage > 80:
        reasons.append("High current workload — capacity is limited.")
    elif employee.workload_percentage < 50:
        reasons.append("Has capacity for additional work.")

    return {
        "match_score": round(total, 1),
        "match_label": match_label(total),
        "skill_coverage_pct": round(cov, 1),
        "matching_skills": matching,
        "missing_skills": missing,
        "component_scores": {
            "skill_match": round(sk, 1),
            "experience_match": round(exp, 1),
            "availability": round(avail, 1),
            "workload_suitability": round(wl, 1),
        },
        "reasons": reasons,
    }


def find_unknown_skills(all_employee_skills: set[str], required: list[str]) -> list[str]:
    norm_all = {_norm_skill(s) for s in all_employee_skills}
    unknown = []
    for r in required:
        if _norm_skill(r) not in norm_all:
            unknown.append(r)
    return unknown
