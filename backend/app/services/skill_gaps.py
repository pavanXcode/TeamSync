"""Skill gap analysis for project teams."""

from __future__ import annotations

from app.config import DEFAULT_SKILL_PROFICIENCY_REQUIRED, TRAINING_SUGGESTIONS
from app.services.matching import _norm_skill


def training_for_skill(skill: str) -> str:
    key = _norm_skill(skill)
    if key in TRAINING_SUGGESTIONS:
        return TRAINING_SUGGESTIONS[key]
    for k, v in TRAINING_SUGGESTIONS.items():
        if k in key or key in k:
            return v
    return f"Structured learning path for {skill.strip()}"


def analyze_skill_gaps(
    required_skills: list[str],
    team_skills: list[dict[str, int]],
    required_proficiency: int | None = None,
) -> tuple[list[dict], float]:
    req_prof = required_proficiency or DEFAULT_SKILL_PROFICIENCY_REQUIRED
    gaps: list[dict] = []

    if not required_skills:
        return [], 0.0

    covered_count = 0
    for raw in required_skills:
        key = _norm_skill(raw)
        profs: list[int] = []
        for emp in team_skills:
            norm = {_norm_skill(k): v for k, v in emp.items()}
            if key in norm:
                profs.append(norm[key])

        team_count = len(profs)
        highest = max(profs) if profs else 0
        average = sum(profs) / len(profs) if profs else 0.0

        if team_count == 0:
            status = "Missing"
        elif highest < req_prof:
            status = "Partially covered"
        else:
            status = "Covered"
            covered_count += 1

        suggestion = None
        if status != "Covered":
            suggestion = training_for_skill(raw)

        gaps.append(
            {
                "skill": raw,
                "team_count": team_count,
                "highest_proficiency": highest,
                "average_proficiency": round(average, 2),
                "required_proficiency": req_prof,
                "status": status,
                "training_suggestion": suggestion,
            }
        )

    overall = (covered_count / len(required_skills)) * 100.0
    return gaps, round(overall, 1)
