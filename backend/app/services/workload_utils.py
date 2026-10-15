"""Workload calculation: utilization from assignments vs availability."""

from sqlalchemy.orm import Session

from app.config import WORKLOAD_THRESHOLDS
from app.models import Assignment, Employee


def assignment_workload_for_employee(db: Session, employee_id: int) -> float:
    rows = (
        db.query(Assignment)
        .filter(
            Assignment.employee_id == employee_id,
            Assignment.status == "Active",
        )
        .all()
    )
    return sum(r.assigned_workload for r in rows)


def effective_utilization(db: Session, employee: Employee) -> float:
    """Utilization = assigned workload as % of employee availability capacity."""
    assigned = assignment_workload_for_employee(db, employee.id)
    if assigned > 0:
        return min(100.0, assigned)
    return min(100.0, max(0.0, employee.workload_percentage))


def available_capacity(db: Session, employee: Employee) -> float:
    util = effective_utilization(db, employee)
    # Capacity is relative to availability (how much of their available time is free)
    avail = max(0.0, min(100.0, employee.availability_percentage))
    used_of_avail = util * (avail / 100.0) if avail > 0 else util
    return max(0.0, avail - used_of_avail)


def utilization_status(util_pct: float) -> str:
    t = WORKLOAD_THRESHOLDS
    if util_pct > t["high_max"]:
        return "Overloaded"
    if util_pct > t["balanced_max"]:
        return "High workload"
    if util_pct >= t["underutilized_max"]:
        return "Balanced"
    return "Underutilized"


def sync_employee_workload_field(db: Session, employee: Employee) -> None:
    employee.workload_percentage = effective_utilization(db, employee)
