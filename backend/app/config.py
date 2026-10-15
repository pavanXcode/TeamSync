"""Central configuration for matching, risk, and workload algorithms."""

# Employee–project matching weights (must sum to 1.0)
MATCHING_WEIGHTS = {
    "skill_match": 0.50,
    "experience_match": 0.20,
    "availability": 0.20,
    "workload_suitability": 0.10,
}

# Deadline risk weights
RISK_WEIGHTS = {
    "deadline_urgency": 0.30,
    "skill_gaps": 0.30,
    "workload_pressure": 0.25,
    "availability_constraints": 0.15,
}

# Workload utilization thresholds
WORKLOAD_THRESHOLDS = {
    "underutilized_max": 50,
    "balanced_max": 80,
    "high_max": 100,
}

DEFAULT_SKILL_PROFICIENCY_REQUIRED = 3

TRAINING_SUGGESTIONS = {
    "python": "Python fundamentals and practical projects",
    "sql": "SQL querying and database design",
    "cloud": "Cloud fundamentals and deployment",
    "cloud computing": "Cloud fundamentals and deployment",
    "machine learning": "Supervised learning and model evaluation",
    "data analytics": "Data cleaning, visualization, and analysis",
    "react": "Component design and frontend development",
    "testing": "Automated testing and test planning",
    "cybersecurity": "Security fundamentals and threat awareness",
    "javascript": "Modern JavaScript and ES6+ patterns",
    "devops": "CI/CD pipelines and infrastructure automation",
    "docker": "Containerization and orchestration basics",
    "kubernetes": "Kubernetes workloads and deployment",
    "api design": "RESTful API design and documentation",
    "project management": "Agile planning and stakeholder communication",
}

DATABASE_URL = "sqlite:///./crewiq.db"
