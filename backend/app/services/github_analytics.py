"""GitHub Analytics service for TeamSync.

Calculates:
- Explicit mapping of GitHub usernames to employees
- Eligible tasks vs. completed tasks with linked issue/PR deduplication
- Separation of Task completion, PR throughput, and Code review activity
- Real due dates extracted strictly from milestone timestamps (never fabricated)
- Deterministic, high-fidelity sample telemetry when credentials are unconfigured
"""

from datetime import datetime, timezone, date
import json
import os
import re
from typing import Any
from sqlalchemy.orm import Session

from app.config import DEFAULT_GITHUB_EMPLOYEE_MAP
from app.models import Employee
from app.schemas import (
    GitHubConnectionStatus,
    GitHubEmployeeProgress,
    GitHubProgressResponse,
    GitHubTaskItem,
    GitHubTeamSummary,
)
from app.services.github_client import GitHubAPIError, GitHubClient

LINKED_ISSUE_REGEX = re.compile(
    r"(?:fix|fixes|fixed|close|closes|closed|resolve|resolves|resolved)\s+#(\d+)",
    re.IGNORECASE,
)


def get_employee_mapping(db: Session) -> tuple[dict[str, int], dict[int, str]]:
    """Build bidirectional mapping between GitHub usernames (lowercase) and employee IDs."""
    github_to_id: dict[str, int] = {}
    id_to_github: dict[int, str] = {}

    # 1. Base from default config
    for handle, emp_id in DEFAULT_GITHUB_EMPLOYEE_MAP.items():
        clean_handle = handle.lower().strip()
        github_to_id[clean_handle] = emp_id
        id_to_github[emp_id] = clean_handle

    # 2. Override from environment variable if present (JSON string)
    env_map = os.getenv("GITHUB_EMPLOYEE_MAPPINGS")
    if env_map:
        try:
            parsed = json.loads(env_map)
            for handle, emp_id in parsed.items():
                clean_handle = str(handle).lower().strip()
                eid = int(emp_id)
                github_to_id[clean_handle] = eid
                id_to_github[eid] = clean_handle
        except (json.JSONDecodeError, ValueError):
            pass

    # 3. Check database employee attributes if column exists
    try:
        employees = db.query(Employee).filter(Employee.active == True).all()  # noqa: E712
        for emp in employees:
            if hasattr(emp, "github_username") and emp.github_username:
                clean_handle = emp.github_username.lower().strip()
                github_to_id[clean_handle] = emp.id
                id_to_github[emp.id] = clean_handle
    except Exception:
        pass

    return github_to_id, id_to_github


def parse_iso_datetime(dt_str: str | None) -> datetime | None:
    if not dt_str:
        return None
    try:
        # Normalize trailing Z
        clean = dt_str.replace("Z", "+00:00")
        return datetime.fromisoformat(clean)
    except Exception:
        return None


def extract_linked_issues_from_text(text: str | None) -> list[int]:
    if not text:
        return []
    matches = LINKED_ISSUE_REGEX.findall(text)
    return [int(m) for m in matches]


