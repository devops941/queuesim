from fastapi import APIRouter, Depends, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.schemas.run_schemas import RunCreateRequest
from app.services.run_service import RunService

router = APIRouter(tags=["runs"])


def _ws_id(workspace_id: str | None, current_user: dict) -> str:
    if workspace_id:
        return workspace_id
    if current_user.get("workspaces"):
        return str(current_user["workspaces"][0])
    return str(current_user.get("workspace_id") or "000000000000000000000002")


@router.post("/scenarios/{scenario_id}/runs", status_code=status.HTTP_202_ACCEPTED)
async def create_run(
    scenario_id: str,
    workspace_id: str | None = Query(None),
    body: RunCreateRequest | None = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    ws_id = _ws_id(workspace_id, current_user)
    svc = RunService(db)
    replications_override = body.replications if body else None
    seed_override = body.seed if body else None
    return await svc.create_run(
        workspace_id=ws_id,
        user_id=str(current_user["_id"]),
        scenario_id=scenario_id,
        replications_override=replications_override,
        seed_override=seed_override,
    )


@router.get("/runs/{run_id}")
async def get_run(
    run_id: str,
    workspace_id: str | None = Query(None),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    ws_id = _ws_id(workspace_id, current_user)
    svc = RunService(db)
    return await svc.get_run(run_id, ws_id)


@router.get("/runs/{run_id}/metrics")
async def get_run_metrics(
    run_id: str,
    workspace_id: str | None = Query(None),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    ws_id = _ws_id(workspace_id, current_user)
    svc = RunService(db)
    return await svc.get_run_metrics(run_id, ws_id)


@router.get("/runs/{run_id}/events")
async def get_run_events(
    run_id: str,
    workspace_id: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    ws_id = _ws_id(workspace_id, current_user)
    # Verify run ownership first
    svc = RunService(db)
    await svc.get_run(run_id, ws_id)
    # Fetch customer events from DB
    cursor = db.customer_events.find({"run_id": run_id}).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)
    total = await db.customer_events.count_documents({"run_id": run_id})
    for d in docs:
        d["id"] = str(d["_id"])
        del d["_id"]
    return {"data": docs, "meta": {"total": total, "skip": skip, "limit": limit}}


@router.post("/runs/{run_id}/cancel")
async def cancel_run(
    run_id: str,
    workspace_id: str | None = Query(None),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    ws_id = _ws_id(workspace_id, current_user)
    svc = RunService(db)
    return await svc.cancel_run(run_id, ws_id)


@router.get("/runs")
async def list_workspace_runs(
    workspace_id: str | None = Query(None),
    status: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    ws_id = _ws_id(workspace_id, current_user)
    svc = RunService(db)
    return await svc.list_workspace_runs(ws_id, status=status, skip=skip, limit=limit)


@router.get("/scenarios/{scenario_id}/runs")
async def list_runs(
    scenario_id: str,
    workspace_id: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    ws_id = _ws_id(workspace_id, current_user)
    svc = RunService(db)
    return await svc.list_runs(scenario_id, ws_id, skip, limit)


@router.get("/runs/{run_id}/replications")
async def get_replication_results(
    run_id: str,
    workspace_id: str | None = Query(None),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    ws_id = _ws_id(workspace_id, current_user)
    svc = RunService(db)
    results = await svc.get_replication_results(run_id, ws_id)
    return {"data": results}
    results = await svc.get_replication_results(run_id, workspace_id)
    return {"data": results}
