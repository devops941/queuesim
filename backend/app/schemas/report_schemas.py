from __future__ import annotations
from typing import Literal, Optional
from pydantic import BaseModel


class ReportCreateRequest(BaseModel):
    run_id: str
    format: Literal["pdf", "csv"]
    workspace_id: str


class ReportResponse(BaseModel):
    id: str
    run_id: str
    format: str
    status: str
    download_url: Optional[str] = None
    created_at: str
