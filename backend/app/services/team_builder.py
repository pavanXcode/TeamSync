"""Greedy team builder with coverage bonus and workload penalty."""

from __future__ import annotations

from itertools import combinations

from app.services.matching import EmployeeLike, ProjectLike, compute_match, _norm_skill


def _team_coverage(team: list[EmployeeLike], required: list[str]) -> tuple[float, set[str]]:
    if not required:
        return 100.0, set()
    covered: set[str] = set()
    for emp in team:
        for k in emp.skills:
            covered.add(_norm_skill(k))
    req_norm = [_norm_skill(r) for r in required]
    hit = sum(1 for r in req_norm if r in covered)
    return (hit / len(req_norm)) * 100.0, covered


def greedy_select(
    employees: list[EmployeeLike],
    project: ProjectLike,
    team_size: int,
    exclude_ids: set[int] | None = None,
) -> tuple[list[EmployeeLike], list[str], float]:
    exclude_ids = exclude_ids or set()
    eligible = [e for e in employees if e.active and e.id not in exclude_ids]
    required = project.required_skills
    selected: list[EmployeeLike] = []
    covered_skills: set[str] = set()

    def marginal_value(emp: EmployeeLike) -> float:
        base = compute_match(emp, project)["match_score"]
        new_skills = {_norm_skill(k) for k in emp.skills} - covered_skills
        req_set = {_norm_skill(r) for r in required}
        bonus = len(new_skills & req_set) * 8.0
        penalty = max(0.0, emp.workload_percentage - 80) * 0.5
        avail_bonus = emp.availability_percentage * 0.05
        return base + bonus + avail_bonus - penalty

    while len(selected) < team_size and eligible:
        best = None
        best_val = -1.0
        for emp in eligible:
            if emp.id in {s.id for s in selected}:
                continue
            val = marginal_value(emp)
            if val > best_val:
                best_val = val
                best = emp
        if best is None:
            break
        selected.append(best)
        eligible.remove(best)
        for k in best.skills:
            covered_skills.add(_norm_skill(k))

    coverage_pct, _ = _team_coverage(selected, required)
    uncovered = [r for r in required if _norm_skill(r) not in covered_skills]

    # Small teams: try combinations if n choose k is reasonable
    pool = [e for e in employees if e.active and e.id not in exclude_ids]
    if len(pool) <= 12 and team_size <= 6 and len(pool) >= team_size:
        from math import comb

        n_comb = comb(len(pool), team_size)
        if n_comb <= 5000:
            best_team = selected
            best_score = _team_suitability(best_team, project, required)
            for combo in combinations(pool, team_size):
                sc = _team_suitability(list(combo), project, required)
                if sc > best_score:
                    best_score = sc
                    best_team = list(combo)
            selected = best_team
            coverage_pct, covered_skills = _team_coverage(selected, required)
            uncovered = [r for r in required if _norm_skill(r) not in covered_skills]

    suitability = _team_suitability(selected, project, required)
    warnings: list[str] = []
    if uncovered:
        warnings.append(f"Team does not cover: {', '.join(uncovered)}.")
    if len(selected) < team_size:
        warnings.append(
            f"Only {len(selected)} eligible members found; desired size was {team_size}."
        )
    if coverage_pct < 100 and uncovered:
        warnings.append("Team is not perfect — critical skills remain uncovered.")

    return selected, warnings, suitability


def _team_suitability(team: list[EmployeeLike], project: ProjectLike, required: list[str]) -> float:
    if not team:
        return 0.0
    cov_pct, _ = _team_coverage(team, required)
    avg_match = sum(compute_match(e, project)["match_score"] for e in team) / len(team)
    wl_penalty = sum(max(0.0, e.workload_percentage - 85) for e in team) / len(team)
    score = cov_pct * 0.45 + avg_match * 0.45 - wl_penalty * 0.3
    if cov_pct < 100:
        score = min(score, 85.0)
    return max(0.0, min(100.0, round(score, 1)))