async def fetch_and_calculate_github_progress(
    db: Session,
    client: GitHubClient,
    start_date: str | None = None,
    end_date: str | None = None,
    employee_id: int | None = None,
) -> GitHubProgressResponse:
    """Fetch live GitHub data or fall back to sample dataset, calculating progress metrics."""
    now_utc = datetime.now(timezone.utc)
    github_to_id, id_to_github = get_employee_mapping(db)

    active_employees = (
        db.query(Employee)
        .filter(Employee.active == True)  # noqa: E712
        .order_by(Employee.name)
        .all()
    )
    emp_by_id = {e.id: e for e in active_employees}
    departments = sorted({e.department for e in active_employees})

    # If client is not configured, generate clean sample data with transparent notification
    if not client.is_configured:
        return _generate_sample_progress(
            active_employees=active_employees,
            id_to_github=id_to_github,
            owner=client.owner or "teamsync-org",
            repo=client.repo or "teamsync-workforce-core",
            message="GitHub credentials (GITHUB_OWNER, GITHUB_REPO) are not configured. Displaying development sample analytics.",
            start_date=start_date,
            end_date=end_date,
            filter_employee_id=employee_id,
            departments=departments,
        )

    try:
        raw_issues = await client.fetch_issues(state="all", max_pages=3)
        raw_prs = await client.fetch_pull_requests(state="all", max_pages=3)
    except GitHubAPIError as err:
        return _generate_sample_progress(
            active_employees=active_employees,
            id_to_github=id_to_github,
            owner=client.owner,
            repo=client.repo,
            message=f"GitHub API Error: {err.message}. Operating in development sample fallback mode.",
            start_date=start_date,
            end_date=end_date,
            filter_employee_id=employee_id,
            departments=departments,
            is_error=True,
        )

    # Process live data
    return _process_raw_github_data(
        raw_issues=raw_issues,
        raw_prs=raw_prs,
        active_employees=active_employees,
        emp_by_id=emp_by_id,
        github_to_id=github_to_id,
        id_to_github=id_to_github,
        owner=client.owner,
        repo=client.repo,
        start_date=start_date,
        end_date=end_date,
        filter_employee_id=employee_id,
        departments=departments,
        now_utc=now_utc,
    )


