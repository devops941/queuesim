from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.errors import AppError
from app.repositories.scenario_repository import ScenarioRepository
from app.schemas.scenario_schemas import ScenarioCreate, ScenarioUpdate, ScenarioConfig, PRESETS


def _serialize(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "workspace_id": doc["workspace_id"],
        "created_by": doc["created_by"],
        "name": doc["name"],
        "description": doc.get("description", ""),
        "service_type": doc.get("service_type", "custom"),
        "config": doc["config"],
        "status": doc["status"],
        "created_at": doc["created_at"].isoformat(),
        "updated_at": doc["updated_at"].isoformat(),
    }


class ScenarioService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.repo = ScenarioRepository(db)

    async def create(self, workspace_id: str, user_id: str, body: ScenarioCreate) -> dict:
        data = {
            "name": body.name,
            "description": body.description,
            "service_type": body.service_type,
            "config": body.config.model_dump(),
        }
        doc = await self.repo.create(workspace_id, user_id, data)
        return _serialize(doc)

    async def create_from_preset(self, workspace_id: str, user_id: str, preset_key: str, name: str) -> dict:
        config = PRESETS.get(preset_key)
        if not config:
            raise AppError("PRESET_NOT_FOUND", f"Preset '{preset_key}' not found", 404)
        body = ScenarioCreate(name=name, config=config, service_type=preset_key)
        return await self.create(workspace_id, user_id, body)

    async def list_scenarios(self, workspace_id: str, skip: int, limit: int, status: str | None) -> dict:
        docs, total = await self.repo.list_by_workspace(workspace_id, skip, limit, status)
        return {
            "data": [_serialize(d) for d in docs],
            "meta": {"total": total, "skip": skip, "limit": limit},
        }

    async def get(self, scenario_id: str, workspace_id: str) -> dict:
        doc = await self.repo.get_by_id(scenario_id, workspace_id)
        if not doc:
            raise AppError("NOT_FOUND", "Scenario not found", 404)
        return _serialize(doc)

    async def update(self, scenario_id: str, workspace_id: str, body: ScenarioUpdate) -> dict:
        doc = await self.repo.get_by_id(scenario_id, workspace_id)
        if not doc:
            raise AppError("NOT_FOUND", "Scenario not found", 404)
        if doc["status"] == "archived":
            raise AppError("CONFLICT", "Cannot edit an archived scenario", 409)

        updates = {}
        if body.name is not None:
            updates["name"] = body.name
        if body.description is not None:
            updates["description"] = body.description
        if body.service_type is not None:
            updates["service_type"] = body.service_type
        if body.config is not None:
            updates["config"] = body.config.model_dump()
            updates["status"] = "draft"

        updated = await self.repo.update(scenario_id, workspace_id, updates)
        return _serialize(updated)

    async def validate(self, scenario_id: str, workspace_id: str) -> dict:
        doc = await self.repo.get_by_id(scenario_id, workspace_id)
        if not doc:
            raise AppError("NOT_FOUND", "Scenario not found", 404)

        try:
            ScenarioConfig(**doc["config"])
        except Exception as exc:
            raise AppError("VALIDATION_FAILED", str(exc), 422)

        await self.repo.set_status(scenario_id, workspace_id, "ready")
        return {"status": "ready", "scenario_id": scenario_id, "message": "Scenario is valid and ready to run"}

    async def duplicate(self, scenario_id: str, workspace_id: str, new_name: str) -> dict:
        try:
            doc = await self.repo.duplicate(scenario_id, workspace_id, new_name)
        except ValueError:
            raise AppError("NOT_FOUND", "Scenario not found", 404)
        return _serialize(doc)

    async def archive(self, scenario_id: str, workspace_id: str) -> dict:
        doc = await self.repo.get_by_id(scenario_id, workspace_id)
        if not doc:
            raise AppError("NOT_FOUND", "Scenario not found", 404)
        await self.repo.set_status(scenario_id, workspace_id, "archived")
        return {"scenario_id": scenario_id, "status": "archived"}

    async def delete(self, scenario_id: str, workspace_id: str) -> dict:
        deleted = await self.repo.delete(scenario_id, workspace_id)
        if not deleted:
            raise AppError("NOT_FOUND", "Scenario not found", 404)
        return {"deleted": True, "scenario_id": scenario_id}

    async def list_presets(self) -> list[dict]:
        return [
            {"key": k, "name": k.replace("_", " ").title(), "config": v.model_dump()}
            for k, v in PRESETS.items()
        ]
