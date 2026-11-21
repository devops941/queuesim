from __future__ import annotations
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field


class RunCreateRequest(BaseModel):
    scenario_id: Optional[str] = None
    replications: Optional[int] = Field(None, ge=1, le=1000)
    seed: Optional[int] = Field(None, ge=0)


class RunResponse(BaseModel):
    id: str
    workspace_id: str
    scenario_id: str
    status: str
    progress: int
    metrics: dict
    error_summary: Optional[str] = None
    created_at: str
    completed_at: Optional[str] = None


class RunListResponse(BaseModel):
    data: list[RunResponse]
    meta: dict
