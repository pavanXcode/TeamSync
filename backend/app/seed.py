"""One-time database seed for CrewIQ demo data."""

from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.models import AppMeta, Assignment, Employee, Project


def seed_if_needed(db: Session) -> None:
    meta = db.get(AppMeta, "seed_complete")
    if meta and meta.value == "true":
        return

    employees_data = [
        ("Priya Sharma", "priya.sharma@crewiq.demo", "ML Engineer", "Data Science", {"Python": 5, "Machine Learning": 5, "SQL": 4, "Cloud Computing": 3}, 4.5, 85, 72),
        ("Marcus Chen", "marcus.chen@crewiq.demo", "Backend Developer", "Engineering", {"Python": 4, "SQL": 5, "API Design": 4, "Docker": 3}, 3.0, 90, 65),
        ("Elena Rodriguez", "elena.rodriguez@crewiq.demo", "Cloud Architect", "Infrastructure", {"Cloud Computing": 5, "Docker": 4, "Kubernetes": 4, "DevOps": 4}, 6.0, 75, 88),
        ("James Okonkwo", "james.okonkwo@crewiq.demo", "Data Analyst", "Data Science", {"SQL": 5, "Data Analytics": 5, "Python": 3, "Machine Learning": 2}, 2.5, 95, 45),
        ("Sarah Mitchell", "sarah.mitchell@crewiq.demo", "Frontend Engineer", "Engineering", {"React": 5, "JavaScript": 5, "Testing": 3, "API Design": 2}, 3.5, 80, 70),
        ("David Kim", "david.kim@crewiq.demo", "Full Stack Developer", "Engineering", {"Python": 4, "React": 4, "SQL": 4, "JavaScript": 4}, 4.0, 70, 92),
        ("Amira Hassan", "amira.hassan@crewiq.demo", "Security Engineer", "Security", {"Cybersecurity": 5, "Cloud Computing": 3, "Python": 3, "DevOps": 3}, 5.0, 60, 55),
        ("Tom Becker", "tom.becker@crewiq.demo", "Junior Developer", "Engineering", {"Python": 3, "JavaScript": 3, "Testing": 2}, 1.5, 100, 30),
        ("Lisa Nguyen", "lisa.nguyen@crewiq.demo", "Product Manager", "Product", {"Project Management": 5, "Data Analytics": 3}, 7.0, 50, 40),
        ("Ryan O'Brien", "ryan.obrien@crewiq.demo", "DevOps Engineer", "Infrastructure", {"DevOps": 5, "Docker": 5, "Kubernetes": 4, "Cloud Computing": 4}, 5.5, 88, 78),
        ("Nina Patel", "nina.patel@crewiq.demo", "ML Researcher", "Data Science", {"Machine Learning": 5, "Python": 5, "Data Analytics": 4}, 3.0, 82, 60),
        ("Chris Walton", "chris.walton@crewiq.demo", "QA Engineer", "Engineering", {"Testing": 5, "JavaScript": 3, "Python": 3}, 4.0, 92, 50),
        ("Fatima Al-Sayed", "fatima.alsayed@crewiq.demo", "Database Admin", "Infrastructure", {"SQL": 5, "Cloud Computing": 3, "DevOps": 2}, 8.0, 65, 85),
        ("Kevin Brooks", "kevin.brooks@crewiq.demo", "Solutions Architect", "Engineering", {"Cloud Computing": 4, "API Design": 5, "Python": 3, "Project Management": 4}, 9.0, 55, 95),
        ("Maya Johnson", "maya.johnson@crewiq.demo", "Data Engineer", "Data Science", {"Python": 4, "SQL": 5, "Cloud Computing": 4, "Docker": 3}, 3.5, 78, 68),
        ("Oliver Grant", "oliver.grant@crewiq.demo", "Intern", "Engineering", {"Python": 2, "JavaScript": 2, "Testing": 1}, 0.5, 100, 15),
    ]

    employees: list[Employee] = []
    for name, email, title, dept, skills, exp, avail, wl in employees_data:
        e = Employee(
            name=name,
            email=email,
            job_title=title,
            department=dept,
            experience_years=exp,
            availability_percentage=avail,
            workload_percentage=wl,
            active=True,
        )
        e.skills = skills
        db.add(e)
        employees.append(e)
    db.flush()

    today = date.today()
    projects_data = [
        (
            "AI Analytics Platform",
            "Enterprise analytics with ML pipelines and cloud deployment.",
            ["Python", "Machine Learning", "SQL", "Cloud Computing"],
            2.0,
            4,
            today,
            today + timedelta(days=45),
            320.0,
            "High",
            "Active",
        ),
        (
            "Customer Portal Redesign",
            "Modern React portal for customer self-service.",
            ["React", "JavaScript", "Testing", "API Design"],
            2.0,
            3,
            today - timedelta(days=10),
            today + timedelta(days=60),
            200.0,
            "Medium",
            "Active",
        ),
        (
            "Security Compliance Audit",
            "Cloud security review and remediation.",
            ["Cybersecurity", "Cloud Computing", "DevOps"],
            3.0,
            2,
            today,
            today + timedelta(days=30),
            150.0,
            "High",
            "Planning",
        ),
        (
            "Data Warehouse Migration",
            "Migrate legacy DB to cloud SQL warehouse.",
            ["SQL", "Cloud Computing", "Python", "Data Analytics"],
            3.0,
            3,
            today - timedelta(days=5),
            today + timedelta(days=90),
            400.0,
            "Medium",
            "Active",
        ),
        (
            "Mobile App MVP",
            "Cross-platform mobile companion app.",
            ["JavaScript", "React", "API Design"],
            1.0,
            2,
            today,
            today + timedelta(days=120),
            180.0,
            "Low",
            "Planning",
        ),
    ]

    projects: list[Project] = []
    for row in projects_data:
        p = Project(
            name=row[0],
            description=row[1],
            minimum_experience=row[3],
            desired_team_size=row[4],
            start_date=row[5],
            deadline=row[6],
            estimated_workload=row[7],
            priority=row[8],
            status=row[9],
        )
        p.required_skills = list(row[2])
        db.add(p)
        projects.append(p)
    db.flush()

    ai_proj = projects[0]
    assignments = [
        (employees[0].id, ai_proj.id, 25, "ML Lead"),
        (employees[1].id, ai_proj.id, 20, "Backend"),
        (employees[6].id, ai_proj.id, 15, "Security"),
        (employees[13].id, ai_proj.id, 85, "Architect"),
    ]
    portal = projects[1]
    assignments += [
        (employees[4].id, portal.id, 35, "Frontend Lead"),
        (employees[5].id, portal.id, 85, "Full Stack"),
    ]
    for eid, pid, wl, role in assignments:
        db.add(
            Assignment(
                employee_id=eid,
                project_id=pid,
                assigned_workload=wl,
                role=role,
                status="Active",
            )
        )
    db.flush()

    from app.services.workload_utils import sync_employee_workload_field

    for emp in employees:
        sync_employee_workload_field(db, emp)

    db.add(AppMeta(key="seed_complete", value="true"))
    db.commit()
