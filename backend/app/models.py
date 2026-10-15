import json
from datetime import datetime, date

from sqlalchemy import (
    String,
    Integer,
    Float,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Employee(Base):
    __tablename__ = "employees"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(180), unique=True, nullable=False)
    job_title: Mapped[str] = mapped_column(String(120), nullable=False)
    department: Mapped[str] = mapped_column(String(80), nullable=False)
    skills_json: Mapped[str] = mapped_column(Text, default="{}")
    experience_years: Mapped[float] = mapped_column(Float, default=0)
    availability_percentage: Mapped[float] = mapped_column(Float, default=100)
    workload_percentage: Mapped[float] = mapped_column(Float, default=0)
    github_username: Mapped[str | None] = mapped_column(String(80), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)

    assignments: Mapped[list["Assignment"]] = relationship(
        "Assignment", back_populates="employee", cascade="all, delete-orphan"
    )

    @property
    def skills(self) -> dict[str, int]:
        try:
            data = json.loads(self.skills_json or "{}")
            return {str(k): int(v) for k, v in data.items()}
        except (json.JSONDecodeError, TypeError, ValueError):
            return {}

    @skills.setter
    def skills(self, value: dict[str, int]) -> None:
        self.skills_json = json.dumps(value or {})


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    required_skills_json: Mapped[str] = mapped_column(Text, default="[]")
    minimum_experience: Mapped[float] = mapped_column(Float, default=0)
    desired_team_size: Mapped[int] = mapped_column(Integer, default=3)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    deadline: Mapped[date | None] = mapped_column(Date, nullable=True)
    estimated_workload: Mapped[float] = mapped_column(Float, default=100)
    priority: Mapped[str] = mapped_column(String(20), default="Medium")
    status: Mapped[str] = mapped_column(String(30), default="Planning")

    assignments: Mapped[list["Assignment"]] = relationship(
        "Assignment", back_populates="project", cascade="all, delete-orphan"
    )

    @property
    def required_skills(self) -> list[str]:
        try:
            data = json.loads(self.required_skills_json or "[]")
            return [str(s) for s in data]
        except (json.JSONDecodeError, TypeError):
            return []

    @required_skills.setter
    def required_skills(self, value: list[str]) -> None:
        self.required_skills_json = json.dumps(value or [])


class Assignment(Base):
    __tablename__ = "assignments"
    __table_args__ = (
        UniqueConstraint("employee_id", "project_id", name="uq_employee_project"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id"), nullable=False)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False)
    assigned_workload: Mapped[float] = mapped_column(Float, default=0)
    role: Mapped[str] = mapped_column(String(80), default="Contributor")
    status: Mapped[str] = mapped_column(String(30), default="Active")

    employee: Mapped["Employee"] = relationship("Employee", back_populates="assignments")
    project: Mapped["Project"] = relationship("Project", back_populates="assignments")


class Activity(Base):
    __tablename__ = "activities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    event_type: Mapped[str] = mapped_column(String(60), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AppMeta(Base):
    """Tracks one-time seed completion."""

    __tablename__ = "app_meta"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[str] = mapped_column(String(255), nullable=False)