def _process_raw_github_data(
    raw_issues: list[dict[str, Any]],
    raw_prs: list[dict[str, Any]],
    active_employees: list[Employee],
    emp_by_id: dict[int, Employee],
    github_to_id: dict[str, int],
    id_to_github: dict[int, str],
    owner: str,
    repo: str,
    start_date: str | None,
    end_date: str | None,
    filter_employee_id: int | None,
    departments: list[str],
    now_utc: datetime,
) -> GitHubProgressResponse:
    # 1. Parse date filter bounds
    start_dt = parse_iso_datetime(f"{start_date}T00:00:00+00:00") if start_date else None
    end_dt = parse_iso_datetime(f"{end_date}T23:59:59+00:00") if end_date else None

    # 2. Build PR mapping and identify linked issues
    # issue_number -> list of PR dicts
    linked_prs_by_issue: dict[int, list[dict[str, Any]]] = {}
    pr_items_processed: list[dict[str, Any]] = []

    for pr in raw_prs:
        pr_number = pr.get("number")
        pr_body = pr.get("body") or ""
        pr_title = pr.get("title") or ""
        linked_issues = extract_linked_issues_from_text(f"{pr_title} {pr_body}")
        pr["_linked_issues"] = linked_issues
        pr_items_processed.append(pr)

        for issue_num in linked_issues:
            linked_prs_by_issue.setdefault(issue_num, []).append(pr)

    # 3. Process issues into tasks (Primary task unit)
    task_items: list[GitHubTaskItem] = []
    issue_numbers_seen: set[int] = set()

    for issue in raw_issues:
        num = issue.get("number")
        if num in issue_numbers_seen:
            continue
        issue_numbers_seen.add(num)

        created_at_dt = parse_iso_datetime(issue.get("created_at"))
        closed_at_dt = parse_iso_datetime(issue.get("closed_at"))

        # Date filtering
        if start_dt and created_at_dt and created_at_dt < start_dt:
            continue
        if end_dt and created_at_dt and created_at_dt > end_dt:
            continue

        # Extract assignees
        assignees = [a.get("login", "").lower() for a in issue.get("assignees", []) if a.get("login")]
        if not assignees and issue.get("assignee"):
            assignees = [issue["assignee"].get("login", "").lower()]

        # Map to employee
        assigned_emp_id = None
        assigned_emp_name = None
        for a in assignees:
            if a in github_to_id:
                assigned_emp_id = github_to_id[a]
                if assigned_emp_id in emp_by_id:
                    assigned_emp_name = emp_by_id[assigned_emp_id].name
                    break

        # Check due date from milestone (Real due dates only!)
        milestone = issue.get("milestone")
        due_date_str = None
        is_overdue = False
        if milestone and milestone.get("due_on"):
            due_dt = parse_iso_datetime(milestone.get("due_on"))
            if due_dt:
                due_date_str = due_dt.strftime("%Y-%m-%d")
                if issue.get("state") == "open" and due_dt < now_utc:
                    is_overdue = True

        # Check linked PR
        linked_prs = linked_prs_by_issue.get(num, [])
        linked_pr_url = linked_prs[0].get("html_url") if linked_prs else None

        # Determine task state: If issue closed or linked PR merged, accepted completed
        raw_state = issue.get("state", "open")
        is_closed = raw_state == "closed" or any(p.get("merged_at") for p in linked_prs)

        task_items.append(
            GitHubTaskItem(
                id=f"ISSUE-{num}",
                number=num,
                title=issue.get("title", ""),
                type="issue",
                state="closed" if is_closed else "open",
                assigned_employee_id=assigned_emp_id,
                assigned_employee_name=assigned_emp_name,
                github_assignees=assignees,
                author=issue.get("user", {}).get("login", "unknown"),
                created_at=issue.get("created_at", ""),
                closed_at=issue.get("closed_at"),
                due_date=due_date_str,
                is_overdue=is_overdue,
                html_url=issue.get("html_url", ""),
                linked_pr_url=linked_pr_url,
                linked_issue_number=None,
            )
        )

    # 4. Handle standalone PRs (PRs not linked to any issue) as standalone tasks
    for pr in pr_items_processed:
        linked = pr.get("_linked_issues", [])
        if linked:
            # Already accounted for in the primary issue task - DO NOT double count!
            continue

        pr_num = pr.get("number")
        created_at_dt = parse_iso_datetime(pr.get("created_at"))
        if start_dt and created_at_dt and created_at_dt < start_dt:
            continue
        if end_dt and created_at_dt and created_at_dt > end_dt:
            continue

        assignees = [a.get("login", "").lower() for a in pr.get("assignees", []) if a.get("login")]
        if not assignees and pr.get("user"):
            assignees = [pr["user"].get("login", "").lower()]

        assigned_emp_id = None
        assigned_emp_name = None
        for a in assignees:
            if a in github_to_id:
                assigned_emp_id = github_to_id[a]
                if assigned_emp_id in emp_by_id:
                    assigned_emp_name = emp_by_id[assigned_emp_id].name
                    break

        is_merged = bool(pr.get("merged_at"))
        is_closed = pr.get("state") == "closed" or is_merged

        task_items.append(
            GitHubTaskItem(
                id=f"PR-{pr_num}",
                number=pr_num,
                title=pr.get("title", ""),
                type="pull_request",
                state="merged" if is_merged else ("closed" if is_closed else "open"),
                assigned_employee_id=assigned_emp_id,
                assigned_employee_name=assigned_emp_name,
                github_assignees=assignees,
                author=pr.get("user", {}).get("login", "unknown"),
                created_at=pr.get("created_at", ""),
                closed_at=pr.get("closed_at"),
                due_date=None,  # PRs without milestones have no fabricated due dates
                is_overdue=False,
                html_url=pr.get("html_url", ""),
                linked_pr_url=None,
                linked_issue_number=None,
            )
        )

    # 5. Calculate per-employee metrics
    employee_metrics: list[GitHubEmployeeProgress] = []

    # Map PR activity
    pr_by_author: dict[str, list[dict[str, Any]]] = {}
    reviews_requested_by_user: dict[str, int] = {}
    for pr in raw_prs:
        author = (pr.get("user", {}).get("login") or "").lower()
        if author:
            pr_by_author.setdefault(author, []).append(pr)
        for req in pr.get("requested_reviewers", []):
            rev_handle = req.get("login", "").lower()
            if rev_handle:
                reviews_requested_by_user[rev_handle] = reviews_requested_by_user.get(rev_handle, 0) + 1

    # Task activity by employee
    tasks_by_emp_id: dict[int, list[GitHubTaskItem]] = {}
    for t in task_items:
        if t.assigned_employee_id:
            tasks_by_emp_id.setdefault(t.assigned_employee_id, []).append(t)

    for emp in active_employees:
        handle = id_to_github.get(emp.id)
        emp_tasks = tasks_by_emp_id.get(emp.id, [])

        assigned_count = len(emp_tasks)
        completed_count = sum(1 for t in emp_tasks if t.state in ("closed", "merged"))
        open_count = assigned_count - completed_count
        overdue_count = sum(1 for t in emp_tasks if t.is_overdue)
        progress_pct = round((completed_count / assigned_count * 100), 1) if assigned_count > 0 else 0.0

        # PR stats
        authored_prs = pr_by_author.get(handle, []) if handle else []
        prs_opened = len(authored_prs)
        prs_merged = sum(1 for p in authored_prs if p.get("merged_at"))
        prs_open = sum(1 for p in authored_prs if p.get("state") == "open")
        pr_merge_rate = round((prs_merged / prs_opened * 100), 1) if prs_opened > 0 else 0.0

        # Review stats
        reviews_req = reviews_requested_by_user.get(handle, 0) if handle else 0
        reviews_comp = sum(
            1 for p in raw_prs if handle and any(
                a.get("login", "").lower() == handle for a in p.get("assignees", [])
            ) and p.get("merged_at")
        )

        employee_metrics.append(
            GitHubEmployeeProgress(
                employee_id=emp.id,
                employee_name=emp.name,
                job_title=emp.job_title,
                department=emp.department,
                github_username=handle,
                assigned_tasks=assigned_count,
                completed_tasks=completed_count,
                open_tasks=open_count,
                overdue_tasks=overdue_count,
                task_progress_pct=progress_pct,
                prs_opened=prs_opened,
                prs_merged=prs_merged,
                prs_open=prs_open,
                pr_merge_rate_pct=pr_merge_rate,
                reviews_requested=reviews_req,
                reviews_completed=reviews_comp,
                recent_tasks=emp_tasks[:8],
            )
        )

    # Filter by employee_id if requested
    filtered_emp_metrics = employee_metrics
    filtered_tasks = task_items
    if filter_employee_id is not None:
        filtered_emp_metrics = [m for m in employee_metrics if m.employee_id == filter_employee_id]
        filtered_tasks = [t for t in task_items if t.assigned_employee_id == filter_employee_id]

    # Team summary
    total_eligible = sum(m.assigned_tasks for m in employee_metrics)
    total_completed = sum(m.completed_tasks for m in employee_metrics)
    overall_progress = round((total_completed / total_eligible * 100), 1) if total_eligible > 0 else 0.0
    total_prs_op = sum(m.prs_opened for m in employee_metrics)
    total_prs_mg = sum(m.prs_merged for m in employee_metrics)
    total_rev_comp = sum(m.reviews_completed for m in employee_metrics)
    total_overdue = sum(m.overdue_tasks for m in employee_metrics)
    active_contributors = sum(1 for m in employee_metrics if m.assigned_tasks > 0 or m.prs_opened > 0)

    team_summary = GitHubTeamSummary(
        total_eligible_tasks=total_eligible,
        total_completed_tasks=total_completed,
        overall_task_progress_pct=overall_progress,
        total_prs_opened=total_prs_op,
        total_prs_merged=total_prs_mg,
        total_reviews_completed=total_rev_comp,
        overdue_tasks_count=total_overdue,
        active_contributors_count=active_contributors,
    )

    connection_status = GitHubConnectionStatus(
        is_connected=True,
        configured=True,
        owner=owner,
        repo=repo,
        rate_limit_remaining=None,
        rate_limit_reset=None,
        last_sync=now_utc.isoformat(),
        error_message=None,
        is_sample=False,
    )

    return GitHubProgressResponse(
        connection_status=connection_status,
        team_summary=team_summary,
        employee_progress=filtered_emp_metrics,
        tasks=filtered_tasks,
        departments=departments,
    )


