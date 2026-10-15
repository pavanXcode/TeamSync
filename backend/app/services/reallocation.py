"""Workload reallocation recommendations."""

from __future__ import annotations

from app.config import WORKLOAD_THRESHOLDS
from app.services.matching import _norm_skill
from app.services.workload_utils import available_capacity, effective_utilization


def recommend_reallocation(
    db,
    overloaded_employee,
    project,
    task_workload: float,
    all_employees,
) -> dict:
    current_util = effective_utilization(db, overloaded_employee)
    current = {
        "employee_id": overloaded_employee.id,
        "name": overloaded_employee.name,
        "project_id": project.id,
        "project_name": project.name,
        "utilization_pct": round(current_util, 1),
        "task_workload": task_workload,
    }

    if current_util <= WORKLOAD_THRESHOLDS["balanced_max"]:
        return {
            "current": current,
            "proposed": None,
            "message": "Employee is not overloaded; reallocation not required.",
        }

    from app.models import Assignment

    assignment = (
        db.query(Assignment)
        .filter(
            Assignment.employee_id == overloaded_employee.id,
            Assignment.project_id == project.id,
            Assignment.status == "Active",
        )
        .first()
    )
    if not assignment or assignment.assigned_workload <= 0:
        return {
            "current": current,
            "proposed": None,
            "message": f"Employee {overloaded_employee.name} has no active assignment on project '{project.name}'.",
        }

    if task_workload > assignment.assigned_workload:
        return {
            "current": current,
            "proposed": None,
            "message": (
                f"Task workload ({task_workload:.0f}%) exceeds "
                f"{overloaded_employee.name}'s assigned workload "
                f"({assignment.assigned_workload:.0f}%) on this project."
            ),
        }

    req_skills = {_norm_skill(s) for s in project.required_skills}
    candidates = []
    for emp in all_employees:
        if emp.id == overloaded_employee.id or not emp.active:
            continue
        util = effective_utilization(db, emp)
        after = util + task_workload
        if after > 100:
            continue
        cap = available_capacity(db, emp)
        if cap < task_workload * 0.5:
            continue
        if emp.availability_percentage < 40:
            continue

        emp_skills = {_norm_skill(k) for k in emp.skills.keys()}
        skill_overlap = len(req_skills & emp_skills)
        reasons = []
        if skill_overlap:
            reasons.append(f"Shares {skill_overlap} relevant project skill(s).")
        reasons.append(f"Utilization would be {after:.0f}% after assignment (within limit).")
        reasons.append(f"Availability {emp.availability_percentage:.0f}%.")
        score = skill_overlap * 10 + (100 - util) + emp.availability_percentage * 0.2
        candidates.append((score, emp, after, reasons))

    candidates.sort(key=lambda x: x[0], reverse=True)
    if not candidates:
        return {
            "current": current,
            "proposed": None,
            "message": "No suitable employee with capacity and skills found.",
        }

    _, best, after, reasons = candidates[0]
    return {
        "current": current,
        "proposed": {
            "employee_id": best.id,
            "name": best.name,
            "reasons": reasons,
            "utilization_after_pct": round(after, 1),
        },
        "message": "Recommended reallocation to balance workload.",
    }
