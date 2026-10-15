"""Rule-based project deadline risk scoring (heuristic, not ML)."""

from __future__ import annotations

from datetime import date

from app.config import DEFAULT_SKILL_PROFICIENCY_REQUIRED, RISK_WEIGHTS
from app.services.matching import _norm_skill, skill_match_score


def risk_level(score: float) -> str:
    if score >= 80:
        return "Critical risk"
    if score >= 60:
        return "High risk"
    if score >= 30:
        return "Medium risk"
    return "Low risk"


def deadline_urgency(
    deadline: date | None,
    today: date,
    estimated_workload: float,
    priority: str,
) -> tuple[float, str]:
    if deadline is None:
        return 40.0, "No deadline set — assuming moderate urgency."

    days_left = (deadline - today).days
    if days_left < 0:
        return 100.0, f"Deadline passed {abs(days_left)} day(s) ago."

    # Scale urgency: more work + fewer days => higher score, capped
    work = max(1.0, estimated_workload)
    days = max(1, days_left)
    pressure = min(100.0, (work / days) * 2.5)

    if days_left <= 7:
        pressure = min(100.0, pressure + 25.0)
    elif days_left <= 14:
        pressure = min(100.0, pressure + 10.0)

    if priority.lower() == "high":
        pressure = min(100.0, pressure + 10.0)
    elif priority.lower() == "critical":
        pressure = min(100.0, pressure + 20.0)

    detail = f"{days_left} day(s) until deadline; estimated workload {estimated_workload:.0f}."
    return max(0.0, min(100.0, pressure)), detail


def team_skill_gap_risk(
    required_skills: list[str],
    team_skills: list[dict[str, int]],
) -> tuple[float, list[str], str]:
    if not required_skills:
        return 0.0, [], "No required skills defined."

    missing: list[str] = []
    gap_scores: list[float] = []
    for req in required_skills:
        best = 0
        for emp_sk in team_skills:
            norm = {_norm_skill(k): v for k, v in emp_sk.items()}
            key = _norm_skill(req)
            if key in norm:
                best = max(best, norm[key])
        if best == 0:
            missing.append(req)
            gap_scores.append(100.0)
        elif best < DEFAULT_SKILL_PROFICIENCY_REQUIRED:
            gap_scores.append(60.0)
        else:
            gap_scores.append(max(0.0, 100.0 - (best / 5.0) * 40.0))

    avg = sum(gap_scores) / len(gap_scores) if gap_scores else 0.0
    detail = f"{len(missing)} missing skill(s) on assigned team."
    return max(0.0, min(100.0, avg)), missing, detail


def workload_pressure_risk(utilizations: list[float]) -> tuple[float, list[str], str]:
    overloaded = [u for u in utilizations if u > 100]
    high = [u for u in utilizations if 80 < u <= 100]
    if not utilizations:
        return 50.0, [], "No team assigned — workload pressure unknown."

    avg = sum(utilizations) / len(utilizations)
    score = avg
    if overloaded:
        score = min(100.0, score + 20.0)
    names_note = []
    detail = f"Average utilization {avg:.0f}% across {len(utilizations)} assignee(s)."
    return max(0.0, min(100.0, score)), names_note, detail


def availability_risk(availabilities: list[float]) -> tuple[float, str]:
    if not availabilities:
        return 50.0, "No team assigned — availability unknown."
    avg = sum(availabilities) / len(availabilities)
    score = max(0.0, min(100.0, 100.0 - avg))
    return score, f"Average availability {avg:.0f}%."


def assess_project_risk(
    project_id: int,
    project_name: str,
    deadline: date | None,
    priority: str,
    estimated_workload: float,
    required_skills: list[str],
    team_member_names: list[str],
    team_skills: list[dict[str, int]],
    team_utilizations: list[float],
    team_availabilities: list[float],
    today: date | None = None,
) -> dict:
    today = today or date.today()
    weights = RISK_WEIGHTS
    warnings: list[str] = []

    du, du_detail = deadline_urgency(deadline, today, estimated_workload, priority)
    sg, missing_skills, sg_detail = team_skill_gap_risk(required_skills, team_skills)
    wp, _, wp_detail = workload_pressure_risk(team_utilizations)
    ar, ar_detail = availability_risk(team_availabilities)

    if deadline is None:
        warnings.append("Project has no deadline; urgency uses default assumption.")
    if not team_member_names:
        warnings.append("No active assignments — skill and workload risks are estimated.")

    total = (
        du * weights["deadline_urgency"]
        + sg * weights["skill_gaps"]
        + wp * weights["workload_pressure"]
        + ar * weights["availability_constraints"]
    )
    total = max(0.0, min(100.0, round(total, 1)))

    overloaded_employees = [
        team_member_names[i]
        for i, u in enumerate(team_utilizations)
        if i < len(team_member_names) and u > 100
    ]

    recommendations: list[str] = []
    if missing_skills:
        recommendations.append(
            f"Close skill gaps ({', '.join(missing_skills)}): assign qualified staff or schedule training."
        )
    if any(u > 80 for u in team_utilizations):
        recommendations.append("Rebalance workload via Workload Balancer to reduce utilization pressure.")
    if ar > 50:
        recommendations.append("Low team availability — consider backup resources or timeline adjustment.")
    if du > 70:
        recommendations.append("Tight timeline — review scope, add capacity, or renegotiate the deadline.")
    if not recommendations:
        recommendations.append("Risk is manageable; continue monitoring assignments and deadlines.")

    factors = [
        {"name": "Deadline urgency", "score": round(du, 1), "detail": du_detail},
        {"name": "Skill gaps", "score": round(sg, 1), "detail": sg_detail},
        {"name": "Workload pressure", "score": round(wp, 1), "detail": wp_detail},
        {"name": "Availability constraints", "score": round(ar, 1), "detail": ar_detail},
    ]

    return {
        "project_id": project_id,
        "project_name": project_name,
        "risk_score": total,
        "risk_level": risk_level(total),
        "factors": factors,
        "recommendations": recommendations,
        "critical_missing_skills": missing_skills,
        "overloaded_employees": overloaded_employees,
        "warnings": warnings,
    }
