"""Tests for GitHub task progress and analytics engine.

Verifies:
- Metric calculations (completed accepted tasks / assigned eligible tasks)
- Deduplication: linked issues and PRs are not double-counted
- Missing assignees handled gracefully
- Overdue tasks with real milestone due dates (no invented dates)
- Strict separation of task completion, PR throughput, and review activity
- API failure and rate limit isolation
- GET /api/github/progress endpoint with filtering
"""

from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
import httpx
import pytest
from fastapi.testclient import TestClient

from app.database import Base, SessionLocal, engine
from app.main import app
from app.models import Employee
from app.seed import seed_if_needed
from app.services.github_client import GitHubAPIError, GitHubClient
from app.services.github_analytics import (
    extract_linked_issues_from_text,
    fetch_and_calculate_github_progress,
    get_employee_mapping,
)


@pytest.fixture(scope="module")
def db_session():
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    seed_if_needed(session)
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(scope="module")
def api_client():
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    seed_if_needed(session)
    session.close()
    return TestClient(app)


def test_extract_linked_issues_from_text():
    """Verify regex correctly detects issue numbers from standard GitHub closing keywords."""
    body1 = "This PR fixes #42 and closes #108 after review."
    assert extract_linked_issues_from_text(body1) == [42, 108]

    body2 = "Resolves #999 and fixed 55."
    assert extract_linked_issues_from_text(body2) == [999]

    body3 = "No issue referenced here."
    assert extract_linked_issues_from_text(body3) == []


def test_username_mapping(db_session):
    """Verify explicit mapping translates handles to correct employee IDs."""
    github_to_id, id_to_github = get_employee_mapping(db_session)
    assert github_to_id["priyasharma-dev"] == 1
    assert github_to_id["marcuschen"] == 2
    assert id_to_github[1] == "priyasharma-dev"
    assert id_to_github[2] == "marcuschen"


@pytest.mark.anyio
async def test_deduplication_linked_pr_does_not_double_count_task(db_session):
    """When a PR links to an issue (e.g. 'Fixes #10'), only 1 task is counted, not 2."""
    now_iso = datetime.now(timezone.utc).isoformat()

    mock_issues = [
        {
            "number": 10,
            "title": "Build authentication middleware",
            "state": "closed",
            "assignees": [{"login": "priyasharma-dev"}],
            "user": {"login": "priyasharma-dev"},
            "created_at": now_iso,
            "closed_at": now_iso,
            "html_url": "https://github.com/org/repo/issues/10",
        }
    ]

    mock_prs = [
        {
            "number": 25,
            "title": "Auth middleware implementation",
            "body": "Fixes #10 with JWT validation",
            "state": "closed",
            "merged_at": now_iso,
            "assignees": [{"login": "priyasharma-dev"}],
            "user": {"login": "priyasharma-dev"},
            "created_at": now_iso,
            "closed_at": now_iso,
            "html_url": "https://github.com/org/repo/pull/25",
        }
    ]

    client = GitHubClient(owner="test-org", repo="test-repo", token="mock-token")
    client.fetch_issues = AsyncMock(return_value=mock_issues)
    client.fetch_pull_requests = AsyncMock(return_value=mock_prs)

    res = await fetch_and_calculate_github_progress(
        db=db_session,
        client=client,
        employee_id=1,
    )

    priya = next((e for e in res.employee_progress if e.employee_id == 1), None)
    assert priya is not None
    # Must only be 1 task, not 2
    assert priya.assigned_tasks == 1
    assert priya.completed_tasks == 1
    assert priya.task_progress_pct == 100.0

    # PR activity is tracked separately!
    assert priya.prs_opened == 1
    assert priya.prs_merged == 1
    assert priya.pr_merge_rate_pct == 100.0


@pytest.mark.anyio
async def test_missing_assignees_handled_safely(db_session):
    """Issues without assignees must not crash the calculation."""
    now_iso = datetime.now(timezone.utc).isoformat()
    mock_issues = [
        {
            "number": 50,
            "title": "Unassigned backlog item",
            "state": "open",
            "assignees": [],
            "assignee": None,
            "user": {"login": "someone"},
            "created_at": now_iso,
            "closed_at": None,
            "html_url": "https://github.com/org/repo/issues/50",
        }
    ]

    client = GitHubClient(owner="test-org", repo="test-repo", token="mock-token")
    client.fetch_issues = AsyncMock(return_value=mock_issues)
    client.fetch_pull_requests = AsyncMock(return_value=[])

    res = await fetch_and_calculate_github_progress(db=db_session, client=client)
    unassigned = [t for t in res.tasks if t.assigned_employee_id is None]
    assert len(unassigned) == 1
    assert unassigned[0].number == 50


