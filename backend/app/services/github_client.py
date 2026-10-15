"""GitHub REST API client for TeamSync.

Handles:
- Authentication via GITHUB_TOKEN
- Owner/Repo configuration via GITHUB_OWNER / GITHUB_REPO
- Rate limit inspection and propagation
- Pagination for issues and pull requests
- Graceful error handling for 401, 403, 404, network failures, timeouts
- Strict security: NEVER logs or exposes tokens
"""

import os
import re
from typing import Any
import httpx


class GitHubAPIError(Exception):
    """Custom exception for GitHub API errors with safe user-facing message."""

    def __init__(self, message: str, status_code: int | None = None, is_rate_limit: bool = False):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.is_rate_limit = is_rate_limit


class GitHubClient:
    """Backend-only GitHub API client."""

    BASE_URL = "https://api.github.com"

    def __init__(
        self,
        owner: str | None = None,
        repo: str | None = None,
        token: str | None = None,
        timeout: float = 12.0,
    ):
        self.owner = (owner or os.getenv("GITHUB_OWNER", "")).strip()
        self.repo = (repo or os.getenv("GITHUB_REPO", "")).strip()
        self.token = (token or os.getenv("GITHUB_TOKEN", "")).strip()
        self.timeout = timeout

    @property
    def is_configured(self) -> bool:
        """Check if all required configuration parameters are present."""
        return bool(self.owner and self.repo)

    def _get_headers(self) -> dict[str, str]:
        headers = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "TeamSync-Workforce-Intelligence/1.0",
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    def _safe_url(self, endpoint: str) -> str:
        return f"{self.BASE_URL}/repos/{self.owner}/{self.repo}/{endpoint.lstrip('/')}"

    async def get_repository_info(self) -> dict[str, Any]:
        """Fetch basic repository metadata and verify connectivity."""
        if not self.is_configured:
            raise GitHubAPIError("GITHUB_OWNER and GITHUB_REPO must be configured.")

        url = f"{self.BASE_URL}/repos/{self.owner}/{self.repo}"
        headers = self._get_headers()

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.get(url, headers=headers)
            except httpx.RequestError as exc:
                raise GitHubAPIError(f"Network error connecting to GitHub: {exc.__class__.__name__}") from exc

            self._check_response_status(response)
            data = response.json()
            return {
                "name": data.get("name"),
                "full_name": data.get("full_name"),
                "private": data.get("private", False),
                "html_url": data.get("html_url"),
                "default_branch": data.get("default_branch"),
                "open_issues_count": data.get("open_issues_count", 0),
            }

    async def fetch_issues(self, state: str = "all", max_pages: int = 3) -> list[dict[str, Any]]:
        """Fetch issues (excluding pull requests returned by the issues endpoint)."""
        raw_items = await self._fetch_paginated("issues", {"state": state, "per_page": 100}, max_pages=max_pages)
        # Filter out pull requests (GitHub issues endpoint includes PRs with a 'pull_request' key)
        issues_only = [item for item in raw_items if "pull_request" not in item]
        return issues_only

    async def fetch_pull_requests(self, state: str = "all", max_pages: int = 3) -> list[dict[str, Any]]:
        """Fetch pull requests with full metadata."""
        return await self._fetch_paginated("pulls", {"state": state, "per_page": 100}, max_pages=max_pages)

    async def _fetch_paginated(
        self, endpoint: str, params: dict[str, Any], max_pages: int = 3
    ) -> list[dict[str, Any]]:
        if not self.is_configured:
            raise GitHubAPIError("GITHUB_OWNER and GITHUB_REPO must be configured.")

        url = self._safe_url(endpoint)
        headers = self._get_headers()
        items: list[dict[str, Any]] = []

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            for page in range(1, max_pages + 1):
                page_params = {**params, "page": page}
                try:
                    response = await client.get(url, headers=headers, params=page_params)
                except httpx.RequestError as exc:
                    raise GitHubAPIError(f"Network error contacting GitHub: {exc.__class__.__name__}") from exc

                self._check_response_status(response)
                page_items = response.json()
                if not isinstance(page_items, list) or not page_items:
                    break

                items.extend(page_items)

                # Check Link header for next page
                link_header = response.headers.get("Link", "")
                if 'rel="next"' not in link_header:
                    break

        return items

    def _check_response_status(self, response: httpx.Response) -> None:
        """Inspect HTTP status and headers for errors, rate limits, and permissions."""
        remaining = response.headers.get("x-ratelimit-remaining")
        reset_time = response.headers.get("x-ratelimit-reset")

        if response.status_code == 401:
            raise GitHubAPIError(
                "Invalid or expired GitHub token. Check GITHUB_TOKEN.",
                status_code=401,
            )
        elif response.status_code == 403:
            if remaining == "0":
                raise GitHubAPIError(
                    f"GitHub API rate limit exceeded. Resets at epoch {reset_time}.",
                    status_code=403,
                    is_rate_limit=True,
                )
            raise GitHubAPIError(
                "Access forbidden. Verify token permissions (read:repo or Issues/Pull Requests read-only).",
                status_code=403,
            )
        elif response.status_code == 404:
            raise GitHubAPIError(
                f"Repository '{self.owner}/{self.repo}' not found or token lacks access.",
                status_code=404,
            )
        elif response.status_code >= 400:
            raise GitHubAPIError(
                f"GitHub API returned error HTTP {response.status_code}.",
                status_code=response.status_code,
            )

    @staticmethod
    def get_rate_limit_info(headers: httpx.Headers | dict[str, str]) -> dict[str, Any]:
        """Extract rate limit remaining and reset metadata safely."""
        return {
            "remaining": (
                int(headers.get("x-ratelimit-remaining"))
                if headers.get("x-ratelimit-remaining") is not None
                else None
            ),
            "reset": headers.get("x-ratelimit-reset"),
        }
