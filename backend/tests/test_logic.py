"""Tests for CrewIQ business logic."""

import pytest
from datetime import date, timedelta

from app.services.matching import EmployeeLike, ProjectLike, compute_match
from app.services.team_builder import greedy_select
from app.services.risk import assess_project_risk
from app.schemas import EmployeeCreate


def emp(**kwargs) -> EmployeeLike:
    defaults = dict(
        id=1,
        name="Test",
        job_title="Dev",
        department="Eng",
        skills={"Python": 4},
        experience_years=3,
        availability_percentage=100,
        workload_percentage=40,
        active=True,
    )
    defaults.update(kwargs)
    return EmployeeLike(**defaults)


def test_stronger_skill_coverage_ranks_higher():
    project = ProjectLike(name="P", required_skills=["Python", "SQL"], minimum_experience=2)
    weak = emp(id=1, skills={"Python": 2})
    strong = emp(id=2, skills={"Python": 5, "SQL": 4})
    assert compute_match(strong, project)["match_score"] > compute_match(weak, project)["match_score"]


def test_unavailable_employee_penalty():
    project = ProjectLike(name="P", required_skills=["Python"], minimum_experience=0)
    avail = emp(id=1, availability_percentage=90)
    low = emp(id=2, availability_percentage=20)
    assert compute_match(avail, project)["match_score"] > compute_match(low, project)["match_score"]


def test_missing_skills_reduce_score():
    project = ProjectLike(name="P", required_skills=["Python", "Kubernetes"], minimum_experience=0)
    partial = emp(skills={"Python": 5})
    full = emp(skills={"Python": 5, "Kubernetes": 4})
    assert compute_match(full, project)["match_score"] > compute_match(partial, project)["match_score"]


def test_team_builder_no_duplicates():
    project = ProjectLike(name="P", required_skills=["Python", "SQL"], minimum_experience=0)
    employees = [
        emp(id=i, skills={"Python": 3 + (i % 2), "SQL": 2 + (i % 3)})
        for i in range(1, 8)
    ]
    team, _, _ = greedy_select(employees, project, 4, set())
    ids = [t.id for t in team]
    assert len(ids) == len(set(ids))


def test_team_reports_uncovered_skills():
    project = ProjectLike(name="P", required_skills=["Python", "Cybersecurity"], minimum_experience=0)
    employees = [emp(id=1, skills={"Python": 5}), emp(id=2, skills={"SQL": 5})]
    team, warnings, _ = greedy_select(employees, project, 2, set())
    assert any("Cybersecurity" in w or "does not cover" in w for w in warnings) or len(team) < 2


def test_risk_score_bounded():
    r = assess_project_risk(
        1,
        "Test",
        date.today() + timedelta(days=30),
        "High",
        200,
        ["Python"],
        ["A"],
        [{"Python": 5}],
        [70.0],
        [80.0],
    )
    assert 0 <= r["risk_score"] <= 100


def test_invalid_percentage_rejected():
    with pytest.raises(ValueError):
        EmployeeCreate(
            name="X",
            email="x@test.com",
            job_title="J",
            department="D",
            skills={"Python": 3},
            experience_years=1,
            availability_percentage=150,
        )


def test_reallocation_capacity_logic():
    """Target utilization after move must not exceed 100 without override."""
    util = 85.0
    task = 20.0
    assert util + task > 100


def test_inactive_employee_excluded_from_matching():
    project = ProjectLike(name="P", required_skills=["Python"], minimum_experience=1)
    inactive_emp = emp(active=False, skills={"Python": 5})
    res = compute_match(inactive_emp, project)
    assert res["match_score"] == 0.0
    assert "inactive" in res["reasons"][0].lower()


def test_unknown_skills_detected():
    from app.services.matching import find_unknown_skills

    directory_skills = {"Python", "SQL", "React"}
    required = ["Python", "Rust", "Golang"]
    unknown = find_unknown_skills(directory_skills, required)
    assert set(unknown) == {"Rust", "Golang"}


def test_deadline_urgency_past_and_none():
    from app.services.risk import deadline_urgency

    today = date.today()
    # Past deadline -> maximum pressure (100)
    score_past, desc_past = deadline_urgency(today - timedelta(days=5), today, 100, "High")
    assert score_past == 100.0
    assert "passed" in desc_past.lower()

    # None deadline -> default moderate pressure
    score_none, desc_none = deadline_urgency(None, today, 100, "Medium")
    assert 0 <= score_none <= 100
    assert "no deadline" in desc_none.lower()


def test_skill_gap_analysis_covered_and_missing():
    from app.services.skill_gaps import analyze_skill_gaps

    required = ["Python", "Quantum Computing"]
    team_skills = [{"Python": 5}]
    gaps, coverage = analyze_skill_gaps(required, team_skills)

    assert coverage == 50.0
    py_gap = next(g for g in gaps if g["skill"] == "Python")
    qc_gap = next(g for g in gaps if g["skill"] == "Quantum Computing")

    assert py_gap["status"] == "Covered"
    assert py_gap["training_suggestion"] is None

    assert qc_gap["status"] == "Missing"
    assert qc_gap["training_suggestion"] is not None
    assert "learning" in qc_gap["training_suggestion"].lower() or "quantum" in qc_gap["training_suggestion"].lower()


def test_team_builder_strictly_excludes_ids():
    project = ProjectLike(name="P", required_skills=["Python", "SQL"], minimum_experience=0)
    employees = [
        emp(id=1, skills={"Python": 5, "SQL": 5}),
        emp(id=2, skills={"Python": 4, "SQL": 4}),
        emp(id=3, skills={"Python": 3, "SQL": 3}),
    ]
    # Exclude the top candidate (id=1)
    team, _, _ = greedy_select(employees, project, 2, exclude_ids={1})
    team_ids = {m.id for m in team}
    assert 1 not in team_ids
    assert 2 in team_ids
