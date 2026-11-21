from __future__ import annotations
from pydantic import BaseModel
from typing import Optional


class ImportResponse(BaseModel):
    id: str
    workspace_id: str
    scenario_id: str
    file_name: str
    row_count: int
    validation_summary: dict
    status: str
    created_at: str


class ImportListResponse(BaseModel):
    data: list[ImportResponse]
    meta: dict
