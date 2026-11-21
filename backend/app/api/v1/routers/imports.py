from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.services.import_service import ImportService

router = APIRouter(prefix="/imports", tags=["imports"])


@router.post("", status_code=status.HTTP_201_CREATED)
async def upload_csv(
    file: UploadFile = File(...),
    scenario_id: str = Form(default="unlinked"),
    workspace_id: str | None = Form(None),
    workspace_id_query: str | None = Query(None, alias="workspace_id"),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    ws_id = (
        workspace_id
        or workspace_id_query
        or (str(current_user["workspaces"][0]) if current_user.get("workspaces") else "000000000000000000000002")
    )
    file_bytes = await file.read()
    svc = ImportService(db)
    return await svc.process_csv_upload(
        workspace_id=ws_id,
        scenario_id=scenario_id,
        file_bytes=file_bytes,
        filename=file.filename or "upload.csv",
    )


@router.get("/{import_id}")
async def get_import(
    import_id: str,
    workspace_id: str | None = Query(None),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    ws_id = (
        workspace_id
        or (str(current_user["workspaces"][0]) if current_user.get("workspaces") else "000000000000000000000002")
    )
    svc = ImportService(db)
    return await svc.get_import(import_id, ws_id)


@router.get("")
async def list_imports(
    scenario_id: str = Query(...),
    workspace_id: str | None = Query(None),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    ws_id = (
        workspace_id
        or (str(current_user["workspaces"][0]) if current_user.get("workspaces") else "000000000000000000000002")
    )
    svc = ImportService(db)
    return {"data": await svc.list_imports(scenario_id, ws_id)}