@pytest.mark.anyio
async def test_overdue_tasks_real_milestone_due_date_only(db_session):
    """Overdue flag is only set if milestone.due_on exists and is in the past."""
    past_due = (datetime.now(timezone.utc) - timedelta(days=5)).isoformat()
    future_due = (datetime.now(timezone.utc) + timedelta(days=10)).isoformat()
    now_iso = datetime.now(timezone.utc).isoformat()

    mock_issues = [
        # Issue 1: past due milestone, open -> OVERDUE
        {
            "number": 101,
            "title": "Overdue task",
            "state": "open",
            "assignees": [{"login": "marcuschen"}],
            "created_at": now_iso,
            "milestone": {"due_on": past_due},
            "html_url": "https://github.com/org/repo/issues/101",
        },
        # Issue 2: future milestone, open -> NOT OVERDUE
        {
            "number": 102,
            "title": "On track task",
            "state": "open",
            "assignees": [{"login": "marcuschen"}],
            "created_at": now_iso,
            "milestone": {"due_on": future_due},
            "html_url": "https://github.com/org/repo/issues/102",
        },
        # Issue 3: no milestone -> due_date is None, NOT OVERDUE
        {
            "number": 103,
            "title": "No milestone task",
            "state": "open",
            "assignees": [{"login": "marcuschen"}],
            "created_at": now_iso,
            "milestone": None,
            "html_url": "https://github.com/org/repo/issues/103",
        },
    ]

    client = GitHubClient(owner="test-org", repo="test-repo", token="mock-token")
    client.fetch_issues = AsyncMock(return_value=mock_issues)
    client.fetch_pull_requests = AsyncMock(return_value=[])

    res = await fetch_and_calculate_github_progress(db=db_session, client=client, employee_id=2)

    marcus = next(e for e in res.employee_progress if e.employee_id == 2)
    assert marcus.assigned_tasks == 3
    assert marcus.overdue_tasks == 1

    t101 = next(t for t in res.tasks if t.number == 101)
    assert t101.is_overdue is True
    assert t101.due_date is not None

    t103 = next(t for t in res.tasks if t.number == 103)
    assert t103.is_overdue is False
    assert t103.due_date is None


def test_github_api_client_error_handling():
    """Verify HTTP error classification in GitHubClient."""
    client = GitHubClient(owner="test", repo="repo", token="fake")

    # 401 Unauthorized
    resp_401 = httpx.Response(401, headers={})
    with pytest.raises(GitHubAPIError) as exc_401:
        client._check_response_status(resp_401)
    assert exc_401.value.status_code == 401
    assert "Invalid or expired" in exc_401.value.message

    # 403 Rate Limit
    resp_403_rate = httpx.Response(403, headers={"x-ratelimit-remaining": "0", "x-ratelimit-reset": "1700000000"})
    with pytest.raises(GitHubAPIError) as exc_403:
        client._check_response_status(resp_403_rate)
    assert exc_403.value.is_rate_limit is True

    # 404 Not Found
    resp_404 = httpx.Response(404, headers={})
    with pytest.raises(GitHubAPIError) as exc_404:
        client._check_response_status(resp_404)
    assert exc_404.value.status_code == 404


def test_get_github_progress_endpoint_sample_mode(api_client):
    """GET /api/github/progress returns 200 with structured data and is_sample flag."""
    resp = api_client.get("/api/github/progress")
    assert resp.status_code == 200
    data = resp.json()

    assert "connection_status" in data
    assert "team_summary" in data
    assert "employee_progress" in data
    assert "tasks" in data

    # Verify summary invariants
    summary = data["team_summary"]
    assert summary["total_eligible_tasks"] >= 0
    assert summary["total_completed_tasks"] >= 0
    assert 0.0 <= summary["overall_task_progress_pct"] <= 100.0

    # Verify tasks have required fields and direct html links
    for task in data["tasks"]:
        assert "html_url" in task
        assert task["html_url"].startswith("http")
        assert task["type"] in ("issue", "pull_request")


def test_get_github_progress_endpoint_filters(api_client):
    """Test employee_id query parameter filters results."""
    resp = api_client.get("/api/github/progress?employee_id=1")
    assert resp.status_code == 200
    data = resp.json()

    assert len(data["employee_progress"]) == 1
    assert data["employee_progress"][0]["employee_id"] == 1
    assert data["employee_progress"][0]["employee_name"] == "Priya Sharma"

    # All returned tasks must belong to Priya
    for task in data["tasks"]:
        assert task["assigned_employee_id"] == 1
