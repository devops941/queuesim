from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import FileResponse
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.schemas.report_schemas import ReportCreateRequest
from app.services.report_service import ReportService

router = APIRouter(tags=["reports"])


@router.post("/reports", status_code=status.HTTP_202_ACCEPTED)
async def create_report(
    body: ReportCreateRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    svc = ReportService(db)
    return await svc.generate_report(
        run_id=body.run_id,
        workspace_id=body.workspace_id,
        fmt=body.format,
    )


def _ws_id(workspace_id: str | None, current_user: dict) -> str:
    if workspace_id:
        return workspace_id
    if current_user.get("workspaces"):
        return str(current_user["workspaces"][0])
    return str(current_user.get("workspace_id") or "000000000000000000000002")


@router.get("/reports")
async def list_workspace_reports(
    workspace_id: str | None = Query(None),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    ws_id = _ws_id(workspace_id, current_user)
    from app.core.database import MEMORY_STORE
    try:
        cursor = db.reports.find({"workspace_id": ws_id}).sort("created_at", -1)
        docs = await cursor.to_list(length=100)
        if docs:
            from app.services.report_service import _serialize
            return [_serialize(d) for d in docs]
    except Exception:
        pass
    reports = list(MEMORY_STORE.get("reports", {}).values())
    filtered = [r for r in reports if r.get("workspace_id") == ws_id]
    from app.services.report_service import _serialize
    return [_serialize(d) for d in filtered]


@router.get("/reports/{report_id}")
async def get_report(
    report_id: str,
    workspace_id: str | None = Query(None),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    ws_id = _ws_id(workspace_id, current_user)
    svc = ReportService(db)
    return await svc.get_report(report_id, ws_id)


@router.get("/reports/{report_id}/download")
async def download_report(
    report_id: str,
    workspace_id: str | None = Query(None),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    ws_id = _ws_id(workspace_id, current_user)
    svc = ReportService(db)
    file_path = await svc.get_report_file_path(report_id, ws_id)

    # Determine media type and filename from extension
    if file_path.endswith(".pdf"):
        media_type = "application/pdf"
        filename = f"report_{report_id}.pdf"
    else:
        media_type = "text/csv"
        filename = f"report_{report_id}.csv"

    return FileResponse(
        path=file_path,
        media_type=media_type,
        filename=filename,
    )


@router.get("/runs/{run_id}/reports")
async def list_reports_for_run(
    run_id: str,
    workspace_id: str | None = Query(None),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    ws_id = _ws_id(workspace_id, current_user)
    svc = ReportService(db)
    reports = await svc.list_reports(run_id, ws_id)
    return {"data": reports}