def _generate_sample_progress(
    active_employees: list[Employee],
    id_to_github: dict[int, str],
    owner: str,
    repo: str,
    message: str,
    start_date: str | None = None,
    end_date: str | None = None,
    filter_employee_id: int | None = None,
    departments: list[str] | None = None,
    is_error: bool = False,
) -> GitHubProgressResponse:
    """Deterministic sample telemetry calibrated to existing CrewIQ employees and initiatives."""
    now_utc = datetime.now(timezone.utc)
    today = date.today()

    sample_tasks_seed = [
        (101, "Implement PyTorch model pipeline for predictive workload engine", 1, "priyasharma-dev", "closed", -14, -2, -1, "issue", 201),
        (102, "Optimize real-time inference latency under peak API load", 1, "priyasharma-dev", "closed", -10, -1, None, "issue", 202),
        (103, "Feature store schema integration with SQLite cache layer", 1, "priyasharma-dev", "open", -5, None, 10, "issue", None),
        (104, "Tune hyperparameters for greedy team builder heuristic", 1, "priyasharma-dev", "open", -3, None, -1, "issue", None), # Overdue

        (105, "FastAPI endpoint routing and Pydantic v2 serialization", 2, "marcuschen", "closed", -18, -4, -3, "issue", 203),
        (106, "Implement database connection pooling and SQLite locks", 2, "marcuschen", "closed", -12, -2, -2, "issue", 204),
        (107, "Workload reallocation safety bounds constraint validator", 2, "marcuschen", "open", -6, None, 8, "issue", None),
        (108, "Structured activity logging with atomic transactions", 2, "marcuschen", "open", -4, None, 14, "issue", None),

        (109, "Terraform infrastructure provisioning for cloud deployment", 3, "erodriguez-cloud", "closed", -20, -5, -4, "issue", 205),
        (110, "Kubernetes helm chart templates and autoscaling policy", 3, "erodriguez-cloud", "closed", -15, -3, -2, "issue", 206),
        (111, "Multi-region fallback routing and latency telemetry", 3, "erodriguez-cloud", "open", -8, None, -2, "issue", None), # Overdue
        (112, "Production container hardening and non-root execution", 3, "erodriguez-cloud", "open", -4, None, 20, "issue", None),

        (113, "Data ingestion pipeline for cross-initiative metrics", 4, "jokonkwo", "closed", -16, -6, -5, "issue", 207),
        (114, "SQL schema views for department capacity aggregation", 4, "jokonkwo", "closed", -11, -3, -1, "issue", 208),
        (115, "Automated data drift detection tests for tabular models", 4, "jokonkwo", "open", -5, None, 12, "issue", None),

        (116, "Refactor Recharts workforce utilization responsive wrapper", 5, "sarahmitchell-fe", "closed", -15, -4, -2, "issue", 209),
        (117, "Implement dark mode theme tokens in Tailwind CSS", 5, "sarahmitchell-fe", "closed", -10, -2, -1, "issue", 210),
        (118, "Accessibility WCAG audit for employee directory modal", 5, "sarahmitchell-fe", "open", -4, None, 9, "issue", None),
        (119, "Smart Team Builder interactive suitability radar view", 5, "sarahmitchell-fe", "open", -2, None, -3, "issue", None), # Overdue

        (120, "Full-stack integration for workload reallocation modal", 6, "davidkim-fs", "closed", -14, -3, -2, "issue", 211),
        (121, "Axios client request interceptor with JWT renewal logic", 6, "davidkim-fs", "closed", -8, -1, -1, "issue", 212),
        (122, "Optimistic UI state updates for initiative assignment", 6, "davidkim-fs", "open", -3, None, 6, "issue", None),

        (123, "Vulnerability audit on third-party backend dependencies", 7, "amirahassan-sec", "closed", -12, -4, -3, "issue", 213),
        (124, "Enforce strict Content Security Policy headers across Vite", 7, "amirahassan-sec", "closed", -7, -2, -1, "issue", 214),
        (125, "Rate limiting and token bucket protection on API endpoints", 7, "amirahassan-sec", "open", -3, None, 15, "issue", None),

        (126, "Unit tests for skill gap proficiency delta calculations", 8, "tombecker-dev", "closed", -9, -2, -1, "issue", 215),
        (127, "Mock data fixture generator for team building test suite", 8, "tombecker-dev", "open", -4, None, 7, "issue", None),

        (128, "Product requirements spec for workforce intelligence v2", 9, "lisanguyen-pm", "closed", -21, -8, -7, "issue", 216),
        (129, "Milestone tracking and sprint capacity forecasting", 9, "lisanguyen-pm", "closed", -13, -3, -2, "issue", 217),
        (130, "User journey mapping for skill gap training advisor", 9, "lisanguyen-pm", "open", -4, None, 18, "issue", None),

        (131, "GitHub Actions CI pipeline for automated pytest and lint", 10, "ryan-obrien-ops", "closed", -16, -5, -4, "issue", 218),
        (132, "Docker Compose multi-stage build cache optimization", 10, "ryan-obrien-ops", "closed", -9, -1, -1, "issue", 219),
        (133, "Automated vulnerability container scanning on merge", 10, "ryan-obrien-ops", "open", -3, None, 5, "issue", None),

        (134, "Literature review on team complementarity algorithms", 11, "ninapatel-ml", "closed", -14, -4, -3, "issue", 220),
        (135, "Prototype collaborative filtering for talent suggestion", 11, "ninapatel-ml", "open", -6, None, 11, "issue", None),

        (136, "End-to-end Cypress tests for employee creation flow", 12, "chriswalton-qa", "closed", -11, -3, -2, "issue", 221),
        (137, "Regression test suite for risk prediction thresholds", 12, "chriswalton-qa", "closed", -6, -1, -1, "issue", 222),
        (138, "Load testing API under concurrent team recommendation calls", 12, "chriswalton-qa", "open", -2, None, 8, "issue", None),

        (139, "Database index optimization on assignments and projects", 13, "fatima-alsayed-db", "closed", -15, -4, -3, "issue", 223),
        (140, "SQLite WAL mode benchmarking and crash recovery test", 13, "fatima-alsayed-db", "closed", -8, -2, -1, "issue", 224),
        (141, "Automated database backup retention rotation script", 13, "fatima-alsayed-db", "open", -3, None, 14, "issue", None),

        (142, "Architecture blueprint for distributed task execution", 14, "kevinbrooks-sa", "closed", -19, -6, -5, "issue", 225),
        (143, "System resilience review and failure mode analysis", 14, "kevinbrooks-sa", "closed", -10, -2, -1, "issue", 226),
        (144, "API contract specification for enterprise SSO integration", 14, "kevinbrooks-sa", "open", -4, None, -1, "issue", None), # Overdue

        (145, "ETL pipeline for historical project completion telemetry", 15, "mayajohnson-data", "closed", -13, -3, -2, "issue", 227),
        (146, "Parquet storage partitioning for analytics warehouse", 15, "mayajohnson-data", "open", -5, None, 10, "issue", None),

        (147, "Documentation for local PowerShell environment setup", 16, "olivergrant-dev", "closed", -8, -1, -1, "issue", 228),
        (148, "CSS styling polish for empty and loading skeleton states", 16, "olivergrant-dev", "open", -2, None, 6, "issue", None),
    ]

    all_tasks: list[GitHubTaskItem] = []
    emp_tasks_map: dict[int, list[GitHubTaskItem]] = {}
    emp_by_id = {e.id: e for e in active_employees}

    for num, title, eid, handle, state, c_offset, cl_offset, due_offset, item_type, pr_num in sample_tasks_seed:
        c_date = (today + datetime.fromtimestamp(0).date().resolution * c_offset).isoformat()
        cl_date = (today + datetime.fromtimestamp(0).date().resolution * cl_offset).isoformat() if cl_offset else None
        due_date = (today + datetime.fromtimestamp(0).date().resolution * due_offset).isoformat() if due_offset else None

        is_overdue = False
        if due_offset and due_offset < 0 and state == "open":
            is_overdue = True

        emp_obj = emp_by_id.get(eid)
        emp_name = emp_obj.name if emp_obj else None

        item = GitHubTaskItem(
            id=f"ISSUE-{num}",
            number=num,
            title=title,
            type=item_type,
            state=state,
            assigned_employee_id=eid,
            assigned_employee_name=emp_name,
            github_assignees=[handle],
            author=handle,
            created_at=f"{c_date}T10:00:00Z",
            closed_at=f"{cl_date}T18:00:00Z" if cl_date else None,
            due_date=due_date,
            is_overdue=is_overdue,
            html_url=f"https://github.com/{owner}/{repo}/issues/{num}",
            linked_pr_url=f"https://github.com/{owner}/{repo}/pull/{pr_num}" if pr_num else None,
            linked_issue_number=None,
        )
        all_tasks.append(item)
        emp_tasks_map.setdefault(eid, []).append(item)

    # Compile employee records
    employee_metrics: list[GitHubEmployeeProgress] = []
    for emp in active_employees:
        tasks = emp_tasks_map.get(emp.id, [])
        assigned = len(tasks)
        completed = sum(1 for t in tasks if t.state in ("closed", "merged"))
        open_count = assigned - completed
        overdue_count = sum(1 for t in tasks if t.is_overdue)
        progress = round((completed / assigned * 100), 1) if assigned > 0 else 0.0

        # Deterministic PR & review metrics matching the tasks
        prs_opened = completed + (1 if open_count > 0 else 0)
        prs_merged = completed
        prs_open = max(0, prs_opened - prs_merged)
        pr_merge_rate = round((prs_merged / prs_opened * 100), 1) if prs_opened > 0 else 0.0

        reviews_req = max(1, assigned + 1)
        reviews_comp = max(0, assigned - 1)

        employee_metrics.append(
            GitHubEmployeeProgress(
                employee_id=emp.id,
                employee_name=emp.name,
                job_title=emp.job_title,
                department=emp.department,
                github_username=id_to_github.get(emp.id),
                assigned_tasks=assigned,
                completed_tasks=completed,
                open_tasks=open_count,
                overdue_tasks=overdue_count,
                task_progress_pct=progress,
                prs_opened=prs_opened,
                prs_merged=prs_merged,
                prs_open=prs_open,
                pr_merge_rate_pct=pr_merge_rate,
                reviews_requested=reviews_req,
                reviews_completed=reviews_comp,
                recent_tasks=tasks,
            )
        )

    # Filter
    filtered_emp = employee_metrics
    filtered_tasks = all_tasks
    if filter_employee_id is not None:
        filtered_emp = [m for m in employee_metrics if m.employee_id == filter_employee_id]
        filtered_tasks = [t for t in all_tasks if t.assigned_employee_id == filter_employee_id]

    tot_tasks = sum(m.assigned_tasks for m in employee_metrics)
    tot_comp = sum(m.completed_tasks for m in employee_metrics)
    tot_progress = round((tot_comp / tot_tasks * 100), 1) if tot_tasks > 0 else 0.0

    summary = GitHubTeamSummary(
        total_eligible_tasks=tot_tasks,
        total_completed_tasks=tot_comp,
        overall_task_progress_pct=tot_progress,
        total_prs_opened=sum(m.prs_opened for m in employee_metrics),
        total_prs_merged=sum(m.prs_merged for m in employee_metrics),
        total_reviews_completed=sum(m.reviews_completed for m in employee_metrics),
        overdue_tasks_count=sum(m.overdue_tasks for m in employee_metrics),
        active_contributors_count=len([m for m in employee_metrics if m.assigned_tasks > 0]),
    )

    status = GitHubConnectionStatus(
        is_connected=False,
        configured=False,
        owner=owner,
        repo=repo,
        rate_limit_remaining=None,
        rate_limit_reset=None,
        last_sync=now_utc.isoformat(),
        error_message=message if is_error else None,
        is_sample=True,
    )

    return GitHubProgressResponse(
        connection_status=status,
        team_summary=summary,
        employee_progress=filtered_emp,
        tasks=filtered_tasks,
        departments=departments or sorted({e.department for e in active_employees}),
    )
