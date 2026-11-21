from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.errors import AppError
from app.repositories.run_repository import RunRepository
from app.repositories.scenario_repository import ScenarioRepository

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _serialize_run(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "scenario_id": doc.get("scenario_id", ""),
        "status": doc.get("status", ""),
        "progress": doc.get("progress", 0),
        "metrics": doc.get("metrics", {}),
        "created_at": doc["created_at"].isoformat() if doc.get("created_at") else None,
        "completed_at": doc["completed_at"].isoformat() if doc.get("completed_at") else None,
    }


def _serialize_scenario(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "name": doc.get("name", ""),
        "status": doc.get("status", ""),
        "updated_at": doc["updated_at"].isoformat() if doc.get("updated_at") else None,
    }


def _ws_id(workspace_id: str | None, current_user: dict) -> str:
    if workspace_id:
        return workspace_id
    if current_user.get("workspaces"):
        return str(current_user["workspaces"][0])
    return str(current_user.get("workspace_id") or "000000000000000000000002")


@router.get("/dashboard")
async def get_dashboard(
    workspace_id: str | None = Query(None),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    ws_id = _ws_id(workspace_id, current_user)
    from app.core.database import MEMORY_STORE
    run_repo = RunRepository(db)
    scenario_repo = ScenarioRepository(db)

    try:
        total_scenarios = await db.scenarios.count_documents({"workspace_id": ws_id})
    except Exception:
        total_scenarios = 0
    if total_scenarios == 0:
        total_scenarios = len([
            s for s in MEMORY_STORE.get("scenarios", {}).values()
            if s and s.get("workspace_id") == ws_id
        ])

    try:
        total_runs = await db.runs.count_documents({"workspace_id": ws_id})
    except Exception:
        total_runs = 0
    if total_runs == 0:
        unique_runs = set()
        for r in MEMORY_STORE.get("runs", {}).values():
            if r and r.get("workspace_id") == ws_id:
                unique_runs.add(str(r.get("_id")))
        total_runs = len(unique_runs)

    recent_runs_docs = await run_repo.list_recent(ws_id, limit=5)
    scenarios_docs, _ = await scenario_repo.list_by_workspace(ws_id, skip=0, limit=5)

    return {
        "total_scenarios": total_scenarios,
        "total_runs": total_runs,
        "recent_runs": [_serialize_run(d) for d in recent_runs_docs],
        "recent_scenarios": [_serialize_scenario(d) for d in scenarios_docs],
    }


@router.get("/compare")
async def compare_runs_analytics(
    run_ids: str = Query(..., description="Comma-separated run IDs"),
    workspace_id: str | None = Query(None),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    ws_id = _ws_id(workspace_id, current_user)
    from app.services.comparison_service import ComparisonService
    ids = [r.strip() for r in run_ids.split(",") if r.strip()]
    svc = ComparisonService(db)
    return await svc.compare_runs(ids, ws_id)


@router.get("/runs/{run_id}/summary")
async def get_run_summary(
    run_id: str,
    workspace_id: str | None = Query(None),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    ws_id = _ws_id(workspace_id, current_user)
    from bson import ObjectId

    try:
        oid = ObjectId(run_id)
    except Exception:
        raise AppError("INVALID_ID", "Invalid run ID format", 400)

    run_doc = await db.runs.find_one({"_id": oid, "workspace_id": workspace_id})
    if not run_doc:
        raise AppError("NOT_FOUND", "Run not found", 404)

    scenario_name = "Unknown"
    if run_doc.get("scenario_id"):
        try:
            scenario = await db.scenarios.find_one({"_id": ObjectId(run_doc["scenario_id"])})
            if scenario:
                scenario_name = scenario.get("name", "Unknown")
        except Exception:
            pass

    return {
        "run_id": run_id,
        "scenario_id": run_doc.get("scenario_id"),
        "scenario_name": scenario_name,
        "status": run_doc.get("status"),
        "progress": run_doc.get("progress", 0),
        "engine_version": run_doc.get("engine_version"),
        "seed": run_doc.get("seed"),
        "config_snapshot": run_doc.get("config_snapshot", {}),
        "metrics": run_doc.get("metrics", {}),
        "error_summary": run_doc.get("error_summary"),
        "created_at": run_doc["created_at"].isoformat() if run_doc.get("created_at") else None,
        "completed_at": run_doc["completed_at"].isoformat() if run_doc.get("completed_at") else None,
    }
