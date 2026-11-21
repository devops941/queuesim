from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.schemas.scenario_schemas import ScenarioCreate, ScenarioUpdate
from app.services.scenario_service import ScenarioService

router = APIRouter(prefix="/scenarios", tags=["scenarios"])


class ScenarioSensitivityBody(BaseModel):
    vary_param: str = "servers"
    min_value: float = 1.0
    max_value: float = 6.0
    step: float = 1.0


def _workspace_id(user: dict) -> str:
    workspaces = user.get("workspaces", [])
    if workspaces:
        return str(workspaces[0])
    return str(user.get("workspace_id", ""))


@router.get("/presets")
async def list_presets():
    from app.schemas.scenario_schemas import PRESETS
    return {"data": [{"key": k, "name": k.replace("_"," ").title()} for k in PRESETS]}


@router.get("")
async def list_scenarios(
    workspace_id: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status: str | None = Query(None),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    ws_id = workspace_id or _workspace_id(current_user) or "000000000000000000000002"
    svc = ScenarioService(db)
    return await svc.list_scenarios(ws_id, skip, limit, status)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_scenario(
    body: ScenarioCreate,
    workspace_id: str | None = Query(None),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    ws_id = workspace_id or _workspace_id(current_user) or "000000000000000000000002"
    svc = ScenarioService(db)
    return await svc.create(ws_id, str(current_user["_id"]), body)


@router.get("/{scenario_id}")
async def get_scenario(
    scenario_id: str,
    workspace_id: str | None = Query(None),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    ws_id = workspace_id or _workspace_id(current_user) or "000000000000000000000002"
    svc = ScenarioService(db)
    return await svc.get(scenario_id, ws_id)


@router.patch("/{scenario_id}")
async def update_scenario(
    scenario_id: str,
    body: ScenarioUpdate,
    workspace_id: str | None = Query(None),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    ws_id = workspace_id or _workspace_id(current_user) or "000000000000000000000002"
    svc = ScenarioService(db)
    return await svc.update(scenario_id, ws_id, body)


@router.post("/{scenario_id}/validate")
async def validate_scenario(
    scenario_id: str,
    workspace_id: str | None = Query(None),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    ws_id = workspace_id or _workspace_id(current_user) or "000000000000000000000002"
    svc = ScenarioService(db)
    return await svc.validate(scenario_id, ws_id)


@router.post("/{scenario_id}/duplicate", status_code=status.HTTP_201_CREATED)
async def duplicate_scenario(
    scenario_id: str,
    workspace_id: str | None = Query(None),
    new_name: str = Query(...),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    ws_id = workspace_id or _workspace_id(current_user) or "000000000000000000000002"
    svc = ScenarioService(db)
    return await svc.duplicate(scenario_id, ws_id, new_name)


@router.post("/{scenario_id}/archive")
async def archive_scenario(
    scenario_id: str,
    workspace_id: str | None = Query(None),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    ws_id = workspace_id or _workspace_id(current_user) or "000000000000000000000002"
    svc = ScenarioService(db)
    return await svc.archive(scenario_id, ws_id)


@router.post("/{scenario_id}/sensitivity")
async def scenario_sensitivity(
    scenario_id: str,
    body: ScenarioSensitivityBody,
    workspace_id: str | None = Query(None),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    ws_id = workspace_id or _workspace_id(current_user) or "000000000000000000000002"
    from app.services.comparison_service import ComparisonService
    svc = ComparisonService(db)
    vals = []
    v = body.min_value
    step = body.step if body.step > 0 else 1.0
    while v <= body.max_value + 1e-9:
        vals.append(round(v, 2))
        v += step
    res = await svc.run_sensitivity(
        scenario_id=scenario_id,
        workspace_id=ws_id,
        vary_param=body.vary_param,
        values=vals,
    )
    return {"scenario_id": scenario_id, "vary_param": body.vary_param, "points": res["results"]}


@router.delete("/{scenario_id}", status_code=status.HTTP_200_OK)
async def delete_scenario(
    scenario_id: str,
    workspace_id: str | None = Query(None),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    ws_id = workspace_id or _workspace_id(current_user) or "000000000000000000000002"
    svc = ScenarioService(db)
    return await svc.delete(scenario_id, ws_id)
