"""Dashboard KPI and chart aggregation."""

from __future__ import annotations

from datetime import date

from sqlalchemy.orm import Session

from app.models import Activity, Employee, Project
from app.services.risk import assess_project_risk
from app.services.skill_gaps import analyze_skill_gaps
from app.services.workload_utils import effective_utilization, utilization_status


def build_dashboard(db: Session) -> dict:
    employees = db.query(Employee).filter(Employee.active == True).all()  # noqa: E712
    projects = db.query(Project).all()
    active_projects = [p for p in projects if p.status not in ("Completed", "Cancelled")]

    utils = [effective_utilization(db, e) for e in employees]
    high_or_over = sum(
        1 for u in utils if utilization_status(u) in ("High workload", "Overloaded")
    )
    available_count = sum(1 for e in employees if e.availability_percentage >= 50 and effective_utilization(db, e) < 80)

    critical_gaps = 0
    at_risk = 0
    project_coverage_chart = []
    risk_distribution = {"Low risk": 0, "Medium risk": 0, "High risk": 0, "Critical risk": 0}

    for p in active_projects:
        team = [a.employee for a in p.assignments if a.status == "Active"]
        team_skills = [e.skills for e in team]
        gaps, cov = analyze_skill_gaps(p.required_skills, team_skills)
        critical_gaps += sum(1 for g in gaps if g["status"] == "Missing")
        project_coverage_chart.append({"name": p.name[:24], "coverage": cov})

        risk = assess_project_risk(
            p.id,
            p.name,
            p.deadline,
            p.priority,
            p.estimated_workload,
            p.required_skills,
            [e.name for e in team],
            team_skills,
            [effective_utilization(db, e) for e in team],
            [e.availability_percentage for e in team],
        )
        risk_distribution[risk["risk_level"]] = risk_distribution.get(risk["risk_level"], 0) + 1
        if risk["risk_score"] >= 60:
            at_risk += 1

    skill_freq: dict[str, int] = {}
    for e in employees:
        for s in e.skills:
            key = s.strip()
            skill_freq[key] = skill_freq.get(key, 0) + 1
    top_skills = sorted(skill_freq.items(), key=lambda x: -x[1])[:8]
    skills_chart = [{"skill": k, "count": v} for k, v in top_skills]

    util_buckets = {"Underutilized": 0, "Balanced": 0, "High workload": 0, "Overloaded": 0}
    for u in utils:
        util_buckets[utilization_status(u)] = util_buckets.get(utilization_status(u), 0) + 1

    workload_chart = [
        {"name": e.name.split()[0], "utilization": round(effective_utilization(db, e), 1)}
        for e in employees[:15]
    ]

    activities = (
        db.query(Activity).order_by(Activity.timestamp.desc()).limit(10).all()
    )

    return {
        "kpis": {
            "total_employees": len(employees),
            "active_projects": len(active_projects),
            "available_employees": available_count,
            "high_workload_employees": high_or_over,
            "critical_skill_gaps": critical_gaps,
            "projects_at_risk": at_risk,
        },
        "charts": {
            "utilization_distribution": [
                {"status": k, "count": v} for k, v in util_buckets.items()
            ],
            "workload_comparison": workload_chart,
            "top_skills": skills_chart,
            "project_skill_coverage": project_coverage_chart,
            "risk_distribution": [
                {"level": k, "count": v} for k, v in risk_distribution.items()
            ],
        },
        "recent_activity": [
            {
                "id": a.id,
                "event_type": a.event_type,
                "description": a.description,
                "timestamp": a.timestamp.isoformat(),
            }
            for a in activities
        ],
    }
