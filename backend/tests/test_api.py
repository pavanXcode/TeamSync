"""API integration tests."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.seed import seed_if_needed


@pytest.fixture()
def client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    seed_if_needed(db)

    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_seed_not_duplicated(client):
    r1 = client.get("/api/employees")
    n1 = len(r1.json())
    r2 = client.get("/api/employees")
    assert len(r2.json()) == n1
    assert n1 >= 15


def test_matching_analyze(client):
    projects = client.get("/api/projects").json()
    ai = next(p for p in projects if "AI Analytics" in p["name"])
    r = client.post("/api/matching/analyze", json={"project_id": ai["id"]})
    assert r.status_code == 200
    body = r.json()
    assert len(body["results"]) > 0
    assert body["results"][0]["match_score"] >= body["results"][-1]["match_score"]


def test_reallocation_confirm_persists(client):
    projects = client.get("/api/projects").json()
    proj = projects[0]
    employees = client.get("/api/employees").json()
    assignee_ids = {a["employee_id"] for a in proj["assigned_team"]}
    assigned_emps = [e for e in employees if e["id"] in assignee_ids]
    overloaded = max(assigned_emps, key=lambda e: e["workload_percentage"])
    initial_source_wl = overloaded["workload_percentage"]

    task_workload = 15.0
    rec = client.post(
        "/api/workload/reallocation/recommend",
        json={
            "employee_id": overloaded["id"],
            "project_id": proj["id"],
            "task_workload": task_workload,
        },
    )
    assert rec.status_code == 200
    prop = rec.json().get("proposed")
    assert prop is not None, "Expected an eligible candidate for reallocation"
    target_id = prop["employee_id"]
    target_emp = next(e for e in employees if e["id"] == target_id)
    initial_target_wl = target_emp["workload_percentage"]

    r = client.post(
        "/api/workload/reallocation/confirm",
        json={
            "from_employee_id": overloaded["id"],
            "to_employee_id": target_id,
            "project_id": proj["id"],
            "task_workload": task_workload,
        },
    )
    assert r.status_code == 200
    assert r.json()["ok"] is True

    # Confirm that accepted reallocations persist in SQLite
    proj_after = client.get(f"/api/projects/{proj['id']}").json()
    after_team = {a["employee_id"]: a["assigned_workload"] for a in proj_after["assigned_team"]}
    assert after_team[overloaded["id"]] == initial_source_wl - task_workload
    assert after_team[target_id] == initial_target_wl + task_workload

    e_from_after = client.get(f"/api/employees/{overloaded['id']}").json()
    e_to_after = client.get(f"/api/employees/{target_id}").json()
    assert e_from_after["workload_percentage"] == initial_source_wl - task_workload
    assert e_to_after["workload_percentage"] == initial_target_wl + task_workload


def test_reallocation_rejected_does_not_modify_assignments(client):
    projects = client.get("/api/projects").json()
    proj = projects[0]
    initial_team = {a["employee_id"]: a["assigned_workload"] for a in proj["assigned_team"]}

    # Rejection 1: target capacity exceeded (> 100%)
    r1 = client.post(
        "/api/workload/reallocation/confirm",
        json={
            "from_employee_id": 14,
            "to_employee_id": 1,
            "project_id": proj["id"],
            "task_workload": 95.0,
        },
    )
    assert r1.status_code == 400
    assert "exceed 100%" in r1.json()["detail"]

    # Rejection 2: source has no active assignment on the project
    r2 = client.post(
        "/api/workload/reallocation/confirm",
        json={
            "from_employee_id": 3,
            "to_employee_id": 1,
            "project_id": proj["id"],
            "task_workload": 5.0,
        },
    )
    assert r2.status_code == 400
    assert "No active assignment" in r2.json()["detail"]

    # Rejection 3: non-existent employee
    r3 = client.post(
        "/api/workload/reallocation/confirm",
        json={
            "from_employee_id": 9999,
            "to_employee_id": 1,
            "project_id": proj["id"],
            "task_workload": 5.0,
        },
    )
    assert r3.status_code == 404

    # Confirm assignments in SQLite remain completely unmodified
    proj_after = client.get(f"/api/projects/{proj['id']}").json()
    after_team = {a["employee_id"]: a["assigned_workload"] for a in proj_after["assigned_team"]}
    assert after_team == initial_team


def test_team_builder_endpoint(client):
    # Recommend team for project 1
    r = client.post(
        "/api/team-builder/recommend",
        json={"project_id": 1, "desired_team_size": 3},
    )
    assert r.status_code == 200
    data = r.json()
    assert len(data["team_members"]) == 3
    assert data["overall_skill_coverage_pct"] > 0
    assert 0 <= data["team_suitability_score"] <= 100

    # With exclude_employee_ids
    excluded_id = data["team_members"][0]["employee_id"]
    r2 = client.post(
        "/api/team-builder/recommend",
        json={
            "project_id": 1,
            "desired_team_size": 3,
            "exclude_employee_ids": [excluded_id],
        },
    )
    assert r2.status_code == 200
    data2 = r2.json()
    member_ids = {m["employee_id"] for m in data2["team_members"]}
    assert excluded_id not in member_ids

    # 404 for invalid project_id
    r3 = client.post(
        "/api/team-builder/recommend",
        json={"project_id": 99999},
    )
    assert r3.status_code == 404

    # 400 for neither project_id nor required_skills
    r4 = client.post("/api/team-builder/recommend", json={})
    assert r4.status_code == 400


def test_skill_gaps_endpoint(client):
    # Project 1: fully covered skills
    r1 = client.get("/api/skill-gaps/1")
    assert r1.status_code == 200
    data1 = r1.json()
    assert data1["project_name"] == "AI Analytics Platform"
    assert data1["overall_coverage_pct"] == 100.0

    # Project 3: unassigned project with missing skills and training suggestions
    r3 = client.get("/api/skill-gaps/3")
    assert r3.status_code == 200
    data3 = r3.json()
    assert data3["overall_coverage_pct"] == 0.0
    for g in data3["gaps"]:
        assert g["status"] == "Missing"
        assert g["training_suggestion"] is not None
        assert len(g["training_suggestion"]) > 5

    # 404 for non-existent project
    r_err = client.get("/api/skill-gaps/9999")
    assert r_err.status_code == 404


def test_risks_endpoints(client):
    # List risks
    r = client.get("/api/risks")
    assert r.status_code == 200
    risks = r.json()
    assert len(risks) >= 5
    # Verify sorted descending by risk_score
    for i in range(len(risks) - 1):
        assert risks[i]["risk_score"] >= risks[i + 1]["risk_score"]

    for item in risks:
        assert 0 <= item["risk_score"] <= 100
        assert item["risk_level"] in {"Low risk", "Medium risk", "High risk", "Critical risk"}
        assert len(item["factors"]) == 4
        assert len(item["recommendations"]) >= 1

    # Single project risk
    r_single = client.get(f"/api/risks/{risks[0]['project_id']}")
    assert r_single.status_code == 200
    assert r_single.json()["project_id"] == risks[0]["project_id"]

    # 404 for non-existent project
    r_err = client.get("/api/risks/99999")
    assert r_err.status_code == 404


def test_workload_analysis_endpoint(client):
    r = client.get("/api/workload/analysis")
    assert r.status_code == 200
    data = r.json()
    assert len(data["employees"]) >= 15
    assert "thresholds" in data
    assert "distribution" in data

    # Verify status distribution totals match employees
    dist_total = sum(d["count"] for d in data["distribution"])
    assert dist_total == len(data["employees"])


def test_dashboard_endpoint(client):
    r = client.get("/api/dashboard")
    assert r.status_code == 200
    data = r.json()
    assert "kpis" in data
    assert "charts" in data
    assert "recent_activity" in data
    assert data["kpis"]["total_employees"] >= 15
    assert data["kpis"]["active_projects"] >= 1


def test_validation_and_edge_cases(client):
    # Duplicate email rejected
    r_dup = client.post(
        "/api/employees",
        json={
            "name": "Duplicate",
            "email": "priya.sharma@crewiq.demo",
            "job_title": "Engineer",
            "department": "Engineering",
            "experience_years": 3,
        },
    )
    assert r_dup.status_code == 400

    # Project with deadline before start date rejected
    r_date = client.post(
        "/api/projects",
        json={
            "name": "Invalid Project",
            "start_date": "2026-05-10",
            "deadline": "2026-05-01",
            "required_skills": ["Python"],
        },
    )
    assert r_date.status_code == 400
    assert "Deadline must be on or after start date" in r_date.json()["detail"]

    # Project with empty required skills rejected
    r_skill = client.post(
        "/api/projects",
        json={
            "name": "No Skills Project",
            "required_skills": [],
        },
    )
    assert r_skill.status_code == 422

    # Matching ad-hoc request with empty skills rejected
    r_match_err = client.post("/api/matching/analyze", json={})
    assert r_match_err.status_code == 400
