from typing import List
from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.services.comparison_service import ComparisonService

router = APIRouter(tags=["comparisons"])


class ComparisonRequest(BaseModel):
    run_ids: List[str]
    workspace_id: str


class SensitivityRequest(BaseModel):
    scenario_id: str
    workspace_id: str
    vary_param: str
    values: List[float]


@router.post("/comparisons")
async def compare_runs(
    body: ComparisonRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    svc = ComparisonService(db)
    return await svc.compare_runs(body.run_ids, body.workspace_id)


@router.post("/sensitivity")
async def run_sensitivity(
    body: SensitivityRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    svc = ComparisonService(db)
    return await svc.run_sensitivity(
        scenario_id=body.scenario_id,
        workspace_id=body.workspace_id,
        vary_param=body.vary_param,
        values=body.values,
    )
