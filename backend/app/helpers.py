"""ORM to API helpers."""

from sqlalchemy.orm import Session

from app.models import Employee, Project
from app.schemas import EmployeeOut, ProjectOut
from app.services.workload_utils import effective_utilization


def employee_to_out(db: Session, emp: Employee) -> EmployeeOut:
    active_projects = []
    for a in emp.assignments:
        if a.status == "Active" and a.project:
            active_projects.append(
                {
                    "project_id": a.project_id,
                    "project_name": a.project.name,
                    "role": a.role,
                    "assigned_workload": a.assigned_workload,
                }
            )
    util = effective_utilization(db, emp)
    return EmployeeOut(
        id=emp.id,
        name=emp.name,
        email=emp.email,
        job_title=emp.job_title,
        department=emp.department,
        skills=emp.skills,
        experience_years=emp.experience_years,
        availability_percentage=emp.availability_percentage,
        workload_percentage=round(util, 1),
        github_username=getattr(emp, "github_username", None),
        active=emp.active,
        active_projects=active_projects,
    )


def project_to_out(db: Session, proj: Project) -> ProjectOut:
    team = []
    for a in proj.assignments:
        if a.status == "Active" and a.employee:
            team.append(
                {
                    "employee_id": a.employee_id,
                    "name": a.employee.name,
                    "role": a.role,
                    "assigned_workload": a.assigned_workload,
                }
            )
    return ProjectOut(
        id=proj.id,
        name=proj.name,
        description=proj.description,
        required_skills=proj.required_skills,
        minimum_experience=proj.minimum_experience,
        desired_team_size=proj.desired_team_size,
        start_date=proj.start_date,
        deadline=proj.deadline,
        estimated_workload=proj.estimated_workload,
        priority=proj.priority,
        status=proj.status,
        assigned_team=team,
    )


def log_activity(db: Session, event_type: str, description: str) -> None:
    from app.models import Activity

    db.add(Activity(event_type=event_type, description=description))
    db.commit()
